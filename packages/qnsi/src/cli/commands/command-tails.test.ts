/**
 * Targeted arms the generic sweep cannot reach: the auth-command catch, the
 * crypto-policy update paths behind --tier, and the crypto-scan local scanner
 * (formats, file output, truncation, upload validation and results).
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RateLimiter } from "../utils/rate-limiter.js";
import { clearTokenCache } from "../utils/token-cache.js";
import { registerAuthCommands } from "./auth.js";
import { registerCryptoPolicyCommands } from "./crypto-policy.js";
import { registerCryptoScanCommands } from "./crypto-scan.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";

describe("command tails", () => {
	let env: ReturnType<typeof setupTestEnvironment>;

	beforeEach(() => {
		env = setupTestEnvironment();
		clearTokenCache();
	});

	afterEach(() => {
		env.cleanup();
	});

	async function run(register: (p: Command, c: typeof mockConfig) => void, argv: string[]) {
		const program = new Command();
		register(program, mockConfig);
		try {
			await program.parseAsync(["node", "qnsi", ...argv]);
		} catch {
			// mocked process.exit lets execution continue; commander may throw
		}
	}

	it("auth token surfaces unexpected limiter faults through its catch", async () => {
		vi.spyOn(RateLimiter.prototype, "checkLimit").mockRejectedValueOnce(
			new Error("unexpected limiter fault"),
		);
		await run(registerAuthCommands, ["auth", "token"]);
		expect(env.mockError.mock.calls.join(" ")).toContain("unexpected limiter fault");
		expect(env.mockExit).toHaveBeenCalled();

		env.mockError.mockClear();
		vi.spyOn(RateLimiter.prototype, "checkLimit").mockRejectedValueOnce("raw limiter fault");
		await run(registerAuthCommands, ["auth", "token"]);
		expect(env.mockError.mock.calls.join(" ")).toContain("Failed to get token");
	});

	it("kms keys create folds only the provided metadata fields", async () => {
		env.mockFetch.mockImplementation(async (url: string) => {
			if (String(url).includes("/auth/service-token")) {
				return createMockResponse({ accessToken: "tail-token" });
			}
			return createMockResponse({ id: "key-1" });
		});
		const { registerKmsCommands } = await import("./kms.js");
		const program = new Command();
		registerKmsCommands(program, mockConfig);
		try {
			await program.parseAsync([
				"node",
				"qnsi",
				"kms",
				"keys",
				"create",
				"--name",
				"named-only-key",
				"--purpose",
				"",
			]);
		} catch {
			// mocked exit
		}
		const postCall = env.mockFetch.mock.calls.find(
			([url, init]) =>
				String(url).includes("/kms/v1/keys") &&
				(init as RequestInit | undefined)?.method === "POST",
		) as [string, RequestInit];
		const body = JSON.parse(String(postCall[1].body));
		expect(body.metadata).toEqual({ name: "named-only-key" });
	});

	it("crypto-policy update sends only --tier, prints table output, and maps failures", async () => {
		env.mockFetch.mockImplementation(async (url: string) => {
			if (String(url).includes("/auth/service-token")) {
				return createMockResponse({ accessToken: "tail-token" });
			}
			return createMockResponse({ policyTier: "strict" });
		});
		const tableProgram = new Command();
		registerCryptoPolicyCommands(tableProgram, { ...mockConfig, outputFormat: "table" });
		try {
			await tableProgram.parseAsync([
				"node",
				"qnsi",
				"crypto-policy",
				"update",
				"--tier",
				"strict",
			]);
		} catch {
			// mocked exit
		}
		const putCall = env.mockFetch.mock.calls.find(
			([, init]) => (init as RequestInit | undefined)?.method === "PUT",
		) as [string, RequestInit];
		const body = JSON.parse(String(putCall[1].body));
		expect(body).toMatchObject({ policyTier: "strict", requireHsmForRootKeys: false });
		expect(body.customAllowedKemAlgorithms).toBeUndefined();
		expect(env.mockLog.mock.calls.join(" ")).toContain("Crypto policy updated successfully");

		// Enforcement and generic failures behind --tier.
		env.mockExit.mockClear();
		env.mockFetch.mockImplementation(async (url: string) => {
			if (String(url).includes("/auth/service-token")) {
				return createMockResponse({ accessToken: "tail-token" });
			}
			return createMockResponse({ message: "limited", tier: "free" }, 429, false);
		});
		await run(registerCryptoPolicyCommands, ["crypto-policy", "update", "--tier", "strict"]);
		expect(env.mockExit).toHaveBeenCalled();

		env.mockExit.mockClear();
		env.mockError.mockClear();
		env.mockFetch.mockImplementation(async (url: string) => {
			if (String(url).includes("/auth/service-token")) {
				return createMockResponse({ accessToken: "tail-token" });
			}
			return createMockResponse({ message: "rejected" }, 500, false);
		});
		await run(registerCryptoPolicyCommands, ["crypto-policy", "update", "--tier", "strict"]);
		expect(env.mockError.mock.calls.join(" ")).toContain("Failed to update crypto policy: 500");

		// Network failure behind --tier reaches the update catch.
		env.mockExit.mockClear();
		env.mockFetch.mockImplementation(async (url: string) => {
			if (String(url).includes("/auth/service-token")) {
				return createMockResponse({ accessToken: "tail-token" });
			}
			throw new Error("update transport failure");
		});
		await run(registerCryptoPolicyCommands, ["crypto-policy", "update", "--tier", "strict"]);
		expect(env.mockError.mock.calls.join(" ")).toContain("update transport failure");

		env.mockError.mockClear();
		env.mockFetch.mockImplementation(async (url: string) => {
			if (String(url).includes("/auth/service-token")) {
				return createMockResponse({ accessToken: "tail-token" });
			}
			throw "raw update failure";
		});
		await run(registerCryptoPolicyCommands, ["crypto-policy", "update", "--tier", "strict"]);
		expect(env.mockError.mock.calls.join(" ")).toContain("Failed to update crypto policy");
	});

	describe("crypto scan", () => {
		let dir: string;

		beforeEach(async () => {
			dir = await mkdtemp(join(tmpdir(), "qnsi-scan-"));
			await writeFile(
				join(dir, "legacy.py"),
				["h = hashlib.md5(data)", "h2 = hashlib.sha1(data)"].join("\n"),
			);
		});

		afterEach(async () => {
			await rm(dir, { recursive: true, force: true });
		});

		it("writes cbom and json outputs to files and prints cbom to stdout", async () => {
			const cbomPath = join(dir, "out.cbom.json");
			await run(registerCryptoScanCommands, [
				"crypto",
				"scan",
				dir,
				"--format",
				"cbom",
				"--output",
				cbomPath,
			]);
			const cbom = JSON.parse(await readFile(cbomPath, "utf8"));
			expect(cbom.summary).toMatchObject({ totalFindings: 2, classical: 2, pqc: 0 });
			expect(cbom.components.map((c: { name: string }) => c.name).sort()).toEqual(["md5", "sha1"]);

			await run(registerCryptoScanCommands, ["crypto", "scan", dir, "--format", "cbom"]);
			expect(env.mockLog.mock.calls.join(" ")).toContain("crypto-asset");

			const jsonPath = join(dir, "out.json");
			await run(registerCryptoScanCommands, [
				"crypto",
				"scan",
				dir,
				"--format",
				"json",
				"--output",
				jsonPath,
			]);
			const payload = JSON.parse(await readFile(jsonPath, "utf8"));
			expect(payload.findings).toHaveLength(2);
		});

		it("warns on truncation and exits on unscannable directories", async () => {
			await run(registerCryptoScanCommands, [
				"crypto",
				"scan",
				dir,
				"--max-findings",
				"1",
				"--exclude",
				"vendor",
			]);
			expect(env.mockError.mock.calls.join(" ")).toContain("TRUNCATED");

			env.mockError.mockClear();
			await run(registerCryptoScanCommands, ["crypto", "scan", join(dir, "does-not-exist")]);
			expect(env.mockError.mock.calls.join(" ")).toContain("Scan failed:");
			expect(env.mockExit).toHaveBeenCalled();
		});

		it("aggregates repeated algorithms in the CBOM and enforces the upload cap", async () => {
			await writeFile(
				join(dir, "repeats.py"),
				["h = hashlib.md5(a)", "h = hashlib.md5(b)", "h = hashlib.md5(c)"].join("\n"),
			);
			const cbomPath = join(dir, "repeat.cbom.json");
			await run(registerCryptoScanCommands, [
				"crypto",
				"scan",
				dir,
				"--format",
				"cbom",
				"--output",
				cbomPath,
			]);
			const cbom = JSON.parse(await readFile(cbomPath, "utf8"));
			const md5 = cbom.components.find((c: { name: string }) => c.name === "md5");
			expect(md5.occurrences).toBe(4);

			// 10,001 findings exceed the ingest cap and block the upload.
			await writeFile(
				join(dir, "huge.py"),
				Array.from({ length: 10_001 }, () => "h = hashlib.md5(x)").join("\n"),
			);
			env.mockError.mockClear();
			const capped = new Command();
			registerCryptoScanCommands(capped, { ...mockConfig, edgeGatewayUrl: "https://edge.test" });
			try {
				await capped.parseAsync([
					"node",
					"qnsi",
					"crypto",
					"scan",
					dir,
					"--upload",
					"--repo-id",
					"repo-1",
					"--agent-id",
					"agent-1",
					"--agent-secret",
					"secret-1",
				]);
			} catch {
				// mocked exit
			}
			expect(env.mockError.mock.calls.join(" ")).toContain("the ingest cap is 10000");
		});

		it("validates every upload precondition", async () => {
			const argvBase = ["crypto", "scan", dir, "--upload"];

			await run(registerCryptoScanCommands, argvBase);
			expect(env.mockError.mock.calls.join(" ")).toContain("requires agent credentials");

			env.mockError.mockClear();
			const noTenant = new Command();
			registerCryptoScanCommands(noTenant, { ...mockConfig, tenantId: null });
			try {
				await noTenant.parseAsync([
					"node",
					"qnsi",
					...argvBase,
					"--agent-id",
					"agent-1",
					"--agent-secret",
					"secret-1",
				]);
			} catch {
				// mocked exit
			}
			expect(env.mockError.mock.calls.join(" ")).toContain("requires QNSI_TENANT_ID");

			env.mockError.mockClear();
			const noEdge = new Command();
			registerCryptoScanCommands(noEdge, { ...mockConfig, edgeGatewayUrl: null });
			try {
				await noEdge.parseAsync([
					"node",
					"qnsi",
					...argvBase,
					"--agent-id",
					"agent-1",
					"--agent-secret",
					"secret-1",
				]);
			} catch {
				// mocked exit
			}
			expect(env.mockError.mock.calls.join(" ")).toContain("requires QNSI_EDGE_GATEWAY_URL");

			env.mockError.mockClear();
			const withEdge = new Command();
			registerCryptoScanCommands(withEdge, {
				...mockConfig,
				edgeGatewayUrl: "https://edge.test",
			});
			try {
				await withEdge.parseAsync([
					"node",
					"qnsi",
					...argvBase,
					"--agent-id",
					"agent-1",
					"--agent-secret",
					"secret-1",
				]);
			} catch {
				// mocked exit
			}
			expect(env.mockError.mock.calls.join(" ")).toContain("requires --repo-id");
		});

		it("prints json to stdout and scans the working directory by default", async () => {
			await run(registerCryptoScanCommands, ["crypto", "scan", dir, "--format", "json"]);
			expect(env.mockLog.mock.calls.join(" ")).toContain("filesScanned");

			// No directory argument: scans the cwd, truncated immediately.
			env.mockError.mockClear();
			await run(registerCryptoScanCommands, ["crypto", "scan", "--max-findings", "1"]);
			expect(env.mockError.mock.calls.join(" ")).toContain("TRUNCATED");
		});

		it("uploads a minimal report with defaulted repo metadata and sized findings", async () => {
			await writeFile(join(dir, "sized.py"), "key = RSA.generate(2048)");
			const { mkdir } = await import("node:fs/promises");
			await mkdir(join(dir, "tests"));
			await writeFile(join(dir, "tests", "helper.py"), "h = hashlib.md5(x)");
			env.mockFetch.mockResolvedValueOnce(createMockResponse({}, 202));
			const program = new Command();
			registerCryptoScanCommands(program, { ...mockConfig, edgeGatewayUrl: "https://edge.test" });
			try {
				await program.parseAsync([
					"node",
					"qnsi",
					"crypto",
					"scan",
					dir,
					"--upload",
					"--repo-id",
					"repo-min",
					"--agent-id",
					"agent-1",
					"--agent-secret",
					"secret-1",
				]);
			} catch {
				// mocked exit
			}
			const [, init] = env.mockFetch.mock.calls[0] as [string, RequestInit];
			const report = JSON.parse(String(init.body));
			// repoName defaults to the directory basename; ref/commit stay absent.
			expect(report.repo.name.length).toBeGreaterThan(0);
			expect(report.repo.ref).toBeUndefined();
			expect(report.repo.commitSha).toBeUndefined();
			// The sized RSA finding carries its keySize into the upload shape.
			expect(
				report.findings.some(
					(f: { algorithm: string; keySize?: number }) =>
						f.algorithm === "rsa-2048" && f.keySize === 2048,
				),
			).toBe(true);
			// Findings inside test paths carry their testContext marker.
			expect(report.findings.some((f: { testContext?: boolean }) => f.testContext === true)).toBe(
				true,
			);
			// An empty 202 body falls back to local counts and n/a hashes.
			expect(env.mockLog.mock.calls.join(" ")).toContain("bodyHash n/a");
		});

		it("uploads reports and maps accepted and rejected responses", async () => {
			const uploadArgv = [
				"crypto",
				"scan",
				dir,
				"--upload",
				"--repo-id",
				"repo-1",
				"--repo-name",
				"qnsi",
				"--ref",
				"main",
				"--commit",
				"abc123",
				"--agent-id",
				"agent-1",
				"--agent-secret",
				"secret-1",
			];
			const uploadConfig = { ...mockConfig, edgeGatewayUrl: "https://edge.test" };

			env.mockFetch.mockResolvedValueOnce(
				createMockResponse({ findingCount: 2, bodyHash: "hash-1" }, 202),
			);
			const acceptProgram = new Command();
			registerCryptoScanCommands(acceptProgram, uploadConfig);
			try {
				await acceptProgram.parseAsync(["node", "qnsi", ...uploadArgv]);
			} catch {
				// mocked exit
			}
			expect(env.mockLog.mock.calls.join(" ")).toContain("Uploaded 2 findings");
			const [url] = env.mockFetch.mock.calls[0] as [string];
			expect(String(url)).toContain("https://edge.test");

			env.mockError.mockClear();
			env.mockFetch.mockResolvedValueOnce(
				createMockResponse({ message: "bad signature" }, 401, false),
			);
			const rejectProgram = new Command();
			registerCryptoScanCommands(rejectProgram, uploadConfig);
			try {
				await rejectProgram.parseAsync(["node", "qnsi", ...uploadArgv]);
			} catch {
				// mocked exit
			}
			expect(env.mockError.mock.calls.join(" ")).toContain("Upload failed: 401");
		});
	});
});
