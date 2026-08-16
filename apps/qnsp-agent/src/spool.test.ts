import * as crypto from "node:crypto";
import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentConfig } from "./config.js";
import { createReportPayload } from "./reporter.js";
import { enqueueReport, flushQueuedReports, listQueuedReports, reportBodyHash } from "./spool.js";

let stateDir: string;
let config: AgentConfig;

beforeEach(async () => {
	stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "qnsp-agent-spool-"));
	config = {
		agentId: "00000000-0000-4000-8000-000000000001",
		agentSecret: crypto.randomBytes(32).toString("hex"),
		endpoint: "https://api.qnsi.heossi.com",
		tenantId: "00000000-0000-4000-8000-000000000002",
		scanPaths: ["/etc/ssl"],
		intervalSecs: 300,
		logLevel: "silent",
		hostname: "durable-host",
		stateDir,
	};
});

afterEach(async () => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
	await fs.rm(stateDir, { recursive: true, force: true });
});

describe("durable report spool", () => {
	async function writeRawEnvelope(name: string, value: unknown): Promise<string> {
		await listQueuedReports(stateDir);
		const file = path.join(stateDir, "report-spool", name);
		await fs.writeFile(file, JSON.stringify(value), { mode: 0o600 });
		return file;
	}

	it("writes reports with restrictive permissions before delivery", async () => {
		const payload = createReportPayload(config, []);
		const file = await enqueueReport(stateDir, payload);

		expect(await listQueuedReports(stateDir)).toEqual([file]);
		expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
		expect((await fs.stat(path.dirname(file))).mode & 0o777).toBe(0o700);
	});

	it("recovers a fully written staging file after a process interruption", async () => {
		const file = await enqueueReport(stateDir, createReportPayload(config, []));
		const stagedPath = `${file}.pending-write`;
		await fs.rename(file, stagedPath);

		expect(await listQueuedReports(stateDir)).toEqual([file]);
		await expect(fs.stat(stagedPath)).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("filters non-report entries and orders reports by durable filename", async () => {
		const later = createReportPayload(config, [], "2026-08-14T02:00:00.000Z");
		const earlier = createReportPayload(config, [], "2026-08-14T01:00:00.000Z");
		const laterFile = await enqueueReport(stateDir, later);
		const earlierFile = await enqueueReport(stateDir, earlier);
		await fs.writeFile(path.join(stateDir, "report-spool", "ignored.txt"), "ignored");

		expect(await listQueuedReports(stateDir)).toEqual([earlierFile, laterFile]);
	});

	it("rejects malformed durable envelopes before network delivery", async () => {
		const payload = createReportPayload(config, []);
		const valid = { version: 1, payloadHash: reportBodyHash(payload), payload };
		const malformed: Array<[string, unknown, RegExp]> = [
			["01.json", null, /not an object/],
			["02.json", { ...valid, version: 2 }, /version/],
			["03.json", { ...valid, payloadHash: undefined }, /hash is invalid/],
			["04.json", { ...valid, payloadHash: "invalid" }, /hash is invalid/],
			["05.json", { ...valid, payload: null }, /payload is invalid/],
			["06.json", { ...valid, payload: { ...payload, agentId: 1 } }, /payload is invalid/],
			["07.json", { ...valid, payload: { ...payload, hostname: 1 } }, /payload is invalid/],
			["08.json", { ...valid, payload: { ...payload, reportedAt: 1 } }, /payload is invalid/],
			["09.json", { ...valid, payload: { ...payload, assets: null } }, /payload is invalid/],
		];
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		for (const [name, value, expected] of malformed) {
			const file = await writeRawEnvelope(name, value);
			await expect(flushQueuedReports(config)).rejects.toThrow(expected);
			await fs.unlink(file);
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("retains a report across a failed delivery and replays it after restart", async () => {
		const payload = createReportPayload(config, [
			{ type: "ssh_key", path: "/host/id_rsa", algorithm: "RSA", keySize: 2048 },
		]);
		await enqueueReport(stateDir, payload);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ status: 401, text: async () => "temporarily rejected" }),
		);

		expect((await flushQueuedReports(config)).remaining).toBe(1);

		const expectedHash = reportBodyHash(payload);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				status: 202,
				json: async () => ({
					accepted: true,
					agentId: config.agentId,
					assetCount: 1,
					bodyHash: expectedHash,
				}),
			}),
		);

		const replayed = await flushQueuedReports({ ...config });
		expect(replayed).toEqual({ pendingBefore: 1, accepted: 1, remaining: 0 });
	});

	it("does not delete a report when acknowledgement hash mismatches", async () => {
		await enqueueReport(stateDir, createReportPayload(config, []));
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				status: 202,
				json: async () => ({
					accepted: true,
					agentId: config.agentId,
					assetCount: 0,
					bodyHash: "0".repeat(64),
				}),
			}),
		);

		const result = await flushQueuedReports(config);
		expect(result).toEqual({ pendingBefore: 1, accepted: 0, remaining: 1 });
	});

	it("rejects a tampered queued report without transmitting it", async () => {
		const file = await enqueueReport(stateDir, createReportPayload(config, []));
		const envelope = JSON.parse(await fs.readFile(file, "utf8")) as {
			payload: { hostname: string };
		};
		envelope.payload.hostname = "tampered-host";
		await fs.writeFile(file, JSON.stringify(envelope), { mode: 0o600 });
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(flushQueuedReports(config)).rejects.toThrow("integrity check failed");
		expect(fetchMock).not.toHaveBeenCalled();
		expect(await listQueuedReports(stateDir)).toHaveLength(1);
	});

	it("rejects a valid queued report owned by a different agent", async () => {
		const otherConfig = {
			...config,
			agentId: "00000000-0000-4000-8000-000000000099",
		};
		await enqueueReport(stateDir, createReportPayload(otherConfig, []));
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(flushQueuedReports(config)).rejects.toThrow("different agent");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("uses the Windows persistence path without directory fsync", async () => {
		const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
		Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
		try {
			await enqueueReport(stateDir, createReportPayload(config, []));
		} finally {
			if (descriptor) Object.defineProperty(process, "platform", descriptor);
		}
	});

	it("cleans an interrupted staging write and preserves the original error", async () => {
		const payload = createReportPayload(config, []);
		const spoolDir = path.join(stateDir, "report-spool");
		let stagingPath = "";
		let serializations = 0;
		const failingPayload = {
			...payload,
			toJSON() {
				serializations += 1;
				if (serializations === 1) {
					return {
						agentId: payload.agentId,
						hostname: payload.hostname,
						reportedAt: payload.reportedAt,
						assets: payload.assets,
					};
				}
				const pending = fsSync
					.readdirSync(spoolDir)
					.find((name) => name.endsWith(".pending-write"));
				if (!pending) throw new Error("pending write was not created");
				stagingPath = path.join(spoolDir, pending);
				fsSync.unlinkSync(stagingPath);
				throw new Error("serialization failed");
			},
		};

		await expect(enqueueReport(stateDir, failingPayload)).rejects.toThrow("serialization failed");
		await expect(fs.stat(stagingPath)).rejects.toMatchObject({ code: "ENOENT" });
	});
});
