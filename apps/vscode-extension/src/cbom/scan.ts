import * as vscode from "vscode";
import { withClient } from "../client";
import { getScanExclude, getScanInclude, getScanMaxFiles } from "../config";
import { log, logError } from "../output";
import { buildCycloneDxCbom } from "./cyclonedx";
import { type CryptoFinding, compareUrgency, detectInText } from "./detector";

export interface ReadinessSummary {
	readonly score: number | null;
	readonly detail: string;
}

export type UrgencyCounts = {
	critical: number;
	high: number;
	medium: number;
	low: number;
	total: number;
};

function severityFor(f: CryptoFinding): vscode.DiagnosticSeverity {
	switch (f.urgency) {
		case "critical":
		case "high":
			return vscode.DiagnosticSeverity.Warning;
		case "medium":
			return vscode.DiagnosticSeverity.Information;
		default:
			return vscode.DiagnosticSeverity.Hint;
	}
}

function toDiagnostic(f: CryptoFinding): vscode.Diagnostic {
	const range = new vscode.Range(f.line, f.startChar, f.line, f.endChar);
	const diag = new vscode.Diagnostic(
		range,
		`${f.algorithm}: quantum-vulnerable (${f.urgency}). ${f.reason} Recommended: ${f.recommend}.`,
		severityFor(f),
	);
	diag.source = "QNSI";
	diag.code = f.algorithm;
	return diag;
}

async function readText(uri: vscode.Uri): Promise<string | null> {
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		if (bytes.byteLength > 1_000_000) {
			return null; // skip very large files
		}
		const sample = bytes.subarray(0, 8000);
		if (sample.includes(0)) {
			return null; // binary
		}
		return Buffer.from(bytes).toString("utf8");
	} catch {
		return null;
	}
}

export class CbomController {
	private readonly diagnostics = vscode.languages.createDiagnosticCollection("qnsi");
	/** fsPath → findings (only files with ≥1 finding are kept). */
	readonly results = new Map<string, CryptoFinding[]>();
	readiness: ReadinessSummary | null = null;
	private readonly changeEmitter = new vscode.EventEmitter<void>();
	readonly onDidChange = this.changeEmitter.event;

	constructor(private readonly context: vscode.ExtensionContext) {}

	counts(): UrgencyCounts {
		const c: UrgencyCounts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
		for (const findings of this.results.values()) {
			for (const f of findings) {
				c[f.urgency] += 1;
				c.total += 1;
			}
		}
		return c;
	}

	/** Re-scan a single open document (on save / on open). */
	scanDocument(doc: vscode.TextDocument): void {
		if (doc.uri.scheme !== "file") {
			return;
		}
		const findings = detectInText(doc.getText());
		if (findings.length === 0) {
			this.diagnostics.delete(doc.uri);
			this.results.delete(doc.uri.fsPath);
		} else {
			this.diagnostics.set(doc.uri, findings.map(toDiagnostic));
			this.results.set(
				doc.uri.fsPath,
				findings.sort((a, b) => compareUrgency(a.urgency, b.urgency)),
			);
		}
		this.changeEmitter.fire();
	}

	/** Full workspace scan: detect locally, set diagnostics, then fetch backend PQC readiness. */
	async scanWorkspace(): Promise<void> {
		const include = getScanInclude();
		const exclude = getScanExclude();
		if (include.length === 0) {
			void vscode.window.showWarningMessage("QNSI: no scan include globs configured.");
			return;
		}
		const includeGlob = include.length === 1 ? include[0] : `{${include.join(",")}}`;
		const excludeGlob = exclude.length > 0 ? `{${exclude.join(",")}}` : null;

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "QNSI: scanning for quantum-vulnerable crypto…",
				cancellable: true,
			},
			async (progress, token) => {
				const uris = await vscode.workspace.findFiles(
					includeGlob as string,
					excludeGlob,
					getScanMaxFiles(),
				);
				this.diagnostics.clear();
				this.results.clear();

				let scanned = 0;
				for (const uri of uris) {
					if (token.isCancellationRequested) {
						break;
					}
					const text = await readText(uri);
					scanned += 1;
					if (text === null) {
						continue;
					}
					const findings = detectInText(text);
					if (findings.length > 0) {
						this.diagnostics.set(uri, findings.map(toDiagnostic));
						this.results.set(
							uri.fsPath,
							findings.sort((a, b) => compareUrgency(a.urgency, b.urgency)),
						);
					}
					if (scanned % 50 === 0) {
						progress.report({ message: `${scanned}/${uris.length} files…` });
					}
				}
				log(
					`workspace scan: ${scanned} files, ${this.counts().total} findings in ${this.results.size} files`,
				);
			},
		);

		await this.refreshReadiness();
		this.changeEmitter.fire();

		const c = this.counts();
		if (c.total === 0) {
			void vscode.window.showInformationMessage(
				"QNSI: no quantum-vulnerable cryptography found. 🎉",
			);
		} else {
			void vscode.window.showWarningMessage(
				`QNSI: ${c.total} finding(s) - ${c.critical} critical, ${c.high} high, ${c.medium} medium. See the QNSI: Crypto Inventory view and Problems panel.`,
			);
		}
	}

	/** Pull the tenant's PQC readiness score from the crypto-inventory service (best-effort). */
	async refreshReadiness(): Promise<void> {
		const summary = await withClient(
			this.context,
			async (client): Promise<ReadinessSummary | null> => {
				try {
					const tenantId = await client.tenantId();
					const raw = (await client.cryptoInventory.getReadinessScore(tenantId)) as Record<
						string,
						unknown
					>;
					const score = pickNumber(raw, ["score", "readinessScore", "overallScore"]);
					const detail = pickString(raw, ["status", "label", "summary"]) ?? "Readiness retrieved";
					return { score, detail };
				} catch (err) {
					logError("readiness fetch", err);
					return null;
				}
			},
		);
		if (summary !== undefined) {
			this.readiness = summary;
		}
	}

	async exportCbom(): Promise<void> {
		if (this.results.size === 0) {
			void vscode.window.showInformationMessage(
				"QNSI: run a workspace scan first - nothing to export.",
			);
			return;
		}
		const json = buildCycloneDxCbom(this.results, new Date().toISOString());
		const doc = await vscode.workspace.openTextDocument({ language: "json", content: json });
		await vscode.window.showTextDocument(doc);
	}

	clear(): void {
		this.diagnostics.clear();
		this.results.clear();
		this.readiness = null;
		this.changeEmitter.fire();
	}

	dispose(): void {
		this.diagnostics.dispose();
		this.changeEmitter.dispose();
	}
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
	for (const k of keys) {
		const v = obj[k];
		if (typeof v === "number" && Number.isFinite(v)) {
			return v;
		}
	}
	return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
	for (const k of keys) {
		const v = obj[k];
		if (typeof v === "string" && v.length > 0) {
			return v;
		}
	}
	return null;
}
