import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearTokenCache } from "../utils/token-cache.js";
import { registerAccessControlCommands } from "./access-control.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";

describe("Access Control commands", () => {
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

	describe("access policies list", () => {
		it("should list policies successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						items: [{ id: "pol-1", name: "Policy 1" }],
					}),
				);

			registerAccessControlCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "access", "policies", "list"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/access/v1/tenants/test-tenant/policies"),
				expect.any(Object),
			);
		});
	});

	describe("access policies get", () => {
		it("should get policy details successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(createMockResponse({ id: "pol-1", name: "Policy 1" }));

			registerAccessControlCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "access", "policies", "get", "pol-1"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
		});

		it("should handle 404 not found", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(createMockResponse({ error: "Not found" }, 404, false));

			registerAccessControlCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "access", "policies", "get", "nonexistent"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(5);
		});
	});

	describe("access policies create", () => {
		it("should create policy successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(createMockResponse({ id: "pol-new" }));

			registerAccessControlCommands(program, mockConfig);
			try {
				await program.parseAsync([
					"node",
					"test",
					"access",
					"policies",
					"create",
					"--name",
					"New Policy",
					"--effect",
					"allow",
					"--actions",
					"read",
					"--resources",
					"*",
				]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/access/v1/policies"),
				expect.objectContaining({
					method: "POST",
					body: expect.stringContaining("New Policy"),
				}),
			);
		});
	});
});
