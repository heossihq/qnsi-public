import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearTokenCache } from "../utils/token-cache.js";
import { registerTenantCommands } from "./tenant.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";

describe("Tenant commands", () => {
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

	describe("tenant get", () => {
		it("should get tenant details successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						id: "test-tenant",
						plan: "free",
						metadata: {},
					}),
				);

			registerTenantCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "tenant", "get", "test-tenant"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/tenant/v1/tenants/test-tenant"),
				expect.any(Object),
			);
		});

		it("should enforce cross-tenant access prevention", async () => {
			registerTenantCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "tenant", "get", "other-tenant"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(2); // INVALID_ARGUMENTS
			expect(env.mockFetch).not.toHaveBeenCalled();
		});

		it("should handle 404 not found", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(createMockResponse({ error: "Not found" }, 404, false));

			registerTenantCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "tenant", "get", "test-tenant"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(5); // NOT_FOUND
		});
	});

	describe("tenant list", () => {
		it("should be disabled", async () => {
			registerTenantCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "tenant", "list"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(2); // INVALID_ARGUMENTS
		});
	});

	describe("tenant create", () => {
		it("should be disabled", async () => {
			registerTenantCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "tenant", "create", "--name", "new-tenant"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(2); // INVALID_ARGUMENTS
		});
	});
});
