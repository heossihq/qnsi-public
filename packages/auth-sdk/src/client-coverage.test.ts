import { clearActivationCache } from "@heossihq/qnsi-sdk-activation";
import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	AuthClient,
	createAuthClientTelemetry,
	getServiceAuthHeader,
	isAuthClientTelemetry,
	isPersonalAccessToken,
	isPqcNativeToken,
	requestServiceToken,
	toPatNistAlgorithmName,
	validateEmail,
	validateURL,
	validateUUID,
} from "./index.js";

global.fetch = vi.fn();

const TENANT = "a1b2c3d4-e5f6-4789-8abc-def012345678";
const USER = "b1b2c3d4-e5f6-4789-8abc-def012345678";
const CRED = "c1b2c3d4-e5f6-4789-8abc-def012345678";

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

function client(overrides: Record<string, unknown> = {}): AuthClient {
	return new AuthClient({
		baseUrl: "https://auth.example.com",
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

function lastBody(): Record<string, unknown> {
	const calls = vi.mocked(fetch).mock.calls;
	return JSON.parse(String((calls[calls.length - 1]?.[1] as RequestInit).body));
}

async function call<T>(fn: (c: AuthClient) => Promise<T>, response: unknown): Promise<T> {
	clearActivationCache();
	const c = client();
	vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
	vi.mocked(fetch).mockResolvedValueOnce(
		response === undefined ? new Response(null, { status: 204 }) : json(response),
	);
	return fn(c);
}

describe("constructor guards", () => {
	it("throws without an apiKey, allows internal http, rejects bad urls", () => {
		expect(() => new AuthClient({ apiKey: " " })).toThrow(/apiKey is required/);
		expect(() => client({ baseUrl: "http://auth-service.qnsp-prod.internal:8081" })).not.toThrow();
		expect(() => client({ baseUrl: "http://[bad" })).toThrow(/HTTPS in production/);
		expect(() => client({ baseUrl: "https://bad host" })).not.toThrow();
		expect(() => new AuthClient({ apiKey: "k" })).not.toThrow();
	});
});

describe("auth flows", () => {
	it("login with and without optional totp/audience", async () => {
		await call(
			(c) =>
				c.login({
					email: "user@example.com",
					password: "pw",
					tenantId: TENANT,
					totp: "123456",
					audience: "platform",
				}),
			{ accessToken: "a", refreshToken: "r" },
		);
		expect(lastUrl()).toContain("/auth/login");
		expect(lastBody()).toMatchObject({ totp: "123456", audience: "platform" });
		await call((c) => c.login({ email: "user@example.com", password: "pw", tenantId: TENANT }), {
			accessToken: "a",
			refreshToken: "r",
		});
		expect(lastBody()["totp"]).toBeUndefined();
	});

	it("refreshToken with and without audience", async () => {
		await call((c) => c.refreshToken({ refreshToken: "r", audience: "platform" }), {
			accessToken: "a",
			refreshToken: "r2",
		});
		expect(lastUrl()).toContain("/auth/token/refresh");
		await call((c) => c.refreshToken({ refreshToken: "r" }), {
			accessToken: "a",
			refreshToken: "r2",
		});
	});

	it("passkey registration start/complete", async () => {
		await call((c) => c.registerPasskeyStart({ userId: USER, tenantId: TENANT }), {
			challengeId: CRED,
			options: {},
		});
		expect(lastUrl()).toContain("/auth/webauthn/register/start");

		await call(
			(c) =>
				c.registerPasskeyComplete({
					userId: USER,
					tenantId: TENANT,
					challengeId: CRED,
					response: {} as never,
				}),
			{ verified: true },
		);
		expect(lastUrl()).toContain("/auth/webauthn/register/complete");
	});

	it("passkey authentication start/complete with userId, email, and neither", async () => {
		await call(
			(c) => c.authenticatePasskeyStart({ tenantId: TENANT, userId: USER, email: "u@e.com" }),
			{ challengeId: CRED, options: {} },
		);
		expect(lastBody()).toMatchObject({ userId: USER, email: "u@e.com" });
		await call((c) => c.authenticatePasskeyStart({ tenantId: TENANT }), {
			challengeId: CRED,
			options: {},
		});

		await call(
			(c) =>
				c.authenticatePasskeyComplete({
					tenantId: TENANT,
					challengeId: CRED,
					userId: USER,
					email: "u@e.com",
					response: {} as never,
				}),
			{ accessToken: "a" },
		);
		await call(
			(c) =>
				c.authenticatePasskeyComplete({
					tenantId: TENANT,
					challengeId: CRED,
					response: {} as never,
				}),
			{ accessToken: "a" },
		);
	});

	it("listPasskeys unwraps credentials; deletePasskey targets the credential", async () => {
		const creds = await call((c) => c.listPasskeys(USER, TENANT), { credentials: [{ id: CRED }] });
		expect(creds).toEqual([{ id: CRED }]);
		expect(lastUrl()).toContain(`credentials/${USER}?tenantId=${TENANT}`);

		await call((c) => c.deletePasskey(CRED, USER), undefined);
		expect(lastUrl()).toContain(`credentials/${CRED}?userId=${USER}`);
	});

	it("mfa challenge and verify", async () => {
		await call((c) => c.mfaChallenge({ email: "u@e.com", tenantId: TENANT }), { required: true });
		expect(lastUrl()).toContain("/auth/mfa/challenge");
		await call((c) => c.mfaVerify({ email: "u@e.com", tenantId: TENANT, totp: "000000" }), {
			verified: true,
		});
		expect(lastUrl()).toContain("/auth/mfa/verify");
	});

	it("federation SAML (full and minimal) and OIDC (with and without state)", async () => {
		await call(
			(c) =>
				c.federateSAML({
					providerId: "p1",
					externalUserId: "x1",
					email: "u@e.com",
					name: "U",
					tenantId: TENANT,
					roles: ["admin"],
					attributes: { dept: "eng" },
				}),
			{ accessToken: "a" },
		);
		expect(lastBody()).toMatchObject({ name: "U", roles: ["admin"], attributes: { dept: "eng" } });
		await call(
			(c) => c.federateSAML({ providerId: "p1", externalUserId: "x1", email: "u@e.com" }),
			{ accessToken: "a" },
		);
		expect(lastBody()["attributes"]).toEqual({});

		await call((c) => c.federateOIDC({ providerId: "p1", code: "code", state: "s" }), {
			accessToken: "a",
		});
		await call((c) => c.federateOIDC({ providerId: "p1", code: "code" }), { accessToken: "a" });
	});
});

describe("risk and audit", () => {
	it("risk evaluate/policies/signals/stats with and without tenant filters", async () => {
		await call(
			(c) =>
				c.evaluateRisk({
					userId: USER,
					tenantId: TENANT,
					context: {} as never,
					action: "login",
				}),
			{ action: "allow" },
		);
		expect(lastUrl()).toContain("/auth/risk/evaluate");

		await call((c) => c.createRiskPolicy({ name: "p", rules: [] as never }, TENANT), { id: CRED });
		expect(lastUrl()).toContain(`policies?tenantId=${TENANT}`);
		await call(
			(c) =>
				c.createRiskPolicy({
					name: "p",
					enabled: false,
					rules: [] as never,
					thresholds: { low: 1 } as never,
					actions: { low: "allow" } as never,
				}),
			{ id: CRED },
		);
		expect(lastUrl()).not.toContain("tenantId=");

		await call((c) => c.listRiskPolicies(TENANT), { items: [] });
		expect(lastUrl()).toContain(`?tenantId=${TENANT}`);
		await call((c) => c.listRiskPolicies(), { items: [] });

		await call(
			(c) =>
				c.reportThreatSignal({
					userId: USER,
					tenantId: TENANT,
					signalType: "impossible_travel" as never,
					severity: "high" as never,
					context: {} as never,
					source: "edge",
				}),
			{ recorded: true },
		);
		await call(
			(c) =>
				c.reportThreatSignal({
					tenantId: TENANT,
					signalType: "impossible_travel" as never,
					severity: "high" as never,
					context: {} as never,
					source: "edge",
				}),
			{ recorded: true },
		);

		await call((c) => c.getUserRiskSignals(USER, { tenantId: TENANT, limit: 5 }), { items: [] });
		expect(lastUrl()).toContain("limit=5");
		await call((c) => c.getUserRiskSignals(USER), { items: [] });

		await call((c) => c.getRiskStats(TENANT), { total: 0 });
		await call((c) => c.getRiskStats(), { total: 0 });
	});

	it("federated audit query/reports/activity with full and bare options", async () => {
		await call(
			(c) =>
				c.queryFederatedAudit(
					{
						startDate: "2026-01-01",
						endDate: "2026-02-01",
						providerIds: ["p1"],
						eventTypes: ["login"] as never,
						userIds: [USER],
						limit: 10,
						offset: 5,
					},
					TENANT,
				),
			{ items: [] },
		);
		expect(lastUrl()).toContain(`query?tenantId=${TENANT}`);
		expect(lastBody()).toMatchObject({ limit: 10, offset: 5 });
		await call((c) => c.queryFederatedAudit({}), { items: [] });
		expect(lastBody()).toMatchObject({ limit: 100, offset: 0 });

		await call(
			(c) =>
				c.createFederatedAuditReport(
					{
						reportType: "summary" as never,
						startDate: "2026-01-01",
						endDate: "2026-02-01",
						providerIds: ["p1"],
						format: "csv" as never,
						includeDetails: false,
					},
					TENANT,
				),
			{ id: CRED },
		);
		await call(
			(c) =>
				c.createFederatedAuditReport({
					reportType: "summary" as never,
					startDate: "2026-01-01",
					endDate: "2026-02-01",
				}),
			{ id: CRED },
		);
		expect(lastBody()).toMatchObject({ format: "json", includeDetails: true });

		await call((c) => c.listFederatedAuditReports({ tenantId: TENANT, limit: 3 }), { items: [] });
		expect(lastUrl()).toContain("limit=3");
		await call((c) => c.listFederatedAuditReports(), { items: [] });

		await call((c) => c.getFederatedAuditReport(CRED, TENANT), { id: CRED });
		expect(lastUrl()).toContain(`reports/${CRED}?tenantId=${TENANT}`);
		await call((c) => c.getFederatedAuditReport(CRED), { id: CRED });

		await call((c) => c.getCrossTenantActivity(24), { items: [] });
		expect(lastUrl()).toContain("?hours=24");
		await call((c) => c.getCrossTenantActivity(), { items: [] });
	});
});

describe("request core", () => {
	it("retries 429s then succeeds; gives up after maxRetries", async () => {
		const c = client();
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(new Response("slow", { status: 429 }));
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("slow", { status: 429, headers: { "Retry-After": "nah" } }),
		);
		vi.mocked(fetch).mockResolvedValueOnce(json({ items: [] }));
		await expect(c.listRiskPolicies()).resolves.toEqual({ items: [] });

		clearActivationCache();
		const c2 = client({ maxRetries: 0 });
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(new Response("slow", { status: 429 }));
		await expect(c2.listRiskPolicies()).rejects.toThrow(/Rate limit exceeded/);
	});

	it("handles non-OK, real timeout, and non-Error rethrow", async () => {
		clearActivationCache();
		const c = client();
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("secret", { status: 500, statusText: "Boom" }),
		);
		await expect(c.listRiskPolicies()).rejects.toThrow(/500 Boom/);

		clearActivationCache();
		const c2 = client({ timeoutMs: 5 });
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockImplementationOnce(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
					});
				}),
		);
		await expect(c2.listRiskPolicies()).rejects.toThrow(/Request timeout after 5ms/);

		clearActivationCache();
		const c3 = client();
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockRejectedValueOnce("wire snapped");
		await expect(c3.listRiskPolicies()).rejects.toBe("wire snapped");
	});
});

describe("telemetry", () => {
	it("object and config-built telemetry both record; branches covered", async () => {
		const events: unknown[] = [];
		const c = client({ telemetry: { record: (e: unknown) => events.push(e) } });
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(json({ items: [] }));
		await c.listRiskPolicies();
		expect(events[events.length - 1]).toMatchObject({ status: "ok" });

		const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
		const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
		clearActivationCache();
		const c2 = client({ telemetry: { serviceName: "auth-test", exporterFactory: () => reader } });
		vi.mocked(fetch).mockResolvedValueOnce(json(ACTIVATION));
		vi.mocked(fetch).mockResolvedValueOnce(new Response("bad", { status: 500 }));
		await expect(c2.listRiskPolicies()).rejects.toThrow();
		const { resourceMetrics } = await reader.collect();
		const names = resourceMetrics.scopeMetrics.flatMap((s) =>
			s.metrics.map((m) => m.descriptor.name),
		);
		expect(names.some((n) => n.includes("requests_total"))).toBe(true);

		const withOtlp = createAuthClientTelemetry({
			serviceName: "s",
			otlpEndpoint: "http://localhost:4318/v1/metrics",
		});
		withOtlp.record({ operation: "o", method: "GET", route: "/x", status: "error", durationMs: 1 });
		const bare = createAuthClientTelemetry({ serviceName: "s" });
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
			createAuthClientTelemetry({ serviceName: "s", metricsIntervalMs: 3_600_000 });
		} finally {
			vi.unstubAllEnvs();
		}
		const saved = process.env["NODE_ENV"];
		delete process.env["NODE_ENV"];
		try {
			createAuthClientTelemetry({
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
		expect(isAuthClientTelemetry({ record: () => {} })).toBe(true);
		expect(isAuthClientTelemetry({ serviceName: "s" })).toBe(false);
	});
});

describe("service tokens", () => {
	it("returns the header on success and undefined on failure", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(json({ accessToken: "svc-token" }));
		await expect(
			getServiceAuthHeader({
				authServiceUrl: "http://auth.qnsp-prod.internal:8081",
				serviceId: "svc",
				serviceSecret: "sec",
				audience: "internal-service",
			}),
		).resolves.toBe("Bearer svc-token");

		vi.mocked(fetch).mockResolvedValueOnce(new Response("no", { status: 401 }));
		await expect(
			getServiceAuthHeader({
				authServiceUrl: "http://auth.qnsp-prod.internal:8081",
				serviceId: "svc",
				serviceSecret: "sec",
			}),
		).resolves.toBeUndefined();
	});

	it("covers null paths: malformed body, network error, abort, https guard", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(json({ nope: true }));
		await expect(
			requestServiceToken({
				authServiceUrl: "http://auth.internal",
				serviceId: "s",
				serviceSecret: "x",
			}),
		).resolves.toBeNull();

		vi.mocked(fetch).mockRejectedValueOnce(new Error("down"));
		await expect(
			requestServiceToken({
				authServiceUrl: "http://auth.internal",
				serviceId: "s",
				serviceSecret: "x",
			}),
		).resolves.toBeNull();

		// REAL timeout: the helper's own timer aborts a signal-honoring fetch.
		vi.mocked(fetch).mockImplementationOnce(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
					});
				}),
		);
		await expect(
			requestServiceToken({
				authServiceUrl: "https://auth.example.com",
				serviceId: "s",
				serviceSecret: "x",
				timeoutMs: 5,
			}),
		).resolves.toBeNull();

		vi.stubEnv("NODE_ENV", "production");
		try {
			await expect(
				requestServiceToken({
					authServiceUrl: "http://external.example.com",
					serviceId: "s",
					serviceSecret: "x",
				}),
			).rejects.toThrow(/HTTPS in production/);
		} finally {
			vi.unstubAllEnvs();
		}
	});
});

describe("validators and PAT helpers", () => {
	it("validateUUID/Email/URL name the field on failure", () => {
		expect(() => validateUUID(TENANT, "id")).not.toThrow();
		expect(() => validateUUID("x", "id")).toThrow(/Invalid id/);
		expect(() => validateEmail("u@e.com", "email")).not.toThrow();
		expect(() => validateEmail("x", "email")).toThrow(/Invalid email/);
		expect(() => validateURL("https://a.com", "url")).not.toThrow();
		expect(() => validateURL("x", "url")).toThrow(/Invalid url/);
	});

	it("PAT helpers classify tokens and map NIST names", () => {
		expect(isPersonalAccessToken("qnsi_pqc_pat_abc")).toBe(true);
		expect(isPersonalAccessToken("qnsp_pqc_pat_abc")).toBe(true);
		expect(isPersonalAccessToken("qnsp_pat_abc")).toBe(true);
		expect(isPersonalAccessToken("other")).toBe(false);
		expect(isPqcNativeToken("qnsi_pqc_pat_abc")).toBe(true);
		expect(isPqcNativeToken("qnsp_pat_abc")).toBe(false);
		expect(toPatNistAlgorithmName("dilithium-3")).toBe("ML-DSA-65");
		expect(toPatNistAlgorithmName("unknown")).toBe("unknown");
	});

	it("toNistAlgorithmName maps and passes through", async () => {
		const { toNistAlgorithmName } = await import("./index.js");
		expect(toNistAlgorithmName("dilithium-3")).toBe("ML-DSA-65");
		expect(toNistAlgorithmName("mystery")).toBe("mystery");
	});
});
