import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearTokenCache } from "../utils/token-cache.js";
import { registerKmsCommands } from "./kms.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";

describe("KMS commands", () => {
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

	describe("kms keys list", () => {
		it("should list KMS keys successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						items: [
							{ keyId: "key-1", name: "test-key-1" },
							{ keyId: "key-2", name: "test-key-2" },
						],
					}),
				);

			registerKmsCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "kms", "keys", "list"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
		});

		it("should exit with error when tenant ID is missing", async () => {
			const configWithoutTenant = { ...mockConfig, tenantId: null };
			registerKmsCommands(program, configWithoutTenant);
			try {
				await program.parseAsync(["node", "test", "kms", "keys", "list"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(2);
		});
	});

	describe("kms keys get", () => {
		it("should get key details successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(createMockResponse({ keyId: "key-1", name: "test-key" }));

			registerKmsCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "kms", "keys", "get", "key-1"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
		});

		it("should handle 404 not found", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(createMockResponse({ error: "Not found" }, 404, false));

			registerKmsCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "kms", "keys", "get", "nonexistent"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(5);
		});
	});

	describe("kms keys create", () => {
		it("should create key successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(createMockResponse({ keyId: "new-key", name: "test-key" }));

			registerKmsCommands(program, mockConfig);
			try {
				await program.parseAsync([
					"node",
					"test",
					"kms",
					"keys",
					"create",
					"--name",
					"test-key",
					"--algorithm",
					"aes-256-gcm",
				]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
		});
	});
});
