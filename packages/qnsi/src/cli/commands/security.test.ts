import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearTokenCache } from "../utils/token-cache.js";
import { registerSecurityCommands } from "./security.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";

describe("Security commands", () => {
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

	describe("security alerts list", () => {
		it("should list alerts successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						items: [
							{ id: "alert-1", severity: "high" },
							{ id: "alert-2", severity: "medium" },
						],
					}),
				);

			registerSecurityCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "security", "alerts", "list"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/security/v1/alerts"),
				expect.objectContaining({
					headers: expect.objectContaining({
						"x-qnsp-tenant": "test-tenant",
					}),
				}),
			);
		});

		it("should filter by severity", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(createMockResponse({ items: [] }));

			registerSecurityCommands(program, mockConfig);
			try {
				await program.parseAsync([
					"node",
					"test",
					"security",
					"alerts",
					"list",
					"--severity",
					"critical",
				]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("severity=critical"),
				expect.any(Object),
			);
		});
	});

	describe("security alerts get", () => {
		it("should be disabled", async () => {
			registerSecurityCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "security", "alerts", "get", "alert-1"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(2);
		});
	});

	describe("security breaches list", () => {
		it("should list breaches successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						breaches: [{ id: "breach-1", severity: "critical" }],
					}),
				);

			registerSecurityCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "security", "breaches", "list"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/security/v1/breaches"),
				expect.any(Object),
			);
		});
	});
});
