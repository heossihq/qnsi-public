/**
 * Durable host-agent report spool.
 *
 * A report is written and fsynced before any network submission. The file is
 * removed only after the platform acknowledges the exact SHA-256 body hash.
 * This provides at-least-once delivery across network loss and process restarts.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { AgentConfig } from "./config.js";
import { formatError, logger } from "./logger.js";
import type { ReportPayload } from "./reporter.js";
import { submitReportPayload } from "./reporter.js";

interface SpoolEnvelope {
	readonly version: 1;
	readonly payloadHash: string;
	readonly payload: ReportPayload;
}

export interface SpoolFlushResult {
	readonly pendingBefore: number;
	readonly accepted: number;
	readonly remaining: number;
}

function reportBody(payload: ReportPayload): Buffer {
	return Buffer.from(JSON.stringify(payload), "utf8");
}

export function reportBodyHash(payload: ReportPayload): string {
	return crypto.createHash("sha256").update(reportBody(payload)).digest("hex");
}

function spoolDirectory(stateDir: string): string {
	return path.join(stateDir, "report-spool");
}

async function ensureSpoolDirectory(stateDir: string): Promise<string> {
	const directory = spoolDirectory(stateDir);
	await fs.mkdir(directory, { recursive: true, mode: 0o700 });
	await fs.chmod(directory, 0o700);
	return directory;
}

function assertEnvelope(value: unknown): asserts value is SpoolEnvelope {
	if (!value || typeof value !== "object") throw new Error("Spool envelope is not an object");
	const envelope = value as Partial<SpoolEnvelope>;
	if (envelope.version !== 1) throw new Error("Unsupported spool envelope version");
	if (!/^[0-9a-f]{64}$/.test(envelope.payloadHash ?? "")) {
		throw new Error("Spool envelope payload hash is invalid");
	}
	const payload = envelope.payload as Partial<ReportPayload> | undefined;
	if (
		!payload ||
		typeof payload.agentId !== "string" ||
		typeof payload.hostname !== "string" ||
		typeof payload.reportedAt !== "string" ||
		!Array.isArray(payload.assets)
	) {
		throw new Error("Spool envelope payload is invalid");
	}
	if (reportBodyHash(payload as ReportPayload) !== envelope.payloadHash) {
		throw new Error("Spool envelope integrity check failed");
	}
}

/** Write a report atomically before attempting delivery. */
export async function enqueueReport(stateDir: string, payload: ReportPayload): Promise<string> {
	const directory = await ensureSpoolDirectory(stateDir);
	const sortableTimestamp = payload.reportedAt.replace(/[^0-9]/g, "");
	const filename = `${sortableTimestamp}-${crypto.randomUUID()}.json`;
	const destination = path.join(directory, filename);
	const stagingPath = `${destination}.pending-write`;
	const envelope: SpoolEnvelope = {
		version: 1,
		payloadHash: reportBodyHash(payload),
		payload,
	};

	const handle = await fs.open(stagingPath, "wx", 0o600);
	let writeCompleted = false;
	try {
		await handle.writeFile(JSON.stringify(envelope), "utf8");
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

export async function listQueuedReports(stateDir: string): Promise<string[]> {
	const directory = await ensureSpoolDirectory(stateDir);
	const initialEntries = await fs.readdir(directory, { withFileTypes: true });
	for (const entry of initialEntries) {
		if (!entry.isFile() || !entry.name.endsWith(".pending-write")) continue;
		const stagedPath = path.join(directory, entry.name);
		const raw = await fs.readFile(stagedPath, "utf8");
		const parsed: unknown = JSON.parse(raw);
		assertEnvelope(parsed);
		await fs.rename(stagedPath, stagedPath.slice(0, -".pending-write".length));
	}
	const entries = await fs.readdir(directory, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
		.map((entry) => path.join(directory, entry.name))
		.sort((a, b) => a.localeCompare(b));
}

async function readQueuedReport(file: string): Promise<SpoolEnvelope> {
	const raw = await fs.readFile(file, "utf8");
	const parsed: unknown = JSON.parse(raw);
	assertEnvelope(parsed);
	return parsed;
}

/**
 * Replay queued reports in order. Processing stops at the first failure to
 * preserve ordering. The failed and later files remain durable for the next run.
 */
export async function flushQueuedReports(config: AgentConfig): Promise<SpoolFlushResult> {
	const files = await listQueuedReports(config.stateDir);
	let accepted = 0;

	for (const file of files) {
		const envelope = await readQueuedReport(file);
		if (envelope.payload.agentId !== config.agentId) {
			throw new Error(`Queued report belongs to a different agent: ${path.basename(file)}`);
		}

		try {
			const result = await submitReportPayload(config, envelope.payload);
			if (!result.accepted || result.bodyHash.toLowerCase() !== envelope.payloadHash) {
				throw new Error("Platform acknowledgement did not match the queued report body hash");
			}
			await fs.unlink(file);
			accepted += 1;
		} catch (error) {
			logger.warn("Queued report delivery deferred", {
				file: path.basename(file),
				error: formatError(error),
			});
			break;
		}
	}

	const remaining = (await listQueuedReports(config.stateDir)).length;
	return { pendingBefore: files.length, accepted, remaining };
}
