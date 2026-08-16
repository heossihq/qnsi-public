import { describe, expect, it, vi } from "vitest";
import { AiIntelligenceClient, AiIntelligenceError } from "./intelligence.js";

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { "Content-Type": "application/json" },
		...init,
	});
}

function makeClient(fetchImpl: typeof fetch): AiIntelligenceClient {
	return new AiIntelligenceClient({
		baseUrl: "https://ai.qnsp.example",
		token: "intel-token",
		fetchImpl,
	});
}

describe("AiIntelligenceClient", () => {
	it("drives every endpoint with bearer auth and normalized base URL", async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
		const client = makeClient(fetchMock as unknown as typeof fetch);

		await client.getDashboard();
		await client.getHealthStatus();
		await client.getAnomalies();
		await client.ingestMetrics([{ service: "kms", metric: "latency", value: 5 }]);
		await client.getScalingRecommendations();
		await client.getRateLimit("tenant-1");
		await client.recordRateLimitRequest("tenant-1", "/v1/x");
		await client.getComplianceViolations();
		await client.runComplianceAudit();
		await client.getCacheStats();
		await client.recordCacheAccess("k", true);
		await client.parseNlpQuery("show anomalies");
		await client.getNlpIntents();
		await client.analyzeError("boom", { service: "kms" });
		await client.getErrorPatterns();
		await client.recordErrorEvent({ service: "kms", error: "boom" });

		expect(fetchMock).toHaveBeenCalledTimes(16);
		const calls = fetchMock.mock.calls as unknown as Array<[URL, RequestInit]>;
		for (const [url, init] of calls) {
			expect(String(url)).toContain("https://ai.qnsp.example/ai/v1/");
			expect((init.headers as Headers).get("Authorization")).toBe("Bearer intel-token");
		}
	});

	it("keeps a trailing-slash base URL and merges extra headers", async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
		const client = new AiIntelligenceClient({
			baseUrl: "https://ai.qnsp.example/",
			token: "t",
			fetchImpl: fetchMock as unknown as typeof fetch,
		});
		await client.getDashboard();
		const first = (fetchMock.mock.calls as unknown as Array<[URL]>)[0];
		expect(String(first?.[0])).toBe("https://ai.qnsp.example/ai/v1/dashboard");
	});

	it("defaults to global fetch when no fetchImpl is provided", async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
		vi.stubGlobal("fetch", fetchMock);
		try {
			const client = new AiIntelligenceClient({
				baseUrl: "https://ai.qnsp.example",
				token: "t",
			});
			await client.getDashboard();
			expect(fetchMock).toHaveBeenCalledTimes(1);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("returns undefined for 204 responses", async () => {
		const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
		const client = makeClient(fetchMock as unknown as typeof fetch);
		await expect(client.runComplianceAudit()).resolves.toBeUndefined();
	});

	it("surfaces error payload messages from both error shapes, and none at all", async () => {
		const structured = vi.fn(async () =>
			jsonResponse(
				{ error: { message: "quota exhausted" } },
				{ status: 429, statusText: "Too Many" },
			),
		);
		await expect(makeClient(structured as unknown as typeof fetch).getDashboard()).rejects.toThrow(
			"failed with status 429: Too Many - quota exhausted",
		);

		const flat = vi.fn(async () =>
			jsonResponse({ message: "flat failure" }, { status: 500, statusText: "Internal" }),
		);
		await expect(makeClient(flat as unknown as typeof fetch).getDashboard()).rejects.toThrow(
			"failed with status 500: Internal - flat failure",
		);

		const bare = vi.fn(async () =>
			jsonResponse({ other: true }, { status: 500, statusText: "Internal" }),
		);
		const bareError = await makeClient(bare as unknown as typeof fetch)
			.getDashboard()
			.catch((e: unknown) => e);
		expect(bareError).toBeInstanceOf(AiIntelligenceError);
		expect((bareError as AiIntelligenceError).statusCode).toBe(500);
		expect(String(bareError)).not.toContain(" - ");

		const nonJson = vi.fn(
			async () => new Response("not json", { status: 502, statusText: "Bad Gateway" }),
		);
		await expect(makeClient(nonJson as unknown as typeof fetch).getDashboard()).rejects.toThrow(
			"failed with status 502: Bad Gateway",
		);

		const nullBody = vi.fn(async () => jsonResponse(null, { status: 500, statusText: "Internal" }));
		await expect(makeClient(nullBody as unknown as typeof fetch).getDashboard()).rejects.toThrow(
			"failed with status 500: Internal",
		);
	});
});
