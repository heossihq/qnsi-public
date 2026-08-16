import { afterEach, describe, expect, it, vi } from "vitest";

import {
	benchmark,
	formatBenchmarkResults,
	PERFORMANCE_SLAS,
	runBenchmarkSuite,
	validateAgainstSLAs,
} from "./benchmarks.js";
import {
	createAiIntelligenceHealthHandler,
	registerPqcProviderHealth,
	ServiceHealthRegistry,
} from "./service-health-registry.js";
import {
	formatSmokeTestReport,
	runSmokeTests,
	testApiEndpoint,
	testHealthEndpoint,
} from "./smoke-test-utils.js";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("benchmarks", () => {
	it("computes timing statistics from measured iterations", async () => {
		// Deterministic clock: each iteration takes exactly 2ms.
		let now = 0;
		vi.spyOn(performance, "now").mockImplementation(() => {
			now += 2;
			return now;
		});
		const result = await benchmark("det", () => {}, 4);
		expect(result).toMatchObject({ name: "det", iterations: 4, totalMs: 8, avgMs: 2 });
		expect(result.minMs).toBe(2);
		expect(result.maxMs).toBe(2);
		expect(result.p50Ms).toBe(2);
		expect(result.p95Ms).toBe(2);
		expect(result.p99Ms).toBe(2);
		expect(result.opsPerSecond).toBe(500);
	});

	it("awaits async work and orders percentiles from sorted timings", async () => {
		const seen: number[] = [];
		const result = await benchmark(
			"async",
			async () => {
				seen.push(seen.length);
				await Promise.resolve();
			},
			3,
		);
		expect(seen).toEqual([0, 1, 2]);
		expect(result.minMs).toBeLessThanOrEqual(result.p50Ms);
		expect(result.p50Ms).toBeLessThanOrEqual(result.maxMs);
	});

	it("zero iterations and zero-duration clocks fall back to zeros", async () => {
		const empty = await benchmark("empty", () => {}, 0);
		expect(empty.minMs).toBe(0);
		expect(empty.maxMs).toBe(0);
		expect(empty.p50Ms).toBe(0);
		expect(empty.opsPerSecond).toBe(0);

		vi.spyOn(performance, "now").mockReturnValue(42);
		const flat = await benchmark("flat", () => {}, 2);
		expect(flat.avgMs).toBe(0);
		expect(flat.opsPerSecond).toBe(0);
	});

	it("runBenchmarkSuite runs each benchmark and captures the node environment", async () => {
		const suite = await runBenchmarkSuite("suite", [
			{ name: "a", fn: () => {}, iterations: 2 },
			{ name: "b", fn: () => {} },
		]);
		expect(suite.suiteName).toBe("suite");
		expect(suite.results.map((r) => r.name)).toEqual(["a", "b"]);
		expect(suite.results[1]?.iterations).toBe(100);
		expect(suite.environment.nodeVersion).toBe(process.version);
		expect(suite.environment.platform).toBe(process.platform);
		expect(suite.environment.cpuCount).toBeGreaterThan(0);
	});

	it("runBenchmarkSuite reports a browser environment when process has no node version", async () => {
		vi.stubGlobal("process", { ...process, versions: undefined });
		const suite = await runBenchmarkSuite("browser-suite", [
			{ name: "a", fn: () => {}, iterations: 1 },
		]);
		expect(suite.environment).toEqual({
			nodeVersion: "browser",
			platform: "browser",
			cpuCount: 1,
		});
	});

	it("formatBenchmarkResults renders a markdown table row per result", async () => {
		const suite = await runBenchmarkSuite("fmt", [{ name: "row-1", fn: () => {}, iterations: 1 }]);
		const text = formatBenchmarkResults(suite);
		expect(text).toContain("# Benchmark Results: fmt");
		expect(text).toContain(`**Node:** ${process.version}`);
		expect(text).toContain("| row-1 | 1 |");
	});

	it("validateAgainstSLAs selects the requested percentile and compares to the threshold", () => {
		const result = {
			name: "x",
			iterations: 1,
			totalMs: 1,
			avgMs: 1,
			minMs: 1,
			maxMs: 9,
			p50Ms: 3,
			p95Ms: 6,
			p99Ms: 9,
			opsPerSecond: 1000,
		};
		expect(validateAgainstSLAs(result, 5, "p50")).toEqual({
			passed: true,
			actualMs: 3,
			thresholdMs: 5,
		});
		expect(validateAgainstSLAs(result, 5)).toEqual({ passed: false, actualMs: 6, thresholdMs: 5 });
		expect(validateAgainstSLAs(result, PERFORMANCE_SLAS.API_RESPONSE_P99_MS, "p99").passed).toBe(
			true,
		);
	});
});

describe("ServiceHealthRegistry", () => {
	it("tracks components and derives the worst overall status", () => {
		const registry = new ServiceHealthRegistry("svc", "1.2.3");
		registry.registerComponent("db");
		registry.registerComponent("cache", "degraded", "slow");
		expect(registry.getOverallStatus()).toBe("degraded");
		registry.setComponentStatus("db", "critical", "down");
		expect(registry.getOverallStatus()).toBe("critical");
		expect(registry.isComponentHealthy("db")).toBe(false);
		expect(registry.isComponentHealthy("missing")).toBe(false);
		expect(registry.isReady()).toBe(false);
		registry.setComponentStatus("db", "ok");
		registry.setComponentStatus("cache", "ok");
		expect(registry.getOverallStatus()).toBe("ok");
		expect(registry.isComponentHealthy("db")).toBe(true);
		expect(registry.isReady()).toBe(true);
	});

	it("emits degraded and recovered events only on status transitions", () => {
		const registry = new ServiceHealthRegistry("svc");
		const events: string[] = [];
		registry.onHealthChange((event) => {
			events.push(`${event.eventType}:${event.component}:${event.status}`);
		});
		registry.registerComponent("db");
		registry.setComponentStatus("db", "degraded", "slow");
		registry.setComponentStatus("db", "degraded", "still slow");
		registry.setComponentStatus("db", "ok");
		// A component never registered defaults its previous status to ok, so
		// setting it to ok emits nothing.
		registry.setComponentStatus("fresh", "ok");
		expect(events).toEqual([
			"service.health.degraded.v1:db:degraded",
			"service.health.recovered.v1:db:ok",
		]);
	});

	it("a throwing handler is contained and later handlers still run", () => {
		const registry = new ServiceHealthRegistry("svc");
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const seen: string[] = [];
		registry.onHealthChange(() => {
			throw new Error("handler boom");
		});
		registry.onHealthChange((event) => {
			seen.push(event.component);
		});
		registry.setComponentStatus("db", "critical");
		expect(seen).toEqual(["db"]);
		expect(consoleError).toHaveBeenCalledWith("Health event handler error:", expect.any(Error));
	});

	it("getHealthResponse reports service metadata, uptime, and per-component messages", () => {
		const registry = new ServiceHealthRegistry("svc", "9.9.9");
		registry.registerComponent("db", "ok");
		registry.registerComponent("hsm", "degraded", "provider offline");
		const response = registry.getHealthResponse();
		expect(response.status).toBe("degraded");
		expect(response.service).toBe("svc");
		expect(response.version).toBe("9.9.9");
		expect(response.uptime).toBeGreaterThanOrEqual(0);
		expect(response.components["db"]).toEqual({ status: "ok" });
		expect(response.components["hsm"]).toEqual({ status: "degraded", message: "provider offline" });
	});

	it("defaults the version to unknown", () => {
		expect(new ServiceHealthRegistry("svc").getHealthResponse().version).toBe("unknown");
	});
});

describe("registerPqcProviderHealth", () => {
	it("marks the provider ok when present and degraded with the error message when absent", () => {
		const okRegistry = new ServiceHealthRegistry("svc");
		registerPqcProviderHealth(okRegistry, {});
		expect(okRegistry.getHealthResponse().components["pqc-provider"]).toEqual({
			status: "ok",
			message: "liboqs initialized",
		});

		const failedRegistry = new ServiceHealthRegistry("svc");
		registerPqcProviderHealth(failedRegistry, null, new Error("liboqs load error"));
		expect(failedRegistry.getHealthResponse().components["pqc-provider"]).toEqual({
			status: "degraded",
			message: "liboqs load error",
		});

		const noErrorRegistry = new ServiceHealthRegistry("svc");
		registerPqcProviderHealth(noErrorRegistry, null);
		expect(noErrorRegistry.getHealthResponse().components["pqc-provider"]?.message).toBe(
			"liboqs initialization failed",
		);
	});
});

describe("createAiIntelligenceHealthHandler", () => {
	const EVENT = {
		eventType: "service.health.degraded.v1" as const,
		serviceName: "svc",
		component: "db",
		status: "degraded" as const,
		message: "slow",
		timestamp: "2026-08-15T00:00:00.000Z",
	};

	it("skips emission with a warning when no URL is configured", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await createAiIntelligenceHealthHandler(undefined, async () => "tok")(EVENT);
		expect(warn).toHaveBeenCalledOnce();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("posts the event with a bearer token to the ingest route", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
		vi.stubGlobal("fetch", fetchMock);
		await createAiIntelligenceHealthHandler("https://ai.internal", async () => "tok-1")(EVENT);
		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://ai.internal/ai/v1/events/ingest");
		expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-1");
		expect(JSON.parse(init.body as string)).toMatchObject({
			eventType: EVENT.eventType,
			source: "svc",
			data: { component: "db", status: "degraded", message: "slow" },
		});
	});

	it("omits the Authorization header when no token resolves and logs non-OK responses", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 503, statusText: "Service Unavailable" }));
		vi.stubGlobal("fetch", fetchMock);
		await createAiIntelligenceHealthHandler("https://ai.internal", async () => undefined)(EVENT);
		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(init.headers as Record<string, string>).not.toHaveProperty("Authorization");
		expect(consoleError).toHaveBeenCalledWith(
			"Failed to emit health event to AI Intelligence: 503 Service Unavailable",
		);
	});

	it("contains transport failures instead of throwing", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
		await expect(
			createAiIntelligenceHealthHandler("https://ai.internal", async () => "tok")(EVENT),
		).resolves.toBeUndefined();
		expect(consoleError).toHaveBeenCalledWith(
			"Failed to emit health event to AI Intelligence:",
			expect.any(Error),
		);
	});
});

describe("smoke-test-utils", () => {
	it("runSmokeTests records passes, failures, and non-Error throws", async () => {
		const suite = await runSmokeTests("svc", "1.0.0", [
			{ name: "ok", fn: async () => {} },
			{
				name: "boom",
				fn: async () => {
					throw new Error("exploded");
				},
			},
			{
				name: "string-throw",
				fn: async () => {
					throw "raw failure";
				},
			},
		]);
		expect(suite.summary).toMatchObject({ total: 3, passed: 1, failed: 2 });
		expect(suite.results[0]).toMatchObject({ name: "ok", passed: true });
		expect(suite.results[1]?.error).toBe("exploded");
		expect(suite.results[2]?.error).toBe("raw failure");
	});

	it("testHealthEndpoint accepts healthy and degraded, rejects non-OK and unhealthy", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ status: "degraded" }), { status: 200 }))
			.mockResolvedValueOnce(new Response(null, { status: 500 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ status: "unhealthy" }), { status: 200 }),
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(testHealthEndpoint("https://svc.internal")).resolves.toEqual({
			status: "degraded",
		});
		await expect(testHealthEndpoint("https://svc.internal")).rejects.toThrow(
			"Health check failed with status 500",
		);
		await expect(testHealthEndpoint("https://svc.internal")).rejects.toThrow(
			"Service unhealthy: unhealthy",
		);
		expect(fetchMock.mock.calls[0]?.[0]).toBe("https://svc.internal/health");
	});

	it("testHealthEndpoint aborts through its timeout signal", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(
				(_url: string, init: RequestInit) =>
					new Promise((_resolve, reject) => {
						init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
					}),
			),
		);
		await expect(testHealthEndpoint("https://svc.internal", 5)).rejects.toThrow("aborted");
	});

	it("testApiEndpoint serializes bodies, checks status, and tolerates non-JSON responses", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ id: "r1" }), { status: 201 }))
			.mockResolvedValueOnce(new Response("not json", { status: 404 }));
		vi.stubGlobal("fetch", fetchMock);

		const created = await testApiEndpoint("https://svc.internal/v1/things", {
			method: "POST",
			headers: { "x-extra": "1" },
			body: { name: "thing" },
			expectedStatus: 201,
		});
		expect(created).toEqual({ status: 201, body: { id: "r1" } });
		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(init.body).toBe(JSON.stringify({ name: "thing" }));
		expect((init.headers as Record<string, string>)["x-extra"]).toBe("1");
		expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");

		await expect(testApiEndpoint("https://svc.internal/v1/missing")).rejects.toThrow(
			"Expected status 200, got 404: null",
		);
	});

	it("testApiEndpoint aborts through its timeout signal", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(
				(_url: string, init: RequestInit) =>
					new Promise((_resolve, reject) => {
						init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
					}),
			),
		);
		await expect(testApiEndpoint("https://svc.internal/v1/slow", { timeoutMs: 5 })).rejects.toThrow(
			"aborted",
		);
	});

	it("formatSmokeTestReport prints one status line per result plus error details", async () => {
		const suite = await runSmokeTests("svc", "2.0.0", [
			{ name: "pass-case", fn: async () => {} },
			{
				name: "fail-case",
				fn: async () => {
					throw new Error("broken pipe");
				},
			},
		]);
		const report = formatSmokeTestReport(suite);
		expect(report).toContain("=== Smoke Test Report: svc ===");
		expect(report).toContain("Version: 2.0.0");
		expect(report).toContain("Summary: 1/2 passed");
		expect(report).toContain("✅ PASS pass-case");
		expect(report).toContain("❌ FAIL fail-case");
		expect(report).toContain("Error: broken pipe");
	});
});
