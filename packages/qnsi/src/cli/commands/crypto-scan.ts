/**
 * `qnsi crypto scan` - source-code cryptography scanning.
 *
 * Runs the @heossihq/qnsi/code-scan engine locally (parse-only, zero network in
 * scan mode) and prints findings as a table, JSON, or a CycloneDX 1.5 CBOM.
 * With --upload, submits a findings-only report (never source code) to
 * POST /proxy/crypto/v1/code-scan-reports using the same HMAC agent protocol
 * as the qnsp host agent. Design: docs/design/code-crypto-scanner.md.
 */

import { createHash, createHmac, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import type { Command } from "commander";

import cliPackage from "../../../package.json" with { type: "json" };
import type { CodeCryptoFinding, ScanSummary } from "../../code-scan/index.js";
import { RULE_SET_VERSION, scanDirectory } from "../../code-scan/index.js";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { printError, printJson, printSuccess, printTable } from "../utils/output.js";

const UPLOAD_TIMEOUT_MS = 30_000;
/** Server-side cap on findings per report (route schema). */
const MAX_UPLOAD_FINDINGS = 10_000;

/**
 * Derive the HMAC key from the agent bootstrap secret: SHA-256 over the
 * DECODED bytes of the hex secret. Matches agent-auth.ts / qnsp-agent.
 */
function deriveHmacKey(secret: string): Buffer {
	return createHash("sha256").update(Buffer.from(secret, "hex")).digest();
}

function signReport(agentId: string, secret: string, rawBody: Buffer): Record<string, string> {
	const timestamp = new Date().toISOString();
	const nonce = randomBytes(16).toString("hex");
	const bodyHash = createHash("sha256").update(rawBody).digest("hex");
	const signature = createHmac("sha256", deriveHmacKey(secret))
		.update(`${timestamp}.${nonce}.${bodyHash}`)
		.digest("hex");

	return {
		"x-agent-id": agentId,
		"x-agent-timestamp": timestamp,
		"x-agent-nonce": nonce,
		"x-agent-body-hash": bodyHash,
		"x-agent-signature": signature,
	};
}

/**
 * Wire shape for one finding - matches codeScanReportSchema exactly. The
 * engine's `classification` field is intentionally NOT sent: the server
 * derives isPqc/isHybrid from the canonical algorithm id and the strict
 * schema rejects unknown keys.
 */
function toWireFinding(finding: CodeCryptoFinding): Record<string, unknown> {
	return {
		path: finding.path,
		line: finding.line,
		language: finding.language,
		library: finding.library,
		ruleId: finding.ruleId,
		algorithm: finding.algorithm,
		category: finding.category,
		confidence: finding.confidence,
		lineHash: finding.lineHash,
		...(finding.keySize !== undefined ? { keySize: finding.keySize } : {}),
		...(finding.testContext !== undefined ? { testContext: finding.testContext } : {}),
	};
}

/** Minimal CycloneDX 1.5 CBOM built locally from scan findings. */
function buildLocalCbom(summary: ScanSummary, scannedPath: string): Record<string, unknown> {
	const byAlgorithm = new Map<string, { count: number; classification: string }>();
	for (const finding of summary.findings) {
		const entry = byAlgorithm.get(finding.algorithm);
		if (entry) {
			entry.count += 1;
		} else {
			byAlgorithm.set(finding.algorithm, {
				count: 1,
				classification: finding.classification,
			});
		}
	}

	return {
		bomFormat: "CycloneDX",
		specVersion: "1.5",
		metadata: {
			timestamp: new Date().toISOString(),
			tools: [{ name: "qnsi crypto scan", version: cliPackage.version }],
			component: { type: "application", name: scannedPath },
		},
		components: Array.from(byAlgorithm.entries()).map(([algorithm, info]) => ({
			type: "crypto-asset",
			name: algorithm,
			postureClass: info.classification,
			occurrences: info.count,
			cryptoProperties: { assetType: "algorithm" },
		})),
		summary: {
			filesScanned: summary.filesScanned,
			filesSkipped: summary.filesSkipped,
			totalFindings: summary.findings.length,
			classical: summary.findings.filter((f) => f.classification === "classical").length,
			pqc: summary.findings.filter((f) => f.classification === "pqc").length,
			hybrid: summary.findings.filter((f) => f.classification === "hybrid").length,
			truncated: summary.truncated,
		},
	};
}

interface CryptoScanOptions {
	readonly format?: "table" | "json" | "cbom";
	readonly output?: string;
	readonly exclude?: string;
	readonly maxFindings?: string;
	readonly upload?: boolean;
	readonly repoId?: string;
	readonly repoName?: string;
	readonly ref?: string;
	readonly commit?: string;
	readonly agentId?: string;
	readonly agentSecret?: string;
}

async function uploadReport(
	config: CliConfig,
	options: CryptoScanOptions,
	summary: ScanSummary,
	scannedPath: string,
): Promise<boolean> {
	const agentId = options.agentId ?? process.env["QNSI_AGENT_ID"];
	const agentSecret = options.agentSecret ?? process.env["QNSI_AGENT_SECRET"];
	const tenantId = config.tenantId;
	const edgeGatewayUrl = config.edgeGatewayUrl;

	if (!agentId || !agentSecret) {
		printError(
			"--upload requires agent credentials (--agent-id/--agent-secret or QNSI_AGENT_ID/QNSI_AGENT_SECRET). Register a scanner agent under Crypto Posture → Agents.",
		);
		return false;
	}
	if (!tenantId) {
		printError("--upload requires QNSI_TENANT_ID");
		return false;
	}
	if (!edgeGatewayUrl) {
		printError("--upload requires QNSI_EDGE_GATEWAY_URL");
		return false;
	}
	if (!options.repoId) {
		printError("--upload requires --repo-id (stable identifier used to dedupe rescans)");
		return false;
	}
	if (summary.findings.length > MAX_UPLOAD_FINDINGS) {
		printError(
			`Scan produced ${summary.findings.length} findings; the ingest cap is ${MAX_UPLOAD_FINDINGS}. Narrow the scan with --exclude.`,
		);
		return false;
	}

	const report = {
		agentId,
		repo: {
			id: options.repoId,
			name: options.repoName ?? basename(scannedPath),
			...(options.ref ? { ref: options.ref } : {}),
			...(options.commit ? { commitSha: options.commit } : {}),
		},
		scannedAt: new Date().toISOString(),
		scannerVersion: cliPackage.version,
		ruleSetVersion: RULE_SET_VERSION,
		findings: summary.findings.map(toWireFinding),
	};

	const rawBody = Buffer.from(JSON.stringify(report), "utf8");
	const url = `${edgeGatewayUrl.replace(/\/$/, "")}/proxy/crypto/v1/code-scan-reports`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-qnsp-tenant": tenantId,
			...signReport(agentId, agentSecret, rawBody),
		},
		body: rawBody,
		signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
	});

	if (response.status !== 202) {
		const errorText = await response.text();
		printError(`Upload failed: ${response.status} ${errorText}`);
		return false;
	}

	const accepted = (await response.json()) as { findingCount?: number; bodyHash?: string };
	printSuccess(
		`Uploaded ${accepted.findingCount ?? summary.findings.length} findings (bodyHash ${accepted.bodyHash ?? "n/a"}). They enter the CBOM on the next discovery run of the code_repo source.`,
	);
	return true;
}

export function registerCryptoScanCommands(program: Command, config: CliConfig): void {
	const crypto = program
		.command("crypto")
		.description("Cryptographic inventory commands (source-code scanning)");

	crypto
		.command("scan [directory]")
		.description(
			"Scan source code for classical/PQC cryptography usage (local, parse-only; code never leaves this machine)",
		)
		.option("--format <format>", "Output format: table | json | cbom", "table")
		.option("--output <file>", "Write output to a file instead of stdout")
		.option("--exclude <dirs>", "Comma-separated extra directory names to skip")
		.option("--max-findings <n>", "Stop after N findings (reported as truncated)")
		.option("--upload", "Upload findings to the QNSI crypto inventory (requires agent credentials)")
		.option("--repo-id <id>", "Stable repository id for upload dedup (required with --upload)")
		.option("--repo-name <name>", "Repository display name (default: directory basename)")
		.option("--ref <ref>", "Git ref being scanned (upload metadata)")
		.option("--commit <sha>", "Git commit SHA being scanned (upload metadata)")
		.option("--agent-id <id>", "Scanner agent id (or QNSI_AGENT_ID)")
		.option("--agent-secret <secret>", "Scanner agent secret (or QNSI_AGENT_SECRET)")
		.action(async (directory: string | undefined, options: CryptoScanOptions) => {
			const scannedPath = resolve(directory ?? ".");

			let summary: ScanSummary;
			try {
				summary = await scanDirectory({
					rootDir: scannedPath,
					...(options.exclude
						? { excludeDirs: options.exclude.split(",").map((d) => d.trim()) }
						: {}),
					...(options.maxFindings ? { maxFindings: Number.parseInt(options.maxFindings, 10) } : {}),
				});
			} catch (err) {
				printError(`Scan failed: ${err instanceof Error ? err.message : String(err)}`);
				process.exit(EXIT_CODES.GENERAL_ERROR);
				return;
			}

			if (summary.truncated) {
				printError(
					`Warning: finding cap reached - results are TRUNCATED (${summary.findings.length} findings).`,
				);
			}

			// commander supplies the "table" default, so no fallback arm is reachable.
			const format = options.format;
			if (format === "cbom") {
				const cbom = buildLocalCbom(summary, scannedPath);
				if (options.output) {
					await writeFile(options.output, `${JSON.stringify(cbom, null, "\t")}\n`, "utf8");
					printSuccess(`CBOM written to ${options.output}`);
				} else {
					printJson(cbom);
				}
			} else if (format === "json") {
				const payload = {
					scannedPath,
					filesScanned: summary.filesScanned,
					filesSkipped: summary.filesSkipped,
					truncated: summary.truncated,
					findings: summary.findings,
				};
				if (options.output) {
					await writeFile(options.output, `${JSON.stringify(payload, null, "\t")}\n`, "utf8");
					printSuccess(`Findings written to ${options.output}`);
				} else {
					printJson(payload);
				}
			} else {
				printTable(
					summary.findings.map((f) => ({
						path: `${f.path}:${f.line}`,
						algorithm: f.algorithm,
						class: f.classification,
						confidence: f.confidence,
						rule: f.ruleId,
					})),
				);
				printSuccess(
					`${summary.findings.length} findings in ${summary.filesScanned} files (${summary.filesSkipped} skipped)`,
				);
			}

			if (options.upload) {
				const ok = await uploadReport(config, options, summary, scannedPath);
				if (!ok) {
					process.exit(EXIT_CODES.INVALID_ARGUMENTS);
					return;
				}
			}
		});
}
