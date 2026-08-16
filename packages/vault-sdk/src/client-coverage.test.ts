import { clearActivationCache } from "@heossihq/qnsi-sdk-activation";
import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	createVaultClientTelemetry,
	isVaultClientTelemetry,
	VaultClient,
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

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function client(overrides: Record<string, unknown> = {}): VaultClient {
	return new VaultClient({
		baseUrl: "https://vault.example.com",
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

async function call<T>(fn: (c: VaultClient) => Promise<T>, response: unknown): Promise<T> {
	clearActivationCache();
	const c = client();
	vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
	// void endpoints answer 204 with no body; anything else is JSON
	vi.mocked(fetch).mockResolvedValueOnce(
		response === undefined ? new Response(null, { status: 204 }) : json(response),
	);
	return fn(c);
}

describe("constructor guards", () => {
	it("throws without an apiKey", () => {
		expect(() => new VaultClient({ apiKey: " " })).toThrow(/apiKey is required/);
	});

	it("checks tier access when a tier is given and skips when absent", () => {
		expect(() => client({ tier: "dev-pro" })).not.toThrow();
		expect(() => client()).not.toThrow();
	});

	it("allows internal-mesh http, rejects external http and unparseable urls", () => {
		expect(() => client({ baseUrl: "http://vault-service.qnsp-prod.internal:8084" })).not.toThrow();
		expect(() => client({ baseUrl: "http://[bad" })).toThrow(/HTTPS in production/);
	});

	it("falls back to the service name when the https host cannot be parsed", () => {
		expect(() => client({ baseUrl: "https://bad host" })).not.toThrow();
	});

	it("uses the default cloud baseUrl when none is given", () => {
		expect(() => new VaultClient({ apiKey: "k" })).not.toThrow();
	});
});

describe("secrets", () => {
	it("createSecret resolves the tenant from activation and serializes options", async () => {
		await call(
			(c) =>
				c.createSecret({
					name: "s1",
					payload: "cGF5bG9hZA==",
					metadata: { a: 1 },
					rotationPolicy: { intervalDays: 30 } as never,
				}),
			{ id: ID },
		);
		const body = JSON.parse(String(lastInit().body));
		expect(body.tenantId).toBe(TENANT);
		expect(body.metadata).toEqual({ a: 1 });
		expect(lastUrl()).toContain("/vault/v1/secrets");
	});

	it("createSecret validates and uses an explicit tenantId", async () => {
		await call((c) => c.createSecret({ tenantId: TENANT, name: "s", payload: "cA==" }), {
			id: ID,
		});
		expect(JSON.parse(String(lastInit().body)).tenantId).toBe(TENANT);
		await expect(
			client().createSecret({ tenantId: "bad", name: "s", payload: "cA==" }),
		).rejects.toThrow(/Invalid tenantId/);
	});

	it("getSecret passes the lease token as query and header when present", async () => {
		await call((c) => c.getSecret(ID, { leaseToken: "lease-1" }), { id: ID });
		expect(lastUrl()).toContain("leaseToken=lease-1");
		expect((lastInit().headers as Record<string, string>)["x-lease-token"]).toBe("lease-1");
		await call((c) => c.getSecret(ID), { id: ID });
		expect(lastUrl()).not.toContain("leaseToken=");
	});

	it("getSecretVersion, rotateSecret, deleteSecret round-trip", async () => {
		await call((c) => c.getSecretVersion(ID, 3), { id: ID });
		expect(lastUrl()).toContain(`/vault/v1/secrets/${ID}/versions/3`);

		await call(
			(c) =>
				c.rotateSecret(ID, {
					tenantId: TENANT,
					newPayload: "bg==",
					metadata: { b: 2 },
					rotationPolicy: { intervalDays: 7 } as never,
				}),
			{ id: ID },
		);
		expect(lastUrl()).toContain(`/vault/v1/secrets/${ID}/rotate`);
		await call((c) => c.rotateSecret(ID, { tenantId: TENANT }), { id: ID });

		await call((c) => c.deleteSecret(ID, TENANT), undefined);
		expect(lastUrl()).toContain(`tenantId=${TENANT}`);
		expect(lastInit().method).toBe("DELETE");
	});
});

describe("dynamic secrets", () => {
	it("config create/list with and without filters", async () => {
		await call(
			(c) =>
				c.createDynamicSecretConfig({
					tenantId: TENANT,
					name: "db",
					secretType: "database" as never,
					backend: { kind: "postgres" } as never,
					defaultTtlSeconds: 60,
					maxTtlSeconds: 600,
					template: { role: "ro" } as never,
				}),
			{ id: ID },
		);
		expect(lastUrl()).toContain(`configs?tenantId=${TENANT}`);
		await call(
			(c) =>
				c.createDynamicSecretConfig({
					name: "db",
					secretType: "database" as never,
					backend: {} as never,
				}),
			{ id: ID },
		);
		expect(lastUrl()).not.toContain("tenantId=");

		await call(
			(c) => c.listDynamicSecretConfigs({ tenantId: TENANT, secretType: "database" as never }),
			{ items: [] },
		);
		expect(lastUrl()).toContain("secretType=database");
		await call((c) => c.listDynamicSecretConfigs(), { items: [] });
	});

	it("credentials, leases, renew, revoke, stats", async () => {
		await call(
			(c) => c.requestCredentials(ID, { tenantId: TENANT, ttlSeconds: 60, metadata: {} }),
			{
				leaseId: ID,
			},
		);
		expect(lastUrl()).toContain(`configs/${ID}/credentials?tenantId=${TENANT}`);
		await call((c) => c.requestCredentials(ID), { leaseId: ID });

		await call((c) => c.listLeases(ID, { tenantId: TENANT }), { items: [] });
		expect(lastUrl()).toContain(`configs/${ID}/leases?tenantId=${TENANT}`);
		await call((c) => c.listLeases(ID), { items: [] });

		await call((c) => c.renewLease(ID, { ttlSeconds: 120 }), { leaseId: ID });
		expect(lastUrl()).toContain(`leases/${ID}/renew`);
		await call((c) => c.renewLease(ID), { leaseId: ID });

		await call((c) => c.revokeLease(ID), undefined);
		expect(lastUrl()).toContain(`leases/${ID}/revoke`);

		await call((c) => c.getDynamicSecretStats({ tenantId: TENANT }), { total: 0 });
		expect(lastUrl()).toContain(`stats?tenantId=${TENANT}`);
		await call((c) => c.getDynamicSecretStats(), { total: 0 });
	});
});

describe("leakage detection", () => {
	it("policies create/list with every optional field", async () => {
		await call(
			(c) =>
				c.createLeakagePolicy({
					tenantId: TENANT,
					name: "p",
					description: "d",
					enabled: true,
					scanTargets: { secretTypes: [] } as never,
					scanSources: [],
					threatFeeds: [],
					alerting: {} as never,
					autoRemediation: {} as never,
					scanSchedule: "daily" as never,
				}),
			{ id: ID },
		);
		expect(lastUrl()).toContain(`policies?tenantId=${TENANT}`);
		await call(
			(c) =>
				c.createLeakagePolicy({
					name: "p",
					scanTargets: { secretTypes: [] } as never,
					scanSources: [],
					alerting: {} as never,
					scanSchedule: "daily" as never,
				}),
			{ id: ID },
		);

		await call((c) => c.listLeakagePolicies({ tenantId: TENANT, enabled: true }), { items: [] });
		expect(lastUrl()).toContain("enabled=true");
		await call((c) => c.listLeakagePolicies(), { items: [] });
	});

	it("incidents report/list/update, scan, stats", async () => {
		await call(
			(c) =>
				c.reportLeakageIncident({
					tenantId: TENANT,
					secretId: ID,
					source: "github" as never,
					severity: "high" as never,
					detectedAt: new Date().toISOString(),
					evidence: {} as never,
					threatFeedMatch: { feed: "x" } as never,
					notes: "n",
				}),
			{ id: ID },
		);
		expect(lastUrl()).toContain(`incidents?tenantId=${TENANT}`);
		await call(
			(c) =>
				c.reportLeakageIncident({
					secretId: ID,
					source: "github" as never,
					severity: "high" as never,
					detectedAt: new Date().toISOString(),
					evidence: {} as never,
				}),
			{ id: ID },
		);

		await call(
			(c) =>
				c.listLeakageIncidents({
					tenantId: TENANT,
					status: "open" as never,
					severity: "high" as never,
					secretId: ID,
					limit: 5,
					offset: 2,
				}),
			{ items: [] },
		);
		for (const fragment of ["status=open", "severity=high", "limit=5", "offset=2"]) {
			expect(lastUrl()).toContain(fragment);
		}
		await call((c) => c.listLeakageIncidents(), { items: [] });

		await call(
			(c) =>
				c.updateIncidentStatus(ID, {
					tenantId: TENANT,
					status: "resolved" as never,
					assignee: "a",
					notes: "n",
					remediationActions: [] as never,
				}),
			{ id: ID },
		);
		expect(lastUrl()).toContain(`incidents/${ID}?tenantId=${TENANT}`);
		await call((c) => c.updateIncidentStatus(ID, {}), { id: ID });

		await call(
			(c) =>
				c.triggerLeakageScan({
					tenantId: TENANT,
					secretIds: [ID],
					sources: [],
					threatFeeds: [],
					force: true,
				}),
			{ scanId: ID },
		);
		expect(lastUrl()).toContain(`scan?tenantId=${TENANT}`);
		await call((c) => c.triggerLeakageScan(), { scanId: ID });

		await call((c) => c.getLeakageStats({ tenantId: TENANT }), { total: 0 });
		await call((c) => c.getLeakageStats(), { total: 0 });
	});
});

describe("versioned secrets", () => {
	it("create/list/get/rollback/compare with every optional field", async () => {
		await call(
			(c) =>
				c.createSecretVersion({
					tenantId: TENANT,
					secretId: ID,
					value: "dg==",
					metadata: {},
					rotationPolicy: {} as never,
					retentionPolicy: {} as never,
					changeReason: "r",
					approvedBy: "a",
				}),
			{ version: 2 },
		);
		expect(lastUrl()).toContain(`versioned-secrets?tenantId=${TENANT}`);
		await call((c) => c.createSecretVersion({ secretId: ID, value: "dg==" }), { version: 2 });

		await call(
			(c) =>
				c.listSecretVersions(ID, {
					tenantId: TENANT,
					limit: 5,
					offset: 1,
					state: "active" as never,
					fromDate: "2026-01-01",
					toDate: "2026-02-01",
				}),
			{ items: [] },
		);
		for (const fragment of ["limit=5", "offset=1", "state=active", "fromDate=", "toDate="]) {
			expect(lastUrl()).toContain(fragment);
		}
		await call((c) => c.listSecretVersions(ID), { items: [] });

		await call((c) => c.getSecretVersionDetails(ID, 4, { tenantId: TENANT }), { version: 4 });
		expect(lastUrl()).toContain(`versions/4?tenantId=${TENANT}`);
		await call((c) => c.getSecretVersionDetails(ID, 4), { version: 4 });

		await call(
			(c) =>
				c.rollbackSecret(ID, {
					tenantId: TENANT,
					targetVersion: 1,
					createNewVersion: true,
					reason: "r",
					approvedBy: "a",
				}),
			{ version: 3 },
		);
		expect(lastUrl()).toContain(`${ID}/rollback?tenantId=${TENANT}`);
		await call((c) => c.rollbackSecret(ID, { targetVersion: 1 }), { version: 3 });

		await call(
			(c) =>
				c.compareVersions(ID, { tenantId: TENANT, version1: 1, version2: 2, includeValues: true }),
			{ differences: [] },
		);
		expect(lastUrl()).toContain(`${ID}/compare?tenantId=${TENANT}`);
		await call((c) => c.compareVersions(ID, { version1: 1, version2: 2 }), { differences: [] });
	});

	it("retention policy, state transition, stats", async () => {
		await call(
			(c) =>
				c.setRetentionPolicy(ID, {
					tenantId: TENANT,
					maxVersions: 5,
					retentionDays: 30,
					destroyOnArchive: true,
					autoArchiveAfterDays: 10,
				}),
			{ ok: true },
		);
		expect(lastUrl()).toContain(`${ID}/retention-policy?tenantId=${TENANT}`);
		expect(lastInit().method).toBe("PUT");
		await call((c) => c.setRetentionPolicy(ID, {}), { ok: true });

		await call(
			(c) =>
				c.transitionVersionState(ID, 2, {
					tenantId: TENANT,
					state: "archived" as never,
					reason: "r",
					destroyData: false,
				}),
			{ ok: true },
		);
		expect(lastUrl()).toContain(`versions/2/state?tenantId=${TENANT}`);
		await call((c) => c.transitionVersionState(ID, 2, { state: "archived" as never }), {
			ok: true,
		});

		await call((c) => c.getVersionedSecretsStats({ tenantId: TENANT }), { total: 0 });
		await call((c) => c.getVersionedSecretsStats(), { total: 0 });
	});
});

describe("request core", () => {
	it("retries 429 (with and without parseable Retry-After) then succeeds or gives up", async () => {
		const c = client();
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(new Response("slow", { status: 429 }));
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("slow", { status: 429, headers: { "Retry-After": "soon" } }),
		);
		vi.mocked(fetch).mockResolvedValueOnce(json({ id: ID }));
		await expect(c.getSecret(ID)).resolves.toEqual({ id: ID });

		const c2 = client({ maxRetries: 0 });
		clearActivationCache();
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(new Response("slow", { status: 429 }));
		await expect(c2.getSecret(ID)).rejects.toThrow(/Rate limit exceeded/);
	});

	it("handles 204, non-OK, real timeout, and non-Error rethrow", async () => {
		clearActivationCache();
		const c = client();
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
		await expect(c.getSecret(ID)).resolves.toBeUndefined();

		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("secret-body", { status: 500, statusText: "Boom" }),
		);
		await expect(c.getSecret(ID)).rejects.toThrow(/500 Boom/);

		const c3 = client({ timeoutMs: 5 });
		clearActivationCache();
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockImplementationOnce(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
					});
				}),
		);
		await expect(c3.getSecret(ID)).rejects.toThrow(/Request timeout after 5ms/);

		clearActivationCache();
		const c4 = client();
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockRejectedValueOnce("wire snapped");
		await expect(c4.getSecret(ID)).rejects.toBe("wire snapped");
	});
});

describe("telemetry", () => {
	it("accepts a telemetry object, builds real telemetry from config, and exports", async () => {
		const events: unknown[] = [];
		const c = client({ telemetry: { record: (e: unknown) => events.push(e) } });
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(json({ id: ID }));
		await c.getSecret(ID);
		expect(events[events.length - 1]).toMatchObject({ status: "ok" });

		const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
		const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
		clearActivationCache();
		const c2 = client({ telemetry: { serviceName: "vault-test", exporterFactory: () => reader } });
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(new Response("bad", { status: 500 }));
		await expect(c2.getSecret(ID)).rejects.toThrow();
		const { resourceMetrics } = await reader.collect();
		const names = resourceMetrics.scopeMetrics.flatMap((s) =>
			s.metrics.map((m) => m.descriptor.name),
		);
		expect(names.some((n) => n.includes("requests_total"))).toBe(true);
	});

	it("covers config-built telemetry branches", () => {
		const withOtlp = createVaultClientTelemetry({
			serviceName: "s",
			otlpEndpoint: "http://localhost:4318/v1/metrics",
		});
		withOtlp.record({ operation: "o", method: "GET", route: "/x", status: "error", durationMs: 1 });

		const bare = createVaultClientTelemetry({ serviceName: "s" });
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
			createVaultClientTelemetry({ serviceName: "s", metricsIntervalMs: 3_600_000 });
		} finally {
			vi.unstubAllEnvs();
		}

		const saved = process.env["NODE_ENV"];
		delete process.env["NODE_ENV"];
		try {
			createVaultClientTelemetry({
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

		expect(isVaultClientTelemetry({ record: () => {} })).toBe(true);
		expect(isVaultClientTelemetry({ serviceName: "s" })).toBe(false);
	});
});

describe("validateUUID", () => {
	it("accepts valid and names the field on failure", () => {
		expect(() => validateUUID(TENANT, "tenantId")).not.toThrow();
		expect(() => validateUUID("nope", "id")).toThrow(/Invalid id/);
	});
});

describe("toNistAlgorithmName", () => {
	it("maps internal names to NIST names and passes unknowns through", async () => {
		const { toNistAlgorithmName } = await import("./index.js");
		expect(toNistAlgorithmName("kyber-768")).toBe("ML-KEM-768");
		expect(toNistAlgorithmName("not-an-algorithm")).toBe("not-an-algorithm");
	});
});
