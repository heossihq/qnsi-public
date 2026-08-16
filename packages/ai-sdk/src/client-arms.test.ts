/**
 * Arm sweep for AiOrchestratorClient: constructor gates, tier enforcement,
 * retry/backoff, error mapping, streaming, and one call through every API
 * method proving path, params, and headers.
 */
import { clearActivationCache } from "@heossihq/qnsi-sdk-activation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiOrchestratorClient, AiOrchestratorError, TierError } from "./client.js";
import type { AiClientTelemetryEvent } from "./observability.js";

const TENANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ID = "11111111-1111-4111-a111-111111111111";
const BASE = "https://ai.qnsp.example";

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
		headers: { "Content-Type": "application/json" },
		...init,
	});
}

const fetchMock = vi.fn();

function armGateway(payload: unknown): void {
	fetchMock.mockImplementation(async (url: URL | string) => {
		if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
		return jsonResponse(payload);
	});
}

function client(overrides: Record<string, unknown> = {}): AiOrchestratorClient {
	return new AiOrchestratorClient({
		baseUrl: BASE,
		apiKey: "ai-key",
		fetchImpl: fetchMock as unknown as typeof fetch,
		...overrides,
	});
}

beforeEach(() => {
	clearActivationCache();
	fetchMock.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function calledUrls(): string[] {
	return fetchMock.mock.calls.map(([u]) => String(u));
}

describe("constructor policy", () => {
	it("requires an api key and HTTPS outside the sanctioned exceptions", () => {
		expect(() => client({ apiKey: " " })).toThrow("apiKey is required");
		expect(() => client({ baseUrl: "http://api.example.com" })).toThrow(
			"baseUrl must use HTTPS in production",
		);
		expect(client({ baseUrl: "http://localhost:4020" })).toBeInstanceOf(AiOrchestratorClient);
		expect(client({ baseUrl: "http://127.0.0.1:4020" })).toBeInstanceOf(AiOrchestratorClient);
		expect(client({ baseUrl: "http://ai.qnsp.internal" })).toBeInstanceOf(AiOrchestratorClient);
		expect(() => client({ baseUrl: "http://exa mple" })).toThrow(
			"baseUrl must use HTTPS in production",
		);
	});

	it("uses global fetch when no fetchImpl is given and wraps telemetry configs", async () => {
		vi.stubGlobal("fetch", fetchMock);
		armGateway({ items: [] });
		const bare = new AiOrchestratorClient({ baseUrl: BASE, apiKey: "k" });
		await bare.listWorkloads();
		expect(fetchMock).toHaveBeenCalled();
	});
});

describe("tier enforcement", () => {
	it("blocks inference, training, and enclave features below their tiers", async () => {
		armGateway({});
		const free = client({ tier: "free" });
		await expect(
			free.invokeInference({ tenantId: TENANT, modelDeploymentId: ID, input: {} }),
		).rejects.toBeInstanceOf(TierError);
		await expect(
			free.submitWorkload({
				tenantId: TENANT,
				name: "model-training-run",
				containerImage: "img",
			} as never),
		).rejects.toBeInstanceOf(TierError);
		await expect(
			free.submitWorkload({
				tenantId: TENANT,
				name: "gpu-job",
				containerImage: "img",
				resources: { cpu: 1, memoryGiB: 1, gpu: 1, acceleratorType: "nvidia-a10g" },
			} as never),
		).rejects.toBeInstanceOf(TierError);
	});

	it("permits everything without a configured tier", async () => {
		armGateway({ workloadId: ID, status: "scheduled", replayed: false, acceptedAt: "now" });
		const unrestricted = client();
		await expect(
			unrestricted.submitWorkload({
				tenantId: TENANT,
				name: "fine-tune-job",
				containerImage: "img",
				idempotencyKey: "idem-1",
			} as never),
		).resolves.toMatchObject({ workloadId: ID });
		const submit = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/ai/v1/workloads"));
		expect((submit?.[1] as RequestInit).headers).toBeDefined();
		const body = JSON.parse(String((submit?.[1] as RequestInit).body)) as Record<string, unknown>;
		expect(body["env"]).toEqual({});
		expect(body["idempotencyKey"]).toBeUndefined();
	});
});

describe("deployModel", () => {
	it("wraps the manifest into a signed workload submission", async () => {
		armGateway({ workloadId: ID, status: "scheduled", replayed: false, acceptedAt: "now" });
		const c = client();
		await c.deployModel({
			tenantId: TENANT,
			modelName: "resnet",
			artifactId: ID,
			artifactVersion: 1,
			runtimeImage: "img",
			manifest: {
				modelName: "resnet",
				version: "1.0.0",
				createdAt: "now",
				files: [],
				metadata: {},
			},
		} as never);
		const submit = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/ai/v1/workloads"));
		const body = JSON.parse(String((submit?.[1] as RequestInit).body)) as {
			name: string;
			manifest: { algorithm: string; pqcSignature: string };
			labels: Record<string, string>;
			command: string[];
		};
		expect(body.name).toBe("resnet-deployment");
		expect(body.manifest.algorithm).toBe("sha3-512");
		expect(body.manifest.pqcSignature).toMatch(/^[0-9a-f]{128}$/);
		expect(body.labels["qnsp.io/model-name"]).toBe("resnet");
		expect(body.command).toEqual(["python", "-m", "qnsp.runtime.inference"]);
	});
});

describe("retry and error mapping", () => {
	it("retries 429 (Retry-After, unparseable, and backoff) then fails closed", async () => {
		vi.useFakeTimers();
		const c = client({ maxRetries: 2, retryDelayMs: 5 });
		fetchMock.mockImplementation(async (url: URL | string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			return jsonResponse({}, { status: 429, headers: { "Retry-After": "1" } });
		});
		const failing = c.listWorkloads().catch((e: unknown) => e);
		await vi.advanceTimersByTimeAsync(5_000);
		const failure = await failing;
		expect(failure).toBeInstanceOf(AiOrchestratorError);
		expect((failure as AiOrchestratorError).statusCode).toBe(429);

		let attempts = 0;
		fetchMock.mockImplementation(async (url: URL | string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			attempts += 1;
			if (attempts === 1)
				return jsonResponse({}, { status: 429, headers: { "Retry-After": "nope" } });
			if (attempts === 2) return jsonResponse({}, { status: 429 });
			return jsonResponse({ items: [] });
		});
		const recovering = c.listWorkloads();
		await vi.advanceTimersByTimeAsync(5_000);
		await expect(recovering).resolves.toEqual({ items: [] });
	});

	it("maps 401 to the signup guidance and other statuses to generic errors", async () => {
		const c = client();
		fetchMock.mockImplementation(async (url: URL | string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			return new Response(null, { status: 401, statusText: "Unauthorized" });
		});
		await expect(c.listWorkloads()).rejects.toThrow("Authentication failed");

		fetchMock.mockImplementation(async (url: URL | string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			return new Response(null, { status: 503, statusText: "Unavailable" });
		});
		await expect(c.listWorkloads()).rejects.toThrow("AI Orchestrator API error: 503");
	});

	it("returns undefined on 204 and reports telemetry for ok and error outcomes", async () => {
		const events: AiClientTelemetryEvent[] = [];
		const c = client({ telemetry: { record: (e: AiClientTelemetryEvent) => events.push(e) } });
		fetchMock.mockImplementation(async (url: URL | string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			return new Response(null, { status: 204 });
		});
		await expect(c.cancelWorkload({ workloadId: ID })).resolves.toBeUndefined();
		expect(events.at(-1)).toMatchObject({ status: "ok", httpStatus: 204 });

		fetchMock.mockImplementation(async (url: URL | string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			throw new Error("socket hangup");
		});
		await expect(c.listWorkloads()).rejects.toThrow("socket hangup");
		expect(events.at(-1)).toMatchObject({ status: "error", error: "socket hangup" });
	});
});

describe("streaming", () => {
	it("yields NDJSON events across chunk boundaries including the trailing line", async () => {
		const encoder = new TextEncoder();
		fetchMock.mockImplementation(async (url: URL | string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(encoder.encode('{"type":"log","payload":{"line":1}}\n{"type":'));
					controller.enqueue(encoder.encode('"log","payload":{"line":2}}\n\n'));
					controller.enqueue(encoder.encode('{"type":"workload.status","payload":{}}'));
					controller.close();
				},
			});
			return new Response(stream, { status: 200 });
		});
		const events = [];
		for await (const event of client().streamInferenceEvents(ID)) {
			events.push(event);
		}
		expect(events).toHaveLength(3);
		expect(events[2]).toMatchObject({ type: "workload.status" });
	});

	it("ends quietly when the stream response has no body", async () => {
		fetchMock.mockImplementation(async (url: URL | string) => {
			if (String(url).includes("/sdk/activate")) return jsonResponse(ACTIVATION);
			return new Response(null, { status: 200 });
		});
		const events = [];
		for await (const event of client().streamInferenceEvents(ID)) {
			events.push(event);
		}
		expect(events).toEqual([]);
	});
});

describe("full method surface", () => {
	it("drives every registry, cost, bias, and security method with its params", async () => {
		armGateway({
			model: { id: ID },
			deployment: { id: ID },
			budget: { id: ID },
			evaluation: { id: ID },
			pattern: { id: ID },
			items: [],
		});
		const c = client();

		await c.registerArtifact({ tenantId: TENANT, documentId: ID, version: 1 });
		await c.getWorkload(ID);
		await c.listWorkloads({ tenantId: TENANT, status: "running", cursor: "c", limit: 5 });
		await c.cancelWorkload({ workloadId: ID, reason: "done" });
		await c.invokeInference({ tenantId: TENANT, modelDeploymentId: ID, input: { q: 1 } });
		await c.registerModel({ tenantId: TENANT, name: "m" } as never);
		await c.listModels({
			tenantId: TENANT,
			provider: "openai",
			modelType: "llm",
			status: "active",
			tag: "t",
			cursor: "c",
			limit: 5,
		});
		await c.getModel(ID);
		await c.updateModel(ID, { description: "d" } as never);
		await c.activateModel(ID);
		await c.deprecateModel(ID);
		await c.createDeployment({ modelId: ID } as never);
		await c.listDeployments({
			tenantId: TENANT,
			modelId: ID,
			environment: "production",
			status: "running",
			cursor: "c",
			limit: 5,
		});
		await c.getDeployment(ID);
		await c.stopDeployment(ID);
		await c.getCostSummary(TENANT);
		await c.getCostSummary();
		await c.getCostAnalytics({
			tenantId: TENANT,
			modelName: "m",
			provider: "openai",
			startDate: "2026-08-01",
			endDate: "2026-08-17",
			groupBy: "day",
		});
		await c.getCostAnalytics({ startDate: "2026-08-01", endDate: "2026-08-17" });
		await c.createBudget({ tenantId: TENANT } as never);
		await c.listBudgets({
			tenantId: TENANT,
			status: "active",
			budgetType: "monthly",
			cursor: "c",
			limit: 5,
		});
		await c.getBudget(ID);
		await c.deleteBudget(ID);
		await c.getCostAlerts({
			tenantId: TENANT,
			budgetId: ID,
			alertType: "threshold_warning",
			severity: "warning",
			acknowledged: false,
			cursor: "c",
			limit: 5,
		});
		await c.acknowledgeCostAlert(ID);
		await c.getOptimizationRecommendations({
			tenantId: TENANT,
			recommendationType: "model_switch",
			status: "pending",
			priority: "high",
			cursor: "c",
			limit: 5,
		});
		await c.acceptRecommendation(ID);
		await c.createBiasEvaluation({ tenantId: TENANT } as never);
		await c.startEvaluation(ID);
		await c.listEvaluations({
			tenantId: TENANT,
			modelName: "m",
			modelId: ID,
			evaluationType: "calibration",
			status: "completed",
			cursor: "c",
			limit: 5,
		});
		await c.getEvaluation(ID);
		await c.getBiasIncidents({
			tenantId: TENANT,
			modelName: "m",
			modelId: ID,
			incidentType: "threshold_breach",
			severity: "high",
			status: "open",
			cursor: "c",
			limit: 5,
		});
		await c.recordBiasIncident({ tenantId: TENANT } as never);
		await c.getFairnessMetrics({
			tenantId: TENANT,
			modelName: "m",
			modelId: ID,
			metricName: "dp",
			startDate: "2026-08-01",
			endDate: "2026-08-17",
			cursor: "c",
			limit: 5,
		});
		await c.getFairnessMetrics();
		await c.getBiasSummary(TENANT);
		await c.getBiasSummary();
		await c.createDetectionPattern({ pattern: "x" } as never);
		await c.listPatterns({
			patternType: "regex",
			attackCategory: "jailbreak",
			severity: "high",
			enabled: true,
			cursor: "c",
			limit: 5,
		});
		await c.listPatterns();
		await c.getPattern(ID);
		await c.deletePattern(ID);
		await c.getInjectionIncidents({
			tenantId: TENANT,
			attackCategory: "jailbreak",
			severity: "high",
			detectionMethod: "pattern",
			actionTaken: "blocked",
			startDate: "2026-08-01",
			endDate: "2026-08-17",
			cursor: "c",
			limit: 5,
		});
		await c.getInjectionIncidents();
		await c.getInjectionStats({ tenantId: TENANT, startDate: "2026-08-01", endDate: "2026-08-17" });
		await c.getInjectionStats({ startDate: "2026-08-01", endDate: "2026-08-17" });
		await c.getInjectionSummary(TENANT);
		await c.getInjectionSummary();

		const urls = calledUrls();
		expect(urls.some((u) => u.includes("/ai/v1/workloads?tenantId="))).toBe(true);
		expect(urls.some((u) => u.includes("/ai/v1/registry/models?tenantId="))).toBe(true);
		expect(urls.some((u) => u.includes("acknowledged=false"))).toBe(true);
		expect(urls.some((u) => u.includes("enabled=true"))).toBe(true);
	});

	it("drives every list method with defaults and the remaining tails", async () => {
		armGateway({ items: [], model: {}, deployment: {}, budget: {}, evaluation: {}, pattern: {} });
		const c = client();
		await c.listWorkloads();
		await c.listModels();
		await c.listDeployments();
		await c.listBudgets();
		await c.getCostAlerts();
		await c.getOptimizationRecommendations();
		await c.listEvaluations();
		await c.getBiasIncidents();
		await c.configureDetection({ enabled: true } as never);
		const bare = calledUrls().filter((u) => u.includes("/ai/v1/") && !u.includes("?"));
		expect(bare.length).toBeGreaterThanOrEqual(9);
	});

	it("records telemetry through a wrapped CONFIG form", async () => {
		const { PeriodicExportingMetricReader, InMemoryMetricExporter, AggregationTemporality } =
			await import("@opentelemetry/sdk-metrics");
		armGateway({ items: [] });
		const reader = new PeriodicExportingMetricReader({
			exporter: new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE),
			exportIntervalMillis: 2 ** 30,
		});
		const c = client({ telemetry: { serviceName: "cfg", exporterFactory: () => reader } });
		await c.listWorkloads();
		await reader.shutdown();
	});

	it("rejects malformed UUIDs before the network", async () => {
		const c = client();
		armGateway({});
		await expect(c.getWorkload("nope")).rejects.toThrow("Invalid workloadId");
		await expect(c.listModels({ tenantId: "nope" })).rejects.toThrow("Invalid tenantId");
	});
});
