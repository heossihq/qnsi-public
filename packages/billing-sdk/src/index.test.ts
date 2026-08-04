import { clearActivationCache } from "@heossihq/qnsi-sdk-activation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingClient } from "./index.js";

describe("BillingClient Security Tests", () => {
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
				new BillingClient({
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
				new BillingClient({
					baseUrl: "http://localhost:3000",
					apiKey: "test-api-key",
				});
			}).not.toThrow();

			process.env["NODE_ENV"] = originalEnv;
		});
	});

	describe("Input Validation", () => {
		const client = new BillingClient({
			baseUrl: "https://api.example.com",
			apiKey: "test-api-key",
		});

		it("should reject invalid UUIDs", async () => {
			await expect(client.listInvoices("not-a-uuid")).rejects.toThrow("Invalid tenantId");
		});

		it("should reject SQL injection in tenantId", async () => {
			await expect(client.listInvoices("'; DROP TABLE invoices; --")).rejects.toThrow(
				"Invalid tenantId",
			);
		});

		it("should reject path traversal in tenantId", async () => {
			await expect(client.listInvoices("../../etc/passwd")).rejects.toThrow("Invalid tenantId");
		});

		it("should reject XSS attempts in tenantId", async () => {
			await expect(client.listInvoices("<script>alert('xss')</script>")).rejects.toThrow(
				"Invalid tenantId",
			);
		});
	});

	describe("Error Message Sanitization", () => {
		const client = new BillingClient({
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
						error: "Payment processing failed",
						stack: "at BillingService.processPayment()",
						creditCard: "4111-1111-1111-1111",
						apiKey: "api_key_example_123",
					}),
			});
			// second call in the IIFE below - activationPromise already resolved, only the operation double needed
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				headers: new Headers(),
				text: async () =>
					JSON.stringify({
						error: "Payment processing failed",
						stack: "at BillingService.processPayment()",
						creditCard: "4111-1111-1111-1111",
						apiKey: "api_key_example_123",
					}),
			});

			await expect(client.listInvoices("123e4567-e89b-12d3-a456-426614174000")).rejects.toThrow(
				"Billing API error: 500 Internal Server Error",
			);

			const errorMessage = await (async () => {
				try {
					await client.listInvoices("123e4567-e89b-12d3-a456-426614174000");
					return "";
				} catch (error) {
					return error instanceof Error ? error.message : String(error);
				}
			})();

			expect(errorMessage).not.toContain("api_key_example_123");
			expect(errorMessage).not.toContain("4111-1111-1111-1111");
			expect(errorMessage).not.toContain("Payment processing failed");
			expect(errorMessage).not.toContain("stack");
		});
	});

	describe("Rate Limiting", () => {
		const client = new BillingClient({
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
						items: [],
						nextCursor: null,
					}),
				};
			});

			const result = await client.listInvoices("123e4567-e89b-12d3-a456-426614174000");

			expect(result).toBeDefined();
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

			await expect(client.listInvoices("123e4567-e89b-12d3-a456-426614174000")).rejects.toThrow(
				"Rate limit exceeded after 2 retries",
			);
		});
	});
});
