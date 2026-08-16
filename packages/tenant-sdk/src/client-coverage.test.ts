import { clearActivationCache } from "@heossihq/qnsi-sdk-activation";
import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	createTenantClientTelemetry,
	isTenantClientTelemetry,
	TenantClient,
	validateUUID,
} from "./index.js";

global.fetch = vi.fn();

const TENANT = "a1b2c3d4-e5f6-4789-8abc-def012345678";
const ID = "b1b2c3d4-e5f6-4789-8abc-def012345678";

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

const SECURITY = {
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

function client(overrides: Record<string, unknown> = {}): TenantClient {
	return new TenantClient({
		baseUrl: "https://tenant.example.com",
		apiKey: "test-key",
		retryDelayMs: 1,
		...overrides,
	});
}

beforeEach(() => {
	vi.resetAllMocks();
	clearActivationCache();
});

function lastUrl(): string {
	const calls = vi.mocked(fetch).mock.calls;
	return String(calls[calls.length - 1]?.[0]);
}

function lastInit(): RequestInit {
	const calls = vi.mocked(fetch).mock.calls;
	return calls[calls.length - 1]?.[1] as RequestInit;
}

function lastBody(): Record<string, unknown> {
	return JSON.parse(String(lastInit().body));
}

async function call<T>(fn: (c: TenantClient) => Promise<T>, response: unknown): Promise<T> {
	clearActivationCache();
	const c = client();
	vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
	vi.mocked(fetch).mockResolvedValueOnce(
		response === undefined ? new Response(null, { status: 204 }) : json(response),
	);
	return fn(c);
}

describe("constructor guards", () => {
	it("covers apiKey, http rules, bad urls, and defaults", () => {
		expect(() => new TenantClient({ apiKey: " " })).toThrow(/apiKey is required/);
		expect(() =>
			client({ baseUrl: "http://tenant-service.qnsp-prod.internal:8108" }),
		).not.toThrow();
		expect(() => client({ baseUrl: "http://[bad" })).toThrow(/HTTPS in production/);
		expect(() => client({ baseUrl: "https://bad host" })).not.toThrow();
		expect(() => new TenantClient({ apiKey: "k" })).not.toThrow();
	});
});

describe("tenant CRUD", () => {
	it("createTenant with every optional field and minimal", async () => {
		await call(
			(c) =>
				c.createTenant({
					name: "Acme",
					slug: "acme",
					plan: "starter" as never,
					region: "ap-southeast-1",
					complianceTags: ["gdpr"],
					hsmMode: "shared" as never,
					metadata: { m: 1 },
					domains: [{ domain: "acme.com", verified: true }],
					security: SECURITY as never,
					signature: { provider: "p", algorithm: "a", value: "v", publicKey: "k" } as never,
				}),
			{ id: ID },
		);
		expect(lastUrl()).toContain("/tenant/v1/tenants");
		expect(lastBody()).toMatchObject({ plan: "starter", metadata: { m: 1 } });
		await call((c) => c.createTenant({ name: "Acme", slug: "acme", security: SECURITY as never }), {
			id: ID,
		});
		expect(lastBody()["plan"]).toBeUndefined();
	});

	it("updateTenant full and minimal; getTenant; listTenants variants", async () => {
		await call(
			(c) =>
				c.updateTenant(ID, {
					plan: "pro" as never,
					status: "active" as never,
					complianceTags: [],
					hsmMode: "shared" as never,
					metadata: {},
					security: SECURITY as never,
					signature: { provider: "p", algorithm: "a", value: "v", publicKey: "k" } as never,
				}),
			{ id: ID },
		);
		expect(lastInit().method).toBe("PATCH");
		await call((c) => c.updateTenant(ID, { security: SECURITY as never }), { id: ID });

		await call((c) => c.getTenant(ID), { id: ID });
		expect(lastUrl()).toContain(`/tenant/v1/tenants/${ID}`);

		await call((c) => c.listTenants({ limit: 5, cursor: "c" }), { items: [], nextCursor: null });
		expect(lastUrl()).toContain("limit=5");
		await call((c) => c.listTenants(), { items: [], nextCursor: null });
	});
});

describe("crypto policy", () => {
	const POLICY = {
		policyTier: "default",
		customAllowedKemAlgorithms: [],
		customAllowedSignatureAlgorithms: [],
	};

	it("v0 get/upsert with and without optional fields", async () => {
		await call((c) => c.getTenantCryptoPolicy(TENANT), POLICY);
		expect(lastUrl()).toContain("crypto-policy");

		await call(
			(c) =>
				c.upsertTenantCryptoPolicy(TENANT, {
					policyTier: "strict" as never,
					customAllowedKemAlgorithms: ["kyber-768"],
					customAllowedSignatureAlgorithms: ["dilithium-3"],
					requireHsmForRootKeys: true,
					maxKeyAgeDays: 90,
				}),
			POLICY,
		);
		expect(lastBody()).toMatchObject({ requireHsmForRootKeys: true, maxKeyAgeDays: 90 });
		await call(
			(c) => c.upsertTenantCryptoPolicy(TENANT, { policyTier: "default" as never }),
			POLICY,
		);
	});

	it("v1 get/history/update/tier toggles/rollback with etag guards", async () => {
		await call((c) => c.getTenantCryptoPolicyV1(TENANT), { policy: {} });
		expect(lastUrl()).toContain("crypto-policy-v1");

		await call((c) => c.listTenantCryptoPolicyV1History(TENANT, { limit: 3 }), { items: [] });
		expect(lastUrl()).toContain("history?limit=3");
		await call((c) => c.listTenantCryptoPolicyV1History(TENANT), { items: [] });

		await call((c) => c.updateTenantCryptoPolicyV1(TENANT, {} as never, "etag-1"), { policy: {} });
		expect((lastInit().headers as Record<string, string>)["If-Match"]).toBe("etag-1");
		await expect(client().updateTenantCryptoPolicyV1(TENANT, {} as never, "")).rejects.toThrow(
			/etag is required/,
		);

		await call((c) => c.enableTier0Legacy(TENANT, { expiry: "2026-12-31" }, "e"), { policy: {} });
		expect(lastUrl()).toContain("tier0/enable");
		await expect(client().enableTier0Legacy(TENANT, { expiry: "x" }, "")).rejects.toThrow(
			/etag is required/,
		);

		await call((c) => c.disableTier0Legacy(TENANT, "e"), { policy: {} });
		expect(lastUrl()).toContain("tier0/disable");
		await expect(client().disableTier0Legacy(TENANT, "")).rejects.toThrow(/etag is required/);

		await call((c) => c.enableTier4Experimental(TENANT, { approvedBy: "ciso" }, "e"), {
			policy: {},
		});
		expect(lastUrl()).toContain("tier4/enable");
		await expect(client().enableTier4Experimental(TENANT, { approvedBy: "x" }, "")).rejects.toThrow(
			/etag is required/,
		);

		await call((c) => c.rollbackTenantCryptoPolicyV1(TENANT, { historyId: ID }, "e"), {
			policy: {},
		});
		expect(lastBody()).toMatchObject({ historyId: ID });
		await call((c) => c.rollbackTenantCryptoPolicyV1(TENANT, { policyHash: "h" }, "e"), {
			policy: {},
		});
		await expect(
			client().rollbackTenantCryptoPolicyV1(TENANT, { historyId: ID }, ""),
		).rejects.toThrow(/etag is required/);
		await expect(client().rollbackTenantCryptoPolicyV1(TENANT, {}, "e")).rejects.toThrow(
			/historyId or policyHash/,
		);
	});

	it("algorithm convenience methods honor custom lists and tier defaults", async () => {
		await expect(
			call((c) => c.getAllowedKemAlgorithms(TENANT), {
				policyTier: "default",
				customAllowedKemAlgorithms: ["kyber-1024"],
			}),
		).resolves.toEqual(["kyber-1024"]);
		await expect(
			call((c) => c.getAllowedKemAlgorithms(TENANT), { policyTier: "default" }),
		).resolves.toContain("kyber-768");

		await expect(
			call((c) => c.getAllowedSignatureAlgorithms(TENANT), {
				policyTier: "default",
				customAllowedSignatureAlgorithms: ["dilithium-5"],
			}),
		).resolves.toEqual(["dilithium-5"]);
		await expect(
			call((c) => c.getAllowedSignatureAlgorithms(TENANT), { policyTier: "default" }),
		).resolves.toContain("dilithium-3");

		await expect(
			call((c) => c.getDefaultKemAlgorithm(TENANT), { policyTier: "default" }),
		).resolves.toBeTruthy();
		await expect(
			call((c) => c.getDefaultSignatureAlgorithm(TENANT), { policyTier: "default" }),
		).resolves.toBeTruthy();
	});
});

describe("health, quotas, onboarding, isolation", () => {
	it("health snapshot/current/trends/alerts", async () => {
		await call((c) => c.recordHealthSnapshot({ tenantId: TENANT, metrics: {} as never }), {
			id: ID,
		});
		expect(lastUrl()).toContain("health/snapshots");

		await call((c) => c.getCurrentHealth(TENANT), { id: ID });

		await call(
			(c) =>
				c.getHealthTrends({
					tenantId: TENANT,
					since: "2026-01-01",
					until: "2026-02-01",
					granularity: "day" as never,
				}),
			{ points: [] },
		);
		expect(lastUrl()).toContain("granularity=day");
		await call((c) => c.getHealthTrends({ tenantId: TENANT }), { points: [] });

		await call(
			(c) =>
				c.createHealthAlert({
					tenantId: TENANT,
					severity: "high" as never,
					title: "t",
					description: "d",
					metric: "cpu",
					threshold: 90,
					currentValue: 95,
				}),
			{ id: ID },
		);
		expect(lastBody()).toMatchObject({ metric: "cpu", threshold: 90 });
		await call(
			(c) =>
				c.createHealthAlert({
					tenantId: TENANT,
					severity: "low" as never,
					title: "t",
					description: "d",
				}),
			{ id: ID },
		);

		await call((c) => c.acknowledgeAlert({ alertId: ID, acknowledgedBy: "ops", note: "seen" }), {
			id: ID,
		});
		expect(lastBody()).toMatchObject({ note: "seen" });
		await call((c) => c.acknowledgeAlert({ alertId: ID, acknowledgedBy: "ops" }), { id: ID });
	});

	it("quota usage/current/forecast/suggestions", async () => {
		await call(
			(c) =>
				c.recordQuotaUsage({
					tenantId: TENANT,
					quotaName: "api",
					usage: 5,
					timestamp: "2026-08-15T00:00:00Z",
				}),
			undefined,
		);
		await call(
			(c) => c.recordQuotaUsage({ tenantId: TENANT, quotaName: "api", usage: 5 }),
			undefined,
		);

		await call((c) => c.getCurrentQuotas(TENANT), { quotas: [] });

		await call((c) => c.getForecast({ tenantId: TENANT, quotaName: "api", horizonDays: 7 }), {
			points: [],
		});
		expect(lastUrl()).toContain("horizonDays=7");
		await call((c) => c.getForecast({ tenantId: TENANT }), { points: [] });

		await call((c) => c.getQuotaSuggestions(TENANT), { suggestions: [] });
	});

	it("onboarding template/start/status/stats", async () => {
		await call((c) => c.createWorkflowTemplate({ name: "t" } as never), { id: ID });
		expect(lastUrl()).toContain("onboarding/templates");

		await call(
			(c) =>
				c.startOnboarding({
					tenantName: "Acme",
					tenantSlug: "acme",
					ownerEmail: "o@e.com",
					plan: "starter" as never,
					region: "ap",
					ownerName: "O",
					templateId: ID,
					metadata: {},
					priority: "high" as never,
				}),
			{ workflowId: ID },
		);
		expect(lastBody()).toMatchObject({ templateId: ID, priority: "high" });
		await call(
			(c) => c.startOnboarding({ tenantName: "Acme", tenantSlug: "acme", ownerEmail: "o@e.com" }),
			{ workflowId: ID },
		);

		await call((c) => c.getOnboardingStatus(ID), { workflowId: ID });
		expect(lastUrl()).toContain(`onboarding/workflows/${ID}`);

		await call((c) => c.getOnboardingStats({ since: "2026-01-01", until: "2026-02-01" }), {
			total: 0,
		});
		expect(lastUrl()).toContain("since=");
		await call((c) => c.getOnboardingStats(), { total: 0 });
	});

	it("isolation policy/audit/findings", async () => {
		await call(
			(c) =>
				c.createIsolationPolicy({
					tenantId: TENANT,
					name: "p",
					description: "d",
					level: "strict" as never,
					rules: [] as never,
					enforcementMode: "enforce" as never,
				}),
			{ id: ID },
		);
		expect(lastBody()).toMatchObject({ enforcementMode: "enforce" });
		await call(
			(c) => c.createIsolationPolicy({ tenantId: TENANT, name: "p", level: "strict" as never }),
			{ id: ID },
		);

		await call(
			(c) =>
				c.runIsolationAudit({
					tenantId: TENANT,
					policyIds: [ID],
					categories: ["network"] as never,
					depth: "deep" as never,
				}),
			{ runId: ID },
		);
		await call((c) => c.runIsolationAudit({ tenantId: TENANT }), { runId: ID });

		await call(
			(c) =>
				c.getIsolationFindings({
					tenantId: TENANT,
					runId: ID,
					severity: "high" as never,
					category: "network" as never,
					limit: 5,
					cursor: "c",
				}),
			{ items: [] },
		);
		for (const fragment of ["runId=", "severity=high", "category=network", "limit=5", "cursor=c"]) {
			expect(lastUrl()).toContain(fragment);
		}
		await call((c) => c.getIsolationFindings({ tenantId: TENANT }), { items: [] });
	});
});

describe("request core and telemetry", () => {
	it("retries 429s, gives up, handles non-OK, real timeout, non-Error rethrow", async () => {
		const c = client();
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(new Response("slow", { status: 429 }));
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("slow", { status: 429, headers: { "Retry-After": "zzz" } }),
		);
		vi.mocked(fetch).mockResolvedValueOnce(json({ items: [] }));
		await expect(c.listTenants()).resolves.toEqual({ items: [] });

		clearActivationCache();
		const c2 = client({ maxRetries: 0 });
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(new Response("slow", { status: 429 }));
		await expect(c2.listTenants()).rejects.toThrow(/Rate limit exceeded/);

		clearActivationCache();
		const c3 = client();
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("secret", { status: 500, statusText: "Boom" }),
		);
		await expect(c3.listTenants()).rejects.toThrow(/500 Boom/);

		clearActivationCache();
		const c4 = client({ timeoutMs: 5 });
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockImplementationOnce(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
					});
				}),
		);
		await expect(c4.listTenants()).rejects.toThrow(/Request timeout after 5ms/);

		clearActivationCache();
		const c5 = client();
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockRejectedValueOnce("wire snapped");
		await expect(c5.listTenants()).rejects.toBe("wire snapped");
	});

	it("telemetry object, config-built exports, and factory branches", async () => {
		const events: unknown[] = [];
		const c = client({ telemetry: { record: (e: unknown) => events.push(e) } });
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(json({ items: [] }));
		await c.listTenants();
		expect(events[events.length - 1]).toMatchObject({ status: "ok" });

		const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
		const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
		clearActivationCache();
		const c2 = client({ telemetry: { serviceName: "tenant-test", exporterFactory: () => reader } });
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(new Response("bad", { status: 500 }));
		await expect(c2.listTenants()).rejects.toThrow();
		const { resourceMetrics } = await reader.collect();
		const names = resourceMetrics.scopeMetrics.flatMap((s) =>
			s.metrics.map((m) => m.descriptor.name),
		);
		expect(names.some((n) => n.includes("requests_total"))).toBe(true);

		const withOtlp = createTenantClientTelemetry({
			serviceName: "s",
			otlpEndpoint: "http://localhost:4318/v1/metrics",
		});
		withOtlp.record({ operation: "o", method: "GET", route: "/x", status: "error", durationMs: 1 });
		const bare = createTenantClientTelemetry({ serviceName: "s" });
		bare.record({
			operation: "o",
			method: "GET",
			route: "/x",
			status: "ok",
			durationMs: 1,
			httpStatus: 200,
			target: "t",
		});
		vi.stubEnv("NODE_ENV", "production");
		try {
			createTenantClientTelemetry({ serviceName: "s", metricsIntervalMs: 3_600_000 });
		} finally {
			vi.unstubAllEnvs();
		}
		const saved = process.env["NODE_ENV"];
		delete process.env["NODE_ENV"];
		try {
			createTenantClientTelemetry({
				serviceName: "s",
				exporterFactory: () =>
					new PeriodicExportingMetricReader({
						exporter: new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE),
						exportIntervalMillis: 60_000,
					}),
			});
		} finally {
			process.env["NODE_ENV"] = saved;
		}
		expect(isTenantClientTelemetry({ record: () => {} })).toBe(true);
		expect(isTenantClientTelemetry({ serviceName: "s" })).toBe(false);
	});
});

describe("tier helpers", () => {
	it("toNistAlgorithmName maps and passes through; getAlgorithmConfigForTier returns config", async () => {
		const { getAlgorithmConfigForTier, toNistAlgorithmName } = await import("./index.js");
		expect(toNistAlgorithmName("dilithium-3")).toBe("ML-DSA-65");
		expect(toNistAlgorithmName("mystery")).toBe("mystery");
		expect(getAlgorithmConfigForTier("default").kemAlgorithms.length).toBeGreaterThan(0);
	});
});

describe("validateUUID", () => {
	it("accepts valid, names the field on failure", () => {
		expect(() => validateUUID(TENANT, "tenantId")).not.toThrow();
		expect(() => validateUUID("x", "tenantId")).toThrow(/Invalid tenantId/);
	});
});
