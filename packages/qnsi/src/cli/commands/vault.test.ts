import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearTokenCache } from "../utils/token-cache.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";
import { registerVaultCommands } from "./vault.js";

describe("Vault commands", () => {
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

	describe("vault secrets list", () => {
		it("should list secrets successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						secrets: [
							{ id: "6f9f1ce1-2c5b-4fb6-b37b-8ffef8f0b6c9", name: "api-key", version: 1 },
							{ id: "b1b8f0c3-7a2d-4bb4-9c64-3f1b2fddcfe2", name: "db-password", version: 2 },
						],
					}),
				);

			registerVaultCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "vault", "secrets", "list"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
		});
	});

	describe("vault secrets get", () => {
		it("should get secret successfully", async () => {
			env.mockFetch.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }));
			env.mockFetch.mockResolvedValueOnce(createMockResponse({ value: "secret-value" }));

			registerVaultCommands(program, mockConfig);
			try {
				await program.parseAsync([
					"node",
					"test",
					"vault",
					"secrets",
					"get",
					"6f9f1ce1-2c5b-4fb6-b37b-8ffef8f0b6c9",
				]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
		});

		it("should handle 404 not found", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(createMockResponse({ error: "Not found" }, 404, false));

			registerVaultCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "vault", "secrets", "get", "nonexistent"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(5);
		});
	});
});
