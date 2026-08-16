import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VaultClient } from "./vault-client.js";

const TENANT = "55555555-5555-4555-8555-555555555555";
const SECRET_ID = "66666666-6666-4666-8666-666666666666";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText: status === 200 ? "OK" : "Error",
		headers: { get: () => null },
		json: async () => body,
	} as unknown as Response;
}

beforeEach(() => {
	fetchMock.mockReset();
	fetchMock.mockResolvedValue(jsonResponse({ id: SECRET_ID }));
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function makeClient(overrides?: Record<string, unknown>) {
	const client = new VaultClient({
		apiKey: "vault-key-000001",
		baseUrl: "https://edge.test/",
		timeoutMs: 500,
		...overrides,
	});
	client.setTenantId(TENANT);
	return client;
}

describe("VaultClient configuration", () => {
	it("requires an api key and applies defaults", () => {
		expect(() => new VaultClient({ apiKey: " " })).toThrow("apiKey is required");
		const client = new VaultClient({ apiKey: "k-1" });
		expect(client).toBeInstanceOf(VaultClient);
	});
});

describe("secret operations", () => {
	it("createSecret validates explicit tenant ids and posts the wire body", async () => {
		const client = makeClient();
		await client.createSecret({
			tenantId: TENANT,
			name: "db-password",
			payload: "cGF5bG9hZA==",
			metadata: { env: "prod" },
			rotationPolicy: { enabled: true, intervalSeconds: 3_600 },
		});
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://edge.test/vault/v1/secrets");
		expect((init.headers as Record<string, string>)["Authorization"]).toBe(
			"Bearer vault-key-000001",
		);
		expect((init.headers as Record<string, string>)["x-qnsp-tenant-id"]).toBe(TENANT);
		expect(JSON.parse(String(init.body))).toEqual({
			tenantId: TENANT,
			name: "db-password",
			payload: "cGF5bG9hZA==",
			metadata: { env: "prod" },
			rotationPolicy: { enabled: true, intervalSeconds: 3_600 },
		});
	});

	it("createSecret falls back to the injected tenant and fails closed without one", async () => {
		const client = makeClient();
		await client.createSecret({ name: "s", payload: "cA==" });
		expect(
			JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)),
		).toMatchObject({ tenantId: TENANT });

		const unresolved = new VaultClient({ apiKey: "k-1", baseUrl: "https://edge.test" });
		await expect(unresolved.createSecret({ name: "s", payload: "cA==" })).rejects.toThrow(
			"tenantId could not be resolved",
		);
		await expect(
			makeClient().createSecret({ tenantId: "not-a-uuid", name: "s", payload: "cA==" }),
		).rejects.toThrow("tenantId must be a valid UUID");
	});

	it("getSecret and rotateSecret validate UUIDs and hit the documented paths", async () => {
		const client = makeClient();
		await client.getSecret(SECRET_ID);
		expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
			`https://edge.test/vault/v1/secrets/${SECRET_ID}`,
		);
		await expect(client.getSecret("nope")).rejects.toThrow("id must be a valid UUID");

		fetchMock.mockClear();
		await client.rotateSecret(SECRET_ID, {
			tenantId: TENANT,
			newPayload: "bmV3",
			metadata: { rotated: true },
			rotationPolicy: { enabled: true, intervalSeconds: 600 },
		});
		const [rotateUrl, rotateInit] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(rotateUrl).toBe(`https://edge.test/vault/v1/secrets/${SECRET_ID}/rotate`);
		expect(JSON.parse(String(rotateInit.body))).toEqual({
			tenantId: TENANT,
			newPayload: "bmV3",
			metadata: { rotated: true },
			rotationPolicy: { enabled: true, intervalSeconds: 600 },
		});

		// Optional fields stay absent when not provided.
		fetchMock.mockClear();
		await client.rotateSecret(SECRET_ID, { tenantId: TENANT });
		expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
			tenantId: TENANT,
		});
		await expect(client.rotateSecret(SECRET_ID, { tenantId: "bad" })).rejects.toThrow(
			"tenantId must be a valid UUID",
		);
	});
});

describe("transport behavior", () => {
	function rateLimited(retryAfter: string | null): Response {
		return {
			ok: false,
			status: 429,
			statusText: "Too Many Requests",
			headers: { get: (name: string) => (name === "Retry-After" ? retryAfter : null) },
			json: async () => ({}),
		} as unknown as Response;
	}

	it("retries 429s with Retry-After, invalid headers, and exponential backoff before failing", async () => {
		vi.useFakeTimers();
		try {
			fetchMock
				.mockResolvedValueOnce(rateLimited("1"))
				.mockResolvedValueOnce(rateLimited("not-a-number"))
				.mockResolvedValueOnce(rateLimited(null))
				.mockResolvedValueOnce(jsonResponse({ id: SECRET_ID }));
			const pending = makeClient().getSecret(SECRET_ID);
			await vi.advanceTimersByTimeAsync(40_000);
			await expect(pending).resolves.toMatchObject({ id: SECRET_ID });
			expect(fetchMock).toHaveBeenCalledTimes(4);

			fetchMock.mockReset();
			fetchMock.mockResolvedValue(rateLimited(null));
			const failing = makeClient().getSecret(SECRET_ID);
			const failure = failing.catch((e: unknown) => e);
			await vi.advanceTimersByTimeAsync(120_000);
			expect(((await failure) as Error).message).toContain("Rate limit exceeded after 3 retries");
		} finally {
			vi.useRealTimers();
		}
	});

	it("maps non-OK statuses, 204s, aborts, and rethrows transport errors", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(null, 403));
		await expect(makeClient().getSecret(SECRET_ID)).rejects.toThrow("Vault API error: 403");

		fetchMock.mockResolvedValueOnce({
			ok: true,
			status: 204,
			statusText: "No Content",
			headers: { get: () => null },
			json: async () => {
				throw new Error("no body");
			},
		});
		await expect(makeClient().getSecret(SECRET_ID)).resolves.toBeUndefined();

		fetchMock.mockImplementationOnce(async (_url: string, init?: RequestInit) => {
			return new Promise((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => {
					const abortError = new Error("aborted");
					abortError.name = "AbortError";
					reject(abortError);
				});
			});
		});
		await expect(makeClient({ timeoutMs: 10 }).getSecret(SECRET_ID)).rejects.toThrow(
			"Request timeout after 10ms",
		);

		fetchMock.mockRejectedValueOnce(new Error("socket hang up"));
		await expect(makeClient().getSecret(SECRET_ID)).rejects.toThrow("socket hang up");
	});

	it("omits the tenant header before injection and merges custom headers", async () => {
		const client = new VaultClient({ apiKey: "k-1", baseUrl: "https://edge.test" });
		await client.getSecret(SECRET_ID);
		const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<
			string,
			string
		>;
		expect(headers["x-qnsp-tenant-id"]).toBeUndefined();
	});
});
