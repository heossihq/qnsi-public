import { clearActivationCache } from "@heossihq/qnsi-sdk-activation";
import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	BillingClient,
	type BillingSecurityEnvelope,
	createBillingClientTelemetry,
	isBillingClientTelemetry,
	validateUUID,
} from "./index.js";

global.fetch = vi.fn();

const TENANT = "a1b2c3d4-e5f6-4789-8abc-def012345678";
const PAYMENT = "b1b2c3d4-e5f6-4789-8abc-def012345678";
const INVOICE = "c1b2c3d4-e5f6-4789-8abc-def012345678";

const ACTIVATION = {
	activated: true,
	tenantId: TENANT,
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

const SECURITY: BillingSecurityEnvelope = {
	controlPlaneTokenSha256: null,
	pqcSignatures: [],
	hardwareProvider: null,
	attestationStatus: null,
	attestationProof: null,
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function queueActivation(): void {
	vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
}

function client(overrides: Record<string, unknown> = {}): BillingClient {
	return new BillingClient({
		baseUrl: "https://billing.example.com",
		apiKey: "test-key",
		retryDelayMs: 1,
		...overrides,
	});
}

beforeEach(() => {
	// resetAllMocks (not clearAllMocks): once-queued responses must not leak
	// across tests.
	vi.resetAllMocks();
	clearActivationCache();
});

describe("constructor guards", () => {
	it("throws without an apiKey", () => {
		expect(() => new BillingClient({ apiKey: "  " })).toThrow(/apiKey is required/);
	});

	it("allows http for internal service-mesh hostnames", () => {
		expect(() =>
			client({ baseUrl: "http://billing-service.qnsp-prod.internal:8106" }),
		).not.toThrow();
	});

	it("rejects an unparseable http baseUrl", () => {
		expect(() => client({ baseUrl: "http://[bad" })).toThrow(/HTTPS in production/);
	});

	it("falls back to the service name when the https host cannot be parsed", () => {
		// Passes the https guard but new URL() throws -> targetService fallback
		// executes during construction.
		expect(() => client({ baseUrl: "https://bad host" })).not.toThrow();
	});

	it("defaults telemetry environment when NODE_ENV is unset", () => {
		const saved = process.env["NODE_ENV"];
		delete process.env["NODE_ENV"];
		try {
			const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
			const telemetry = createBillingClientTelemetry({
				serviceName: "s",
				exporterFactory: () =>
					new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 }),
			});
			expect(typeof telemetry.record).toBe("function");
		} finally {
			process.env["NODE_ENV"] = saved;
		}
	});
});

describe("every client method issues the right request", () => {
	async function call<T>(fn: (c: BillingClient) => Promise<T>, response: unknown): Promise<T> {
		// Activation caches globally per apiKey; clear so every call() gets a
		// deterministic [activation, response] fetch sequence.
		clearActivationCache();
		const c = client();
		queueActivation();
		vi.mocked(fetch).mockResolvedValueOnce(json(response));
		return fn(c);
	}

	function lastUrl(): string {
		const calls = vi.mocked(fetch).mock.calls;
		return String(calls[calls.length - 1]?.[0]);
	}

	function lastInit(): RequestInit {
		const calls = vi.mocked(fetch).mock.calls;
		return calls[calls.length - 1]?.[1] as RequestInit;
	}

	it("ingestMeters validates every meter tenant and POSTs the batch", async () => {
		const meter = {
			tenantId: TENANT,
			source: "edge",
			meterType: "api.request",
			quantity: 1,
			unit: "count",
			recordedAt: new Date().toISOString(),
			security: SECURITY,
		};
		const res = await call((c) => c.ingestMeters({ meters: [meter] }), { accepted: 1 });
		expect(res.accepted).toBe(1);
		expect(lastUrl()).toContain("/billing/v1/meters");
		expect(lastInit().method).toBe("POST");
	});

	it("createInvoice POSTs and returns the invoice", async () => {
		const res = await call(
			(c) =>
				c.createInvoice({
					tenantId: TENANT,
					periodStart: "2026-08-01",
					periodEnd: "2026-08-31",
					lineItems: [],
					security: SECURITY,
				}),
			{ id: INVOICE, tenantId: TENANT },
		);
		expect(res.id).toBe(INVOICE);
		expect(lastUrl()).toContain("/billing/v1/invoices");
	});

	it("listInvoices carries tenant, limit, and cursor", async () => {
		await call((c) => c.listInvoices(TENANT, { limit: 5, cursor: "c1" }), {
			items: [],
			nextCursor: null,
		});
		expect(lastUrl()).toContain(`tenantId=${TENANT}`);
		expect(lastUrl()).toContain("limit=5");
		expect(lastUrl()).toContain("cursor=c1");
	});

	it("listInvoices omits optional params when absent", async () => {
		await call((c) => c.listInvoices(TENANT), { items: [], nextCursor: null });
		expect(lastUrl()).not.toContain("limit=");
		expect(lastUrl()).not.toContain("cursor=");
	});

	it("revenue endpoints serialize every filter", async () => {
		await call(
			(c) =>
				c.getRevenueByTenant({
					since: "2026-01-01",
					until: "2026-02-01",
					limit: 3,
					cursor: "x",
					sortBy: "revenue",
					sortOrder: "desc",
				}),
			{ items: [] },
		);
		for (const fragment of ["since=", "until=", "limit=3", "cursor=x", "sortBy=", "sortOrder="]) {
			expect(lastUrl()).toContain(fragment);
		}

		await call(
			(c) => c.getRevenueByService({ since: "2026-01-01", until: "2026-02-01", tenantId: TENANT }),
			{ items: [] },
		);
		expect(lastUrl()).toContain(`tenantId=${TENANT}`);

		await call(
			(c) => c.getRevenueSummary({ since: "2026-01-01", until: "2026-02-01", groupBy: "month" }),
			{ total: 0 },
		);
		expect(lastUrl()).toContain("groupBy=month");

		await call((c) => c.getMRRMetrics({ since: "2026-01-01", until: "2026-02-01" }), { mrr: 0 });
		expect(lastUrl()).toContain("/billing/v1/revenue/mrr?");
	});

	it("revenue endpoints work bare (no query string)", async () => {
		await call((c) => c.getRevenueByTenant(), { items: [] });
		expect(lastUrl()).not.toContain("?");
		await call((c) => c.getRevenueByService(), { items: [] });
		await call((c) => c.getRevenueSummary(), { total: 0 });
		await call((c) => c.getMRRMetrics(), { mrr: 0 });
		expect(lastUrl()).toContain("/billing/v1/revenue/mrr");
	});

	it("forecast endpoints serialize filters and work bare", async () => {
		await call(
			(c) => c.getUsageForecast({ tenantId: TENANT, meterType: "api.request", horizonDays: 30 }),
			{ points: [] },
		);
		expect(lastUrl()).toContain("horizonDays=30");
		await call((c) => c.getUsageForecast(), { points: [] });

		await call((c) => c.getBillingForecast({ tenantId: TENANT, horizonMonths: 3 }), { points: [] });
		expect(lastUrl()).toContain("horizonMonths=3");
		await call((c) => c.getBillingForecast(), { points: [] });

		await call(
			(c) =>
				c.getCapacityForecast({ meterType: "api.request", horizonDays: 7, thresholdPercent: 80 }),
			{ points: [] },
		);
		expect(lastUrl()).toContain("thresholdPercent=80");
		await call((c) => c.getCapacityForecast(), { points: [] });
	});

	it("dunning endpoints round-trip", async () => {
		await call((c) => c.configureDunning({ tenantId: TENANT, retrySchedule: [1, 3, 7] } as never), {
			id: "sched-1",
		});
		expect(lastUrl()).toContain("/billing/v1/dunning/schedules");

		await call((c) => c.retryPayment({ paymentId: PAYMENT }), { status: "retried" });
		expect(lastUrl()).toContain(PAYMENT);

		await call((c) => c.resolveDunning({ paymentId: PAYMENT, resolution: "paid" }), {
			id: PAYMENT,
		});
		expect(lastUrl()).toContain(PAYMENT);

		await call((c) => c.getDunningStatus(TENANT), { status: "none" });
		expect(lastUrl()).toContain(TENANT);

		await call((c) => c.getDunningMetrics({ since: "2026-01-01" }), { total: 0 });
		expect(lastUrl()).toContain("since=");
		await call((c) => c.getDunningMetrics(), { total: 0 });
	});

	it("credit endpoints round-trip", async () => {
		await call(
			(c) => c.createCredit({ tenantId: TENANT, amountCents: 100, reason: "promo" } as never),
			{ id: "credit-1" },
		);
		expect(lastUrl()).toContain("/billing/v1/credits");

		await call((c) => c.getCreditBalance(TENANT), { balanceCents: 100 });
		expect(lastUrl()).toContain(`tenantId=${TENANT}`);

		await call((c) => c.applyCredit({ tenantId: TENANT, invoiceId: INVOICE } as never), {
			applied: true,
		});
		expect(lastUrl()).toContain("/billing/v1/credits/apply");

		await call((c) => c.createPromotion({ code: "SAVE" } as never), { id: "promo-1" });
		expect(lastUrl()).toContain("/billing/v1/credits/promotions");

		await call((c) => c.redeemPromotion({ tenantId: TENANT, code: "SAVE" } as never), {
			redeemed: true,
		});
		expect(lastUrl()).toContain("/billing/v1/credits/redeem");

		await call(
			(c) =>
				c.getCreditHistory({
					tenantId: TENANT,
					since: "2026-01-01",
					until: "2026-02-01",
					limit: 5,
					cursor: "c",
				}),
			{ items: [] },
		);
		expect(lastUrl()).toContain("/billing/v1/credits/history?");
		await call((c) => c.getCreditHistory({ tenantId: TENANT }), { items: [] });
	});
});

describe("remaining branch tails", () => {
	it("uses the default cloud baseUrl when none is given", () => {
		expect(() => new BillingClient({ apiKey: "k" })).not.toThrow();
	});

	it("injects the activated tenant id on subsequent requests from the same client", async () => {
		const c = client();
		queueActivation();
		vi.mocked(fetch).mockResolvedValueOnce(json({ balanceCents: 1 }));
		await c.getCreditBalance(TENANT);

		vi.mocked(fetch).mockResolvedValueOnce(json({ balanceCents: 2 }));
		await c.getCreditBalance(TENANT);

		const calls = vi.mocked(fetch).mock.calls;
		const lastHeaders = (calls[calls.length - 1]?.[1] as RequestInit).headers as Record<
			string,
			string
		>;
		expect(lastHeaders["x-qnsp-tenant-id"]).toBe(TENANT);
	});

	it("serializes every optional createInvoice field and the dunning note/until filters", async () => {
		clearActivationCache();
		const c = client();
		queueActivation();
		vi.mocked(fetch).mockResolvedValueOnce(json({ id: INVOICE }));
		await c.createInvoice({
			tenantId: TENANT,
			periodStart: "2026-08-01",
			periodEnd: "2026-08-31",
			lineItems: [],
			currency: "USD",
			taxesCents: 9,
			metadata: { m: 1 },
			security: SECURITY,
			signature: { provider: "p", algorithm: "a", value: "v", publicKey: "k" },
		});
		let calls = vi.mocked(fetch).mock.calls;
		const invoiceBody = JSON.parse(String((calls[calls.length - 1]?.[1] as RequestInit).body));
		expect(invoiceBody).toMatchObject({ currency: "USD", taxesCents: 9, metadata: { m: 1 } });
		expect(invoiceBody.signature.provider).toBe("p");

		vi.mocked(fetch).mockResolvedValueOnce(json({ id: PAYMENT }));
		await c.resolveDunning({ paymentId: PAYMENT, resolution: "waived", note: "customer call" });
		calls = vi.mocked(fetch).mock.calls;
		const dunningBody = JSON.parse(String((calls[calls.length - 1]?.[1] as RequestInit).body));
		expect(dunningBody.note).toBe("customer call");

		vi.mocked(fetch).mockResolvedValueOnce(json({ total: 0 }));
		await c.getDunningMetrics({ until: "2026-09-01" });
		calls = vi.mocked(fetch).mock.calls;
		expect(String(calls[calls.length - 1]?.[0])).toContain("until=");
	});
});

describe("request core", () => {
	it("retries a 429 without Retry-After using backoff and succeeds", async () => {
		const c = client();
		queueActivation();
		vi.mocked(fetch).mockResolvedValueOnce(new Response("slow down", { status: 429 }));
		vi.mocked(fetch).mockResolvedValueOnce(json({ balanceCents: 1 }));

		const res = await c.getCreditBalance(TENANT);
		expect(res).toEqual({ balanceCents: 1 });
	});

	it("ignores an unparseable Retry-After header", async () => {
		const c = client();
		queueActivation();
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("slow down", { status: 429, headers: { "Retry-After": "soon" } }),
		);
		vi.mocked(fetch).mockResolvedValueOnce(json({ balanceCents: 2 }));

		const res = await c.getCreditBalance(TENANT);
		expect(res).toEqual({ balanceCents: 2 });
	});

	it("returns undefined for 204 responses", async () => {
		const c = client();
		queueActivation();
		vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
		const res = await c.getCreditBalance(TENANT);
		expect(res).toBeUndefined();
	});

	it("maps a REAL timeout abort to a timeout error", async () => {
		const c = client({ timeoutMs: 5 });
		queueActivation();
		// A fetch that honors the abort signal: the client's own timer fires at
		// 5ms and aborts it - the real timeout path, not a simulated rejection.
		vi.mocked(fetch).mockImplementationOnce(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
					});
				}),
		);
		await expect(c.getCreditBalance(TENANT)).rejects.toThrow(/Request timeout after 5ms/);
	});

	it("rethrows non-Error throwables untouched", async () => {
		const c = client();
		queueActivation();
		vi.mocked(fetch).mockRejectedValueOnce("wire snapped");
		await expect(c.getCreditBalance(TENANT)).rejects.toBe("wire snapped");
	});

	it("propagates non-OK statuses without leaking bodies", async () => {
		const c = client();
		queueActivation();
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ secret: "leak" }), { status: 500, statusText: "Boom" }),
		);
		await expect(c.getCreditBalance(TENANT)).rejects.toThrow(/500 Boom/);
	});
});

describe("telemetry wiring", () => {
	it("accepts a prebuilt telemetry object and records ok events", async () => {
		const events: unknown[] = [];
		const c = client({ telemetry: { record: (e: unknown) => events.push(e) } });
		queueActivation();
		vi.mocked(fetch).mockResolvedValueOnce(json({ balanceCents: 1 }));
		await c.getCreditBalance(TENANT);
		expect(events.length).toBeGreaterThan(0);
		expect(events[events.length - 1]).toMatchObject({ status: "ok", method: "GET" });
	});

	it("builds real telemetry from config and exports real data points", async () => {
		const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
		const reader = new PeriodicExportingMetricReader({
			exporter,
			exportIntervalMillis: 60_000,
		});
		const c = client({
			telemetry: { serviceName: "billing-test", exporterFactory: () => reader },
		});
		queueActivation();
		vi.mocked(fetch).mockResolvedValueOnce(new Response("nope", { status: 500 }));
		await expect(c.getCreditBalance(TENANT)).rejects.toThrow();

		const { resourceMetrics } = await reader.collect();
		const names = resourceMetrics.scopeMetrics.flatMap((s) =>
			s.metrics.map((m) => m.descriptor.name),
		);
		expect(names).toContain("billing_sdk_requests_total");
		expect(names).toContain("billing_sdk_request_failures_total");
		expect(names).toContain("billing_sdk_request_duration_ms");
	});

	it("createBillingClientTelemetry honors otlpEndpoint and test-env defaults", () => {
		const withOtlp = createBillingClientTelemetry({
			serviceName: "s",
			otlpEndpoint: "http://localhost:4318/v1/metrics",
			metricsIntervalMs: 60_000,
			metricsTimeoutMs: 1_000,
		});
		expect(typeof withOtlp.record).toBe("function");
		withOtlp.record({
			operation: "op",
			method: "GET",
			route: "/x",
			status: "error",
			durationMs: 1,
		});

		// NODE_ENV=test: no reader at all - record still works.
		const bare = createBillingClientTelemetry({ serviceName: "s" });
		bare.record({
			operation: "op",
			method: "GET",
			route: "/x",
			status: "ok",
			durationMs: 1,
			httpStatus: 200,
			target: "t",
		});
	});

	it("falls back to the console exporter outside test environments", () => {
		vi.stubEnv("NODE_ENV", "production");
		try {
			const telemetry = createBillingClientTelemetry({
				serviceName: "s",
				metricsIntervalMs: 3_600_000,
			});
			expect(typeof telemetry.record).toBe("function");
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("isBillingClientTelemetry distinguishes objects from configs", () => {
		expect(isBillingClientTelemetry({ record: () => {} })).toBe(true);
		expect(isBillingClientTelemetry({ serviceName: "s" })).toBe(false);
	});
});

describe("validateUUID", () => {
	it("accepts valid UUIDs and names the field on failure", () => {
		expect(() => validateUUID(TENANT, "tenantId")).not.toThrow();
		expect(() => validateUUID("nope", "tenantId")).toThrow(/Invalid tenantId/);
	});
});
