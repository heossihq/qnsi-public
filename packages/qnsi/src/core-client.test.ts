import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	activateSdk,
	clearActivationCache,
	getActivationLimits,
	getCachedActivation,
	SdkActivationError_,
} from "./_activation/index.js";
import { Internal, SDK_ID, SDK_VERSION } from "./_internal.js";
import { QnsiClient } from "./client.js";
import {
	QnsiApiError,
	QnsiAuthError,
	QnsiError,
	QnsiNetworkError,
	QnsiWebhookError,
} from "./errors.js";

const ACTIVATION = {
	activated: true,
	tenantId: "11111111-1111-4111-8111-111111111111",
	tier: "dev-pro",
	limits: {
		storageGB: 10,
		apiCalls: 50_000,
		enclavesEnabled: false,
		aiTrainingEnabled: false,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
	activationToken: "act-token-1",
	expiresInSeconds: 3_600,
	activatedAt: "2026-08-16T00:00:00.000Z",
};

function activationResponse(overrides?: Record<string, unknown>) {
	return new Response(JSON.stringify({ ...ACTIVATION, ...overrides }), { status: 200 });
}

beforeEach(() => {
	clearActivationCache();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("errors", () => {
	it("every class carries its name, structured fields, and prefixed message", () => {
		expect(new QnsiError("base").name).toBe("QnsiError");

		const network = new QnsiNetworkError("GET", "https://api/x", new Error("ECONNREFUSED"));
		expect(network.message).toContain("network error on GET https://api/x: ECONNREFUSED");
		expect(network.op).toBe("GET");
		expect(network.url).toBe("https://api/x");
		expect(new QnsiNetworkError("GET", "u", "string cause").message).toContain("string cause");
		expect(new QnsiNetworkError("GET", "u", 42).message).toContain("unknown error");

		const auth = new QnsiAuthError("bad key", "INVALID_API_KEY");
		expect(auth.message).toBe("qnsp: auth error (INVALID_API_KEY): bad key");
		expect(new QnsiAuthError("bad key").message).toBe("qnsp: auth error: bad key");

		const api = new QnsiApiError("denied", 403, "FORBIDDEN", { detail: 1 });
		expect(api.message).toBe("qnsp: api error 403 FORBIDDEN: denied");
		expect(api.statusCode).toBe(403);
		expect(api.body).toEqual({ detail: 1 });
		expect(new QnsiApiError("oops", 500).message).toBe("qnsp: api error 500: oops");

		const webhook = new QnsiWebhookError("hmac mismatch");
		expect(webhook.reason).toBe("hmac mismatch");
		expect(webhook.message).toBe("qnsp: webhook error: hmac mismatch");
	});
});

describe("activation client", () => {
	const config = {
		apiKey: "qnsi_pqc_api_test-key-000001",
		sdkId: "qnsi",
		sdkVersion: SDK_VERSION,
		platformUrl: "https://edge.test",
	} as const;

	it("rejects an empty api key before any network call", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await expect(activateSdk({ ...config, apiKey: "  " })).rejects.toMatchObject({
			code: "INVALID_API_KEY",
			statusCode: 401,
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("activates, sends identity headers, caches, and exposes cached limits", async () => {
		const fetchMock = vi.fn().mockImplementation(async () => activationResponse());
		vi.stubGlobal("fetch", fetchMock);

		const first = await activateSdk(config);
		expect(first.tenantId).toBe(ACTIVATION.tenantId);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://edge.test/billing/v1/sdk/activate");
		expect((init.headers as Record<string, string>)["authorization"]).toBe(
			`Bearer ${config.apiKey}`,
		);
		expect(JSON.parse(init.body as string)).toMatchObject({
			sdkId: "qnsi",
			sdkVersion: SDK_VERSION,
			runtime: "node",
		});

		const second = await activateSdk(config);
		expect(second).toBe(first);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		expect(getCachedActivation(config)?.tier).toBe("dev-pro");
		expect(getActivationLimits(config)).toEqual(ACTIVATION.limits);
	});

	it("returns null cached state for unknown keys and clears on demand", async () => {
		expect(getCachedActivation(config)).toBeNull();
		expect(getActivationLimits(config)).toBeNull();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async () => activationResponse()),
		);
		await activateSdk(config);
		clearActivationCache();
		expect(getCachedActivation(config)).toBeNull();
	});

	it("maps structured errors, bare 401s, 429s, other statuses, and transport failures", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						activated: false,
						error: "account suspended",
						code: "ACCOUNT_SUSPENDED",
					}),
					{ status: 403 },
				),
			),
		);
		await expect(activateSdk(config)).rejects.toMatchObject({
			code: "ACCOUNT_SUSPENDED",
			statusCode: 403,
		});

		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
		await expect(activateSdk(config)).rejects.toMatchObject({ code: "INVALID_API_KEY" });

		// Valid JSON that is not a structured activation error falls back to the status mapping.
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 401 })),
		);
		await expect(activateSdk(config)).rejects.toMatchObject({ code: "INVALID_API_KEY" });

		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
		await expect(activateSdk(config)).rejects.toMatchObject({ code: "RATE_LIMITED" });

		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
		await expect(activateSdk(config)).rejects.toMatchObject({
			code: "SERVICE_UNAVAILABLE",
			statusCode: 503,
		});

		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("dns failure")));
		const transport = await activateSdk(config).catch((e: SdkActivationError_) => e);
		expect(transport).toBeInstanceOf(SdkActivationError_);
		expect((transport as SdkActivationError_).message).toContain("dns failure");

		vi.stubGlobal("fetch", vi.fn().mockRejectedValue("raw failure"));
		const raw = await activateSdk(config).catch((e: SdkActivationError_) => e);
		expect((raw as SdkActivationError_).message).toContain("raw failure");
	});

	it("rejects schema-invalid activation bodies as SERVICE_UNAVAILABLE 502", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(JSON.stringify({ activated: true }), { status: 200 })),
		);
		await expect(activateSdk(config)).rejects.toMatchObject({
			code: "SERVICE_UNAVAILABLE",
			statusCode: 502,
		});
	});

	it("reports browser and edge runtimes when node markers are absent", async () => {
		const fetchImpl = vi.fn().mockImplementation(async () => activationResponse());

		vi.stubGlobal("process", { ...process, versions: undefined });
		vi.stubGlobal("window", {});
		vi.stubGlobal("document", {});
		await activateSdk({ ...config, apiKey: "browser-runtime-key-1", fetchImpl });
		expect(
			JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string),
		).toMatchObject({ runtime: "browser" });
		vi.unstubAllGlobals();

		fetchImpl.mockClear();
		vi.stubGlobal("process", { ...process, versions: undefined });
		await activateSdk({ ...config, apiKey: "edge-runtime-key-0001", fetchImpl });
		expect(
			JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string),
		).toMatchObject({ runtime: "edge" });
	});

	it("expires cached activations after their full lifetime", async () => {
		vi.useFakeTimers();
		try {
			const fetchImpl = vi.fn().mockImplementation(async () => activationResponse());
			const expiryConfig = { ...config, apiKey: "expiring-cache-key-01", fetchImpl };
			await activateSdk(expiryConfig);
			expect(getCachedActivation(expiryConfig)).not.toBeNull();
			vi.advanceTimersByTime(3_600_001);
			expect(getCachedActivation(expiryConfig)).toBeNull();
			expect(getActivationLimits(expiryConfig)).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it("honors a custom fetch implementation and the default platform url", async () => {
		const fetchImpl = vi.fn().mockImplementation(async () => activationResponse());
		const result = await activateSdk({
			apiKey: "custom-fetch-key-1",
			sdkId: "qnsi",
			sdkVersion: SDK_VERSION,
			fetchImpl,
		});
		expect(result.activated).toBe(true);
		expect((fetchImpl.mock.calls[0] as [string, RequestInit])[0]).toBe(
			"https://api.qnsi.heossi.com/billing/v1/sdk/activate",
		);
	});
});

describe("Internal", () => {
	const BASE = "https://edge.test";

	function makeInternal() {
		return new Internal({ apiKey: "internal-key-000001", baseUrl: `${BASE}/`, timeoutMs: 500 });
	}

	/** fetch stub: first call answers activation, later calls use the queue. */
	function stubFetch(queue: Array<() => Response | Promise<Response>>) {
		const fetchMock = vi.fn().mockImplementation(async (url: string) => {
			if (String(url).includes("/billing/v1/sdk/activate")) {
				return activationResponse();
			}
			const next = queue.shift();
			if (!next) throw new Error("unexpected request");
			return next();
		});
		vi.stubGlobal("fetch", fetchMock);
		return fetchMock;
	}

	it("requires an api key and applies option defaults", () => {
		expect(() => new Internal({ apiKey: " " })).toThrow(QnsiAuthError);
		const internal = new Internal({ apiKey: "k-000001" });
		expect(internal.baseUrl).toBe("https://api.qnsi.heossi.com");
		expect(internal.timeoutMs).toBe(15_000);
		expect(makeInternal().baseUrl).toBe(BASE);
	});

	it("activates once, injects tenantId into bodies and queries, and parses JSON", async () => {
		const fetchMock = stubFetch([
			() => new Response(JSON.stringify({ ok: true }), { status: 200 }),
		]);
		const internal = makeInternal();
		const result = await internal.request<{ ok: boolean }>("POST", "/vault/v1/secrets", {
			name: "s1",
		});
		expect(result).toEqual({ ok: true });

		const serviceCall = fetchMock.mock.calls.find(([url]) => !String(url).includes("activate")) as [
			string,
			RequestInit,
		];
		expect(serviceCall[0]).toBe(`${BASE}/vault/v1/secrets?tenantId=${ACTIVATION.tenantId}`);
		expect(JSON.parse(serviceCall[1].body as string)).toEqual({
			tenantId: ACTIVATION.tenantId,
			name: "s1",
		});
		expect((serviceCall[1].headers as Record<string, string>)["authorization"]).toBe(
			"Bearer internal-key-000001",
		);
	});

	it("caller-supplied tenantId wins in both body and query", async () => {
		const fetchMock = stubFetch([
			() => new Response(JSON.stringify({ ok: true }), { status: 200 }),
		]);
		const internal = makeInternal();
		await internal.request(
			"POST",
			"/kms/v1/keys",
			{ tenantId: "caller-tenant" },
			{ query: { tenantId: "caller-tenant", limit: 5 }, idempotencyKey: "idem-1" },
		);
		const serviceCall = fetchMock.mock.calls.find(([url]) => !String(url).includes("activate")) as [
			string,
			RequestInit,
		];
		expect(serviceCall[0]).toContain("tenantId=caller-tenant");
		expect(serviceCall[0]).toContain("limit=5");
		expect(JSON.parse(serviceCall[1].body as string)).toEqual({ tenantId: "caller-tenant" });
		expect((serviceCall[1].headers as Record<string, string>)["idempotency-key"]).toBe("idem-1");
	});

	it("passes through non-object bodies, appends to existing query strings, and skips undefined query values", async () => {
		const fetchMock = stubFetch([
			() => new Response(JSON.stringify({ ok: true }), { status: 200 }),
		]);
		const internal = makeInternal();
		await internal.request("POST", "/vault/v1/import?source=cli", ["a", "b"], {
			query: { cursor: undefined },
		});
		const serviceCall = fetchMock.mock.calls.find(([url]) => !String(url).includes("activate")) as [
			string,
			RequestInit,
		];
		expect(serviceCall[0]).toBe(
			`${BASE}/vault/v1/import?source=cli&tenantId=${ACTIVATION.tenantId}`,
		);
		expect(JSON.parse(serviceCall[1].body as string)).toEqual(["a", "b"]);
	});

	it("retries exactly once after a 401 by re-activating", async () => {
		const fetchMock = stubFetch([
			() => new Response(null, { status: 401 }),
			() => new Response(JSON.stringify({ ok: true }), { status: 200 }),
		]);
		const internal = makeInternal();
		const result = await internal.request("GET", "/kms/v1/keys");
		expect(result).toEqual({ ok: true });
		const serviceCalls = fetchMock.mock.calls.filter(([url]) => !String(url).includes("activate"));
		expect(serviceCalls).toHaveLength(2);
	});

	it("maps structured API errors, plain-text errors, 204s, and invalid JSON", async () => {
		stubFetch([
			() =>
				new Response(JSON.stringify({ code: "QUOTA_EXCEEDED", message: "limit reached" }), {
					status: 402,
				}),
		]);
		const internal = makeInternal();
		const apiError = await internal.request("GET", "/kms/v1/keys").catch((e: QnsiApiError) => e);
		expect(apiError).toBeInstanceOf(QnsiApiError);
		expect(apiError).toMatchObject({ statusCode: 402, code: "QUOTA_EXCEEDED" });

		stubFetch([() => new Response("gateway exploded", { status: 502 })]);
		const textError = await makeInternal()
			.request("GET", "/kms/v1/keys")
			.catch((e: QnsiApiError) => e);
		expect((textError as QnsiApiError).message).toContain("gateway exploded");

		stubFetch([
			() => new Response(JSON.stringify({ error: "named error field" }), { status: 500 }),
		]);
		const namedError = await makeInternal()
			.request("GET", "/kms/v1/keys")
			.catch((e: QnsiApiError) => e);
		expect((namedError as QnsiApiError).message).toContain("named error field");

		stubFetch([() => new Response(null, { status: 204 })]);
		expect(await makeInternal().request("DELETE", "/vault/v1/secrets/s1")).toEqual({});

		stubFetch([() => new Response("not-json", { status: 200 })]);
		const jsonError = await makeInternal()
			.request("GET", "/kms/v1/keys")
			.catch((e: QnsiApiError) => e);
		expect((jsonError as QnsiApiError).message).toContain("response is not valid JSON");
	});

	it("defaults the message for bodies without message/error fields and empty bodies", async () => {
		stubFetch([() => new Response(JSON.stringify({ code: "OPAQUE" }), { status: 500 })]);
		const codeOnly = await makeInternal()
			.request("GET", "/kms/v1/keys")
			.catch((e: QnsiApiError) => e);
		expect((codeOnly as QnsiApiError).message).toBe("qnsp: api error 500 OPAQUE: HTTP 500");

		stubFetch([() => new Response(null, { status: 500 })]);
		const empty = await makeInternal()
			.request("GET", "/kms/v1/keys")
			.catch((e: QnsiApiError) => e);
		expect((empty as QnsiApiError).message).toBe("qnsp: api error 500: HTTP 500");
	});

	it("aborts requests that exceed the configured timeout", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
				if (String(url).includes("activate")) return activationResponse();
				return new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
				});
			}),
		);
		const internal = new Internal({
			apiKey: "timeout-key-000001",
			baseUrl: BASE,
			timeoutMs: 10,
		});
		const error = await internal.request("GET", "/kms/v1/keys").catch((e: unknown) => e);
		expect(error).toBeInstanceOf(QnsiNetworkError);
		expect((error as QnsiNetworkError).message).toContain("aborted");
	});

	it("wraps transport failures in QnsiNetworkError", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async (url: string) => {
				if (String(url).includes("activate")) return activationResponse();
				throw new Error("socket hang up");
			}),
		);
		const internal = makeInternal();
		const error = await internal.request("GET", "/kms/v1/keys").catch((e: unknown) => e);
		expect(error).toBeInstanceOf(QnsiNetworkError);
		expect((error as QnsiNetworkError).message).toContain("socket hang up");
	});

	it("caches activation until near expiry and refreshes after invalidation", async () => {
		const fetchMock = stubFetch([
			() => new Response(JSON.stringify({ ok: 1 }), { status: 200 }),
			() => new Response(JSON.stringify({ ok: 2 }), { status: 200 }),
		]);
		const internal = makeInternal();
		await internal.request("GET", "/kms/v1/keys");
		await internal.request("GET", "/kms/v1/keys");
		expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("activate"))).toHaveLength(
			1,
		);

		internal.invalidateActivation();
		clearActivationCache();
		stubFetch([() => new Response(JSON.stringify({ ok: 3 }), { status: 200 })]);
		await internal.request("GET", "/kms/v1/keys");
		expect(await internal.resolveTenantId()).toBe(ACTIVATION.tenantId);
	});

	it("re-handshakes once expiresInSeconds elapses past the refresh buffer", async () => {
		vi.useFakeTimers();
		try {
			const fetchMock = vi.fn().mockImplementation(async (url: string) => {
				if (String(url).includes("activate")) return activationResponse();
				return new Response(JSON.stringify({ ok: true }), { status: 200 });
			});
			vi.stubGlobal("fetch", fetchMock);
			const internal = makeInternal();
			await internal.ensureActivated();
			await internal.ensureActivated();
			expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("activate"))).toHaveLength(
				1,
			);

			// 3600s validity: past 3540s the instance buffer expires; the global
			// cache's 300s refresh buffer expires even earlier, so both re-fetch.
			vi.advanceTimersByTime(3_599_000);
			await internal.ensureActivated();
			expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("activate"))).toHaveLength(
				2,
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it("coalesces concurrent activations into one in-flight handshake", async () => {
		let resolveActivation: ((r: Response) => void) | undefined;
		const fetchMock = vi.fn().mockImplementation(async (url: string) => {
			if (String(url).includes("activate")) {
				return new Promise<Response>((resolve) => {
					resolveActivation = resolve;
				});
			}
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);
		const internal = makeInternal();
		const first = internal.ensureActivated();
		const second = internal.ensureActivated();
		resolveActivation?.(activationResponse());
		expect(await first).toEqual(await second);
		expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("activate"))).toHaveLength(
			1,
		);
	});

	it("treats an unreadable response body as empty", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async (url: string) => {
				if (String(url).includes("activate")) return activationResponse();
				return {
					ok: true,
					status: 200,
					text: () => Promise.reject(new Error("body stream broken")),
				} as unknown as Response;
			}),
		);
		expect(await makeInternal().request("GET", "/kms/v1/keys")).toEqual({});
	});

	it("propagates activation failures and clears the in-flight promise", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
		const internal = makeInternal();
		await expect(internal.ensureActivated()).rejects.toBeInstanceOf(SdkActivationError_);
		// A second attempt reissues the handshake rather than reusing the rejected promise.
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async () => activationResponse()),
		);
		clearActivationCache();
		await expect(internal.ensureActivated()).resolves.toMatchObject({
			tenantId: ACTIVATION.tenantId,
		});
	});
});

describe("QnsiClient", () => {
	it("exposes the eleven sub-clients and activation-derived accessors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async (url: string) => {
				if (String(url).includes("activate")) return activationResponse();
				return new Response(JSON.stringify({ ok: true }), { status: 200 });
			}),
		);
		const client = new QnsiClient({ apiKey: "client-key-000001", baseUrl: "https://edge.test" });
		for (const sub of [
			"vault",
			"kms",
			"audit",
			"auth",
			"tenant",
			"access",
			"billing",
			"cryptoInventory",
			"storage",
			"search",
			"ai",
		] as const) {
			expect(client[sub]).toBeDefined();
		}
		expect((await client.ensureActivated()).activated).toBe(true);
		expect(await client.tenantId()).toBe(ACTIVATION.tenantId);
		expect(await client.tier()).toBe("dev-pro");
		expect(await client.limits()).toEqual(ACTIVATION.limits);
		expect(await client.hasFeature("vaultEnabled")).toBe(true);
		expect(await client.hasFeature("enclavesEnabled")).toBe(false);
		expect(await client.hasFeature("nonexistent")).toBe(false);
	});

	it("SDK identity constants stay in lockstep with the package", () => {
		expect(SDK_ID).toBe("qnsi");
		expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
	});
});
