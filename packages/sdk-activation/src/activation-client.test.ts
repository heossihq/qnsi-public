import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

	afterEach(() => {
		vi.restoreAllMocks();
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

	it("normalizes defaults and detects node, browser, and edge runtimes", async () => {
		const activationResponse = {
			activated: true,
			tenantId: "a1b2c3d4-e5f6-4789-8abc-def012345678",
			tier: "free",
			activationToken: "tok_test",
			expiresInSeconds: 1,
			activatedAt: "2026-08-14T00:00:00Z",
			limits: {
				storageGB: 1,
				apiCalls: 100,
				enclavesEnabled: false,
				aiTrainingEnabled: false,
				aiInferenceEnabled: false,
				sseEnabled: false,
				vaultEnabled: false,
			},
		};
		const calls: Array<{ url: string; body: { runtime: string } }> = [];
		const fetchImpl: typeof fetch = async (input, init) => {
			calls.push({
				url: String(input),
				body: JSON.parse(String(init?.body)) as { runtime: string },
			});
			return new Response(JSON.stringify(activationResponse), { status: 200 });
		};
		const originalProcess = Object.getOwnPropertyDescriptor(globalThis, "process");
		const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
		const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
		try {
			await activateSdk({ ...BASE_CONFIG, platformUrl: "https://example.test/", fetchImpl });
			clearActivationCache();
			Reflect.deleteProperty(globalThis, "process");
			Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
			Object.defineProperty(globalThis, "document", { configurable: true, value: {} });
			await activateSdk({ ...BASE_CONFIG, apiKey: "browser_key_0000", fetchImpl });
			clearActivationCache();
			Reflect.deleteProperty(globalThis, "window");
			Reflect.deleteProperty(globalThis, "document");
			await activateSdk({ ...BASE_CONFIG, apiKey: "edge_key_000000", fetchImpl });
		} finally {
			if (originalProcess) Object.defineProperty(globalThis, "process", originalProcess);
			if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
			else Reflect.deleteProperty(globalThis, "window");
			if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
			else Reflect.deleteProperty(globalThis, "document");
		}
		expect(calls.map((call) => call.body.runtime)).toEqual(["node", "browser", "edge"]);
		expect(calls[0]?.url).toBe("https://example.test/billing/v1/sdk/activate");
	});

	it("uses the default platform URL, timeout, and global fetch", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						activated: true,
						tenantId: "a1b2c3d4-e5f6-4789-8abc-def012345678",
						tier: "free",
						activationToken: "token",
						expiresInSeconds: 3600,
						activatedAt: "2026-08-14T00:00:00Z",
						limits: {
							storageGB: 1,
							apiCalls: 1,
							enclavesEnabled: false,
							aiTrainingEnabled: false,
							aiInferenceEnabled: false,
							sseEnabled: false,
							vaultEnabled: false,
						},
					}),
					{ status: 200 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);
		await activateSdk({
			apiKey: "default_key_0000",
			sdkId: "vault-sdk",
			sdkVersion: "1.0.0",
		});
		expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
			"https://api.qnsi.heossi.com/billing/v1/sdk/activate",
		);
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

	it("fails closed on malformed errors, generic errors, and malformed success bodies", async () => {
		const responses = [
			new Response("not-json", { status: 400 }),
			new Response(JSON.stringify({ unexpected: true }), { status: 500 }),
			new Response(JSON.stringify({ unexpected: true }), { status: 200 }),
		];
		for (const response of responses) {
			clearActivationCache();
			await expect(
				activateSdk({ ...BASE_CONFIG, fetchImpl: () => Promise.resolve(response) }),
			).rejects.toBeInstanceOf(SdkActivationError_);
		}
		await expect(
			activateSdk({ ...BASE_CONFIG, fetchImpl: () => Promise.reject("offline") }),
		).rejects.toThrow(/offline/);
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

		let fetchCalls = 0;
		const config: SdkActivationConfig = {
			...BASE_CONFIG,
			fetchImpl: () => {
				fetchCalls += 1;
				return Promise.resolve(
					new Response(JSON.stringify(activationResponse), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);
			},
		};

		const result = await activateSdk(config);
		expect(result.activated).toBe(true);
		expect(result.tier).toBe("dev-starter");
		expect(result.limits.apiCalls).toBe(10_000);
		expect(await activateSdk(config)).toBe(result);
		expect(fetchCalls).toBe(1);

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

	it("expires cached activations and refreshes entries inside the refresh buffer", async () => {
		let now = 1_000_000;
		vi.spyOn(Date, "now").mockImplementation(() => now);
		let calls = 0;
		const response = {
			activated: true,
			tenantId: "a1b2c3d4-e5f6-4789-8abc-def012345678",
			tier: "free",
			activationToken: "token",
			expiresInSeconds: 1,
			activatedAt: "2026-08-14T00:00:00Z",
			limits: {
				storageGB: 1,
				apiCalls: 1,
				enclavesEnabled: false,
				aiTrainingEnabled: false,
				aiInferenceEnabled: false,
				sseEnabled: false,
				vaultEnabled: false,
			},
		};
		const config = {
			...BASE_CONFIG,
			fetchImpl: () => {
				calls += 1;
				return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
			},
		};
		await activateSdk(config);
		await activateSdk(config);
		expect(calls).toBe(2);
		now += 2_000;
		expect(getCachedActivation(config)).toBeNull();
	});
});
