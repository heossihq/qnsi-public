import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearTokenCache } from "../utils/token-cache.js";
import { registerStorageCommands } from "./storage.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";

describe("Storage commands", () => {
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

	describe("storage objects list", () => {
		it("should list objects successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						items: [
							{ id: "obj-1", name: "file1.txt" },
							{ id: "obj-2", name: "file2.txt" },
						],
					}),
				);

			registerStorageCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "storage", "objects", "list"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			const [, secondCall] = env.mockFetch.mock.calls;
			expect(secondCall?.[0]).toEqual(expect.stringContaining("/storage/v1/documents"));
			expect(secondCall?.[1]).toEqual(
				expect.objectContaining({
					headers: expect.objectContaining({
						"x-qnsp-tenant": "test-tenant",
					}),
				}),
			);
		});

		it("should exit with error when tenant ID is missing", async () => {
			registerStorageCommands(program, { ...mockConfig, tenantId: null });
			try {
				await program.parseAsync(["node", "test", "storage", "objects", "list"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(2);
		});
	});

	describe("storage objects get", () => {
		it("should be disabled", async () => {
			registerStorageCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "storage", "objects", "get", "obj-1"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(2);
		});
	});

	describe("storage objects delete", () => {
		it("should be disabled", async () => {
			registerStorageCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "storage", "objects", "delete", "obj-1"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(2);
		});
	});
});
