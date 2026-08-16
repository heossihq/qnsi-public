import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Only the activation edge is doubled; CryptoInventoryClient is the real implementation. */
const activateSdk = vi.fn();

vi.mock("@heossihq/qnsi-sdk-activation", () => ({
	activateSdk: (...args: unknown[]) => activateSdk(...args),
}));

import { CryptoInventoryClient, toNistAlgorithmName } from "./index.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";

/** Superset response: every method unwraps one of these keys. */
const BODY = {
	asset: { algorithm: "dilithium-3" },
	assets: [{ algorithm: "dilithium-3" }],
	count: 1,
	stats: { total: 1 },
	runs: [{ id: "r1" }],
	job: { id: "j1" },
	jobs: [{ id: "j1" }],
	policy: { id: "p1" },
	policies: [{ id: "p1" }],
	device: { id: "d1" },
	healthCheck: { status: "ok" },
	score: { overall: 50 },
	categoryScore: { category: "kms", score: 50 },
	success: true,
};

function stubFetch(impl?: (...args: unknown[]) => unknown) {
	const fetchMock = vi.fn(impl ?? (() => jsonResponse(BODY)));
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
	return new CryptoInventoryClient({
		apiKey: "tok",
		baseUrl: "https://crypto.example",
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
		expect(() => new CryptoInventoryClient({ apiKey: "" })).toThrow("apiKey is required");
		expect(() => new CryptoInventoryClient({ apiKey: "  " })).toThrow("apiKey is required");
	});

	it.each(["http://localhost:8080", "http://127.0.0.1:8080"])("allows %s in development", (u) => {
		vi.stubEnv("NODE_ENV", "development");
		expect(() => new CryptoInventoryClient({ apiKey: "tok", baseUrl: u })).not.toThrow();
	});

	it("rejects plain http against a public host", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(
			() => new CryptoInventoryClient({ apiKey: "tok", baseUrl: "http://crypto.example" }),
		).toThrow("baseUrl must use HTTPS in production");
	});

	it.each([
		"http://crypto.internal/",
		"http://localhost:1",
		"http://127.0.0.1:1",
	])("treats %s as an internal address", (u) => {
		vi.stubEnv("NODE_ENV", "production");
		expect(() => new CryptoInventoryClient({ apiKey: "tok", baseUrl: u })).not.toThrow();
	});

	it("rejects an unparseable http base url", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(() => new CryptoInventoryClient({ apiKey: "tok", baseUrl: "http://" })).toThrow(
			"baseUrl must use HTTPS in production",
		);
	});

	it("falls back to a fixed telemetry target for an unparseable host", () => {
		expect(
			(client({ baseUrl: "https://[" }) as unknown as { targetService: string }).targetService,
		).toBe("crypto-inventory-service");
	});

	it("activates once and reuses the result", async () => {
		stubFetch();
		const c = client();

		await c.getAssetStats(TENANT);
		await c.getAssetStats(TENANT);

		expect(activateSdk).toHaveBeenCalledTimes(1);
	});
});

describe("request plumbing", () => {
	it("sends the bearer key", async () => {
		const f = stubFetch();
		await client().getAssetStats(TENANT);

		expect(init(f).headers["Authorization"]).toBe("Bearer tok");
	});

	it("raises on a non-2xx response", async () => {
		stubFetch(() => jsonResponse({}, { status: 500 }));

		await expect(client().getAssetStats(TENANT)).rejects.toThrow();
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
		const pending = client({ timeoutMs: 100 }).getAssetStats(TENANT);
		const assertion = expect(pending).rejects.toThrow(/timeout/i);
		await vi.advanceTimersByTimeAsync(100);
		await assertion;
	});

	it("rethrows a transport error", async () => {
		stubFetch(() => {
			throw new Error("connection reset");
		});

		await expect(client().getAssetStats(TENANT)).rejects.toThrow("connection reset");
	});

	it("rethrows a non-Error", async () => {
		stubFetch(() => {
			throw "opaque";
		});

		await expect(client().getAssetStats(TENANT)).rejects.toBeTruthy();
	});
});

describe("rate limiting", () => {
	it("honours Retry-After, backs off, ignores garbage and gives up", async () => {
		vi.useFakeTimers();

		let n = 0;
		stubFetch(() => {
			n += 1;
			return n === 1
				? jsonResponse({}, { status: 429, headers: new Headers({ "Retry-After": "2" }) })
				: jsonResponse(BODY);
		});
		let pending = client().getAssetStats(TENANT);
		await vi.advanceTimersByTimeAsync(2_000);
		await expect(pending).resolves.toBeTruthy();

		n = 0;
		stubFetch(() => {
			n += 1;
			return n === 1 ? jsonResponse({}, { status: 429 }) : jsonResponse(BODY);
		});
		pending = client({ retryDelayMs: 100 }).getAssetStats(TENANT);
		await vi.advanceTimersByTimeAsync(100);
		await expect(pending).resolves.toBeTruthy();

		n = 0;
		stubFetch(() => {
			n += 1;
			return n === 1
				? jsonResponse({}, { status: 429, headers: new Headers({ "Retry-After": "soon" }) })
				: jsonResponse(BODY);
		});
		pending = client({ retryDelayMs: 50 }).getAssetStats(TENANT);
		await vi.advanceTimersByTimeAsync(50);
		await expect(pending).resolves.toBeTruthy();

		stubFetch(() => jsonResponse({}, { status: 429 }));
		const exhausted = client({ maxRetries: 1, retryDelayMs: 10 }).getAssetStats(TENANT);
		const assertion = expect(exhausted).rejects.toThrow(/Rate limit/);
		await vi.advanceTimersByTimeAsync(200);
		await assertion;
	});
});

describe("telemetry", () => {
	it("records success, failure and transport errors", async () => {
		const record = vi.fn();

		stubFetch();
		await client({ telemetry: { record } }).getAssetStats(TENANT);
		expect(record).toHaveBeenCalledWith(expect.objectContaining({ status: "ok" }));

		record.mockClear();
		stubFetch(() => jsonResponse({}, { status: 503 }));
		await expect(client({ telemetry: { record } }).getAssetStats(TENANT)).rejects.toThrow();
		expect(record).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));

		record.mockClear();
		stubFetch(() => {
			throw new Error("down");
		});
		await expect(client({ telemetry: { record } }).getAssetStats(TENANT)).rejects.toThrow();
		expect((record.mock.calls[0]?.[0] as Record<string, unknown>)["httpStatus"]).toBeUndefined();
	});

	it("builds telemetry from a config and stays silent without one", async () => {
		stubFetch();

		await expect(
			client({ telemetry: { serviceName: "crypto-test" } }).getAssetStats(TENANT),
		).resolves.toBeTruthy();
		await expect(client().getAssetStats(TENANT)).resolves.toBeTruthy();
	});
});

describe("assets", () => {
	it("lists assets with no optional filters", async () => {
		const f = stubFetch();

		const result = await client().listAssets({ tenantId: TENANT });

		expect(new URL(url(f)).searchParams.get("tenantId")).toBe(TENANT);
		expect(result.assets[0]?.algorithmNist).toBe("ML-DSA-65");
	});

	it("lists assets with every optional filter", async () => {
		const f = stubFetch();

		await client().listAssets({
			tenantId: TENANT,
			assetType: "key",
			source: "kms",
			isPqc: true,
			algorithm: "dilithium-3",
			limit: 10,
			offset: 5,
		});

		const q = new URL(url(f)).searchParams;
		expect(q.get("assetType")).toBe("key");
		expect(q.get("source")).toBe("kms");
		expect(q.get("isPqc")).toBe("true");
		expect(q.get("algorithm")).toBe("dilithium-3");
		expect(q.get("limit")).toBe("10");
		expect(q.get("offset")).toBe("5");
	});

	it("rejects a malformed tenant id", async () => {
		const f = stubFetch();

		await expect(client().listAssets({ tenantId: "nope" })).rejects.toBeTruthy();
		expect(f).not.toHaveBeenCalled();
	});

	it("gets, stats and deletes an asset", async () => {
		const f = stubFetch();

		expect((await client().getAsset(ID)).algorithmNist).toBe("ML-DSA-65");
		expect(await client().getAssetStats(TENANT)).toEqual({ total: 1 });
		await client().deleteAsset(ID);

		expect(init(f, 2).method).toBe("DELETE");
	});

	it("discovers assets with and without a tenant", async () => {
		const f = stubFetch();

		await client().discoverAssets();
		await client().discoverAssets({ tenantId: TENANT });

		expect(init(f, 0).method).toBe("POST");
		await expect(client().discoverAssets({ tenantId: "nope" })).rejects.toBeTruthy();
	});
});

describe("discovery", () => {
	it("lists jobs, reads one and reads runs", async () => {
		const f = stubFetch();

		await client().listDiscoveryJobs({});
		await client().listDiscoveryJobs({ tenantId: TENANT, status: "running" as never, limit: 5 });
		await client().getDiscoveryJob({ jobId: ID });
		await client().getDiscoveryJob({ jobId: ID, tenantId: TENANT });
		await client().getDiscoveryRuns();
		await client().getDiscoveryRuns(TENANT, 3);

		expect(f).toHaveBeenCalledTimes(6);
	});
});

describe("deprecation policies", () => {
	it("covers the full lifecycle", async () => {
		const f = stubFetch();

		await client().createDeprecationPolicy({ tenantId: TENANT, algorithm: "rsa-2048" } as never);
		await client().listDeprecationPolicies({});
		await client().listDeprecationPolicies({ tenantId: TENANT, status: "active" } as never);
		await client().getDeprecationPolicy(ID);
		await client().updateDeprecationPolicy(ID, { status: "paused" } as never);
		await client().deleteDeprecationPolicy(ID);

		expect(init(f, 0).method).toBe("POST");
		expect(init(f, 5).method).toBe("DELETE");
	});

	it("reads affected assets, acknowledges and summarises", async () => {
		const f = stubFetch();

		await client().getAffectedAssets({});
		await client().getAffectedAssets({ tenantId: TENANT, policyId: ID, limit: 5 } as never);
		await client().acknowledgeDeprecation({ tenantId: TENANT, assetId: ID } as never);
		await client().getDeprecationSummary();
		await client().getDeprecationSummary(TENANT);

		expect(f).toHaveBeenCalledTimes(5);
	});
});

describe("hardware", () => {
	it("covers registration through deletion", async () => {
		const f = stubFetch();

		await client().registerHardware({ tenantId: TENANT, vendor: "v" } as never);
		await client().listHardware({});
		await client().listHardware({ tenantId: TENANT, status: "active", limit: 5 } as never);
		await client().getHardware(ID);
		await client().updateHardware(ID, { status: "retired" } as never);
		await client().deleteHardware(ID);

		expect(init(f, 0).method).toBe("POST");
		expect(init(f, 5).method).toBe("DELETE");
	});

	it("records health and reads health and summary", async () => {
		const f = stubFetch();

		await client().recordHealthCheck(ID, { status: "ok" } as never);
		await client().getHardwareHealth(ID);
		await client().getHardwareHealth(ID, { limit: 5 } as never);
		await client().getInventorySummary();
		await client().getInventorySummary(TENANT);

		expect(f).toHaveBeenCalledTimes(5);
	});
});

describe("pqc readiness", () => {
	it("reads score, category, history, recommendations and benchmark", async () => {
		const f = stubFetch();

		await client().getReadinessScore();
		await client().getReadinessScore(TENANT);
		await client().getCategoryScore("kms" as never);
		await client().getCategoryScore("kms" as never, TENANT);
		await client().getScoreHistory({});
		await client().getScoreHistory({ tenantId: TENANT, limit: 5 } as never);
		await client().getRecommendations();
		await client().getRecommendations(TENANT);
		await client().getBenchmark();
		await client().getBenchmark(TENANT);

		expect(f).toHaveBeenCalledTimes(10);
	});

	it("reads the pqc migration status", async () => {
		const f = stubFetch();

		await client().getPqcMigrationStatus(TENANT);

		expect(url(f)).toContain("/crypto/v1/");
	});
});

describe("toNistAlgorithmName", () => {
	it("maps a known algorithm and passes an unknown one through", () => {
		expect(toNistAlgorithmName("dilithium-3")).toBe("ML-DSA-65");
		expect(toNistAlgorithmName("not-real")).toBe("not-real");
	});
});

describe("every optional filter is carried when supplied", () => {
	function f() {
		return stubFetch();
	}

	it("listDeprecationPolicies carries all six filters", async () => {
		const m = f();

		await client().listDeprecationPolicies({
			tenantId: TENANT,
			status: "active",
			severity: "high",
			algorithm: "rsa-2048",
			limit: 10,
			offset: 5,
		} as never);

		const q = new URL(url(m)).searchParams;
		expect(q.get("tenantId")).toBe(TENANT);
		expect(q.get("status")).toBe("active");
		expect(q.get("severity")).toBe("high");
		expect(q.get("algorithm")).toBe("rsa-2048");
		expect(q.get("limit")).toBe("10");
		expect(q.get("offset")).toBe("5");
	});

	it("getAffectedAssets carries all seven filters", async () => {
		const m = f();

		await client().getAffectedAssets({
			tenantId: TENANT,
			severity: "high",
			status: "open",
			acknowledged: false,
			algorithm: "rsa-2048",
			limit: 10,
			offset: 5,
		} as never);

		const q = new URL(url(m)).searchParams;
		expect(q.get("acknowledged")).toBe("false");
		expect(q.get("severity")).toBe("high");
		expect(q.get("offset")).toBe("5");
	});

	it("listHardware carries all its filters", async () => {
		const m = f();

		await client().listHardware({
			tenantId: TENANT,
			hardwareType: "hsm",
			status: "active",
			healthStatus: "healthy",
			pqcCapable: true,
			complianceLevel: "fips-140-3",
			limit: 10,
			offset: 5,
		} as never);

		const q = new URL(url(m)).searchParams;
		expect(q.get("hardwareType")).toBe("hsm");
		expect(q.get("healthStatus")).toBe("healthy");
		expect(q.get("pqcCapable")).toBe("true");
		expect(q.get("complianceLevel")).toBe("fips-140-3");
	});

	it("listDiscoveryJobs carries all its filters", async () => {
		const m = f();

		await client().listDiscoveryJobs({
			tenantId: TENANT,
			status: "running" as never,
			limit: 5,
			offset: 2,
		} as never);

		const q = new URL(url(m)).searchParams;
		expect(q.get("status")).toBe("running");
		expect(q.get("limit")).toBe("5");
	});

	it("getHardwareHealth and getScoreHistory carry their filters", async () => {
		const m = f();

		await client().getHardwareHealth(ID, { limit: 5, offset: 2, status: "ok" } as never);
		await client().getScoreHistory({ tenantId: TENANT, limit: 5, offset: 2 } as never);

		expect(url(m, 0)).toContain("limit=5");
		expect(new URL(url(m, 1)).searchParams.get("tenantId")).toBe(TENANT);
	});

	it("rejects a malformed tenant in every options-shaped filter", async () => {
		const m = f();

		await expect(
			client().listDeprecationPolicies({ tenantId: "nope" } as never),
		).rejects.toBeTruthy();
		await expect(client().getAffectedAssets({ tenantId: "nope" } as never)).rejects.toBeTruthy();
		await expect(client().listHardware({ tenantId: "nope" } as never)).rejects.toBeTruthy();
		await expect(client().listDiscoveryJobs({ tenantId: "nope" } as never)).rejects.toBeTruthy();
		await expect(client().getScoreHistory({ tenantId: "nope" } as never)).rejects.toBeTruthy();
		expect(m).not.toHaveBeenCalled();
	});

	it("rejects a malformed tenant in every string-shaped filter", async () => {
		const m = f();

		await expect(client().getDiscoveryRuns("nope")).rejects.toBeTruthy();
		await expect(client().getDeprecationSummary("nope")).rejects.toBeTruthy();
		await expect(client().getInventorySummary("nope")).rejects.toBeTruthy();
		await expect(client().getReadinessScore("nope")).rejects.toBeTruthy();
		await expect(client().getCategoryScore("kms" as never, "nope")).rejects.toBeTruthy();
		await expect(client().getRecommendations("nope")).rejects.toBeTruthy();
		await expect(client().getBenchmark("nope")).rejects.toBeTruthy();
		expect(m).not.toHaveBeenCalled();
	});
});

describe("no-content responses", () => {
	it("returns undefined for a 204", async () => {
		stubFetch(() => jsonResponse(null, { status: 204 }));

		await expect(client().deleteAsset(ID)).resolves.toBeUndefined();
	});
});

describe("remaining option and derivation branches", () => {
	it("uses the default base url when none is supplied", async () => {
		stubFetch();

		await expect(
			new CryptoInventoryClient({ apiKey: "tok" }).getReadinessScore(),
		).resolves.toBeTruthy();
	});

	it("omits the tenant header before activation resolves", async () => {
		activateSdk.mockResolvedValue({ tenantId: undefined });
		const m = stubFetch();

		await client().getReadinessScore();

		expect(init(m).headers["x-qnsp-tenant-id"]).toBeUndefined();
	});

	it("derives a telemetry operation label when none is given", async () => {
		const record = vi.fn();
		stubFetch();

		await (
			client({ telemetry: { record } }) as unknown as {
				request: (method: string, path: string, o?: Record<string, unknown>) => Promise<unknown>;
			}
		).request("GET", "/crypto/v1/assets");

		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ operation: "GET /crypto/v1/assets" }),
		);
	});

	it("reports a zero percentage and incomplete migration for an empty inventory", async () => {
		stubFetch(() => jsonResponse({ stats: { totalAssets: 0, pqcAssets: 0, classicalAssets: 0 } }));

		expect(await client().getPqcMigrationStatus(TENANT)).toMatchObject({
			pqcPercentage: 0,
			migrationComplete: false,
		});
	});

	it("reports a complete migration once no classical assets remain", async () => {
		stubFetch(() => jsonResponse({ stats: { totalAssets: 4, pqcAssets: 4, classicalAssets: 0 } }));

		expect(await client().getPqcMigrationStatus(TENANT)).toMatchObject({
			pqcPercentage: 100,
			migrationComplete: true,
		});
	});

	it("reports a partial migration while classical assets remain", async () => {
		stubFetch(() => jsonResponse({ stats: { totalAssets: 4, pqcAssets: 1, classicalAssets: 3 } }));

		expect(await client().getPqcMigrationStatus(TENANT)).toMatchObject({
			pqcPercentage: 25,
			migrationComplete: false,
		});
	});

	it("listHardware carries a location filter", async () => {
		const m = stubFetch();

		await client().listHardware({ location: "ap-southeast-1" } as never);

		expect(new URL(url(m)).searchParams.get("location")).toBe("ap-southeast-1");
	});

	it("getHardwareHealth carries since and until", async () => {
		const m = stubFetch();

		await client().getHardwareHealth(ID, {
			tenantId: TENANT,
			since: "2026-01-01T00:00:00Z",
			until: "2026-02-01T00:00:00Z",
		} as never);

		const q = new URL(url(m)).searchParams;
		expect(q.get("since")).toBeTruthy();
		expect(q.get("until")).toBeTruthy();
	});

	it("rejects a malformed hardware id", async () => {
		const m = stubFetch();

		await expect(client().getHardwareHealth("nope")).rejects.toBeTruthy();
		expect(m).not.toHaveBeenCalled();
	});
});

describe("score history window", () => {
	it("carries since and until", async () => {
		const m = stubFetch();

		await client().getScoreHistory({
			tenantId: TENANT,
			since: "2026-01-01T00:00:00Z",
			until: "2026-02-01T00:00:00Z",
			limit: 10,
		} as never);

		const q = new URL(url(m)).searchParams;
		expect(q.get("since")).toBe("2026-01-01T00:00:00Z");
		expect(q.get("until")).toBe("2026-02-01T00:00:00Z");
		// withTenantHeader also stamps the tenant on the request headers.
		expect(init(m).headers["x-qnsp-tenant"]).toBe(TENANT);
	});
});
