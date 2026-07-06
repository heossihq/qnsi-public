import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearTokenCache } from "../utils/token-cache.js";
import { registerSearchCommands } from "./search.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";

describe("Search commands", () => {
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

	describe("search query", () => {
		it("should execute search query successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						items: [
							{ id: "doc-1", title: "Document 1" },
							{ id: "doc-2", title: "Document 2" },
						],
					}),
				);

			registerSearchCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "search", "query", "--query", "test"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			const [, secondCall] = env.mockFetch.mock.calls;
			expect(secondCall?.[0]).toEqual(expect.stringContaining("/search/v1/documents"));
			expect(secondCall?.[1]).toEqual(
				expect.objectContaining({
					headers: expect.objectContaining({
						"x-qnsp-tenant": "test-tenant",
					}),
				}),
			);
		});

		it("should exit with error when tenant ID is missing", async () => {
			registerSearchCommands(program, { ...mockConfig, tenantId: null });
			try {
				await program.parseAsync(["node", "test", "search", "query", "--query", "test"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(2);
		});
	});

	describe("search indexes list", () => {
		it("should be disabled", async () => {
			registerSearchCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "search", "indexes", "list"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(2);
		});
	});
});
