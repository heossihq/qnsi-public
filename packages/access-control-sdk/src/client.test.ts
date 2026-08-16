import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Only the activation edge is doubled; AccessControlClient itself is the real implementation. */
const activateSdk = vi.fn();

vi.mock("@heossihq/qnsi-sdk-activation", () => ({
	activateSdk: (...args: unknown[]) => activateSdk(...args),
}));

import { AccessControlClient, DEFAULT_BASE_URL, toNistAlgorithmName } from "./index.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const POLICY = "22222222-2222-4222-8222-222222222222";
const GRANT = "33333333-3333-4333-8333-333333333333";
const REQ = "44444444-4444-4444-8444-444444444444";

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
		text: async () => "error body",
	};
}

function client(overrides: Record<string, unknown> = {}) {
	return new AccessControlClient({
		apiKey: "tok",
		baseUrl: "https://access.example",
		...overrides,
	});
}

const url = (m: ReturnType<typeof stubFetch>, i = 0) => String(m.mock.calls[i]?.[0]);
const init = (m: ReturnType<typeof stubFetch>, i = 0) =>
	m.mock.calls[i]?.[1] as { method: string; headers: Record<string, string>; body?: string };

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
		expect(() => new AccessControlClient({ apiKey: "" })).toThrow("apiKey is required");
		expect(() => new AccessControlClient({ apiKey: "  " })).toThrow("apiKey is required");
	});

	it("defaults to the public cloud base url", async () => {
		const f = stubFetch(() => jsonResponse({}));
		await new AccessControlClient({ apiKey: "tok" }).getSimulationHistory();

		expect(url(f).startsWith(DEFAULT_BASE_URL)).toBe(true);
	});

	it("trims a trailing slash", async () => {
		const f = stubFetch(() => jsonResponse({}));
		await client({ baseUrl: "https://access.example/" }).getSimulationHistory();

		expect(url(f)).toBe("https://access.example/access/v1/simulate/history");
	});

	it.each(["http://localhost:8080", "http://127.0.0.1:8080"])("allows %s in development", (u) => {
		vi.stubEnv("NODE_ENV", "development");
		expect(() => new AccessControlClient({ apiKey: "tok", baseUrl: u })).not.toThrow();
	});

	it("rejects plain http against a public host", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(
			() => new AccessControlClient({ apiKey: "tok", baseUrl: "http://access.example" }),
		).toThrow("baseUrl must use HTTPS in production");
	});

	it.each([
		"http://access.internal/",
		"http://10.0.0.5",
		"http://172.16.0.5",
		"http://172.31.0.5",
		"http://192.168.1.5",
		"http://localhost:8080",
	])("treats %s as internal", (u) => {
		vi.stubEnv("NODE_ENV", "production");
		expect(() => new AccessControlClient({ apiKey: "tok", baseUrl: u })).not.toThrow();
	});

	it.each([
		"http://11.0.0.5",
		"http://172.15.0.5",
		"http://172.32.0.5",
		"http://192.169.1.5",
	])("rejects %s as not internal", (u) => {
		vi.stubEnv("NODE_ENV", "production");
		expect(() => new AccessControlClient({ apiKey: "tok", baseUrl: u })).toThrow(
			"baseUrl must use HTTPS in production",
		);
	});

	it("rejects an unparseable http base url", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(() => new AccessControlClient({ apiKey: "tok", baseUrl: "http://" })).toThrow(
			"baseUrl must use HTTPS in production",
		);
	});

	it("falls back to a fixed telemetry target for an unparseable host", () => {
		const c = client({ baseUrl: "https://[" });

		expect((c as unknown as { targetService: string }).targetService).toBeTruthy();
	});

	it("skips activation for an internal address and activates once otherwise", async () => {
		stubFetch(() => jsonResponse({}));

		await new AccessControlClient({
			apiKey: "tok",
			baseUrl: "http://access.internal",
		}).getSimulationHistory();
		expect(activateSdk).not.toHaveBeenCalled();

		const c = client();
		await c.getSimulationHistory();
		await c.getSimulationHistory();
		expect(activateSdk).toHaveBeenCalledTimes(1);
	});
});

describe("request plumbing", () => {
	it("sends the bearer key and activated tenant header", async () => {
		const f = stubFetch(() => jsonResponse({}));
		await client().getSimulationHistory();

		expect(init(f).headers["Authorization"]).toBe("Bearer tok");
		expect(init(f).headers["x-qnsp-tenant-id"]).toBe(TENANT);
	});

	it("returns undefined for a 204", async () => {
		stubFetch(() => jsonResponse(null, { status: 204 }));

		await expect(client().getSimulationHistory()).resolves.toBeUndefined();
	});

	it("raises on a non-2xx response", async () => {
		stubFetch(() => jsonResponse({}, { status: 500 }));

		await expect(client().getSimulationHistory()).rejects.toThrow("Access Control API error: 500");
	});

	it("tolerates an unreadable error body", async () => {
		stubFetch(() => ({
			ok: false,
			status: 500,
			statusText: "Error",
			headers: new Headers(),
			json: async () => ({}),
			text: async () => {
				throw new Error("stream closed");
			},
		}));

		await expect(client().getSimulationHistory()).rejects.toThrow("Access Control API error");
	});

	it("reports a timeout distinctly", async () => {
		vi.useFakeTimers();
		stubFetch((_u, i) => {
			const signal = (i as { signal?: AbortSignal }).signal;
			return new Promise((_res, rej) => {
				signal?.addEventListener("abort", () => {
					const e = new Error("aborted");
					e.name = "AbortError";
					rej(e);
				});
			});
		});
		const pending = client({ timeoutMs: 100 }).getSimulationHistory();
		const assertion = expect(pending).rejects.toThrow("Request timeout after 100ms");
		await vi.advanceTimersByTimeAsync(100);
		await assertion;
	});

	it("rethrows a transport error unchanged", async () => {
		stubFetch(() => {
			throw new Error("connection reset");
		});

		await expect(client().getSimulationHistory()).rejects.toThrow("connection reset");
	});

	it("rethrows a non-Error", async () => {
		stubFetch(() => {
			throw "opaque";
		});

		await expect(client().getSimulationHistory()).rejects.toBeTruthy();
	});
});

describe("rate limiting", () => {
	it("honours Retry-After", async () => {
		vi.useFakeTimers();
		let n = 0;
		stubFetch(() => {
			n += 1;
			return n === 1
				? jsonResponse({}, { status: 429, headers: new Headers({ "Retry-After": "2" }) })
				: jsonResponse({ ok: true });
		});
		const pending = client().getSimulationHistory();
		await vi.advanceTimersByTimeAsync(2_000);

		await expect(pending).resolves.toEqual({ ok: true });
	});

	it("backs off exponentially without a Retry-After", async () => {
		vi.useFakeTimers();
		let n = 0;
		stubFetch(() => {
			n += 1;
			return n === 1 ? jsonResponse({}, { status: 429 }) : jsonResponse({ ok: true });
		});
		const pending = client({ retryDelayMs: 100 }).getSimulationHistory();
		await vi.advanceTimersByTimeAsync(100);

		await expect(pending).resolves.toEqual({ ok: true });
	});

	it("ignores an unparseable Retry-After", async () => {
		vi.useFakeTimers();
		let n = 0;
		stubFetch(() => {
			n += 1;
			return n === 1
				? jsonResponse({}, { status: 429, headers: new Headers({ "Retry-After": "soon" }) })
				: jsonResponse({ ok: true });
		});
		const pending = client({ retryDelayMs: 50 }).getSimulationHistory();
		await vi.advanceTimersByTimeAsync(50);

		await expect(pending).resolves.toEqual({ ok: true });
	});

	it("gives up once the budget is spent", async () => {
		vi.useFakeTimers();
		stubFetch(() => jsonResponse({}, { status: 429 }));
		const pending = client({ maxRetries: 1, retryDelayMs: 10 }).getSimulationHistory();
		const assertion = expect(pending).rejects.toThrow("Rate limit exceeded after 1 retries");
		await vi.advanceTimersByTimeAsync(200);
		await assertion;
	});
});

describe("telemetry", () => {
	it("records success and failure", async () => {
		const record = vi.fn();
		stubFetch(() => jsonResponse({}));
		await client({ telemetry: { record } }).getSimulationHistory();
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ operation: "getSimulationHistory", status: "ok" }),
		);

		record.mockClear();
		stubFetch(() => jsonResponse({}, { status: 503 }));
		await expect(client({ telemetry: { record } }).getSimulationHistory()).rejects.toThrow();
		expect(record).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
	});

	it("records a transport failure with no http status", async () => {
		const record = vi.fn();
		stubFetch(() => {
			throw new Error("down");
		});

		await expect(client({ telemetry: { record } }).getSimulationHistory()).rejects.toThrow();
		const call = record.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(call["httpStatus"]).toBeUndefined();
		expect(call["error"]).toBe("down");
	});

	it("omits the error field when a non-Error is thrown", async () => {
		const record = vi.fn();
		stubFetch(() => {
			throw "opaque";
		});

		await expect(client({ telemetry: { record } }).getSimulationHistory()).rejects.toBeTruthy();
		expect((record.mock.calls[0]?.[0] as Record<string, unknown>)["error"]).toBeUndefined();
	});

	it("builds telemetry from a config object and stays silent without one", async () => {
		stubFetch(() => jsonResponse({}));

		await expect(
			client({ telemetry: { serviceName: "acl-test" } }).getSimulationHistory(),
		).resolves.toBeTruthy();
		await expect(client().getSimulationHistory()).resolves.toBeTruthy();
	});
});

describe("policies", () => {
	it("creates, reads and lists policies", async () => {
		const f = stubFetch(() => jsonResponse({ id: POLICY }));

		await client().createPolicy({ tenantId: TENANT, name: "p" } as never);
		expect(init(f, 0).method).toBe("POST");

		await client().getPolicy(POLICY);
		expect(url(f, 1)).toContain(POLICY);

		await client().listPolicies(TENANT, { limit: 10, cursor: "c" });
		const q = new URL(url(f, 2)).searchParams;
		expect(q.get("limit")).toBe("10");
		expect(q.get("cursor")).toBe("c");

		await client().listPolicies(TENANT);
		expect(url(f, 3)).toContain(`/access/v1/tenants/${TENANT}/policies`);
	});

	it("validates identifiers before the network", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await expect(client().getPolicy("nope")).rejects.toThrow(/Invalid/);
		await expect(client().listPolicies("nope")).rejects.toThrow(/Invalid/);
		expect(f).not.toHaveBeenCalled();
	});

	it("compares policies across two tenants", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await client().comparePolicies([TENANT, POLICY]);

		expect(init(f).method).toBe("POST");
	});
});

describe("capabilities", () => {
	it("issues, introspects and revokes", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await client().issueCapability({ tenantId: TENANT, policyId: POLICY } as never);
		expect(init(f, 0).method).toBe("POST");

		await client().introspectCapability({ token: "t" } as never);
		await client().revokeCapability({ tokenId: GRANT, revokedBy: "admin" } as never);
		await client().revokeCapability({
			tokenId: GRANT,
			revokedBy: "admin",
			reason: "compromised",
		} as never);

		expect(f).toHaveBeenCalledTimes(4);
		// The optional reason is carried only when supplied.
		expect(JSON.parse(init(f, 2).body as string).reason).toBeUndefined();
		expect(JSON.parse(init(f, 3).body as string).reason).toBe("compromised");
	});

	it("validates the tenant and policy on issue", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await expect(
			client().issueCapability({ tenantId: "nope", policyId: POLICY } as never),
		).rejects.toThrow(/Invalid/);
		expect(f).not.toHaveBeenCalled();
	});
});

describe("simulation", () => {
	it("simulates, batches and analyses impact", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await client().simulateAccess({ tenantId: TENANT } as never);
		await client().batchSimulate({ tenantId: TENANT, scenarios: [] } as never);
		await client().analyzeImpact({ tenantId: TENANT } as never);

		expect(f).toHaveBeenCalledTimes(3);
		expect(init(f, 0).method).toBe("POST");
	});

	it("reads history with and without filters", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await client().getSimulationHistory();
		expect(url(f, 0)).toBe("https://access.example/access/v1/simulate/history");

		await client().getSimulationHistory({ tenantId: TENANT, limit: 5 });
		const q = new URL(url(f, 1)).searchParams;
		expect(q.get("tenantId")).toBe(TENANT);
		expect(q.get("limit")).toBe("5");
	});
});

describe("just-in-time access", () => {
	it("covers the request, list and process lifecycle", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await client().requestJitAccess({ resourceType: "kms" } as never);
		await client().requestJitAccess({ resourceType: "kms" } as never, { tenantId: TENANT });
		await client().listJitRequests();
		await client().listJitRequests({ tenantId: TENANT, status: "pending", limit: 5 } as never);
		await client().processJitRequest(REQ, { decision: "approve" } as never);

		expect(f).toHaveBeenCalledTimes(5);
		expect(new URL(url(f, 3)).searchParams.get("tenantId")).toBe(TENANT);
	});

	it("reads grants, checks access and revokes", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await client().getUserJitGrants("user-1");
		await client().getUserJitGrants("user-1", { tenantId: TENANT });
		await client().checkJitAccess("user-1", "kms", "key-1", "read");
		await client().checkJitAccess("user-1", "kms", "key-1", "read", { tenantId: TENANT });
		await client().revokeJitGrant(GRANT, "no longer needed");

		expect(f).toHaveBeenCalledTimes(5);
		expect(JSON.parse(init(f, 2).body as string)).toMatchObject({
			userId: "user-1",
			resourceType: "kms",
			resourceId: "key-1",
			permission: "read",
		});
	});

	it("manages jit policies and stats", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await client().createJitPolicy({ name: "p" } as never);
		await client().listJitPolicies();
		await client().listJitPolicies({ tenantId: TENANT });
		await client().getJitStats();
		await client().getJitStats({ tenantId: TENANT });

		expect(f).toHaveBeenCalledTimes(5);
	});

	it("validates the grant id before revoking", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await expect(client().revokeJitGrant("nope", "r")).rejects.toThrow(/Invalid/);
		expect(f).not.toHaveBeenCalled();
	});
});

describe("cross-tenant and anomalies", () => {
	it("reads the overview, graph, anomalies and isolation audit", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await client().getCrossTenantOverview();
		await client().queryAnomalies();
		await client().queryAnomalies({ tenantId: TENANT } as never);
		await client().getCrossTenantGraph();
		await client().getCrossTenantGraph({ depth: 2 });
		await client().runIsolationAudit();
		await client().runIsolationAudit(TENANT);

		expect(f).toHaveBeenCalledTimes(7);
	});
});

describe("toNistAlgorithmName", () => {
	it("maps a known algorithm and passes an unknown one through", () => {
		expect(toNistAlgorithmName("dilithium-3")).toBe("ML-DSA-65");
		expect(toNistAlgorithmName("not-real")).toBe("not-real");
	});
});

describe("optional fields are carried when supplied", () => {
	/**
	 * Each method spreads its optional fields conditionally. The suites above exercise the
	 * omitted arm; these calls exercise the supplied arm for every one of them.
	 */
	function maximal() {
		const f = stubFetch(() => jsonResponse({}));
		return { f, c: client() };
	}

	it("createPolicy carries description, category, enforcementLevel and version", async () => {
		const { f, c } = maximal();

		await c.createPolicy({
			tenantId: TENANT,
			name: "p",
			description: "d",
			category: "security",
			enforcementLevel: "strict",
			version: 2,
			statement: {},
		} as never);

		expect(JSON.parse(init(f).body as string)).toMatchObject({
			description: "d",
			category: "security",
			enforcementLevel: "strict",
			version: 2,
		});
	});

	it("issueCapability carries ttlSeconds and security", async () => {
		const { f, c } = maximal();

		await c.issueCapability({
			tenantId: TENANT,
			policyId: POLICY,
			ttlSeconds: 900,
			security: { level: "high" },
		} as never);

		expect(JSON.parse(init(f).body as string)).toMatchObject({
			ttlSeconds: 900,
			security: { level: "high" },
		});
	});

	it("simulateAccess carries context, proposedPolicies and a tenant filter", async () => {
		const { f, c } = maximal();

		await c.simulateAccess(
			{
				subject: "u",
				resource: "r",
				action: "read",
				context: { ip: "10.0.0.1" },
				proposedPolicies: [{ id: POLICY }],
			} as never,
			{ tenantId: TENANT },
		);

		expect(new URL(url(f)).searchParams.get("tenantId")).toBe(TENANT);
		expect(JSON.parse(init(f).body as string)).toMatchObject({
			context: { ip: "10.0.0.1" },
			proposedPolicies: [{ id: POLICY }],
		});
	});

	it("batchSimulate carries a policy set and tenant filter", async () => {
		const { f, c } = maximal();

		await c.batchSimulate(
			{ scenarios: [] } as never,
			{
				tenantId: TENANT,
				policySetId: POLICY,
			} as never,
		);

		expect(url(f)).toContain("tenantId=");
	});

	it("analyzeImpact carries a scope and tenant filter", async () => {
		const { f, c } = maximal();

		await c.analyzeImpact({ scope: "tenant" } as never, { tenantId: TENANT });

		expect(new URL(url(f)).searchParams.get("tenantId")).toBe(TENANT);
	});

	it("requestJitAccess carries duration, ticket and urgency", async () => {
		const { f, c } = maximal();

		await c.requestJitAccess(
			{
				resourceType: "kms",
				durationMinutes: 30,
				ticketId: "INC-1",
				urgency: "high",
			} as never,
			{ tenantId: TENANT },
		);

		expect(JSON.parse(init(f).body as string)).toMatchObject({
			durationMinutes: 30,
			ticketId: "INC-1",
			urgency: "high",
		});
	});

	it("listJitRequests carries status, limit and tenant", async () => {
		const { f, c } = maximal();

		await c.listJitRequests({ tenantId: TENANT, status: "pending", limit: 5 } as never);

		const q = new URL(url(f)).searchParams;
		expect(q.get("status")).toBe("pending");
		expect(q.get("limit")).toBe("5");
	});

	it("processJitRequest carries comment and modifications", async () => {
		const { f, c } = maximal();

		await c.processJitRequest(
			REQ,
			{
				decision: "approve",
				comment: "ok",
				modifiedDuration: 15,
				modifiedPermissions: ["read"],
			} as never,
			{ tenantId: TENANT },
		);

		expect(JSON.parse(init(f).body as string)).toMatchObject({
			comment: "ok",
			modifiedDuration: 15,
			modifiedPermissions: ["read"],
		});
	});

	it("createJitPolicy carries every optional rule field", async () => {
		const { f, c } = maximal();

		await c.createJitPolicy(
			{
				name: "p",
				maxDurationMinutes: 60,
				requireApproval: true,
				approvers: ["admin"],
				autoApproveConditions: [{ field: "urgency", equals: "low" }],
				notifyOnGrant: true,
				notifyOnExpiry: false,
			} as never,
			{ tenantId: TENANT },
		);

		expect(JSON.parse(init(f).body as string)).toMatchObject({
			maxDurationMinutes: 60,
			requireApproval: true,
			approvers: ["admin"],
			notifyOnGrant: true,
			notifyOnExpiry: false,
		});
	});

	it("getCrossTenantGraph carries depth and includeExpired", async () => {
		const { f, c } = maximal();

		await c.getCrossTenantGraph({ depth: 3, includeExpired: true });

		const q = new URL(url(f)).searchParams;
		expect(q.get("depth")).toBe("3");
		expect(q.get("includeExpired")).toBe("true");
	});

	it("revokeJitGrant and getUserJitGrants carry a tenant filter", async () => {
		const { f, c } = maximal();

		await c.revokeJitGrant(GRANT, "done", { tenantId: TENANT });
		await c.getUserJitGrants("user-1", { tenantId: TENANT });

		expect(url(f, 0)).toContain("tenantId=");
		expect(url(f, 1)).toContain("tenantId=");
	});
});

describe("cross-tenant optional payloads and guards", () => {
	it("getCrossTenantOverview carries every optional filter", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await client().getCrossTenantOverview({
			tenantIds: [TENANT],
			timeRange: { from: "2026-01-01", to: "2026-02-01" },
			includeMetrics: true,
		} as never);

		expect(JSON.parse(init(f).body as string)).toMatchObject({
			tenantIds: [TENANT],
			timeRange: { from: "2026-01-01", to: "2026-02-01" },
			includeMetrics: true,
		});
	});

	it("queryAnomalies carries every optional filter", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await client().queryAnomalies({
			anomalyTypes: ["privilege-escalation"],
			minSeverity: "high",
			limit: 25,
		} as never);

		expect(JSON.parse(init(f).body as string)).toMatchObject({
			anomalyTypes: ["privilege-escalation"],
			minSeverity: "high",
			limit: 25,
		});
	});

	it("comparePolicies requires between two and ten tenants", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await expect(client().comparePolicies([TENANT])).rejects.toThrow(
			"comparePolicies requires 2-10 tenant IDs",
		);
		await expect(
			client().comparePolicies(Array.from({ length: 11 }, () => TENANT)),
		).rejects.toThrow("comparePolicies requires 2-10 tenant IDs");
		expect(f).not.toHaveBeenCalled();
	});

	it("comparePolicies carries an optional comparison key", async () => {
		const f = stubFetch(() => jsonResponse({}));

		await client().comparePolicies([TENANT, POLICY]);
		expect(JSON.parse(init(f, 0).body as string).compareBy).toBeUndefined();

		await client().comparePolicies([TENANT, POLICY], "enforcementLevel" as never);
		expect(JSON.parse(init(f, 1).body as string).compareBy).toBe("enforcementLevel");
	});
});

describe("telemetry operation fallback", () => {
	it("derives an operation label from the method and route when none is given", async () => {
		const record = vi.fn();
		const f = stubFetch(() => jsonResponse({}));

		// Every public method supplies an operation, so drive the private request directly.
		await (
			client({ telemetry: { record } }) as unknown as {
				request: (m: string, p: string, o?: Record<string, unknown>) => Promise<unknown>;
			}
		).request("GET", "/access/v1/policies");

		expect(f).toHaveBeenCalled();
		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ operation: "GET /access/v1/policies" }),
		);
	});
});
