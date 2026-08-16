import * as crypto from "node:crypto";
import type { Dirent, Stats } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { AgentConfig } from "./config.js";
import { deriveHmacKey, type ReportPayload } from "./reporter.js";

const SIGNATURE_DOMAIN = "QNSI-HOST-SCAN-BUNDLE-V1";
const BUNDLE_SUFFIX = ".qnsi-scan.json";

export interface OfflineReportBundle {
	readonly version: 1;
	readonly bundleId: string;
	readonly tenantId: string;
	readonly agentId: string;
	readonly createdAt: string;
	readonly payloadHash: string;
	readonly payload: ReportPayload;
	readonly signature: {
		readonly algorithm: "HMAC-SHA256";
		readonly value: string;
	};
}

export function offlineBundleSigningMessage(
	bundle: Pick<
		OfflineReportBundle,
		"bundleId" | "tenantId" | "agentId" | "createdAt" | "payloadHash"
	>,
): string {
	return [
		SIGNATURE_DOMAIN,
		bundle.bundleId,
		bundle.tenantId,
		bundle.agentId,
		bundle.createdAt,
		bundle.payloadHash,
	].join(".");
}

export function offlinePayloadHash(payload: ReportPayload): string {
	return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function createOfflineReportBundle(
	config: AgentConfig,
	payload: ReportPayload,
): OfflineReportBundle {
	if (payload.agentId !== config.agentId) throw new Error("Offline payload agent mismatch");
	const unsigned = {
		bundleId: crypto.randomUUID(),
		tenantId: config.tenantId,
		agentId: config.agentId,
		createdAt: new Date().toISOString(),
		payloadHash: offlinePayloadHash(payload),
	};
	const value = crypto
		.createHmac("sha256", deriveHmacKey(config.agentSecret))
		.update(offlineBundleSigningMessage(unsigned))
		.digest("hex");
	return {
		version: 1,
		...unsigned,
		payload,
		signature: { algorithm: "HMAC-SHA256", value },
	};
}

export function assertOfflineReportBundle(value: unknown): asserts value is OfflineReportBundle {
	if (!value || typeof value !== "object") throw new Error("Offline bundle is not an object");
	const bundle = value as Partial<OfflineReportBundle>;
	if (
		bundle.version !== 1 ||
		!bundle.bundleId ||
		!bundle.tenantId ||
		!bundle.agentId ||
		!bundle.createdAt ||
		!bundle.payload ||
		!bundle.payloadHash ||
		bundle.signature?.algorithm !== "HMAC-SHA256" ||
		!/^[0-9a-f]{64}$/.test(bundle.signature.value)
	) {
		throw new Error("Offline bundle structure is invalid");
	}
	if (bundle.payload.agentId !== bundle.agentId) throw new Error("Offline bundle agent mismatch");
	if (offlinePayloadHash(bundle.payload) !== bundle.payloadHash) {
		throw new Error("Offline bundle payload integrity check failed");
	}
}

export async function writeOfflineReportBundle(
	directory: string,
	bundle: OfflineReportBundle,
): Promise<string> {
	await fs.mkdir(directory, { recursive: true, mode: 0o700 });
	await fs.chmod(directory, 0o700);
	const sortableTimestamp = bundle.createdAt.replace(/[^0-9]/g, "");
	const destination = path.join(
		directory,
		`${sortableTimestamp}-${bundle.bundleId}${BUNDLE_SUFFIX}`,
	);
	const stagingPath = `${destination}.pending-write`;
	const handle = await fs.open(stagingPath, "wx", 0o600);
	let writeCompleted = false;
	try {
		await handle.writeFile(JSON.stringify(bundle), "utf8");
		await handle.sync();
		writeCompleted = true;
	} finally {
		await handle.close();
		if (!writeCompleted) await fs.unlink(stagingPath).catch(() => undefined);
	}
	await fs.rename(stagingPath, destination);
	await fs.chmod(destination, 0o600);
	if (process.platform !== "win32") {
		const directoryHandle = await fs.open(directory, "r");
		try {
			await directoryHandle.sync();
		} finally {
			await directoryHandle.close();
		}
	}
	return destination;
}

export async function readOfflineReportBundle(file: string): Promise<OfflineReportBundle> {
	const parsed: unknown = JSON.parse(await fs.readFile(file, "utf8"));
	assertOfflineReportBundle(parsed);
	return parsed;
}

export async function listOfflineReportBundles(
	inputPath: string,
	statPath: (path: string) => Promise<Pick<Stats, "isFile" | "isDirectory">> = fs.stat,
	readDirectory: (path: string, options: { withFileTypes: true }) => Promise<Dirent[]> = fs.readdir,
): Promise<string[]> {
	const stat = await statPath(inputPath);
	if (stat.isFile()) return [inputPath];
	if (!stat.isDirectory()) throw new Error("Offline bundle input must be a file or directory");
	const entries = await readDirectory(inputPath, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(BUNDLE_SUFFIX))
		.map((entry) => path.join(inputPath, entry.name))
		.sort((a, b) => a.localeCompare(b));
}

export async function submitOfflineReportBundle(
	endpoint: string,
	bundle: OfflineReportBundle,
): Promise<{ accepted: boolean; bundleId: string; payloadHash: string }> {
	const url = `${endpoint.replace(/\/$/, "")}/proxy/crypto/v1/agent-report-bundles`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json", "x-qnsp-tenant": bundle.tenantId },
		body: JSON.stringify(bundle),
		signal: AbortSignal.timeout(30_000),
	});
	if (response.status !== 202) {
		throw new Error(
			`Offline bundle import rejected (${response.status}): ${await response.text()}`,
		);
	}
	return (await response.json()) as { accepted: boolean; bundleId: string; payloadHash: string };
}
