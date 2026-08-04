import { clearActivationCache } from "@heossihq/qnsi-sdk-activation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpKmsServiceClient } from "./index.js";

// Override global fetch
global.fetch = vi.fn();

const MOCK_ACTIVATION_RESPONSE = {
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
};

describe("HttpKmsServiceClient", () => {
	const baseUrl = "https://kms.example.com";
	const apiToken = "test-token";
	const testTenantId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

	beforeEach(() => {
		vi.clearAllMocks();
		clearActivationCache();
	});

	it("should wrap key successfully", async () => {
		const client = new HttpKmsServiceClient(baseUrl, apiToken);
		const testResponse = {
			keyId: "key-123",
			wrappedKey: "wrapped-key-data",
			algorithm: "kyber-768",
			algorithmNist: "ML-KEM-768",
			provider: "liboqs",
		};

		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(MOCK_ACTIVATION_RESPONSE), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(testResponse), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		const result = await client.wrapKey({
			tenantId: testTenantId,
			dataKey: "data-key-base64",
			keyId: "key-123",
		});

		expect(result).toEqual(testResponse);
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining("/kms/v1/keys/key-123/wrap"),
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					authorization: "Bearer test-token",
					"content-type": "application/json",
				}),
			}),
		);
	});

	it("should include associated data when provided", async () => {
		const client = new HttpKmsServiceClient(baseUrl, apiToken);
		const testResponse = {
			keyId: "key-123",
			wrappedKey: "wrapped-key-data",
			algorithm: "kyber-768",
			provider: "liboqs",
		};

		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(MOCK_ACTIVATION_RESPONSE), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(testResponse), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		await client.wrapKey({
			tenantId: testTenantId,
			dataKey: "data-key-base64",
			keyId: "key-123",
			associatedData: "associated-data-base64",
		});

		const callArgs = vi.mocked(fetch).mock.calls[1];
		const body = JSON.parse(callArgs[1]?.body as string);
		expect(body.associatedData).toBe("associated-data-base64");
	});

	it("should unwrap key successfully", async () => {
		const client = new HttpKmsServiceClient(baseUrl, apiToken);
		const testResponse = {
			dataKey: "unwrapped-key-data",
		};

		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(MOCK_ACTIVATION_RESPONSE), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(testResponse), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		const result = await client.unwrapKey({
			tenantId: testTenantId,
			wrappedKey: "wrapped-key-data",
			keyId: "key-123",
		});

		expect(result).toEqual(testResponse);
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining("/kms/v1/keys/key-123/unwrap"),
			expect.objectContaining({
				method: "POST",
			}),
		);
	});

	it("should throw when constructed without API token", () => {
		expect(() => {
			// @ts-expect-error -- testing runtime validation for missing apiToken
			new HttpKmsServiceClient(baseUrl);
		}).toThrow("QNSP KMS Client: apiToken is required");
	});

	it("should throw when constructed with empty API token", () => {
		expect(() => {
			new HttpKmsServiceClient(baseUrl, "");
		}).toThrow("QNSP KMS Client: apiToken is required");
	});

	it("should throw when constructed with whitespace-only API token", () => {
		expect(() => {
			new HttpKmsServiceClient(baseUrl, "   ");
		}).toThrow("QNSP KMS Client: apiToken is required");
	});

	it("should throw error on wrap failure", async () => {
		const client = new HttpKmsServiceClient(baseUrl, apiToken);

		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(MOCK_ACTIVATION_RESPONSE), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "KMS service unavailable" }), {
				status: 500,
				statusText: "Internal Server Error",
				headers: { "content-type": "application/json" },
			}),
		);

		await expect(
			client.wrapKey({
				tenantId: testTenantId,
				dataKey: "data-key-base64",
				keyId: "key-123",
			}),
		).rejects.toThrow("KMS API error: 500 Internal Server Error");
	});

	it("should throw error on unwrap failure", async () => {
		const client = new HttpKmsServiceClient(baseUrl, apiToken);

		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(MOCK_ACTIVATION_RESPONSE), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "Invalid wrapped key" }), {
				status: 400,
				statusText: "Bad Request",
				headers: { "content-type": "application/json" },
			}),
		);

		await expect(
			client.unwrapKey({
				tenantId: testTenantId,
				wrappedKey: "invalid-wrapped-key",
				keyId: "key-123",
			}),
		).rejects.toThrow("KMS API error: 400 Bad Request");
	});

	it("should handle JSON parse errors gracefully", async () => {
		const client = new HttpKmsServiceClient(baseUrl, apiToken);

		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify(MOCK_ACTIVATION_RESPONSE), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("{", {
				status: 500,
				statusText: "Internal Server Error",
				headers: { "content-type": "application/json" },
			}),
		);

		await expect(
			client.wrapKey({
				tenantId: testTenantId,
				dataKey: "data-key-base64",
				keyId: "key-123",
			}),
		).rejects.toThrow("KMS API error: 500 Internal Server Error");
	});
});
