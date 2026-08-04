import { clearActivationCache } from "@heossihq/qnsi-sdk-activation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VaultClient } from "./index.js";

describe("VaultClient Security Tests", () => {
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
				new VaultClient({
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
				new VaultClient({
					baseUrl: "http://localhost:3000",
					apiKey: "test-api-key",
				});
			}).not.toThrow();

			process.env["NODE_ENV"] = originalEnv;
		});
	});

	describe("Input Validation", () => {
		const client = new VaultClient({
			baseUrl: "https://api.example.com",
			apiKey: "test-api-key",
		});

		it("should reject invalid UUIDs in secret id", async () => {
			await expect(client.getSecret("not-a-uuid")).rejects.toThrow("Invalid id");
		});

		it("should reject SQL injection in secret id", async () => {
			await expect(client.getSecret("'; DROP TABLE secrets; --")).rejects.toThrow("Invalid id");
		});

		it("should reject path traversal in secret id", async () => {
			await expect(client.getSecret("../../etc/passwd")).rejects.toThrow("Invalid id");
		});

		it("should reject invalid UUIDs in tenantId", async () => {
			await expect(
				client.createSecret({
					tenantId: "not-a-uuid",
					name: "test-secret",
					payload: "dGVzdA==",
				}),
			).rejects.toThrow("Invalid tenantId");
		});

		it("should reject SQL injection in tenantId", async () => {
			await expect(
				client.createSecret({
					tenantId: "'; DROP TABLE secrets; --",
					name: "test-secret",
					payload: "dGVzdA==",
				}),
			).rejects.toThrow("Invalid tenantId");
		});

		it("should reject path traversal in tenantId", async () => {
			await expect(
				client.createSecret({
					tenantId: "../../etc/passwd",
					name: "test-secret",
					payload: "dGVzdA==",
				}),
			).rejects.toThrow("Invalid tenantId");
		});
	});

	describe("Error Message Sanitization", () => {
		const client = new VaultClient({
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
						error: "Encryption key leaked: api_key_example_123",
						stack: "at VaultService.encrypt()",
						secret: "my-secret-value",
					}),
			});
			// second call in the IIFE below - activationPromise already resolved
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				headers: new Headers(),
				text: async () =>
					JSON.stringify({
						error: "Encryption key leaked: api_key_example_123",
						stack: "at VaultService.encrypt()",
						secret: "my-secret-value",
					}),
			});

			await expect(client.getSecret("123e4567-e89b-12d3-a456-426614174001")).rejects.toThrow(
				"Vault API error: 500 Internal Server Error",
			);

			const errorMessage = await (async () => {
				try {
					await client.getSecret("123e4567-e89b-12d3-a456-426614174001");
					return "";
				} catch (error) {
					return error instanceof Error ? error.message : String(error);
				}
			})();

			expect(errorMessage).not.toContain("api_key_example_123");
			expect(errorMessage).not.toContain("my-secret-value");
			expect(errorMessage).not.toContain("Encryption key leaked");
			expect(errorMessage).not.toContain("stack");
		});
	});

	describe("Rate Limiting", () => {
		const client = new VaultClient({
			baseUrl: "https://api.example.com",
			apiKey: "test-api-key",
			maxRetries: 2,
			retryDelayMs: 10,
		});

		it("should retry on 429 with Retry-After header", async () => {
			// activation network call - first call on this fresh client instance
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
						name: "test-secret",
						tenantId: "123e4567-e89b-12d3-a456-426614174000",
						version: 1,
						metadata: {},
						rotationPolicy: { intervalSeconds: 3600, expiresAt: null },
						checksum: "abc123",
						createdAt: "2024-01-01T00:00:00Z",
						updatedAt: "2024-01-01T00:00:00Z",
						versionCreatedAt: "2024-01-01T00:00:00Z",
						envelope: { encrypted: "encrypted-data", algorithm: "AES-256-GCM" },
					}),
				};
			});

			const result = await client.getSecret("123e4567-e89b-12d3-a456-426614174001");

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

			await expect(client.getSecret("123e4567-e89b-12d3-a456-426614174001")).rejects.toThrow(
				"Rate limit exceeded after 2 retries",
			);
		});
	});
});
