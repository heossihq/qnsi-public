import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearTokenCache } from "../utils/token-cache.js";
import { registerCryptoPolicyCommands } from "./crypto-policy.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";

describe("Crypto policy commands", () => {
	let program: Command;
	let env: ReturnType<typeof setupTestEnvironment>;

	beforeEach(() => {
		env = setupTestEnvironment();
		program = new Command();
		clearTokenCache();
	});

	afterEach(() => {
		env.cleanup();
	});

	describe("crypto-policy get", () => {
		it("should get crypto policy successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						policyTier: "pro",
						customAllowedKemAlgorithms: ["kyber-768"],
						customAllowedSignatureAlgorithms: ["dilithium-3"],
						requireHsmForRootKeys: false,
						maxKeyAgeDays: 365,
					}),
				);

			registerCryptoPolicyCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "crypto-policy", "get"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
		});

		it("should exit with error when tenant ID is missing", async () => {
			registerCryptoPolicyCommands(program, { ...mockConfig, tenantId: null });
			try {
				await program.parseAsync(["node", "test", "crypto-policy", "get"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(2);
		});

		it("should handle 404 not found", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(createMockResponse({ error: "Not found" }, 404, false));

			registerCryptoPolicyCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "crypto-policy", "get"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(5);
		});
	});

	describe("crypto-policy update", () => {
		it("should update crypto policy successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						policyTier: "enterprise",
						customAllowedKemAlgorithms: ["kyber-768", "kyber-1024"],
						customAllowedSignatureAlgorithms: ["dilithium-3"],
						requireHsmForRootKeys: true,
						maxKeyAgeDays: 180,
					}),
				);

			registerCryptoPolicyCommands(program, mockConfig);
			try {
				await program.parseAsync([
					"node",
					"test",
					"crypto-policy",
					"update",
					"--tier",
					"enterprise",
					"--require-hsm-for-root-keys",
					"--max-key-age-days",
					"180",
				]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
		});

		it("should require tier option", async () => {
			registerCryptoPolicyCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "crypto-policy", "update"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(2);
		});
	});
});
