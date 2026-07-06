import { beforeEach, describe, expect, it } from "vitest";
import {
	activateSdk,
	clearActivationCache,
	getActivationLimits,
	getCachedActivation,
	type SdkActivationConfig,
	SdkActivationError_,
} from "./activation-client.js";

const BASE_CONFIG: SdkActivationConfig = {
	apiKey: "qnsp_test_key_00000000",
	sdkId: "vault-sdk",
	sdkVersion: "0.3.0",
	platformUrl: "https://api.qnsi.heossi.com",
};

describe("SdkActivationError_", () => {
	it("creates error with correct properties", () => {
		const err = new SdkActivationError_("INVALID_API_KEY", "bad key", 401);
		expect(err.name).toBe("SdkActivationError");
		expect(err.code).toBe("INVALID_API_KEY");
		expect(err.message).toBe("bad key");
		expect(err.statusCode).toBe(401);
		expect(err).toBeInstanceOf(Error);
	});
});

describe("activateSdk", () => {
	beforeEach(() => {
		clearActivationCache();
	});

	it("rejects empty API key", async () => {
		await expect(activateSdk({ ...BASE_CONFIG, apiKey: "" })).rejects.toThrow(SdkActivationError_);

		try {
			await activateSdk({ ...BASE_CONFIG, apiKey: "   " });
		} catch (err) {
			expect(err).toBeInstanceOf(SdkActivationError_);
			expect((err as SdkActivationError_).code).toBe("INVALID_API_KEY");
			expect((err as SdkActivationError_).statusCode).toBe(401);
		}
	});

	it("throws SERVICE_UNAVAILABLE on network failure", async () => {
		const config: SdkActivationConfig = {
			...BASE_CONFIG,
			platformUrl: "https://localhost:1",
			timeoutMs: 500,
			fetchImpl: () => {
				throw new Error("Connection refused");
			},
		};

		await expect(activateSdk(config)).rejects.toThrow(SdkActivationError_);

		try {
			await activateSdk(config);
		} catch (err) {
			expect((err as SdkActivationError_).code).toBe("SERVICE_UNAVAILABLE");
			expect((err as SdkActivationError_).statusCode).toBe(503);
		}
	});

	it("throws on 401 response", async () => {
		const config: SdkActivationConfig = {
			...BASE_CONFIG,
			fetchImpl: () => Promise.resolve(new Response(null, { status: 401 })),
		};

		try {
			await activateSdk(config);
		} catch (err) {
			expect(err).toBeInstanceOf(SdkActivationError_);
			expect((err as SdkActivationError_).code).toBe("INVALID_API_KEY");
			expect((err as SdkActivationError_).statusCode).toBe(401);
		}
	});

	it("parses 401 JSON error body and preserves api-keys guidance when present", async () => {
		const config: SdkActivationConfig = {
			...BASE_CONFIG,
			fetchImpl: () =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							activated: false,
							code: "INVALID_API_KEY",
							error: "Invalid API key. Get your key at https://cloud.qnsi.heossi.com/api-keys",
						}),
						{ status: 401, headers: { "content-type": "application/json" } },
					),
				),
		};

		try {
			await activateSdk(config);
		} catch (err) {
			expect(err).toBeInstanceOf(SdkActivationError_);
			expect((err as SdkActivationError_).message).toContain("cloud.qnsi.heossi.com/api-keys");
		}
	});

	it("throws on 429 response", async () => {
		const config: SdkActivationConfig = {
			...BASE_CONFIG,
			fetchImpl: () => Promise.resolve(new Response(null, { status: 429 })),
		};

		try {
			await activateSdk(config);
		} catch (err) {
			expect(err).toBeInstanceOf(SdkActivationError_);
			expect((err as SdkActivationError_).code).toBe("RATE_LIMITED");
			expect((err as SdkActivationError_).statusCode).toBe(429);
		}
	});

	it("caches successful activation and returns from cache", async () => {
		const activationResponse = {
			activated: true,
			tenantId: "a1b2c3d4-e5f6-4789-8abc-def012345678",
			tier: "dev-starter",
			activationToken: "tok_test",
			expiresInSeconds: 3600,
			activatedAt: "2026-03-13T10:00:00Z",
			limits: {
				storageGB: 5,
				apiCalls: 10_000,
				enclavesEnabled: false,
				aiTrainingEnabled: false,
				aiInferenceEnabled: false,
				sseEnabled: false,
				vaultEnabled: true,
			},
		};

		const config: SdkActivationConfig = {
			...BASE_CONFIG,
			fetchImpl: () =>
				Promise.resolve(
					new Response(JSON.stringify(activationResponse), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				),
		};

		const result = await activateSdk(config);
		expect(result.activated).toBe(true);
		expect(result.tier).toBe("dev-starter");
		expect(result.limits.apiCalls).toBe(10_000);

		// Should return from cache
		const cached = getCachedActivation(config);
		expect(cached).not.toBeNull();
		expect(cached?.tenantId).toBe("a1b2c3d4-e5f6-4789-8abc-def012345678");

		const limits = getActivationLimits(config);
		expect(limits).not.toBeNull();
		expect(limits?.storageGB).toBe(5);
	});

	it("returns null for uncached activation", () => {
		expect(getCachedActivation(BASE_CONFIG)).toBeNull();
		expect(getActivationLimits(BASE_CONFIG)).toBeNull();
	});
});
