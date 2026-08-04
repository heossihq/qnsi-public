import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CliConfig } from "../config.js";
import { registerCryptoScanCommands } from "./crypto-scan.js";
import { mockConfig } from "./test-utils.js";

const uploadConfig: CliConfig = {
	...mockConfig,
	edgeGatewayUrl: "https://api.example.com",
	tenantId: "tenant-42",
};

async function runScan(config: CliConfig, args: string[]): Promise<void> {
	const program = new Command();
	program.exitOverride();
	registerCryptoScanCommands(program, config);
	await program.parseAsync(["node", "qnsi", "crypto", "scan", ...args]);
}

describe("qnsi crypto scan", () => {
	let dir: string;
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;
	let exitSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "qnsi-scan-"));
		await writeFile(join(dir, "keys.ts"), `generateKeyPairSync("rsa", { modulusLength: 2048 });`);
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("scans locally and emits findings as JSON", async () => {
		await runScan(mockConfig, [dir, "--format", "json"]);

		const jsonCall = logSpy.mock.calls
			.map((c) => String(c[0]))
			.find((s) => s.trimStart().startsWith("{"));
		expect(jsonCall).toBeDefined();
		const payload = JSON.parse(jsonCall as string) as {
			findings: Array<{ algorithm: string; lineHash: string }>;
			filesScanned: number;
		};
		expect(payload.filesScanned).toBe(1);
		expect(payload.findings).toHaveLength(1);
		expect(payload.findings[0]?.algorithm).toBe("rsa-2048");
		expect(payload.findings[0]?.lineHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("writes a CycloneDX 1.5 CBOM with --format cbom --output", async () => {
		const outFile = join(dir, "cbom.json");
		await runScan(mockConfig, [dir, "--format", "cbom", "--output", outFile]);

		const cbom = JSON.parse(await readFile(outFile, "utf8")) as {
			bomFormat: string;
			specVersion: string;
			components: Array<{ name: string; postureClass: string }>;
			summary: { classical: number };
		};
		expect(cbom.bomFormat).toBe("CycloneDX");
		expect(cbom.specVersion).toBe("1.5");
		expect(cbom.components[0]?.name).toBe("rsa-2048");
		expect(cbom.components[0]?.postureClass).toBe("classical");
		expect(cbom.summary.classical).toBe(1);
	});

	it("uploads the exact wire contract: signed headers, no classification field", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			status: 202,
			text: async () => "",
			json: async () => ({ accepted: true, findingCount: 1, bodyHash: "abc" }),
		});
		vi.stubGlobal("fetch", mockFetch);

		await runScan(uploadConfig, [
			dir,
			"--upload",
			"--repo-id",
			"repo-1",
			"--repo-name",
			"acme/payments",
			"--commit",
			"a1b2c3d4e5f6",
			"--agent-id",
			"agent-7",
			"--agent-secret",
			"deadbeef",
		]);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.example.com/proxy/crypto/v1/code-scan-reports");

		const headers = init.headers as Record<string, string>;
		expect(headers["x-qnsp-tenant"]).toBe("tenant-42");
		expect(headers["x-agent-id"]).toBe("agent-7");
		for (const h of [
			"x-agent-timestamp",
			"x-agent-nonce",
			"x-agent-body-hash",
			"x-agent-signature",
		]) {
			expect(headers[h]).toBeTruthy();
		}

		const body = JSON.parse(String(init.body)) as {
			agentId: string;
			repo: { id: string; name: string; commitSha: string };
			ruleSetVersion: string;
			scannerVersion: string;
			findings: Array<Record<string, unknown>>;
		};
		expect(body.agentId).toBe("agent-7");
		expect(body.repo).toEqual({ id: "repo-1", name: "acme/payments", commitSha: "a1b2c3d4e5f6" });
		expect(body.ruleSetVersion).toMatch(/^\d+\.\d+\.\d+$/);
		expect(body.scannerVersion).toMatch(/^\d+\.\d+\.\d+/);
		expect(body.findings).toHaveLength(1);
		// The strict server schema rejects unknown keys - classification must
		// never reach the wire (the server derives isPqc/isHybrid itself).
		expect(body.findings[0]).not.toHaveProperty("classification");
		expect(body.findings[0]?.["algorithm"]).toBe("rsa-2048");
		expect(exitSpy).not.toHaveBeenCalled();
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("refuses --upload without agent credentials", async () => {
		vi.stubGlobal("fetch", vi.fn());
		vi.stubEnv("QNSI_AGENT_ID", "");
		vi.stubEnv("QNSI_AGENT_SECRET", "");
		await runScan(uploadConfig, [dir, "--upload", "--repo-id", "r1"]);
		expect(exitSpy).toHaveBeenCalled();
	});
});
