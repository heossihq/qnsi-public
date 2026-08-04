import * as crypto from "node:crypto";
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
});
