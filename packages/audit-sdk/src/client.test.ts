import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Only the activation edge is doubled; AuditClient itself is the real implementation. */
const activateSdk = vi.fn();

vi.mock("@heossihq/qnsi-sdk-activation", () => ({
	activateSdk: (...args: unknown[]) => activateSdk(...args),
}));

import { AuditClient, DEFAULT_BASE_URL, toNistAlgorithmName } from "./index.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SUB_ID = "22222222-2222-4222-8222-222222222222";
const POLICY_ID = "33333333-3333-4333-8333-333333333333";

function stubFetch(impl: (...args: unknown[]) => unknown) {
	const fetchMock = vi.fn(impl);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function jsonResponse(body: unknown, init: { status?: number; headers?: Headers } = {}) {
	const status = init.status ?? 200;
	return {
		ok: status < 400,
		status,
		statusText: status === 200 ? "OK" : "Error",
		headers: init.headers ?? new Headers(),
		json: async () => body,
		text: async () => JSON.stringify(body),
	};
}

function client(overrides: Record<string, unknown> = {}) {
	return new AuditClient({ apiKey: "tok", baseUrl: "https://audit.example", ...overrides });
}

function urlOf(fetchMock: ReturnType<typeof stubFetch>, index = 0): string {
	return String(fetchMock.mock.calls[index]?.[0]);
}

function initOf(fetchMock: ReturnType<typeof stubFetch>, index = 0) {
	return fetchMock.mock.calls[index]?.[1] as {
		method: string;
		headers: Record<string, string>;
		body?: string;
	};
}

beforeEach(() => {
	vi.stubEnv("NODE_ENV", "test");
	activateSdk.mockReset().mockResolvedValue({ tenantId: TENANT });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("construction", () => {
	it("refuses a missing api key", () => {
		expect(() => new AuditClient({ apiKey: "" })).toThrow("apiKey is required");
		expect(() => new AuditClient({ apiKey: "   " })).toThrow("apiKey is required");
	});

	it("defaults to the public cloud base url", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ events: [] }));
		await new AuditClient({ apiKey: "tok" }).listEvents();

		expect(urlOf(fetchMock).startsWith(DEFAULT_BASE_URL)).toBe(true);
	});

	it("trims a trailing slash from the base url", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ events: [] }));
		await client({ baseUrl: "https://audit.example/" }).listEvents();

		expect(urlOf(fetchMock)).toBe("https://audit.example/audit/v1/events");
	});

	it.each(["http://localhost:8080", "http://127.0.0.1:8080"])("allows %s in development", (url) => {
		vi.stubEnv("NODE_ENV", "development");
		expect(() => new AuditClient({ apiKey: "tok", baseUrl: url })).not.toThrow();
	});

	it("rejects plain http against a public host", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(() => new AuditClient({ apiKey: "tok", baseUrl: "http://audit.example" })).toThrow(
			"baseUrl must use HTTPS in production",
		);
	});

	it.each([
		"http://audit.internal/",
		"http://10.0.0.5",
		"http://172.16.0.5",
		"http://172.31.0.5",
		"http://192.168.1.5",
		"http://localhost:8080",
	])("treats %s as an internal service address", (url) => {
		vi.stubEnv("NODE_ENV", "production");
		expect(() => new AuditClient({ apiKey: "tok", baseUrl: url })).not.toThrow();
	});

	it.each([
		"http://11.0.0.5",
		"http://172.15.0.5",
		"http://172.32.0.5",
		"http://192.169.1.5",
	])("rejects %s as not internal", (url) => {
		vi.stubEnv("NODE_ENV", "production");
		expect(() => new AuditClient({ apiKey: "tok", baseUrl: url })).toThrow(
			"baseUrl must use HTTPS in production",
		);
	});

	it("rejects an unparseable http base url", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(() => new AuditClient({ apiKey: "tok", baseUrl: "http://" })).toThrow(
			"baseUrl must use HTTPS in production",
		);
	});

	it("falls back to a fixed telemetry target when the host is unparseable", () => {
		const built = client({ baseUrl: "https://[" });

		expect((built as unknown as { targetService: string }).targetService).toBe("audit-service");
	});

	it("skips activation entirely for an internal service address", async () => {
		stubFetch(() => jsonResponse({ events: [] }));
		await new AuditClient({ apiKey: "tok", baseUrl: "http://audit.internal" }).listEvents();

		expect(activateSdk).not.toHaveBeenCalled();
	});

	it("activates once for a public address and reuses the result", async () => {
		stubFetch(() => jsonResponse({ events: [] }));
		const c = client();

		await c.listEvents();
		await c.listEvents();

		expect(activateSdk).toHaveBeenCalledTimes(1);
		expect(activateSdk).toHaveBeenCalledWith(
			expect.objectContaining({ apiKey: "tok", sdkId: "audit-sdk" }),
		);
	});
});

describe("request plumbing", () => {
	it("sends the bearer key and the activated tenant header", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ events: [] }));
		await client().listEvents();

		expect(initOf(fetchMock).headers["Authorization"]).toBe("Bearer tok");
		expect(initOf(fetchMock).headers["x-qnsp-tenant-id"]).toBe(TENANT);
	});

	it("omits the tenant header when activation is skipped", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ events: [] }));
		await new AuditClient({ apiKey: "tok", baseUrl: "http://audit.internal" }).listEvents();

		expect(initOf(fetchMock).headers["x-qnsp-tenant-id"]).toBeUndefined();
	});

	it("returns undefined for a 204 with no body", async () => {
		stubFetch(() => jsonResponse(null, { status: 204 }));

		await expect(client().deleteSubscription(SUB_ID)).resolves.toBeUndefined();
	});

	it("raises on a non-2xx response", async () => {
		stubFetch(() => jsonResponse({}, { status: 500 }));

		await expect(client().listEvents()).rejects.toThrow("Audit API error: 500");
	});

	it("reports a timeout distinctly", async () => {
		vi.useFakeTimers();
		stubFetch((_url, init) => {
			const signal = (init as { signal?: AbortSignal }).signal;
			return new Promise((_resolve, reject) => {
				signal?.addEventListener("abort", () => {
					const err = new Error("aborted");
					err.name = "AbortError";
					reject(err);
				});
			});
		});
		const c = client({ timeoutMs: 100 });

		const pending = c.listEvents();
		const assertion = expect(pending).rejects.toThrow("Request timeout after 100ms");
		await vi.advanceTimersByTimeAsync(100);
		await assertion;
	});

	it("honours a caller-supplied abort signal", async () => {
		const controller = new AbortController();
		const fetchMock = stubFetch(() => jsonResponse({ events: [] }));
		// listEvents does not expose a signal, so drive the private request directly.
		await (
			client() as unknown as {
				request: (m: string, p: string, o: Record<string, unknown>) => Promise<unknown>;
			}
		).request("GET", "/audit/v1/events", { signal: controller.signal });

		expect((initOf(fetchMock) as unknown as { signal: AbortSignal }).signal).toBe(
			controller.signal,
		);
	});
});

describe("rate limiting", () => {
	it("honours Retry-After before retrying", async () => {
		vi.useFakeTimers();
		let calls = 0;
		stubFetch(() => {
			calls += 1;
			return calls === 1
				? jsonResponse({}, { status: 429, headers: new Headers({ "Retry-After": "2" }) })
				: jsonResponse({ events: [] });
		});
		const pending = client().listEvents();
		await vi.advanceTimersByTimeAsync(2_000);

		await expect(pending).resolves.toEqual({ events: [] });
		expect(calls).toBe(2);
	});

	it("backs off exponentially without a Retry-After", async () => {
		vi.useFakeTimers();
		let calls = 0;
		stubFetch(() => {
			calls += 1;
			return calls === 1 ? jsonResponse({}, { status: 429 }) : jsonResponse({ events: [] });
		});
		const pending = client({ retryDelayMs: 100 }).listEvents();
		await vi.advanceTimersByTimeAsync(100);

		await expect(pending).resolves.toEqual({ events: [] });
	});

	it("ignores an unparseable Retry-After", async () => {
		vi.useFakeTimers();
		let calls = 0;
		stubFetch(() => {
			calls += 1;
			return calls === 1
				? jsonResponse({}, { status: 429, headers: new Headers({ "Retry-After": "soon" }) })
				: jsonResponse({ events: [] });
		});
		const pending = client({ retryDelayMs: 50 }).listEvents();
		await vi.advanceTimersByTimeAsync(50);

		await expect(pending).resolves.toEqual({ events: [] });
	});

	it("gives up once the retry budget is spent", async () => {
		vi.useFakeTimers();
		stubFetch(() => jsonResponse({}, { status: 429 }));
		const pending = client({ maxRetries: 1, retryDelayMs: 10 }).listEvents();
		const assertion = expect(pending).rejects.toThrow("Rate limit exceeded after 1 retries");
		await vi.advanceTimersByTimeAsync(200);

		await assertion;
	});
});

describe("telemetry", () => {
	it("records a successful call", async () => {
		stubFetch(() => jsonResponse({ events: [] }));
		const record = vi.fn();

		await client({ telemetry: { record } }).listEvents();

		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ operation: "listEvents", status: "ok", httpStatus: 200 }),
		);
	});

	it("records a failure with its message", async () => {
		stubFetch(() => jsonResponse({}, { status: 503 }));
		const record = vi.fn();

		await expect(client({ telemetry: { record } }).listEvents()).rejects.toThrow();
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ status: "error", httpStatus: 503, error: "HTTP 503" }),
		);
	});

	it("records a transport failure with no http status", async () => {
		stubFetch(() => {
			throw new Error("connection reset");
		});
		const record = vi.fn();

		await expect(client({ telemetry: { record } }).listEvents()).rejects.toThrow();
		const call = record.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(call["status"]).toBe("error");
		expect(call["error"]).toBe("connection reset");
		expect(call["httpStatus"]).toBeUndefined();
	});

	it("records with no error field when a non-Error is thrown", async () => {
		stubFetch(() => {
			throw "opaque";
		});
		const record = vi.fn();

		await expect(client({ telemetry: { record } }).listEvents()).rejects.toBeTruthy();
		const call = record.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(call["error"]).toBeUndefined();
	});

	it("builds telemetry from a config object", async () => {
		stubFetch(() => jsonResponse({ events: [] }));

		await expect(
			client({ telemetry: { serviceName: "audit-sdk-test" } }).listEvents(),
		).resolves.toBeTruthy();
	});

	it("stays silent when no telemetry is configured", async () => {
		stubFetch(() => jsonResponse({ events: [] }));

		await expect(client().listEvents()).resolves.toBeTruthy();
	});
});

describe("ingestEvents", () => {
	const event = { topic: "kms.key.create", sourceService: "kms-service", payload: {} };

	it("posts a batch", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ accepted: 1 }));

		await client().ingestEvents({ events: [event] as never });

		expect(urlOf(fetchMock)).toBe("https://audit.example/audit/v1/events");
		expect(initOf(fetchMock).method).toBe("POST");
		expect(JSON.parse(initOf(fetchMock).body as string)).toHaveLength(1);
	});

	it.each([0, 101])("refuses a batch of %i events before any network call", async (count) => {
		const fetchMock = stubFetch(() => jsonResponse({}));

		await expect(
			client().ingestEvents({ events: Array.from({ length: count }, () => event) as never }),
		).rejects.toThrow("between 1 and 100 events");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("accepts the boundary batch sizes", async () => {
		stubFetch(() => jsonResponse({ accepted: 1 }));

		await expect(client().ingestEvents({ events: [event] as never })).resolves.toBeTruthy();
		await expect(
			client().ingestEvents({ events: Array.from({ length: 100 }, () => event) as never }),
		).resolves.toBeTruthy();
	});
});

describe("listEvents query building", () => {
	it("omits the query string entirely when nothing is filtered", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ events: [] }));

		await client().listEvents();

		expect(urlOf(fetchMock)).toBe("https://audit.example/audit/v1/events");
	});

	it("builds every supported filter", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ events: [] }));

		await client().listEvents({
			tenantId: TENANT,
			sourceService: "kms-service",
			topic: "kms.key.create",
			since: "2026-01-01T00:00:00Z",
			limit: 50,
			cursor: "abc",
		});

		const url = new URL(urlOf(fetchMock));
		expect(Object.fromEntries(url.searchParams)).toEqual({
			tenantId: TENANT,
			sourceService: "kms-service",
			topic: "kms.key.create",
			since: "2026-01-01T00:00:00Z",
			limit: "50",
			cursor: "abc",
		});
	});

	it("rejects a malformed tenant id before the network", async () => {
		const fetchMock = stubFetch(() => jsonResponse({}));

		await expect(client().listEvents({ tenantId: "nope" })).rejects.toThrow(/Invalid tenantId/);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("streaming subscriptions", () => {
	it("creates a subscription", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ id: SUB_ID }));

		await client().createSubscription({ name: "s", filter: {} } as never);

		expect(urlOf(fetchMock)).toBe("https://audit.example/audit/v1/streaming/subscriptions");
		expect(initOf(fetchMock).method).toBe("POST");
	});

	it("lists subscriptions with and without filters", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ subscriptions: [] }));

		await client().listSubscriptions();
		expect(urlOf(fetchMock, 0)).toBe("https://audit.example/audit/v1/streaming/subscriptions");

		await client().listSubscriptions({ status: "active", limit: 10, cursor: "c" } as never);
		expect(new URL(urlOf(fetchMock, 1)).searchParams.get("status")).toBe("active");
	});

	it("updates a subscription", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ id: SUB_ID }));

		await client().updateSubscription(SUB_ID, { status: "paused" } as never);

		expect(urlOf(fetchMock)).toContain(`/audit/v1/streaming/subscriptions/${SUB_ID}`);
	});

	it("deletes a subscription", async () => {
		const fetchMock = stubFetch(() => jsonResponse(null, { status: 204 }));

		await client().deleteSubscription(SUB_ID);

		expect(initOf(fetchMock).method).toBe("DELETE");
	});

	it("reads streaming metrics with and without filters", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ delivered: 0 }));

		await client().getStreamingMetrics();
		expect(urlOf(fetchMock, 0)).toBe("https://audit.example/audit/v1/streaming/metrics");

		await client().getStreamingMetrics({
			subscriptionId: SUB_ID,
			since: "2026-01-01T00:00:00Z",
			until: "2026-02-01T00:00:00Z",
		});
		const params = new URL(urlOf(fetchMock, 1)).searchParams;
		expect(params.get("subscriptionId")).toBe(SUB_ID);
		expect(params.get("since")).toBeTruthy();
		expect(params.get("until")).toBeTruthy();
	});

	it("rejects a malformed subscription id in metrics", async () => {
		stubFetch(() => jsonResponse({}));

		await expect(client().getStreamingMetrics({ subscriptionId: "nope" })).rejects.toThrow(
			/Invalid subscriptionId/,
		);
	});
});

describe("retention policies", () => {
	it("creates a policy", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ id: POLICY_ID }));

		await client().createRetentionPolicy({ name: "p", rules: [] } as never);

		expect(urlOf(fetchMock)).toBe("https://audit.example/audit/v1/retention/policies");
	});

	it("lists policies with and without filters", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ policies: [] }));

		await client().listRetentionPolicies();
		expect(urlOf(fetchMock, 0)).toBe("https://audit.example/audit/v1/retention/policies");

		await client().listRetentionPolicies({ status: "active", limit: 5, cursor: "c" } as never);
		expect(new URL(urlOf(fetchMock, 1)).searchParams.get("status")).toBe("active");
	});

	it("updates and deletes a policy", async () => {
		const fetchMock = stubFetch(() => jsonResponse(null, { status: 204 }));

		await client().updateRetentionPolicy(POLICY_ID, { status: "paused" } as never);
		expect(urlOf(fetchMock, 0)).toContain(`/audit/v1/retention/policies/${POLICY_ID}`);

		await client().deleteRetentionPolicy(POLICY_ID);
		expect(initOf(fetchMock, 1).method).toBe("DELETE");
	});

	it("previews and executes a cleanup", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ affected: 0 }));

		await client().previewCleanup({ policyId: POLICY_ID } as never);
		expect(urlOf(fetchMock, 0)).toContain("/retention");

		await client().executeCleanup({ policyId: POLICY_ID } as never);
		expect(initOf(fetchMock, 1).method).toBe("POST");
	});

	it("reads retention metrics with and without filters", async () => {
		const fetchMock = stubFetch(() => jsonResponse({ archived: 0 }));

		await client().getRetentionMetrics();
		expect(urlOf(fetchMock, 0)).toBe("https://audit.example/audit/v1/retention/metrics");

		await client().getRetentionMetrics({
			since: "2026-01-01T00:00:00Z",
			until: "2026-02-01T00:00:00Z",
		});
		expect(new URL(urlOf(fetchMock, 1)).searchParams.get("since")).toBeTruthy();
	});
});

describe("toNistAlgorithmName", () => {
	it("maps an internal algorithm name to its NIST name", () => {
		expect(toNistAlgorithmName("dilithium-3")).toBe("ML-DSA-65");
		expect(toNistAlgorithmName("kyber-768")).toBe("ML-KEM-768");
	});

	it("passes an unknown algorithm through unchanged", () => {
		expect(toNistAlgorithmName("not-a-real-algorithm")).toBe("not-a-real-algorithm");
	});
});
