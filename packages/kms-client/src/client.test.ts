import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Only the activation edge is doubled; HttpKmsServiceClient itself is the real implementation. */
const activateSdk = vi.fn();

vi.mock("@heossihq/qnsi-sdk-activation", () => ({
	activateSdk: (...args: unknown[]) => activateSdk(...args),
}));

import { createKmsClient, HttpKmsServiceClient } from "./index.js";

function stubFetch(impl: (...args: unknown[]) => unknown) {
	const fetchMock = vi.fn(impl);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function jsonResponse(body: unknown, init: { status?: number; headers?: Headers } = {}) {
	return {
		ok: (init.status ?? 200) < 400,
		status: init.status ?? 200,
		statusText: "OK",
		headers: init.headers ?? new Headers(),
		json: async () => body,
		text: async () => JSON.stringify(body),
	};
}

beforeEach(() => {
	vi.stubEnv("NODE_ENV", "test");
	activateSdk.mockReset().mockResolvedValue({ tenantId: "tenant-1" });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("transport security", () => {
	it("accepts an https base url", () => {
		expect(() => new HttpKmsServiceClient("https://kms.example", "token")).not.toThrow();
	});

	it("trims a trailing slash from the base url", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ dataKey: "k" }));
		const client = new HttpKmsServiceClient("https://kms.example/", "token");

		await client.unwrapKey({
			tenantId: "11111111-1111-4111-8111-111111111111",
			keyId: "key-1",
			wrappedKey: "w",
		});

		expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/^https:\/\/kms\.example\/kms\/v1\//);
	});

	it.each([
		"http://localhost:8080",
		"http://127.0.0.1:8080",
	])("allows %s in a development environment", (url) => {
		vi.stubEnv("NODE_ENV", "development");

		expect(() => new HttpKmsServiceClient(url, "token")).not.toThrow();
	});

	it("rejects plain http against a public host", () => {
		vi.stubEnv("NODE_ENV", "production");

		expect(() => new HttpKmsServiceClient("http://kms.example", "token")).toThrow(
			"baseUrl must use HTTPS in production",
		);
	});

	it("still allows loopback over http in production, as an internal address", () => {
		vi.stubEnv("NODE_ENV", "production");

		// localhost classifies as an internal service hostname, so the HTTPS rule does not
		// apply to it even outside development. Loopback is not a network exposure.
		expect(() => new HttpKmsServiceClient("http://localhost:8080", "token")).not.toThrow();
	});

	it.each([
		"http://kms.internal/",
		"http://10.0.0.5",
		"http://172.16.0.5",
		"http://172.31.0.5",
		"http://192.168.1.5",
	])("allows %s as an internal service address", (url) => {
		vi.stubEnv("NODE_ENV", "production");

		expect(() => new HttpKmsServiceClient(url, "token")).not.toThrow();
	});

	it.each([
		"http://11.0.0.5",
		"http://172.15.0.5",
		"http://172.32.0.5",
		"http://192.169.1.5",
		"http://999.1.1.1",
		"http://1.2.3",
	])("rejects %s as not an internal address", (url) => {
		vi.stubEnv("NODE_ENV", "production");

		expect(() => new HttpKmsServiceClient(url, "token")).toThrow(
			"baseUrl must use HTTPS in production",
		);
	});

	it("rejects an unparseable base url outside development", () => {
		vi.stubEnv("NODE_ENV", "production");

		expect(() => new HttpKmsServiceClient("http://", "token")).toThrow(
			"baseUrl must use HTTPS in production",
		);
	});
});

describe("credentials", () => {
	it("refuses construction with no credential at all", () => {
		expect(
			() => new HttpKmsServiceClient("https://kms.example", null as unknown as string),
		).toThrow("apiToken is required");
	});

	it("refuses an empty api token", () => {
		expect(() => new HttpKmsServiceClient("https://kms.example", "   ")).toThrow(
			"apiToken is required",
		);
	});

	it("sends a bearer header built from the api token", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ dataKey: "k" }));
		const client = new HttpKmsServiceClient("https://kms.example", "tok-123");

		await client.unwrapKey({
			tenantId: "11111111-1111-4111-8111-111111111111",
			keyId: "key-1",
			wrappedKey: "w",
		});

		const init = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
		expect(init.headers["authorization"]).toBe("Bearer tok-123");
	});

	it("prefers a supplied auth-header function over activation", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ dataKey: "k" }));
		const client = new HttpKmsServiceClient("https://kms.example", {
			getAuthHeader: async () => "Bearer service-jwt",
		});

		await client.unwrapKey({
			tenantId: "11111111-1111-4111-8111-111111111111",
			keyId: "key-1",
			wrappedKey: "w",
		});

		const init = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
		expect(init.headers["authorization"]).toBe("Bearer service-jwt");
		// Internal service-to-service callers must not run SDK activation.
		expect(activateSdk).not.toHaveBeenCalled();
	});

	it("omits the header when the auth-header function yields nothing", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ dataKey: "k" }));
		const client = new HttpKmsServiceClient("https://kms.example", {
			getAuthHeader: async () => undefined,
		});

		await client.unwrapKey({
			tenantId: "11111111-1111-4111-8111-111111111111",
			keyId: "key-1",
			wrappedKey: "w",
		});

		const init = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
		expect(init.headers["authorization"]).toBeUndefined();
	});
});

describe("activation", () => {
	it("activates once and reuses the result across calls", async () => {
		stubFetch(() => jsonResponse({ dataKey: "k" }));
		const client = new HttpKmsServiceClient("https://kms.example", "tok-123");

		await client.unwrapKey({
			tenantId: "11111111-1111-4111-8111-111111111111",
			keyId: "key-1",
			wrappedKey: "w",
		});
		await client.unwrapKey({
			tenantId: "11111111-1111-4111-8111-111111111111",
			keyId: "key-1",
			wrappedKey: "w",
		});

		expect(activateSdk).toHaveBeenCalledTimes(1);
		expect(activateSdk).toHaveBeenCalledWith(
			expect.objectContaining({ apiKey: "tok-123", sdkId: "kms-client" }),
		);
	});
});

describe("rate limiting", () => {
	it("honours a Retry-After header before retrying", async () => {
		vi.useFakeTimers();
		let calls = 0;
		stubFetch(() => {
			calls += 1;
			return calls === 1
				? jsonResponse({}, { status: 429, headers: new Headers({ "Retry-After": "2" }) })
				: jsonResponse({ dataKey: "k" });
		});
		const client = new HttpKmsServiceClient("https://kms.example", "tok");

		const pending = client.unwrapKey({
			tenantId: "11111111-1111-4111-8111-111111111111",
			keyId: "key-1",
			wrappedKey: "w",
		});
		await vi.advanceTimersByTimeAsync(2_000);

		expect(await pending).toEqual({ dataKey: "k" });
		expect(calls).toBe(2);
	});

	it("backs off exponentially when no Retry-After is given", async () => {
		vi.useFakeTimers();
		let calls = 0;
		stubFetch(() => {
			calls += 1;
			return calls === 1 ? jsonResponse({}, { status: 429 }) : jsonResponse({ dataKey: "k" });
		});
		const client = new HttpKmsServiceClient("https://kms.example", "tok", { retryDelayMs: 100 });

		const pending = client.unwrapKey({
			tenantId: "11111111-1111-4111-8111-111111111111",
			keyId: "key-1",
			wrappedKey: "w",
		});
		await vi.advanceTimersByTimeAsync(100);

		expect(await pending).toEqual({ dataKey: "k" });
	});

	it("ignores an unparseable Retry-After and backs off instead", async () => {
		vi.useFakeTimers();
		let calls = 0;
		stubFetch(() => {
			calls += 1;
			return calls === 1
				? jsonResponse({}, { status: 429, headers: new Headers({ "Retry-After": "soon" }) })
				: jsonResponse({ dataKey: "k" });
		});
		const client = new HttpKmsServiceClient("https://kms.example", "tok", { retryDelayMs: 50 });

		const pending = client.unwrapKey({
			tenantId: "11111111-1111-4111-8111-111111111111",
			keyId: "key-1",
			wrappedKey: "w",
		});
		await vi.advanceTimersByTimeAsync(50);

		expect(await pending).toEqual({ dataKey: "k" });
	});

	it("gives up once the retry budget is spent", async () => {
		vi.useFakeTimers();
		stubFetch(() => jsonResponse({}, { status: 429 }));
		const client = new HttpKmsServiceClient("https://kms.example", "tok", {
			maxRetries: 1,
			retryDelayMs: 10,
		});

		const pending = client.unwrapKey({
			tenantId: "11111111-1111-4111-8111-111111111111",
			keyId: "key-1",
			wrappedKey: "w",
		});
		const assertion = expect(pending).rejects.toThrow("Rate limit exceeded after 1 retries");
		await vi.advanceTimersByTimeAsync(100);

		await assertion;
	});
});

describe("createKmsClient", () => {
	it("builds a client pointed at the QNSP cloud", () => {
		expect(createKmsClient("tok")).toBeInstanceOf(HttpKmsServiceClient);
	});
});

describe("wrapKey", () => {
	const TENANT = "11111111-1111-4111-8111-111111111111";

	it("posts the wrap request and maps the algorithm to its NIST name", async () => {
		const fetchMock = stubFetch(() =>
			jsonResponse({
				keyId: "key-1",
				wrappedKey: "wrapped",
				algorithm: "ml-kem-768",
				provider: "liboqs",
			}),
		);
		const client = new HttpKmsServiceClient("https://kms.example", "tok");

		const result = await client.wrapKey({ tenantId: TENANT, dataKey: "dk", keyId: "key-1" });

		expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/kms/v1/keys/key-1/wrap");
		expect(result.wrappedKey).toBe("wrapped");
		expect(result.algorithmNist).toBeTruthy();
	});

	it("forwards optional associated data only when supplied", async () => {
		const fetchMock = stubFetch(() =>
			jsonResponse({ keyId: "k", wrappedKey: "w", algorithm: "ml-kem-768", provider: "p" }),
		);
		const client = new HttpKmsServiceClient("https://kms.example", "tok");

		await client.wrapKey({ tenantId: TENANT, dataKey: "dk", keyId: "k", associatedData: "aad" });
		expect(JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body)).toMatchObject({
			associatedData: "aad",
		});

		await client.wrapKey({ tenantId: TENANT, dataKey: "dk", keyId: "k" });
		expect(
			JSON.parse((fetchMock.mock.calls[1]?.[1] as { body: string }).body).associatedData,
		).toBeUndefined();
	});

	it("rejects a malformed tenant id before reaching the network", async () => {
		const fetchMock = stubFetch(() => jsonResponse({}));
		const client = new HttpKmsServiceClient("https://kms.example", "tok");

		await expect(client.wrapKey({ tenantId: "nope", dataKey: "dk", keyId: "k" })).rejects.toThrow(
			/Invalid tenantId/,
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("raises on a non-2xx response and reports it to telemetry", async () => {
		stubFetch(() => jsonResponse({}, { status: 503 }));
		const record = vi.fn();
		const client = new HttpKmsServiceClient("https://kms.example", "tok", {
			telemetry: { record },
		});

		await expect(client.wrapKey({ tenantId: TENANT, dataKey: "dk", keyId: "k" })).rejects.toThrow(
			"KMS API error: 503",
		);
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ operation: "wrapKey", status: "error", httpStatus: 503 }),
		);
	});

	it("reports a transport failure to telemetry and rethrows", async () => {
		stubFetch(() => {
			throw new Error("connection reset");
		});
		const record = vi.fn();
		const client = new HttpKmsServiceClient("https://kms.example", "tok", {
			telemetry: { record },
		});

		await expect(client.wrapKey({ tenantId: TENANT, dataKey: "dk", keyId: "k" })).rejects.toThrow(
			"connection reset",
		);
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ status: "error", error: "connection reset" }),
		);
	});

	it("records a successful call to telemetry", async () => {
		stubFetch(() =>
			jsonResponse({ keyId: "k", wrappedKey: "w", algorithm: "ml-kem-768", provider: "p" }),
		);
		const record = vi.fn();
		const client = new HttpKmsServiceClient("https://kms.example", "tok", {
			telemetry: { record },
		});

		await client.wrapKey({ tenantId: TENANT, dataKey: "dk", keyId: "k" });

		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ operation: "wrapKey", status: "ok", httpStatus: 200 }),
		);
	});

	it("builds telemetry from a config object when one is supplied", async () => {
		stubFetch(() =>
			jsonResponse({ keyId: "k", wrappedKey: "w", algorithm: "ml-kem-768", provider: "p" }),
		);
		const client = new HttpKmsServiceClient("https://kms.example", "tok", {
			telemetry: { serviceName: "kms-client-test" },
		});

		await expect(
			client.wrapKey({ tenantId: TENANT, dataKey: "dk", keyId: "k" }),
		).resolves.toBeTruthy();
	});

	it("injects the activated tenant id as a header", async () => {
		const fetchMock = stubFetch(() =>
			jsonResponse({ keyId: "k", wrappedKey: "w", algorithm: "ml-kem-768", provider: "p" }),
		);
		const client = new HttpKmsServiceClient("https://kms.example", "tok");

		await client.wrapKey({ tenantId: TENANT, dataKey: "dk", keyId: "k" });

		const init = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
		expect(init.headers["x-qnsp-tenant-id"]).toBe("tenant-1");
	});
});

describe("unwrapKey error reporting", () => {
	const TENANT = "11111111-1111-4111-8111-111111111111";

	it("raises on a non-2xx response and reports it to telemetry", async () => {
		stubFetch(() => jsonResponse({}, { status: 403 }));
		const record = vi.fn();
		const client = new HttpKmsServiceClient("https://kms.example", "tok", {
			telemetry: { record },
		});

		await expect(
			client.unwrapKey({ tenantId: TENANT, keyId: "k", wrappedKey: "w" }),
		).rejects.toThrow("KMS API error: 403");
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ operation: "unwrapKey", status: "error" }),
		);
	});

	it("reports a transport failure and rethrows", async () => {
		stubFetch(() => {
			throw new Error("socket hang up");
		});
		const record = vi.fn();
		const client = new HttpKmsServiceClient("https://kms.example", "tok", {
			telemetry: { record },
		});

		await expect(
			client.unwrapKey({ tenantId: TENANT, keyId: "k", wrappedKey: "w" }),
		).rejects.toThrow("socket hang up");
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ status: "error", error: "socket hang up" }),
		);
	});

	it("forwards optional fields only when supplied", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ dataKey: "dk" }));
		const client = new HttpKmsServiceClient("https://kms.example", "tok");

		await client.unwrapKey({
			tenantId: TENANT,
			keyId: "k",
			wrappedKey: "w",
			associatedData: "aad",
			providerHint: "liboqs",
		});

		expect(JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body)).toMatchObject({
			associatedData: "aad",
			providerHint: "liboqs",
		});
	});
});

describe("telemetry target resolution", () => {
	it("labels the target by host when the base url parses", () => {
		const client = new HttpKmsServiceClient("https://kms.example", "tok");

		expect((client as unknown as { targetService: string }).targetService).toBe("kms.example");
	});

	it("falls back to a fixed service name when the base url has no parseable host", () => {
		// Passes the https transport check but the URL constructor rejects it, so the client
		// must still come up with a usable telemetry label rather than failing to construct.
		const client = new HttpKmsServiceClient("https://[", "tok");

		expect((client as unknown as { targetService: string }).targetService).toBe("kms-service");
	});
});

describe("header assembly without activation", () => {
	const TENANT = "11111111-1111-4111-8111-111111111111";

	it("omits both auth and tenant headers for an unauthenticated internal client", async () => {
		const fetchMock = stubFetch(() =>
			jsonResponse({ keyId: "k", wrappedKey: "w", algorithm: "ml-kem-768", provider: "p" }),
		);
		const client = new HttpKmsServiceClient("https://kms.example", {
			getAuthHeader: async () => undefined,
		});

		await client.wrapKey({ tenantId: TENANT, dataKey: "dk", keyId: "k" });

		const init = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
		expect(init.headers["authorization"]).toBeUndefined();
		// Activation never ran, so there is no resolved tenant to inject.
		expect(init.headers["x-qnsp-tenant-id"]).toBeUndefined();
	});

	it("records an error with no message when a non-Error is thrown", async () => {
		stubFetch(() => {
			throw "opaque failure";
		});
		const record = vi.fn();
		const client = new HttpKmsServiceClient("https://kms.example", "tok", {
			telemetry: { record },
		});

		await expect(
			client.unwrapKey({ tenantId: TENANT, keyId: "k", wrappedKey: "w" }),
		).rejects.toBeTruthy();

		const call = record.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(call["status"]).toBe("error");
		expect(call["error"]).toBeUndefined();
	});
});
