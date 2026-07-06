import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliConfig } from "../config.js";
import { registerAuditCommands } from "./audit.js";

describe("Audit commands", () => {
	let program: Command;
	let mockFetch: ReturnType<typeof vi.fn>;
	let mockExit: ReturnType<typeof vi.spyOn>;

	const mockConfig: CliConfig = {
		edgeGatewayUrl: null,
		cloudPortalUrl: "https://cloud.qnsi.heossi.com",
		authServiceUrl: "http://localhost:8081",
		serviceId: "test-service-id",
		serviceSecret: "test-secret",
		tenantId: "test-tenant",
		kmsServiceUrl: "http://localhost:8095",
		vaultServiceUrl: "http://localhost:8090",
		auditServiceUrl: "http://localhost:8103",
		tenantServiceUrl: "http://localhost:8108",
		billingServiceUrl: "http://localhost:8106",
		accessControlServiceUrl: "http://localhost:8102",
		securityMonitoringServiceUrl: "http://localhost:8104",
		storageServiceUrl: "http://localhost:8092",
		searchServiceUrl: "http://localhost:8101",
		observabilityServiceUrl: "http://localhost:8105",
		outputFormat: "json",
		verbose: false,
	};

	beforeEach(() => {
		program = new Command();
		mockFetch = vi.fn();
		global.fetch = mockFetch as unknown as typeof fetch;
		mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "table").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("audit events list", () => {
		it("should list audit events successfully", async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					headers: new Headers(),
					json: async () => ({ accessToken: "test-token" }),
				})
				.mockResolvedValueOnce({
					ok: true,
					headers: new Headers(),
					json: async () => ({
						items: [
							{ eventId: "evt-1", topic: "auth.login", timestamp: "2025-12-24T00:00:00Z" },
							{ eventId: "evt-2", topic: "kms.key.create", timestamp: "2025-12-24T01:00:00Z" },
						],
					}),
				});

			registerAuditCommands(program, mockConfig);
			await program.parseAsync(["node", "test", "audit", "events", "list"]);

			expect(mockExit).toHaveBeenCalledWith(0);
		});

		it("should support filtering by source service", async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					headers: new Headers(),
					json: async () => ({ accessToken: "test-token" }),
				})
				.mockResolvedValueOnce({
					ok: true,
					headers: new Headers(),
					json: async () => ({ items: [] }),
				});

			registerAuditCommands(program, mockConfig);
			await program.parseAsync([
				"node",
				"test",
				"audit",
				"events",
				"list",
				"--source-service",
				"kms-service",
			]);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("sourceService=kms-service"),
				expect.any(Object),
			);
			expect(mockExit).toHaveBeenCalledWith(0);
		});

		it("should respect limit parameter", async () => {
			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					headers: new Headers(),
					json: async () => ({ accessToken: "test-token" }),
				})
				.mockResolvedValueOnce({
					ok: true,
					headers: new Headers(),
					json: async () => ({ items: [] }),
				});

			registerAuditCommands(program, mockConfig);
			await program.parseAsync(["node", "test", "audit", "events", "list", "--limit", "100"]);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("limit=100"),
				expect.any(Object),
			);
			expect(mockExit).toHaveBeenCalledWith(0);
		});
	});
});
