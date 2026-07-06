import { clearActivationCache } from "@heossi/qnsi-sdk-activation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TenantClient } from "./index.js";

describe("TenantClient Security Tests", () => {
	const mockFetch = vi.fn();
	global.fetch = mockFetch;

	beforeEach(() => {
		clearActivationCache();
		vi.clearAllMocks();
	});

	describe("HTTPS Enforcement", () => {
		it("should reject HTTP URLs in production", () => {
			const originalEnv = process.env["NODE_ENV"];
			process.env["NODE_ENV"] = "production";

			expect(() => {
				new TenantClient({
					baseUrl: "http://example.com",
					apiKey: "test-api-key",
				});
			}).toThrow("baseUrl must use HTTPS in production");

			process.env["NODE_ENV"] = originalEnv;
		});

		it("should allow HTTP localhost in development", () => {
			const originalEnv = process.env["NODE_ENV"];
			process.env["NODE_ENV"] = "development";

			expect(() => {
				new TenantClient({
					baseUrl: "http://localhost:3000",
					apiKey: "test-api-key",
				});
			}).not.toThrow();

			process.env["NODE_ENV"] = originalEnv;
		});
	});

	describe("Input Validation", () => {
		const client = new TenantClient({
			baseUrl: "https://api.example.com",
			apiKey: "test-api-key",
		});

		it("should reject invalid UUIDs", async () => {
			await expect(client.getTenant("not-a-uuid")).rejects.toThrow("Invalid id");
		});

		it("should reject SQL injection in tenantId", async () => {
			await expect(client.getTenant("'; DROP TABLE tenants; --")).rejects.toThrow("Invalid id");
		});

		it("should reject path traversal in tenantId", async () => {
			await expect(client.getTenant("../../etc/passwd")).rejects.toThrow("Invalid id");
		});

		it("should reject XSS attempts in tenantId", async () => {
			await expect(client.getTenant("<script>alert('xss')</script>")).rejects.toThrow("Invalid id");
		});
	});

	describe("Error Message Sanitization", () => {
		const client = new TenantClient({
			baseUrl: "https://api.example.com",
			apiKey: "test-api-key",
		});

		it("should not expose sensitive data in error messages", async () => {
			// activation network call (first call per client instance)
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: new Headers(),
				json: async () => ({
					activated: true,
					tenantId: "a1b2c3d4-e5f6-4789-8abc-def012345678",
					tier: "dev-pro",
					activationToken: "tok_test",
					expiresInSeconds: 3600,
					activatedAt: new Date().toISOString(),
					limits: {
						storageGB: 50,
						apiCalls: 100_000,
						enclavesEnabled: false,
						aiTrainingEnabled: false,
						aiInferenceEnabled: true,
						sseEnabled: true,
						vaultEnabled: true,
					},
				}),
			});
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				headers: new Headers(),
				text: async () =>
					JSON.stringify({
						error: "Database connection failed",
						stack: "at TenantService.getTenant()",
						apiKey: "api_key_example_123",
						password: "secret123",
					}),
			});
			// second call in the IIFE below — activationPromise already resolved
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				headers: new Headers(),
				text: async () =>
					JSON.stringify({
						error: "Database connection failed",
						stack: "at TenantService.getTenant()",
						apiKey: "api_key_example_123",
						password: "secret123",
					}),
			});

			await expect(client.getTenant("123e4567-e89b-12d3-a456-426614174000")).rejects.toThrow(
				"Tenant API error: 500 Internal Server Error",
			);

			const errorMessage = await (async () => {
				try {
					await client.getTenant("123e4567-e89b-12d3-a456-426614174000");
					return "";
				} catch (error) {
					return error instanceof Error ? error.message : String(error);
				}
			})();

			expect(errorMessage).not.toContain("api_key_example_123");
			expect(errorMessage).not.toContain("secret123");
			expect(errorMessage).not.toContain("Database connection failed");
			expect(errorMessage).not.toContain("stack");
		});
	});

	describe("Rate Limiting", () => {
		const client = new TenantClient({
			baseUrl: "https://api.example.com",
			apiKey: "test-api-key",
			maxRetries: 2,
			retryDelayMs: 10,
		});

		it("should retry on 429 with Retry-After header", async () => {
			// activation network call consumed before mockImplementation kicks in
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: new Headers(),
				json: async () => ({
					activated: true,
					tenantId: "a1b2c3d4-e5f6-4789-8abc-def012345678",
					tier: "dev-pro",
					activationToken: "tok_test",
					expiresInSeconds: 3600,
					activatedAt: new Date().toISOString(),
					limits: {
						storageGB: 50,
						apiCalls: 100_000,
						enclavesEnabled: false,
						aiTrainingEnabled: false,
						aiInferenceEnabled: true,
						sseEnabled: true,
						vaultEnabled: true,
					},
				}),
			});

			let attemptCount = 0;
			mockFetch.mockImplementation(async () => {
				attemptCount++;
				if (attemptCount === 1) {
					return {
						ok: false,
						status: 429,
						statusText: "Too Many Requests",
						headers: new Headers({ "Retry-After": "1" }),
						text: async () => "",
					};
				}
				return {
					ok: true,
					status: 200,
					headers: new Headers(),
					json: async () => ({
						id: "123e4567-e89b-12d3-a456-426614174000",
						name: "test-tenant",
						slug: "test-tenant",
						status: "active",
						plan: "basic",
						region: "us-east-1",
						complianceTags: [],
						metadata: {},
						security: {
							controlPlaneTokenSha256: null,
							pqcSignatures: [],
							hardwareProvider: null,
							attestationStatus: null,
							attestationProof: null,
						},
						domains: [],
						createdAt: "2024-01-01T00:00:00Z",
						updatedAt: "2024-01-01T00:00:00Z",
					}),
				};
			});

			const result = await client.getTenant("123e4567-e89b-12d3-a456-426614174000");

			expect(result.id).toBe("123e4567-e89b-12d3-a456-426614174000");
			expect(attemptCount).toBe(2);
		});

		it("should fail after max retries", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 429,
				statusText: "Too Many Requests",
				headers: new Headers(),
				text: async () => "",
			});

			await expect(client.getTenant("123e4567-e89b-12d3-a456-426614174000")).rejects.toThrow(
				"Rate limit exceeded after 2 retries",
			);
		});
	});

	describe("Onboarding workflows (sweep 2026-06-13 F1/F2)", () => {
		function activationOnce(): void {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: new Headers(),
				json: async () => ({
					activated: true,
					tenantId: "a1b2c3d4-e5f6-4789-8abc-def012345678",
					tier: "dev-pro",
					activationToken: "tok_test",
					expiresInSeconds: 3600,
					activatedAt: new Date().toISOString(),
					limits: {
						storageGB: 50,
						apiCalls: 100_000,
						enclavesEnabled: false,
						aiTrainingEnabled: false,
						aiInferenceEnabled: true,
						sseEnabled: true,
						vaultEnabled: true,
					},
				}),
			});
		}

		it("startOnboarding POSTs the real /tenant/v1/onboarding/workflows route (not the dead /onboarding/start)", async () => {
			const client = new TenantClient({
				baseUrl: "https://api.example.com",
				apiKey: "test-api-key",
			});
			activationOnce();
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 201,
				headers: new Headers(),
				json: async () => ({ id: "wf-1", status: "in_progress", steps: [] }),
			});

			await client.startOnboarding({
				tenantName: "Acme",
				tenantSlug: "acme-co",
				ownerEmail: "owner@acme.co",
			});

			const lastCall = mockFetch.mock.calls.at(-1) as [string, { method?: string; body?: string }];
			expect(String(lastCall[0])).toContain("/tenant/v1/onboarding/workflows");
			expect(String(lastCall[0])).not.toContain("/onboarding/start");
			expect(lastCall[1]?.method).toBe("POST");
			const body = JSON.parse(lastCall[1]?.body ?? "{}");
			expect(body.tenantName).toBe("Acme");
			expect(body.tenantSlug).toBe("acme-co");
			expect(body.ownerEmail).toBe("owner@acme.co");
		});

		it("getOnboardingStatus GETs the real /tenant/v1/onboarding/workflows/:id route (not the dead /onboarding/status)", async () => {
			const client = new TenantClient({
				baseUrl: "https://api.example.com",
				apiKey: "test-api-key",
			});
			activationOnce();
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: new Headers(),
				json: async () => ({ id: "wf-1", status: "in_progress", steps: [] }),
			});

			await client.getOnboardingStatus("123e4567-e89b-12d3-a456-426614174000");

			const lastCall = mockFetch.mock.calls.at(-1) as [string, { method?: string }];
			expect(String(lastCall[0])).toContain(
				"/tenant/v1/onboarding/workflows/123e4567-e89b-12d3-a456-426614174000",
			);
			expect(String(lastCall[0])).not.toContain("/onboarding/status");
		});
	});
});
