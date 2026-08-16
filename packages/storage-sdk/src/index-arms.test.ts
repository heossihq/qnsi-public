/**
 * Arm sweep for the StorageClient: constructor policy gates, retry/backoff,
 * timeout discipline, download-stream header parsing, and one call through
 * every API method proving path, headers, and query construction.
 */
import { clearActivationCache } from "@heossihq/qnsi-sdk-activation";
import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageClient, toNistAlgorithmName } from "./index.js";
import type { StorageClientTelemetryEvent } from "./observability.js";

const TENANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const DOC = "44444444-4444-4444-a444-444444444444";
const UPLOAD = "11111111-1111-4111-a111-111111111111";
const HOLD = "55555555-5555-4555-a555-555555555555";
const POLICY = "66666666-6666-4666-a666-666666666666";
const BASE = "https://storage.qnsp.example";

const ACTIVATION = {
	activated: true,
	tenantId: "a1b2c3d4-e5f6-4789-8abc-def012345678",
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

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
		...init,
	});
}

const fetchMock = vi.fn();

function fetchCalls(): Array<[string, RequestInit]> {
	return fetchMock.mock.calls as Array<[string, RequestInit]>;
}

/** Activation first, then every subsequent request gets `payload`. */
function armGateway(payload: unknown): void {
	fetchMock.mockImplementation(async (url: string) => {
		if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
		return jsonResponse(payload);
	});
}

function client(overrides: Record<string, unknown> = {}): StorageClient {
	return new StorageClient({ baseUrl: BASE, apiKey: "api-key", tenantId: TENANT, ...overrides });
}

beforeEach(() => {
	clearActivationCache();
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("constructor policy", () => {
	it("requires an api key", () => {
		expect(() => client({ apiKey: "  " })).toThrow("apiKey is required");
	});

	it("rejects plain HTTP outside localhost/internal, allows the sanctioned exceptions", () => {
		expect(() => client({ baseUrl: "http://api.example.com" })).toThrow(
			"baseUrl must use HTTPS in production",
		);
		// NODE_ENV is "test" here, so localhost HTTP is a sanctioned dev exception.
		expect(client({ baseUrl: "http://localhost:4010" })).toBeInstanceOf(StorageClient);
		expect(client({ baseUrl: "http://127.0.0.1:4010" })).toBeInstanceOf(StorageClient);
		expect(client({ baseUrl: "http://storage.qnsp.internal" })).toBeInstanceOf(StorageClient);
		// Unparseable non-https base: the URL probe fails and the gate closes.
		expect(() => client({ baseUrl: "http://exa mple" })).toThrow(
			"baseUrl must use HTTPS in production",
		);
	});

	it("falls back to a generic target when the host cannot be parsed", async () => {
		const events: StorageClientTelemetryEvent[] = [];
		const c = client({
			baseUrl: "https://exa mple",
			telemetry: { record: (e: StorageClientTelemetryEvent) => events.push(e) },
		});
		armGateway({ uploadId: UPLOAD });
		// getUploadStatus supplies an explicit telemetry route, so the request
		// proceeds even though the base URL cannot be parsed into a host.
		await c.getUploadStatus(UPLOAD);
		expect(events.at(-1)?.target).toBe("storage-service");
	});

	it("wraps a telemetry CONFIG into a recorder and accepts a recorder as-is", async () => {
		const events: StorageClientTelemetryEvent[] = [];
		armGateway({ policies: [] });
		await client({
			telemetry: { record: (e: StorageClientTelemetryEvent) => events.push(e) },
		}).listTieringPolicies();
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({ operation: "listTieringPolicies", status: "ok" });

		// Config form: a real in-memory reader, no network exporter.
		const reader = new PeriodicExportingMetricReader({
			exporter: new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE),
			exportIntervalMillis: 2 ** 30,
		});
		await client({
			telemetry: { serviceName: "arm-test", exporterFactory: () => reader },
		}).listTieringPolicies();
		await reader.shutdown();
	});
});

describe("request retry and failure discipline", () => {
	it("retries 429 with Retry-After seconds, then exponential backoff, then fails closed", async () => {
		vi.useFakeTimers();
		const c = client({ maxRetries: 2, retryDelayMs: 10 });
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			return jsonResponse({ error: "slow down" }, { status: 429, headers: { "Retry-After": "1" } });
		});
		const pending = c.getTieringStats();
		const guard = pending.catch((e: unknown) => e);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(String(await guard)).toContain("Rate limit exceeded after 2 retries");
	});

	it("uses the base delay when Retry-After is unparseable and backoff without it", async () => {
		vi.useFakeTimers();
		const c = client({ maxRetries: 1, retryDelayMs: 5 });
		let attempts = 0;
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			attempts += 1;
			if (attempts === 1) {
				return jsonResponse({}, { status: 429, headers: { "Retry-After": "not-a-number" } });
			}
			return jsonResponse({ tiers: [] });
		});
		const pending = c.getTieringStats();
		await vi.advanceTimersByTimeAsync(1_000);
		await expect(pending).resolves.toEqual({ tiers: [] });

		attempts = 0;
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			attempts += 1;
			if (attempts === 1) return jsonResponse({}, { status: 429 });
			return jsonResponse({ tiers: [] });
		});
		const second = c.getTieringStats();
		await vi.advanceTimersByTimeAsync(1_000);
		await expect(second).resolves.toEqual({ tiers: [] });
	});

	it("maps non-OK responses, 204 bodies, timeouts, and non-Error throws", async () => {
		const events: StorageClientTelemetryEvent[] = [];
		const c = client({
			telemetry: { record: (e: StorageClientTelemetryEvent) => events.push(e) },
		});
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			return new Response(null, { status: 500, statusText: "Internal Server Error" });
		});
		await expect(c.getTieringStats()).rejects.toThrow("Storage API error: 500");
		expect(events.at(-1)).toMatchObject({ status: "error", httpStatus: 500, error: "HTTP 500" });

		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			return new Response(null, { status: 204 });
		});
		await expect(c.releaseLegalHold(DOC, "hold-1")).resolves.toBeUndefined();

		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			const abort = new Error("aborted");
			abort.name = "AbortError";
			throw abort;
		});
		await expect(c.getTieringStats()).rejects.toThrow("Request timeout after 30000ms");
		expect(events.at(-1)?.error).toContain("timeout after 30000ms");

		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			throw "raw socket failure";
		});
		await expect(c.getTieringStats()).rejects.toBe("raw socket failure");
	});
});

describe("uploadPart input forms and failures", () => {
	it("accepts Uint8Array and ReadableStream sources", async () => {
		armGateway({ uploadId: UPLOAD, partId: 1 });
		const c = client();
		await c.uploadPart(UPLOAD, 1, new Uint8Array([1, 2]));
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([3]));
				controller.close();
			},
		});
		await c.uploadPart(UPLOAD, 2, stream);
		const bodies = fetchCalls()
			.filter(([u]) => u.includes("/parts/"))
			.map(([, i]) => i.body);
		expect(bodies[0]).toBeInstanceOf(ReadableStream);
		expect(bodies[1]).toBe(stream);
	});

	it("maps upload failures, timeouts, and non-Error throws", async () => {
		const events: StorageClientTelemetryEvent[] = [];
		const c = client({
			telemetry: { record: (e: StorageClientTelemetryEvent) => events.push(e) },
		});
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			return new Response(null, { status: 413, statusText: "Payload Too Large" });
		});
		await expect(c.uploadPart(UPLOAD, 1, Buffer.from([1]))).rejects.toThrow(
			"Upload part error: 413",
		);
		expect(events.at(-1)).toMatchObject({ operation: "uploadPart", bytesSent: 1 });

		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			const abort = new Error("aborted");
			abort.name = "AbortError";
			throw abort;
		});
		await expect(c.uploadPart(UPLOAD, 1, Buffer.from([1]))).rejects.toThrow("Request timeout");

		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			throw "raw upload failure";
		});
		await expect(c.uploadPart(UPLOAD, 1, Buffer.from([1]))).rejects.toBe("raw upload failure");
	});
});

describe("download surfaces", () => {
	it("builds descriptor queries with and without the signed-url options", async () => {
		armGateway({ documentId: DOC });
		const c = client();
		await c.getDownloadDescriptor(DOC, 1);
		await c.getDownloadDescriptor(DOC, 2, { token: "t", expiresAt: 99, signature: "sig" });
		const urls = fetchCalls()
			.map(([u]) => u)
			.filter((u) => u.includes("/download"));
		expect(urls[0]).not.toContain("token=");
		expect(urls[1]).toContain("token=t");
		expect(urls[1]).toContain("expiresAt=99");
		expect(urls[1]).toContain("signature=sig");
	});

	it("handles full-content downloads without a range and empty bodies", async () => {
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			return new Response(null, {
				status: 200,
				headers: { "X-Total-Size": "10", "Content-Length": "0" },
			});
		});
		const c = client();
		const result = await c.downloadStream(DOC, 1, {
			token: "t",
			expiresAt: 5,
			signature: "s",
			range: "bytes=0-9",
		});
		expect(result.statusCode).toBe(200);
		expect(result.totalSize).toBe(10);
		expect(result.contentLength).toBe(10);
		expect(result.range).toBeUndefined();
		expect(result.checksumSha3).toBe("");
		const downloadCall = fetchCalls().find(([u]) => u.includes("/content"));
		expect((downloadCall?.[1]?.headers as Record<string, string>)["Range"]).toBe("bytes=0-9");
	});

	it("maps download failures, timeouts, and non-Error throws", async () => {
		const c = client();
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			return new Response(null, { status: 404, statusText: "Not Found" });
		});
		await expect(c.downloadStream(DOC, 1)).rejects.toThrow("Download error: 404");

		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			const abort = new Error("aborted");
			abort.name = "AbortError";
			throw abort;
		});
		await expect(c.downloadStream(DOC, 1)).rejects.toThrow("Request timeout");

		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			throw "raw download failure";
		});
		await expect(c.downloadStream(DOC, 1)).rejects.toBe("raw download failure");
	});
});

describe("full method surface", () => {
	it("drives every policy, classification, retention, replication, and tiering method", async () => {
		armGateway({ ok: true, policies: [], configurations: [], recommendations: [] });
		const c = client();

		await c.getUploadStatus(UPLOAD);
		await c.completeUpload(UPLOAD);
		await c.getDocumentPolicies(DOC);
		await c.updateDocumentPolicies(DOC, { retentionMode: "governance" });
		await c.applyLegalHold(DOC, { holdId: "hold-a" });
		await c.releaseLegalHold(DOC, "hold-a");
		await c.scheduleLifecycleTransition(DOC, {
			targetTier: "cold",
			transitionAfter: "2027-01-01T00:00:00.000Z",
		});
		await c.createClassificationPolicy({ name: "p" } as never);
		await c.listClassificationPolicies();
		await c.listClassificationPolicies({ enabled: true });
		await c.classifyObject(DOC, { classificationLevel: "confidential" } as never);
		await c.getObjectClassification(DOC);
		await c.startClassificationScan({ scanType: "full" } as never);
		await c.detectPII("call me at +65 5550 0000", "text/plain");
		await c.getClassificationStats();
		await c.createRetentionPolicy({ name: "r" } as never);
		await c.listRetentionPolicies();
		await c.listRetentionPolicies({ enabled: false });
		await c.placeHold(DOC, { holdType: "litigation" } as never);
		await c.releaseHold(HOLD, "case closed");
		await c.scheduleDelete(DOC, { deletionType: "soft" } as never);
		await c.evaluateRetention(DOC, { objectPath: "/a/b" });
		await c.createReplicationConfig({ name: "rep" } as never);
		await c.listReplicationConfigs();
		await c.listReplicationConfigs({ enabled: true, sourceRegion: "ap-southeast-1" });
		await c.replicateObject(DOC, ["ap-northeast-1"]);
		await c.replicateObject(DOC, ["ap-northeast-1"], {
			sizeBytes: 5,
			sourceChecksum: "sum",
			configurationId: "cfg",
			priority: "high",
		});
		await c.getReplicationStatus(DOC);
		await c.getReplicationMetrics();
		await c.getReplicationMetrics({
			sourceRegion: "ap-southeast-1",
			targetRegion: "ap-northeast-1",
			periodDays: 7,
		});
		await c.getRegionHealth();
		await c.createTieringPolicy({ name: "t" } as never);
		await c.listTieringPolicies();
		await c.evaluateTiering(POLICY);
		await c.evaluateTiering(POLICY, { dryRun: true });
		await c.getTieringStats();
		await c.getTieringRecommendations();

		const urls = fetchCalls().map(([u]) => u);
		expect(urls.some((u) => u.includes("/classification/policies?enabled=true"))).toBe(true);
		expect(urls.some((u) => u.includes("/retention/policies?enabled=false"))).toBe(true);
		expect(
			urls.some((u) =>
				u.includes("/replication/configurations?enabled=true&sourceRegion=ap-southeast-1"),
			),
		).toBe(true);
		expect(urls.some((u) => u.includes("periodDays=7"))).toBe(true);
		expect(urls.some((u) => u.includes(`/tiering/policies/${POLICY}/evaluate?dryRun=true`))).toBe(
			true,
		);

		// Tenant-scoped headers are attached where the route requires them.
		const policiesCall = fetchCalls().find(([u]) => u.endsWith(`/documents/${DOC}/policies`));
		expect((policiesCall?.[1]?.headers as Record<string, string>)["x-tenant-id"]).toBe(TENANT);
		// The activation-resolved tenant id overrides the configured one on
		// x-qnsp-tenant-id routes (auto-injection happens after header spread).
		const classifyCall = fetchCalls().find(([u]) => u.endsWith("/classification/objects"));
		expect((classifyCall?.[1]?.headers as Record<string, string>)["x-qnsp-tenant-id"]).toBe(
			ACTIVATION.tenantId,
		);
	});

	it("rejects malformed UUIDs before any network call", async () => {
		const c = client();
		await expect(c.getUploadStatus("not-a-uuid")).rejects.toThrow("Invalid uploadId");
		await expect(c.classifyObject("nope", {} as never)).rejects.toThrow("Invalid objectId");
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("remaining arms", () => {
	it("defaults the base URL and body fields on a minimal initiateUpload", async () => {
		armGateway({
			uploadId: UPLOAD,
			documentId: DOC,
			tenantId: TENANT,
			chunkSizeBytes: 1,
			totalSizeBytes: 1,
			totalParts: 1,
			expiresAt: "2026-08-17T00:00:00.000Z",
			resumeToken: null,
			pqc: { provider: "p", algorithm: "kyber-768", keyId: "k" },
		});
		const c = new StorageClient({ apiKey: "k", tenantId: TENANT });
		const result = await c.initiateUpload({ name: "a.bin", mimeType: "b", sizeBytes: 1 });
		expect(result.pqc.algorithmNist).toBe("ML-KEM-768");
		const call = fetchCalls().find(([u]) => u.endsWith("/storage/v1/documents"));
		expect(call?.[0]).toBe("https://api.qnsi.heossi.com/storage/v1/documents");
		const body = JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;
		expect(body).toMatchObject({ classification: "confidential", metadata: {}, tags: [] });
	});

	it("reports zeroes honestly when a download carries no size headers", async () => {
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			return new Response(null, { status: 200 });
		});
		const c = client();
		const result = await c.downloadStream(DOC, 1);
		expect(result.totalSize).toBe(0);
		expect(result.contentLength).toBe(0);
		expect(result.checksumSha3).toBe("");
	});
});

describe("algorithm naming", () => {
	it("maps internal names to NIST names and passes unknown names through", () => {
		expect(toNistAlgorithmName("kyber-768")).toBe("ML-KEM-768");
		expect(toNistAlgorithmName("proprietary-alg")).toBe("proprietary-alg");
	});
});
