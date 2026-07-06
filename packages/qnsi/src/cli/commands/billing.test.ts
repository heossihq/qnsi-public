import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearTokenCache } from "../utils/token-cache.js";
import { registerBillingCommands } from "./billing.js";
import { createMockResponse, mockConfig, setupTestEnvironment } from "./test-utils.js";

describe("Billing commands", () => {
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

	describe("billing addons list", () => {
		it("should list addons successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						addOns: [{ id: "addon-1", name: "Premium Support" }],
					}),
				);

			registerBillingCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "billing", "addons", "list"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/addons/test-tenant"),
				expect.any(Object),
			);
		});
	});

	describe("billing addons catalog", () => {
		it("should list catalog successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						catalog: [{ id: "addon-1", name: "Premium Support", price: 100 }],
					}),
				);

			registerBillingCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "billing", "addons", "catalog"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/addons/catalog"),
				expect.any(Object),
			);
		});
	});

	describe("billing addons enable", () => {
		it("should enable addon successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(createMockResponse({ success: true }));

			registerBillingCommands(program, mockConfig);
			try {
				await program.parseAsync([
					"node",
					"test",
					"billing",
					"addons",
					"enable",
					"--addon-id",
					"addon-1",
				]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/addons/enable"),
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ tenantId: "test-tenant", addonId: "addon-1" }),
				}),
			);
		});
	});

	describe("billing usage", () => {
		it("should get usage successfully", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(
					createMockResponse({
						usage: { storage: 100, apiCalls: 5000 },
					}),
				);

			registerBillingCommands(program, mockConfig);
			try {
				await program.parseAsync(["node", "test", "billing", "usage"]);
			} catch {
				// expected process.exit
			}

			expect(env.mockExit).toHaveBeenCalledWith(0);
			expect(env.mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/billing/v1/usage/test-tenant"),
				expect.any(Object),
			);
		});

		// Regression guard for the prod double-/billing bug (confirmed against prod 2026-06-13:
		// /proxy/billing/billing/v1/usage -> 404). With an edge-gateway billingServiceUrl
		// (/proxy/billing), the usage URL must be /proxy/billing/v1/usage, NOT
		// /proxy/billing/billing/v1/usage. The local-only test above couldn't catch this.
		it("does NOT double the /billing segment with an edge-gateway URL", async () => {
			env.mockFetch
				.mockResolvedValueOnce(createMockResponse({ accessToken: "test-token" }))
				.mockResolvedValueOnce(createMockResponse({ usage: { apiCalls: 1 } }));

			const edgeConfig = {
				...mockConfig,
				billingServiceUrl: "https://api.qnsi.heossi.com/proxy/billing",
			};
			registerBillingCommands(program, edgeConfig);
			try {
				await program.parseAsync(["node", "test", "billing", "usage"]);
			} catch {
				// expected process.exit
			}

			const usageCall = env.mockFetch.mock.calls.find(
				(c) => typeof c[0] === "string" && c[0].includes("/v1/usage/"),
			);
			expect(usageCall?.[0]).toBe("https://api.qnsi.heossi.com/proxy/billing/v1/usage/test-tenant");
			expect(usageCall?.[0]).not.toContain("/proxy/billing/billing/");
		});
	});
});
