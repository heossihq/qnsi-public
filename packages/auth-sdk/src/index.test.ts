import { clearActivationCache } from "@heossi/qnsi-sdk-activation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthClient } from "./index.js";

describe("AuthClient Security Tests", () => {
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
				new AuthClient({
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
				new AuthClient({
					baseUrl: "http://localhost:3000",
					apiKey: "test-api-key",
				});
			}).not.toThrow();

			process.env["NODE_ENV"] = originalEnv;
		});

		it("should allow HTTP 127.0.0.1 in development", () => {
			const originalEnv = process.env["NODE_ENV"];
			process.env["NODE_ENV"] = "development";

			expect(() => {
				new AuthClient({
					baseUrl: "http://127.0.0.1:3000",
					apiKey: "test-api-key",
				});
			}).not.toThrow();

			process.env["NODE_ENV"] = originalEnv;
		});

		it("should reject HTTP non-localhost in development", () => {
			const originalEnv = process.env["NODE_ENV"];
			process.env["NODE_ENV"] = "development";

			expect(() => {
				new AuthClient({
					baseUrl: "http://example.com",
					apiKey: "test-api-key",
				});
			}).toThrow("baseUrl must use HTTPS in production");

			process.env["NODE_ENV"] = originalEnv;
		});
	});

	describe("Input Validation", () => {
		const client = new AuthClient({
			baseUrl: "https://api.example.com",
			apiKey: "test-api-key",
		});

		it("should reject invalid email addresses", async () => {
			await expect(
				client.login({
					email: "not-an-email",
					password: "password",
					tenantId: "123e4567-e89b-12d3-a456-426614174000",
				}),
			).rejects.toThrow("Invalid email");
		});

		it("should reject SQL injection in email", async () => {
			await expect(
				client.login({
					email: "admin' OR '1'='1",
					password: "password",
					tenantId: "123e4567-e89b-12d3-a456-426614174000",
				}),
			).rejects.toThrow("Invalid email");
		});

		it("should reject XSS attempts in email", async () => {
			await expect(
				client.login({
					email: "<script>alert('xss')</script>@example.com",
					password: "password",
					tenantId: "123e4567-e89b-12d3-a456-426614174000",
				}),
			).rejects.toThrow("Invalid email");
		});

		it("should reject invalid UUIDs", async () => {
			await expect(
				client.login({
					email: "user@example.com",
					password: "password",
					tenantId: "not-a-uuid",
				}),
			).rejects.toThrow("Invalid tenantId");
		});

		it("should reject SQL injection in tenantId", async () => {
			await expect(
				client.login({
					email: "user@example.com",
					password: "password",
					tenantId: "'; DROP TABLE users; --",
				}),
			).rejects.toThrow("Invalid tenantId");
		});

		it("should reject path traversal in tenantId", async () => {
			await expect(
				client.login({
					email: "user@example.com",
					password: "password",
					tenantId: "../../etc/passwd",
				}),
			).rejects.toThrow("Invalid tenantId");
		});

		it("should reject invalid UUID in registerPasskeyStart", async () => {
			await expect(
				client.registerPasskeyStart({
					userId: "not-a-uuid",
					tenantId: "123e4567-e89b-12d3-a456-426614174000",
				}),
			).rejects.toThrow("Invalid userId");
		});

		it("should reject invalid UUID in listPasskeys", async () => {
			await expect(
				client.listPasskeys("not-a-uuid", "123e4567-e89b-12d3-a456-426614174000"),
			).rejects.toThrow("Invalid userId");
		});
	});

	describe("Error Message Sanitization", () => {
		const client = new AuthClient({
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
						stack: "at Database.connect()",
						password: "secret123",
						apiKey: "api_key_example_123",
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
						stack: "at Database.connect()",
						password: "secret123",
						apiKey: "api_key_example_123",
					}),
			});

			await expect(
				client.login({
					email: "user@example.com",
					password: "password",
					tenantId: "123e4567-e89b-12d3-a456-426614174000",
				}),
			).rejects.toThrow("Auth API error: 500 Internal Server Error");

			const errorMessage = await (async () => {
				try {
					await client.login({
						email: "user@example.com",
						password: "password",
						tenantId: "123e4567-e89b-12d3-a456-426614174000",
					});
					return "";
				} catch (error) {
					return error instanceof Error ? error.message : String(error);
				}
			})();

			expect(errorMessage).not.toContain("secret123");
			expect(errorMessage).not.toContain("api_key_example_123");
			expect(errorMessage).not.toContain("Database connection failed");
			expect(errorMessage).not.toContain("stack");
		});
	});

	describe("Rate Limiting", () => {
		const client = new AuthClient({
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
						accessToken: "token",
						refreshToken: null,
					}),
				};
			});

			const result = await client.login({
				email: "user@example.com",
				password: "password",
				tenantId: "123e4567-e89b-12d3-a456-426614174000",
			});

			expect(result.accessToken).toBe("token");
			expect(attemptCount).toBe(2);
		});

		it("should use exponential backoff when Retry-After is missing", async () => {
			let attemptCount = 0;

			mockFetch.mockImplementation(async () => {
				attemptCount++;
				if (attemptCount < 3) {
					return {
						ok: false,
						status: 429,
						statusText: "Too Many Requests",
						headers: new Headers(),
						text: async () => "",
					};
				}
				return {
					ok: true,
					status: 200,
					headers: new Headers(),
					json: async () => ({
						accessToken: "token",
						refreshToken: null,
					}),
				};
			});

			await client.login({
				email: "user@example.com",
				password: "password",
				tenantId: "123e4567-e89b-12d3-a456-426614174000",
			});

			expect(attemptCount).toBe(3);
		});

		it("should fail after max retries", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 429,
				statusText: "Too Many Requests",
				headers: new Headers(),
				text: async () => "",
			});

			await expect(
				client.login({
					email: "user@example.com",
					password: "password",
					tenantId: "123e4567-e89b-12d3-a456-426614174000",
				}),
			).rejects.toThrow("Rate limit exceeded after 2 retries");
		});
	});
});
