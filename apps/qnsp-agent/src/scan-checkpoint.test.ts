import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	checkpointPath,
	listScanCheckpointSummaries,
	loadScanCheckpoint,
	removeScanCheckpoint,
	type ScanCheckpoint,
	saveScanCheckpoint,
	scanScopeHash,
} from "./scan-checkpoint.js";

let stateDir: string;
const hostname = "checkpoint-host";
const scanPaths = ["/var/certificates"];

function validCheckpoint(overrides: Partial<ScanCheckpoint> = {}): ScanCheckpoint {
	const scopeHash = scanScopeHash(scanPaths, hostname);
	return {
		version: 1,
		scanId: "00000000-0000-4000-8000-000000000001",
		scopeHash,
		hostname,
		scanPaths: scanPaths.map((item) => path.resolve(item)),
		startedAt: "2026-08-14T00:00:00.000Z",
		updatedAt: "2026-08-14T00:01:00.000Z",
		nextPathIndex: 0,
		directoryStack: [],
		filesScanned: 0,
		directoriesScanned: 0,
		assetsFound: 0,
		batchSequence: 0,
		pendingReportedAt: null,
		pendingAssets: [],
		...overrides,
	};
}

async function writeRaw(value: unknown): Promise<void> {
	const scopeHash = scanScopeHash(scanPaths, hostname);
	const file = checkpointPath(stateDir, scopeHash);
	await fs.mkdir(path.dirname(file), { recursive: true });
	await fs.writeFile(file, JSON.stringify(value), "utf8");
}

beforeEach(async () => {
	stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "qnsi-checkpoint-"));
});

afterEach(async () => {
	await fs.rm(stateDir, { recursive: true, force: true });
});

describe("scan checkpoints", () => {
	it("creates a new empty checkpoint when no durable state exists", async () => {
		const checkpoint = await loadScanCheckpoint(stateDir, scanPaths, hostname);

		expect(checkpoint).toMatchObject({
			version: 1,
			hostname,
			nextPathIndex: 0,
			filesScanned: 0,
		});
		expect(checkpoint.scanPaths).toEqual(scanPaths.map((item) => path.resolve(item)));
		expect(checkpoint.scopeHash).toBe(scanScopeHash(scanPaths, hostname));
	});

	it("round-trips and summarizes active checkpoints in chronological order", async () => {
		const later = validCheckpoint({
			scanId: "later",
			startedAt: "2026-08-14T02:00:00.000Z",
			directoryStack: [{ directory: "/later", depth: 1, lastEntryName: "b.pem" }],
			filesScanned: 4,
			directoriesScanned: 2,
			assetsFound: 3,
			batchSequence: 2,
			pendingAssets: [{ type: "certificate", path: "/later/b.pem", algorithm: "RSA" }],
		});
		const earlierPaths = ["/etc/ssl"];
		const earlier = {
			...validCheckpoint({
				scanId: "earlier",
				startedAt: "2026-08-14T01:00:00.000Z",
			}),
			scanPaths: earlierPaths,
			scopeHash: scanScopeHash(earlierPaths, hostname),
		};
		await saveScanCheckpoint(stateDir, later);
		await saveScanCheckpoint(stateDir, earlier);
		await fs.writeFile(path.join(stateDir, "scan-checkpoints", "ignored.txt"), "ignored");

		await expect(loadScanCheckpoint(stateDir, scanPaths, hostname)).resolves.toEqual(later);
		const summaries = await listScanCheckpointSummaries(stateDir);
		expect(summaries.map(({ scanId }) => scanId)).toEqual(["earlier", "later"]);
		expect(summaries[0]?.currentDirectory).toBeNull();
		expect(summaries[1]).toMatchObject({
			currentDirectory: "/later",
			filesScanned: 4,
			pendingAssetCount: 1,
		});
	});

	it("rejects malformed checkpoint envelopes and cursor state", async () => {
		const valid = validCheckpoint();
		const malformed: Array<[unknown, RegExp]> = [
			[null, /not an object/],
			[{ ...valid, version: 2 }, /version/],
			[{ ...valid, scopeHash: "wrong" }, /scope mismatch/],
			[{ ...valid, scanId: 1 }, /checkpoint is invalid/],
			[{ ...valid, hostname: 1 }, /checkpoint is invalid/],
			[{ ...valid, scanPaths: null }, /checkpoint is invalid/],
			[{ ...valid, directoryStack: null }, /checkpoint is invalid/],
			[{ ...valid, pendingAssets: null }, /checkpoint is invalid/],
			[{ ...valid, nextPathIndex: "0" }, /checkpoint is invalid/],
			[{ ...valid, filesScanned: "0" }, /checkpoint is invalid/],
			[{ ...valid, directoriesScanned: "0" }, /checkpoint is invalid/],
			[{ ...valid, assetsFound: "0" }, /checkpoint is invalid/],
			[{ ...valid, batchSequence: "0" }, /checkpoint is invalid/],
			[{ ...valid, hostname: "different" }, /content does not match/],
			[{ ...valid, filesScanned: -1 }, /count is invalid/],
			[{ ...valid, filesScanned: 0.5 }, /count is invalid/],
			[{ ...valid, nextPathIndex: 2 }, /path cursor is invalid/],
			[{ ...valid, directoryStack: [null] }, /directory cursor is invalid/],
			[
				{ ...valid, directoryStack: [{ directory: 1, depth: 0, lastEntryName: null }] },
				/directory cursor is invalid/,
			],
			[
				{ ...valid, directoryStack: [{ directory: "/x", depth: 0.5, lastEntryName: null }] },
				/directory cursor is invalid/,
			],
			[
				{ ...valid, directoryStack: [{ directory: "/x", depth: -1, lastEntryName: null }] },
				/directory cursor is invalid/,
			],
			[
				{ ...valid, directoryStack: [{ directory: "/x", depth: 0, lastEntryName: 1 }] },
				/directory cursor is invalid/,
			],
		];

		for (const [value, expected] of malformed) {
			await writeRaw(value);
			await expect(loadScanCheckpoint(stateDir, scanPaths, hostname)).rejects.toThrow(expected);
		}
	});

	it("removes existing state and tolerates an already-absent checkpoint", async () => {
		const checkpoint = validCheckpoint();
		await saveScanCheckpoint(stateDir, checkpoint);
		await removeScanCheckpoint(stateDir, checkpoint.scopeHash);
		await expect(fs.stat(checkpointPath(stateDir, checkpoint.scopeHash))).rejects.toMatchObject({
			code: "ENOENT",
		});
		await expect(removeScanCheckpoint(stateDir, checkpoint.scopeHash)).resolves.toBeUndefined();
	});

	it("propagates checkpoint removal errors other than an absent file", async () => {
		const scopeHash = scanScopeHash(scanPaths, hostname);
		await fs.mkdir(checkpointPath(stateDir, scopeHash), { recursive: true });

		await expect(removeScanCheckpoint(stateDir, scopeHash)).rejects.not.toMatchObject({
			code: "ENOENT",
		});
	});

	it("supports the Windows persistence path without directory fsync", async () => {
		const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
		Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
		try {
			await saveScanCheckpoint(stateDir, validCheckpoint());
		} finally {
			if (descriptor) Object.defineProperty(process, "platform", descriptor);
		}
	});
});
