import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliConfig } from "../config.js";
import { getAuthHeaders, requestServiceToken } from "./auth.js";
import { clearTokenCache } from "./token-cache.js";

describe("auth utilities", () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let mockExit: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		global.fetch = mockFetch as unknown as typeof fetch;
		mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
		clearTokenCache();
		Object.defineProperty(process.stdin, "isTTY", {
			value: false,
			configurable: true,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		clearTokenCache();
	});

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

	describe("requestServiceToken", () => {
		it("should request service token successfully", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				headers: new Headers(),
				json: async () => ({ accessToken: "test-token" }),
			});

			const token = await requestServiceToken(mockConfig);

			expect(token).toBe("test-token");
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:8081/auth/service-token",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer test-secret",
					}),
					body: JSON.stringify({
						serviceId: "test-service-id",
						audience: "internal-service",
					}),
				}),
			);
		});

		it("should exit with AUTH_ERROR when credentials are missing", async () => {
			const configWithoutCreds = { ...mockConfig, serviceId: null, serviceSecret: null };
			await requestServiceToken(configWithoutCreds);
			expect(mockExit).toHaveBeenCalledWith(3);
		});

		it("should exit with AUTH_ERROR on failed request", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				headers: new Headers(),
				text: async () => "Unauthorized",
			});

			try {
				await requestServiceToken(mockConfig);
			} catch {
				// Expected to exit
			}
			expect(mockExit).toHaveBeenCalledWith(3);
		});

		it("should exit with NETWORK_ERROR on network failure", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			try {
				await requestServiceToken(mockConfig);
			} catch {
				// Expected to exit
			}
			expect(mockExit).toHaveBeenCalledWith(7);
		});

		it("should use cached token when available", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				headers: new Headers(),
				json: async () => ({ accessToken: "test-token" }),
			});

			const token1 = await requestServiceToken(mockConfig);
			const token2 = await requestServiceToken(mockConfig);

			expect(token1).toBe("test-token");
			expect(token2).toBe("test-token");
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});

	describe("getAuthHeaders", () => {
		it("should return auth headers with token", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				headers: new Headers(),
				json: async () => ({ accessToken: "test-token" }),
			});

			const headers = await getAuthHeaders(mockConfig);

			expect(headers).toEqual({
				Authorization: "Bearer test-token",
				"Content-Type": "application/json",
				"x-qnsp-tenant": "test-tenant",
				"x-tenant-id": "test-tenant",
			});
		});

		it("should not include tenant header when tenantId is null", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				headers: new Headers(),
				json: async () => ({ accessToken: "test-token" }),
			});

			const configWithoutTenant = { ...mockConfig, tenantId: null };
			const headers = await getAuthHeaders(configWithoutTenant);

			expect(headers).toEqual({
				Authorization: "Bearer test-token",
				"Content-Type": "application/json",
			});
			expect(headers["x-qnsp-tenant"]).toBeUndefined();
			expect(headers["x-tenant-id"]).toBeUndefined();
		});
	});
});

/**
 * REGRESSION GUARD: the CLI must work with the credential a CUSTOMER actually has.
 *
 * The `qnsi` CLI ships as the bin inside @heossihq/qnsi - the package every customer installs
 * - but it had NO api-key path at all. Proven 2026-07-14 against production:
 *
 *     QNSI_API_KEY=<real key>  qnsi kms keys list
 *     -> Error: QNSI_SERVICE_ID must be set
 *
 * It demanded QNSI_SERVICE_ID + QNSI_SERVICE_SECRET + QNSI_TENANT_ID - internal
 * service-account credentials a customer does not have and cannot get. The word `apiKey`
 * appeared exactly once in the whole CLI: in a log-sanitiser regex.
 *
 * Advertised-not-built, aimed straight at developers.
 */
describe("getAuthHeaders: the API-key path (what a customer has)", () => {
	const base = {
		edgeGatewayUrl: "https://api.qnsi.heossi.com",
		cloudPortalUrl: "https://cloud.qnsi.heossi.com",
		authServiceUrl: "https://api.qnsi.heossi.com",
		serviceId: null,
		serviceSecret: null,
		kmsServiceUrl: "",
		vaultServiceUrl: "",
		auditServiceUrl: "",
		tenantServiceUrl: "",
		billingServiceUrl: "",
		accessControlServiceUrl: "",
		securityMonitoringServiceUrl: "",
		storageServiceUrl: "",
		searchServiceUrl: "",
		observabilityServiceUrl: "",
		outputFormat: "json" as const,
		verbose: false,
	};

	it("uses the API key as the bearer - no service account required", async () => {
		const config = { ...base, apiKey: "qnsi_pqc_api_test", tenantId: "tenant-1" } as CliConfig;
		const headers = await getAuthHeaders(config);

		// Before the fix this exited the process with "QNSI_SERVICE_ID must be set".
		expect(headers["Authorization"]).toBe("Bearer qnsi_pqc_api_test");
		expect(headers["x-qnsp-tenant"]).toBe("tenant-1");
	});

	it("an explicit tenantId still wins over activation", async () => {
		const config = { ...base, apiKey: "k", tenantId: "explicit-tenant" } as CliConfig;
		const headers = await getAuthHeaders(config);
		expect(headers["x-tenant-id"]).toBe("explicit-tenant");
	});
});
