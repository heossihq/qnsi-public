import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { ScannedAsset } from "./scanner.js";

export interface ScanDirectoryCursor {
	readonly directory: string;
	readonly depth: number;
	readonly lastEntryName: string | null;
}

export interface ScanCheckpoint {
	readonly version: 1;
	readonly scanId: string;
	readonly scopeHash: string;
	readonly hostname: string;
	readonly scanPaths: string[];
	readonly startedAt: string;
	readonly updatedAt: string;
	readonly nextPathIndex: number;
	readonly directoryStack: ScanDirectoryCursor[];
	readonly filesScanned: number;
	readonly directoriesScanned: number;
	readonly assetsFound: number;
	readonly batchSequence: number;
	readonly pendingReportedAt: string | null;
	readonly pendingAssets: ScannedAsset[];
}

export interface ScanCheckpointSummary {
	readonly scanId: string;
	readonly hostname: string;
	readonly startedAt: string;
	readonly updatedAt: string;
	readonly filesScanned: number;
	readonly directoriesScanned: number;
	readonly assetsFound: number;
	readonly batchesCommitted: number;
	readonly pendingAssetCount: number;
	readonly currentDirectory: string | null;
}

export function scanScopeHash(scanPaths: readonly string[], hostname: string): string {
	return crypto
		.createHash("sha256")
		.update(JSON.stringify({ hostname, scanPaths: scanPaths.map((item) => path.resolve(item)) }))
		.digest("hex");
}

function checkpointDirectory(stateDir: string): string {
	return path.join(stateDir, "scan-checkpoints");
}

export function checkpointPath(stateDir: string, scopeHash: string): string {
	return path.join(checkpointDirectory(stateDir), `${scopeHash}.json`);
}

function assertCheckpoint(
	value: unknown,
	expectedScopeHash: string,
): asserts value is ScanCheckpoint {
	if (!value || typeof value !== "object") throw new Error("Scan checkpoint is not an object");
	const checkpoint = value as Partial<ScanCheckpoint>;
	if (checkpoint.version !== 1) throw new Error("Unsupported scan checkpoint version");
	if (checkpoint.scopeHash !== expectedScopeHash) throw new Error("Scan checkpoint scope mismatch");
	if (
		typeof checkpoint.scanId !== "string" ||
		typeof checkpoint.hostname !== "string" ||
		!Array.isArray(checkpoint.scanPaths) ||
		!Array.isArray(checkpoint.directoryStack) ||
		!Array.isArray(checkpoint.pendingAssets) ||
		typeof checkpoint.nextPathIndex !== "number" ||
		typeof checkpoint.filesScanned !== "number" ||
		typeof checkpoint.directoriesScanned !== "number" ||
		typeof checkpoint.assetsFound !== "number" ||
		typeof checkpoint.batchSequence !== "number"
	) {
		throw new Error("Scan checkpoint is invalid");
	}
	if (scanScopeHash(checkpoint.scanPaths, checkpoint.hostname) !== expectedScopeHash) {
		throw new Error("Scan checkpoint content does not match its scope hash");
	}
	for (const count of [
		checkpoint.nextPathIndex,
		checkpoint.filesScanned,
		checkpoint.directoriesScanned,
		checkpoint.assetsFound,
		checkpoint.batchSequence,
	]) {
		if (!Number.isSafeInteger(count) || count < 0)
			throw new Error("Scan checkpoint count is invalid");
	}
	if (checkpoint.nextPathIndex > checkpoint.scanPaths.length) {
		throw new Error("Scan checkpoint path cursor is invalid");
	}
	for (const frame of checkpoint.directoryStack) {
		if (
			!frame ||
			typeof frame.directory !== "string" ||
			!Number.isSafeInteger(frame.depth) ||
			frame.depth < 0 ||
			(frame.lastEntryName !== null && typeof frame.lastEntryName !== "string")
		) {
			throw new Error("Scan checkpoint directory cursor is invalid");
		}
	}
}

async function ensureCheckpointDirectory(stateDir: string): Promise<string> {
	const directory = checkpointDirectory(stateDir);
	await fs.mkdir(directory, { recursive: true, mode: 0o700 });
	await fs.chmod(directory, 0o700);
	return directory;
}

export async function loadScanCheckpoint(
	stateDir: string,
	scanPaths: readonly string[],
	hostname: string,
): Promise<ScanCheckpoint> {
	const normalizedPaths = scanPaths.map((item) => path.resolve(item));
	const scopeHash = scanScopeHash(normalizedPaths, hostname);
	const file = checkpointPath(stateDir, scopeHash);
	await ensureCheckpointDirectory(stateDir);

	try {
		const parsed: unknown = JSON.parse(await fs.readFile(file, "utf8"));
		assertCheckpoint(parsed, scopeHash);
		return parsed;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}

	const now = new Date().toISOString();
	return {
		version: 1,
		scanId: crypto.randomUUID(),
		scopeHash,
		hostname,
		scanPaths: normalizedPaths,
		startedAt: now,
		updatedAt: now,
		nextPathIndex: 0,
		directoryStack: [],
		filesScanned: 0,
		directoriesScanned: 0,
		assetsFound: 0,
		batchSequence: 0,
		pendingReportedAt: null,
		pendingAssets: [],
	};
}

export async function saveScanCheckpoint(
	stateDir: string,
	checkpoint: ScanCheckpoint,
): Promise<void> {
	const directory = await ensureCheckpointDirectory(stateDir);
	const destination = checkpointPath(stateDir, checkpoint.scopeHash);
	const stagingPath = `${destination}.pending-write`;
	const handle = await fs.open(stagingPath, "w", 0o600);
	try {
		await handle.writeFile(JSON.stringify(checkpoint), "utf8");
		await handle.sync();
	} finally {
		await handle.close();
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
}

export async function removeScanCheckpoint(stateDir: string, scopeHash: string): Promise<void> {
	const file = checkpointPath(stateDir, scopeHash);
	await fs.unlink(file).catch((error: NodeJS.ErrnoException) => {
		if (error.code !== "ENOENT") throw error;
	});
}

export async function listScanCheckpointSummaries(
	stateDir: string,
): Promise<ScanCheckpointSummary[]> {
	const directory = await ensureCheckpointDirectory(stateDir);
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const summaries: ScanCheckpointSummary[] = [];
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
		const parsed: unknown = JSON.parse(await fs.readFile(path.join(directory, entry.name), "utf8"));
		const expectedScopeHash = entry.name.slice(0, -".json".length);
		assertCheckpoint(parsed, expectedScopeHash);
		const current = parsed.directoryStack[parsed.directoryStack.length - 1];
		summaries.push({
			scanId: parsed.scanId,
			hostname: parsed.hostname,
			startedAt: parsed.startedAt,
			updatedAt: parsed.updatedAt,
			filesScanned: parsed.filesScanned,
			directoriesScanned: parsed.directoriesScanned,
			assetsFound: parsed.assetsFound,
			batchesCommitted: parsed.batchSequence,
			pendingAssetCount: parsed.pendingAssets.length,
			currentDirectory: current?.directory ?? null,
		});
	}
	return summaries.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
