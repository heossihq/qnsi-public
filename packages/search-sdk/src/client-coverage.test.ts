import { randomBytes } from "node:crypto";
import { clearActivationCache } from "@heossihq/qnsi-sdk-activation";
import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	InvalidSynonymCursorError,
	InvalidSynonymImportError,
	SearchClient,
	SearchTenantMismatchError,
	UnsupportedSynonymFormatError,
} from "./client.js";
import { createSearchClientTelemetry, isSearchClientTelemetry } from "./observability.js";
import {
	analyzeTokenFrequency,
	batchDeriveDocumentSseTokens,
	createOptimizedSseTokens,
	optimizeSseTokens,
	precomputeCommonTokens,
	SseTokenCache,
} from "./optimization.js";
import {
	checkSseAccess,
	createSseToken,
	deriveDocumentSseTokens,
	deriveQuerySseTokens,
	validateSseTokensRequired,
} from "./sse.js";
import { validateUUID } from "./validation.js";

const TENANT = "a1b2c3d4-e5f6-4789-8abc-def012345678";
const ID = "b1b2c3d4-e5f6-4789-8abc-def012345678";
const SSE_KEY = randomBytes(32);

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

type QueuedResponse = { body: unknown; status?: number; headers?: Record<string, string> };

function makeFetchQueue(): {
	fetchImpl: typeof fetch;
	queue: (r: QueuedResponse) => void;
	calls: Array<{ url: string; init: RequestInit }>;
} {
	const responses: QueuedResponse[] = [];
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const fetchImpl = (async (url: unknown, init?: unknown) => {
		calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
		const next = responses.shift();
		if (!next) throw new Error(`fetch queue empty for ${String(url)}`);
		return new Response(JSON.stringify(next.body), {
			status: next.status ?? 200,
			headers: { "content-type": "application/json", ...(next.headers ?? {}) },
		});
	}) as typeof fetch;
	return { fetchImpl, queue: (r) => responses.push(r), calls };
}

const DOC = {
	tenantId: TENANT,
	documentId: ID,
	version: "1",
	sourceService: "docs",
	title: "Quantum Key Rotation",
	description: "How to rotate keys",
	body: "Rotate quantum keys regularly for post quantum safety",
	tags: ["kms", "rotation"],
	metadata: { lang: "en" },
	security: {
		controlPlaneTokenSha256: null,
		pqcSignatures: [],
		hardwareProvider: null,
		attestationStatus: null,
		attestationProof: null,
	},
};

const BACKEND_SYNONYM_INPUT = {
	name: "Documents",
	description: "Document terminology",
	synonymType: "equivalent" as const,
	language: "en",
	terms: ["document", "report"],
	primaryTerm: null,
	enabled: true,
	weight: 1,
	indexIds: [],
	metadata: { source: "contract-test" },
};

const BACKEND_SYNONYM_GROUP = {
	id: ID,
	tenantId: TENANT,
	...BACKEND_SYNONYM_INPUT,
	createdAt: "2026-08-16T00:00:00.000Z",
	updatedAt: "2026-08-16T00:00:00.000Z",
};

const PUBLIC_SYNONYM_GROUP = {
	id: ID,
	tenantId: TENANT,
	name: "Documents",
	description: "Document terminology",
	synonyms: ["document", "report"],
	isExpanded: true,
	language: "en",
	createdAt: "2026-08-16T00:00:00.000Z",
	updatedAt: "2026-08-16T00:00:00.000Z",
};

const BACKEND_HEALTH_SNAPSHOT = {
	id: ID,
	tenantId: TENANT,
	indexId: ID,
	indexName: "documents-primary",
	healthStatus: "unknown" as const,
	actualHealthStatus: "unknown" as const,
	reportedAssessment: "healthy" as const,
	verificationStatus: "unverified" as const,
	measurementSource: "client_reported" as const,
	totalDocuments: 10,
	totalDocumentsExact: "10",
	totalSizeBytes: 100,
	totalSizeBytesExact: "100",
	indexSizeBytes: 80,
	indexSizeBytesExact: "80",
	fragmentationPercent: 0,
	avgDocumentSizeBytes: 10,
	lastIndexedAt: null,
	lastOptimizedAt: null,
	searchLatencyP50Ms: 0,
	searchLatencyP95Ms: 0,
	searchLatencyP99Ms: 0,
	indexLatencyP50Ms: 0,
	indexLatencyP95Ms: 0,
	errorRate: 0,
	metadata: {},
	collectedAt: "2026-08-16T00:00:00.000Z",
};

const BACKEND_HEALTH_ALERT = {
	id: ID,
	tenantId: TENANT,
	indexId: ID,
	indexName: "documents-primary",
	alertType: "custom" as const,
	severity: "medium" as const,
	status: "active" as const,
	message: "Client-reported condition",
	thresholdValue: 0,
	currentValue: 0,
	metadata: {},
	reportingSource: "client_reported" as const,
	verificationStatus: "unverified" as const,
	triggeredAt: "2026-08-16T00:00:00.000Z",
	acknowledgedAt: null,
	acknowledgedBy: null,
	acknowledgedNotes: null,
	resolvedAt: null,
	resolvedBy: null,
	resolutionNotes: null,
};

const BACKEND_CURRENT_HEALTH = {
	tenantId: TENANT,
	overallStatus: "unknown" as const,
	actualHealthStatus: "unknown" as const,
	verificationStatus: "unverified" as const,
	summary: {
		totalIndices: 1,
		actualHealthStatus: "unknown" as const,
		reportedAssessmentCounts: { healthy: 1, degraded: 0, unhealthy: 0 },
		activeReportedAlerts: 1,
	},
	indices: [BACKEND_HEALTH_SNAPSHOT],
	alerts: [BACKEND_HEALTH_ALERT],
};

const BACKEND_MAINTENANCE_WINDOW = {
	id: ID,
	tenantId: TENANT,
	indexId: ID,
	indexName: "documents-primary",
	maintenanceType: "optimize" as const,
	scheduledAt: "2026-08-16T01:00:00.000Z",
	estimatedDurationMinutes: 30,
	scheduleStatus: "scheduled" as const,
	executionStatus: "unavailable" as const,
	executionStatusReason: "No maintenance executor is configured",
	recordedStartedAt: null,
	recordedCompletedAt: null,
	metadata: {},
	createdBy: "service:cloud",
	cancelledAt: null,
	cancelledBy: null,
	createdAt: "2026-08-16T00:00:00.000Z",
	observedAt: "2026-08-16T00:00:00.000Z",
};

beforeEach(() => {
	clearActivationCache();
});

function makeClient(overrides: Record<string, unknown> = {}) {
	const q = makeFetchQueue();
	const client = new SearchClient({
		baseUrl: "https://search.example.com",
		apiKey: "test-key",
		retryDelayMs: 1,
		fetchImpl: q.fetchImpl as never,
		sseKey: SSE_KEY,
		...overrides,
	});
	return { client, ...q };
}

describe("constructor guards", () => {
	it("covers apiKey, http rules, bad urls, defaults", () => {
		expect(() => new SearchClient({ apiKey: " " })).toThrow(/apiKey is required/);
		expect(
			() => new SearchClient({ apiKey: "k", baseUrl: "http://search.qnsp-prod.internal:8087" }),
		).not.toThrow();
		expect(() => new SearchClient({ apiKey: "k", baseUrl: "http://[bad" })).toThrow(
			/HTTPS in production/,
		);
		expect(() => new SearchClient({ apiKey: "k", baseUrl: "https://bad host" })).not.toThrow();
		expect(() => new SearchClient({ apiKey: "k" })).not.toThrow();
	});
});

describe("every client method, ok and error paths", () => {
	// [name, invoke, expected route fragment, ok response body]
	const CASES: Array<[string, (c: SearchClient) => Promise<unknown>, string, unknown]> = [
		[
			"indexDocument",
			(c) => c.indexDocument(DOC as never),
			"/search/v1/documents/index",
			{ ok: true },
		],
		[
			"search",
			(c) =>
				c.search({ tenantId: TENANT, query: "quantum", limit: 5, cursor: "c", language: "en" }),
			"/search/v1/documents",
			{ items: [] },
		],
		[
			"recordQuery",
			(c) => c.recordQuery({ tenantId: TENANT, query: "q" } as never),
			"/search/v1/",
			{ ok: true },
		],
		[
			"getQueryMetrics",
			(c) => c.getQueryMetrics({ tenantId: TENANT } as never),
			"/search/v1/",
			{ total: 0 },
		],
		[
			"getSearchQuality",
			(c) => c.getSearchQuality({ tenantId: TENANT } as never),
			"/search/v1/",
			{ score: 1 },
		],
		[
			"getTopQueries",
			(c) => c.getTopQueries({ tenantId: TENANT } as never),
			"/search/v1/",
			{ items: [] },
		],
		[
			"createSynonymGroup",
			(c) =>
				c.createSynonymGroup({
					tenantId: TENANT,
					name: "Documents",
					synonyms: ["document", "report"],
				}),
			"/search/v1/synonyms",
			BACKEND_SYNONYM_GROUP,
		],
		[
			"listSynonymGroups",
			(c) => c.listSynonymGroups({ tenantId: TENANT }),
			"/search/v1/synonyms",
			{ groups: [], pagination: { limit: 100, offset: 0, total: 0 } },
		],
		[
			"updateSynonymGroup",
			(c) => c.updateSynonymGroup(ID, { synonyms: ["document", "report"] }),
			`/search/v1/synonyms/${ID}`,
			BACKEND_SYNONYM_GROUP,
		],
		[
			"deleteSynonymGroup",
			(c) => c.deleteSynonymGroup(ID),
			`/search/v1/synonyms/${ID}`,
			{ ok: true },
		],
		[
			"expandTerm",
			(c) => c.expandTerm({ tenantId: TENANT, term: "document" }),
			"/search/v1/synonyms/expand",
			{ inputTerm: "document", expansions: [] },
		],
		[
			"importSynonyms",
			(c) =>
				c.importSynonyms({
					tenantId: TENANT,
					format: "json",
					data: JSON.stringify([BACKEND_SYNONYM_INPUT]),
				}),
			"/search/v1/synonyms/import",
			{ imported: 1, failed: 0 },
		],
		[
			"exportSynonyms",
			(c) => c.exportSynonyms({ tenantId: TENANT, format: "json" }),
			"/search/v1/synonyms/export",
			{ count: 0, groups: [] },
		],
		[
			"recordHealthSnapshot",
			(c) =>
				c.recordHealthSnapshot({
					tenantId: TENANT,
					indexId: ID,
					indexName: "documents-primary",
					totalDocuments: 10,
					totalSizeBytes: 100,
					indexSizeBytes: 80,
					fragmentationPercent: 0,
				}),
			"/search/v2/health/snapshots",
			BACKEND_HEALTH_SNAPSHOT,
		],
		[
			"getIndexHealth",
			(c) => c.getIndexHealth({ tenantId: TENANT }),
			"/search/v2/health/current",
			BACKEND_CURRENT_HEALTH,
		],
		[
			"listHealthAlerts",
			(c) => c.listHealthAlerts({ tenantId: TENANT }),
			"/search/v2/health/alerts",
			{ alerts: [], count: 0, nextCursor: null },
		],
		[
			"acknowledgeAlert",
			(c) => c.acknowledgeAlert({ alertId: ID, tenantId: TENANT }),
			`/search/v2/health/alerts/${ID}/acknowledge`,
			BACKEND_HEALTH_ALERT,
		],
		[
			"createMaintenanceWindow",
			(c) =>
				c.createMaintenanceWindow({
					tenantId: TENANT,
					indexId: ID,
					indexName: "documents-primary",
					maintenanceType: "optimize",
					scheduledAt: "2026-08-16T01:00:00Z",
				}),
			"/search/v2/health/maintenance",
			BACKEND_MAINTENANCE_WINDOW,
		],
		[
			"createIsolationPolicy",
			(c) => c.createIsolationPolicy({ tenantId: TENANT, name: "p" } as never),
			"/search/v1/isolation/policies",
			{ id: ID },
		],
		[
			"listIsolationPolicies",
			(c) => c.listIsolationPolicies({ tenantId: TENANT } as never),
			"/search/v1/isolation/policies",
			{ items: [] },
		],
		[
			"reportViolation",
			(c) => c.reportViolation({ tenantId: TENANT, policyId: ID, description: "d" } as never),
			"/search/v1/isolation/violations",
			{ id: ID },
		],
		[
			"runIsolationVerification",
			(c) => c.runIsolationVerification({ tenantId: TENANT } as never),
			"/search/v1/isolation/verify",
			{ runId: ID },
		],
	];

	it.each(CASES)("%s succeeds and hits its route", async (_name, invoke, route, body) => {
		clearActivationCache();
		const { client, queue, calls } = makeClient({
			telemetry: { record: () => {} },
		});
		queue({ body: ACTIVATION });
		queue({ body });
		await invoke(client);
		expect(calls[calls.length - 1]?.url).toContain(route);
	});

	it.each(CASES)("%s surfaces non-OK errors", async (_name, invoke) => {
		clearActivationCache();
		const { client, queue } = makeClient();
		queue({ body: ACTIVATION });
		queue({ body: { message: "boom" }, status: 500 });
		await expect(invoke(client)).rejects.toThrow(/Search API error: 500/);
	});

	it.each(CASES)("%s times out via its own abort timer", async (_name, invoke) => {
		clearActivationCache();
		const responses: QueuedResponse[] = [];
		const hangingFetch = (async (_url: unknown, init?: RequestInit) => {
			const next = responses.shift();
			if (next) {
				return new Response(JSON.stringify(next.body), {
					status: next.status ?? 200,
					headers: { "content-type": "application/json" },
				});
			}
			return new Promise((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => {
					reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
				});
			});
		}) as typeof fetch;
		responses.push({ body: ACTIVATION });
		const client = new SearchClient({
			baseUrl: "https://search.example.com",
			apiKey: "k",
			timeoutMs: 5,
			retryDelayMs: 1,
			fetchImpl: hangingFetch as never,
			sseKey: SSE_KEY,
		});
		await expect(invoke(client)).rejects.toThrow(/aborted/);
	});

	it.each(CASES)("%s records telemetry when the transport itself fails", async (_name, invoke) => {
		// Queue only the activation: the method fetch throws, so httpStatus is
		// never set and the error telemetry path without a status runs.
		clearActivationCache();
		const events: unknown[] = [];
		const { client, queue } = makeClient({ telemetry: { record: (e: unknown) => events.push(e) } });
		queue({ body: ACTIVATION });
		await expect(invoke(client)).rejects.toThrow(/fetch queue empty/);
		expect(events[events.length - 1]).toMatchObject({ status: "error" });
	});
});

describe("index telemetry response contracts", () => {
	it("accepts coherent unsafe integer projections and rejects contradictory projections", async () => {
		const { client, queue } = makeClient();
		queue({ body: ACTIVATION });
		queue({
			body: {
				...BACKEND_CURRENT_HEALTH,
				indices: [
					{
						...BACKEND_HEALTH_SNAPSHOT,
						totalDocuments: null,
						totalDocumentsExact: "9007199254740993",
					},
				],
			},
		});
		await expect(client.getIndexHealth({ tenantId: TENANT })).resolves.toMatchObject({
			indices: [{ totalDocuments: null, totalDocumentsExact: "9007199254740993" }],
		});

		for (const contradictorySnapshot of [
			{ ...BACKEND_HEALTH_SNAPSHOT, totalDocuments: 9, totalDocumentsExact: "10" },
			{
				...BACKEND_HEALTH_SNAPSHOT,
				totalDocuments: 9_007_199_254_740_991,
				totalDocumentsExact: "9007199254740993",
			},
			{ ...BACKEND_HEALTH_SNAPSHOT, totalDocuments: null, totalDocumentsExact: "10" },
		]) {
			queue({
				body: { ...BACKEND_CURRENT_HEALTH, indices: [contradictorySnapshot] },
			});
			await expect(client.getIndexHealth({ tenantId: TENANT })).rejects.toThrow(
				/totalDocuments must be the safe projection/,
			);
		}
	});

	it("passes through opaque alert cursors and rejects inconsistent page counts", async () => {
		const { client, queue, calls } = makeClient();
		queue({ body: ACTIVATION });
		queue({
			body: { alerts: [BACKEND_HEALTH_ALERT], count: 1, nextCursor: "opaque-next" },
		});
		await expect(
			client.listHealthAlerts({ tenantId: TENANT, cursor: "opaque-current" }),
		).resolves.toEqual({ items: [BACKEND_HEALTH_ALERT], nextCursor: "opaque-next" });
		expect(calls.at(-1)?.url).toContain("cursor=opaque-current");

		queue({ body: { alerts: [BACKEND_HEALTH_ALERT], count: 0, nextCursor: null } });
		await expect(client.listHealthAlerts({ tenantId: TENANT })).rejects.toThrow(
			/count must equal the number of returned alerts/,
		);
	});
});

describe("synonym management wire contract", () => {
	it("maps create, list, update, and delete to the mounted CRUD contract", async () => {
		const { client, queue, calls } = makeClient();
		queue({ body: ACTIVATION });
		queue({ body: BACKEND_SYNONYM_GROUP });
		queue({
			body: {
				groups: [BACKEND_SYNONYM_GROUP],
				pagination: { limit: 2, offset: 4, total: 7 },
			},
		});
		queue({
			body: {
				...BACKEND_SYNONYM_GROUP,
				terms: ["document", "file"],
				enabled: false,
				updated: true,
			},
		});
		queue({ body: null });

		await expect(
			client.createSynonymGroup({
				tenantId: TENANT,
				name: "Documents",
				description: "Document terminology",
				synonyms: ["document", "report"],
				isExpanded: true,
				language: "en",
			}),
		).resolves.toEqual(PUBLIC_SYNONYM_GROUP);
		const createCall = calls[1];
		expect(createCall?.url).toBe(
			`https://search.example.com/search/v1/synonyms?tenantId=${TENANT}`,
		);
		expect(createCall?.init.method).toBe("POST");
		expect(createCall?.init.headers).toMatchObject({
			"Content-Type": "application/json",
			"x-qnsp-tenant-id": TENANT,
		});
		expect(JSON.parse(String(createCall?.init.body))).toEqual({
			name: "Documents",
			description: "Document terminology",
			terms: ["document", "report"],
			enabled: true,
			language: "en",
		});

		await expect(
			client.listSynonymGroups({ tenantId: TENANT, language: "en", limit: 2, cursor: "4" }),
		).resolves.toEqual({ items: [PUBLIC_SYNONYM_GROUP], nextCursor: "6" });
		const listCall = calls[2];
		expect(listCall?.url).toBe(
			`https://search.example.com/search/v1/synonyms?tenantId=${TENANT}&language=en&limit=2&offset=4`,
		);
		expect(listCall?.init.method).toBe("GET");

		await expect(
			client.updateSynonymGroup(ID, {
				name: "Documents",
				description: "Document terminology",
				synonyms: ["document", "file"],
				isExpanded: false,
				language: "en",
			}),
		).resolves.toEqual({
			...PUBLIC_SYNONYM_GROUP,
			synonyms: ["document", "file"],
			isExpanded: false,
		});
		const updateCall = calls[3];
		expect(updateCall?.url).toBe(`https://search.example.com/search/v1/synonyms/${ID}`);
		expect(updateCall?.init.method).toBe("PATCH");
		expect(JSON.parse(String(updateCall?.init.body))).toEqual({
			name: "Documents",
			description: "Document terminology",
			terms: ["document", "file"],
			enabled: false,
			language: "en",
		});

		await expect(client.deleteSynonymGroup(ID)).resolves.toBeUndefined();
		const deleteCall = calls[4];
		expect(deleteCall?.url).toBe(`https://search.example.com/search/v1/synonyms/${ID}`);
		expect(deleteCall?.init.method).toBe("DELETE");
		expect(deleteCall?.init.body).toBeUndefined();
	});

	it("maps absent descriptions and omits unchanged synonym fields", async () => {
		const { client, queue, calls } = makeClient();
		queue({ body: ACTIVATION });
		queue({
			body: {
				groups: [{ ...BACKEND_SYNONYM_GROUP, description: null }],
				pagination: { limit: 50, offset: 0, total: 1 },
			},
		});
		queue({ body: { ...BACKEND_SYNONYM_GROUP, description: null } });

		const listed = await client.listSynonymGroups({ tenantId: TENANT });
		expect(listed.items).toHaveLength(1);
		expect(listed.items[0]).not.toHaveProperty("description");
		await client.updateSynonymGroup(ID, { name: "Renamed" });

		expect(JSON.parse(String(calls[2]?.init.body))).toEqual({ name: "Renamed" });
	});

	it("fails closed when activation does not resolve a tenant", async () => {
		const { client, calls } = makeClient();
		const state = client as unknown as {
			activationPromise: Promise<void>;
			resolvedTenantId: string | null;
		};
		state.activationPromise = Promise.resolve();
		state.resolvedTenantId = null;

		await expect(client.listHealthAlerts()).rejects.toThrow(
			"SDK activation did not return a tenantId",
		);
		expect(calls).toHaveLength(0);
	});

	it("posts expansion JSON and maps terms plus distinct matched group IDs", async () => {
		const secondGroupId = "c1b2c3d4-e5f6-4789-8abc-def012345678";
		const { client, queue, calls } = makeClient();
		queue({ body: ACTIVATION });
		queue({
			body: {
				inputTerm: "report",
				language: "en",
				expansions: [
					{
						term: "document",
						groupId: ID,
						groupName: "Documents",
						synonymType: "equivalent",
						weight: 1,
					},
					{
						term: "file",
						groupId: ID,
						groupName: "Documents",
						synonymType: "equivalent",
						weight: 1,
					},
					{
						term: "paper",
						groupId: secondGroupId,
						groupName: "Papers",
						synonymType: "equivalent",
						weight: 1,
					},
				],
				totalExpansions: 3,
				matchedGroups: 2,
			},
		});

		await expect(
			client.expandTerm({ tenantId: TENANT, term: "report", language: "en" }),
		).resolves.toEqual({
			originalTerm: "report",
			expandedTerms: ["document", "file", "paper"],
			matchedGroups: [ID, secondGroupId],
		});
		const call = calls[1];
		expect(call?.url).toBe(
			`https://search.example.com/search/v1/synonyms/expand?tenantId=${TENANT}`,
		);
		expect(call?.init.method).toBe("POST");
		expect(JSON.parse(String(call?.init.body))).toEqual({ term: "report", language: "en" });
	});

	it("validates JSON import and maps mounted import and export contracts", async () => {
		const { client, queue, calls } = makeClient();
		queue({ body: ACTIVATION });
		queue({ body: { imported: 1, failed: 0 } });
		queue({ body: { count: 1, groups: [BACKEND_SYNONYM_INPUT] } });

		await expect(
			client.importSynonyms({
				tenantId: TENANT,
				format: "json",
				data: JSON.stringify([BACKEND_SYNONYM_INPUT]),
				replaceExisting: true,
				language: "en",
			}),
		).resolves.toEqual({ imported: 1, skipped: 0, errors: [] });
		const importCall = calls[1];
		expect(importCall?.url).toBe(
			`https://search.example.com/search/v1/synonyms/import?tenantId=${TENANT}`,
		);
		expect(importCall?.init.method).toBe("POST");
		expect(JSON.parse(String(importCall?.init.body))).toEqual({
			groups: [BACKEND_SYNONYM_INPUT],
			replaceExisting: true,
			language: "en",
		});

		await expect(
			client.exportSynonyms({ tenantId: TENANT, format: "json", language: "en" }),
		).resolves.toEqual({
			data: JSON.stringify([BACKEND_SYNONYM_INPUT]),
			count: 1,
			format: "json",
		});
		const exportCall = calls[2];
		expect(exportCall?.url).toBe(
			`https://search.example.com/search/v1/synonyms/export?tenantId=${TENANT}&language=en`,
		);
		expect(exportCall?.url).not.toContain("format=");
		expect(exportCall?.init.method).toBe("GET");
	});

	it.each([
		[
			"create",
			(client: SearchClient, tenantId: string) =>
				client.createSynonymGroup({
					tenantId,
					name: "Documents",
					synonyms: ["document", "report"],
				}),
		],
		["list", (client: SearchClient, tenantId: string) => client.listSynonymGroups({ tenantId })],
		[
			"expand",
			(client: SearchClient, tenantId: string) => client.expandTerm({ tenantId, term: "report" }),
		],
		[
			"import",
			(client: SearchClient, tenantId: string) =>
				client.importSynonyms({
					tenantId,
					format: "json",
					data: JSON.stringify([BACKEND_SYNONYM_INPUT]),
				}),
		],
		[
			"export",
			(client: SearchClient, tenantId: string) =>
				client.exportSynonyms({ tenantId, format: "json" }),
		],
	] as const)(
		"rejects a tenant mismatch before the %s operation request",
		async (_name, invoke) => {
			clearActivationCache();
			const { client, queue, calls } = makeClient();
			queue({ body: ACTIVATION });
			await expect(invoke(client, "d1b2c3d4-e5f6-4789-8abc-def012345678")).rejects.toBeInstanceOf(
				SearchTenantMismatchError,
			);
			expect(calls).toHaveLength(1);
		},
	);

	it("rejects mismatched required and optional tenants outside synonym operations", async () => {
		const mismatch = "d1b2c3d4-e5f6-4789-8abc-def012345678";

		const indexed = makeClient();
		indexed.queue({ body: ACTIVATION });
		await expect(
			indexed.client.indexDocument({ ...DOC, tenantId: mismatch } as never),
		).rejects.toBeInstanceOf(SearchTenantMismatchError);
		expect(indexed.calls).toHaveLength(1);

		clearActivationCache();
		const metrics = makeClient();
		metrics.queue({ body: ACTIVATION });
		await expect(metrics.client.getQueryMetrics({ tenantId: mismatch })).rejects.toBeInstanceOf(
			SearchTenantMismatchError,
		);
		expect(metrics.calls).toHaveLength(1);
	});

	it("validates all batch tenants before sending an index operation", async () => {
		const mismatch = "d1b2c3d4-e5f6-4789-8abc-def012345678";
		const { client, queue, calls } = makeClient();
		queue({ body: ACTIVATION });
		await expect(
			client.batchIndexDocuments([DOC as never, { ...DOC, tenantId: mismatch } as never]),
		).rejects.toBeInstanceOf(SearchTenantMismatchError);
		expect(calls).toHaveLength(1);
	});

	it("rejects unsupported synonym formats without making a network request", async () => {
		const imported = makeClient();
		await expect(
			imported.client.importSynonyms({ tenantId: TENANT, format: "csv", data: "a,b" }),
		).rejects.toBeInstanceOf(UnsupportedSynonymFormatError);
		expect(imported.calls).toHaveLength(0);

		const exported = makeClient();
		await expect(
			exported.client.exportSynonyms({ tenantId: TENANT, format: "solr" }),
		).rejects.toBeInstanceOf(UnsupportedSynonymFormatError);
		expect(exported.calls).toHaveLength(0);
	});

	it.each([
		"not-json",
		"[]",
		"[{}]",
		JSON.stringify([{ ...BACKEND_SYNONYM_INPUT, unknown: true }]),
	])("rejects malformed or empty JSON import data before transport: %s", async (data) => {
		const { client, calls } = makeClient();
		await expect(
			client.importSynonyms({ tenantId: TENANT, format: "json", data }),
		).rejects.toBeInstanceOf(InvalidSynonymImportError);
		expect(calls).toHaveLength(0);
	});

	it.each([
		{
			...BACKEND_SYNONYM_INPUT,
			synonymType: "one_way",
			primaryTerm: null,
		},
		{
			...BACKEND_SYNONYM_INPUT,
			synonymType: "one_way",
			primaryTerm: "missing",
		},
	])("rejects invalid one-way synonym semantics before transport", async (group) => {
		const { client, calls } = makeClient();
		await expect(
			client.importSynonyms({ tenantId: TENANT, format: "json", data: JSON.stringify([group]) }),
		).rejects.toBeInstanceOf(InvalidSynonymImportError);
		expect(calls).toHaveLength(0);
	});

	it("accepts a one-way synonym whose primary term belongs to the group", async () => {
		const { client, queue, calls } = makeClient();
		queue({ body: ACTIVATION });
		queue({ body: { imported: 1, failed: 0 } });

		await expect(
			client.importSynonyms({
				tenantId: TENANT,
				format: "json",
				data: JSON.stringify([
					{
						...BACKEND_SYNONYM_INPUT,
						synonymType: "one_way",
						primaryTerm: "document",
					},
				]),
			}),
		).resolves.toBeDefined();
		expect(calls).toHaveLength(2);
	});

	it.each(["", "-1", "1.5", "01", "abc", "9007199254740992"])(
		"rejects invalid offset cursor %j before transport",
		async (cursor) => {
			const { client, calls } = makeClient();
			await expect(client.listSynonymGroups({ tenantId: TENANT, cursor })).rejects.toBeInstanceOf(
				InvalidSynonymCursorError,
			);
			expect(calls).toHaveLength(0);
		},
	);
});

describe("retry, batching, auto-SSE", () => {
	it("honors numeric and ignores non-numeric Retry-After headers", async () => {
		const { client, queue } = makeClient();
		queue({ body: ACTIVATION });
		queue({ body: { m: 1 }, status: 429, headers: { "Retry-After": "1" } });
		queue({ body: { m: 2 }, status: 429, headers: { "Retry-After": "zzz" } });
		queue({ body: { items: [] } });
		await expect(client.search({ tenantId: TENANT, query: "x" })).resolves.toEqual({ items: [] });
	}, 15_000);

	it("constructor evaluates every internal-host arm", () => {
		expect(() => new SearchClient({ apiKey: "k", baseUrl: "http://localhost:9200" })).not.toThrow();
		expect(() => new SearchClient({ apiKey: "k", baseUrl: "http://127.0.0.1:9200" })).not.toThrow();
	});

	it("retries 429 (with and without parseable Retry-After) then succeeds; gives up at maxRetries", async () => {
		const { client, queue } = makeClient();
		queue({ body: ACTIVATION });
		queue({ body: { m: "slow" }, status: 429 });
		queue({ body: { items: [] } });
		await expect(client.search({ tenantId: TENANT, query: "x" })).resolves.toEqual({ items: [] });

		clearActivationCache();
		const second = makeClient({ maxRetries: 0 });
		second.queue({ body: ACTIVATION });
		second.queue({ body: { m: "slow" }, status: 429 });
		await expect(second.client.search({ tenantId: TENANT, query: "x" })).rejects.toThrow(
			/Rate limit exceeded/,
		);
	});

	it("search requires a query or SSE tokens and appends sse tokens", async () => {
		const { client, queue, calls } = makeClient();
		await expect(client.search({ tenantId: TENANT })).rejects.toThrow(/requires either/);

		queue({ body: ACTIVATION });
		queue({ body: { items: [] } });
		await client.search({ tenantId: TENANT, sseTokens: ["t1", "t2"] });
		expect(calls[calls.length - 1]?.url).toContain("sse=t1");
	});

	it("batchIndexDocuments indexes each document", async () => {
		const { client, queue, calls } = makeClient();
		queue({ body: ACTIVATION });
		queue({ body: { ok: true } });
		queue({ body: { ok: true } });
		await client.batchIndexDocuments([DOC as never, { ...DOC, documentId: TENANT } as never]);
		expect(calls.filter((c) => c.url.includes("/documents/index"))).toHaveLength(2);
	});

	it("searchWithAutoSse derives tokens when a key exists and falls back without", async () => {
		const { client, queue, calls } = makeClient();
		queue({ body: ACTIVATION });
		queue({ body: { items: [] } });
		await client.searchWithAutoSse({ tenantId: TENANT, query: "quantum rotation" });
		expect(calls[calls.length - 1]?.url).toContain("sse=");

		clearActivationCache();
		const bare = makeClient({ sseKey: undefined });
		bare.queue({ body: ACTIVATION });
		bare.queue({ body: { items: [] } });
		await bare.client.searchWithAutoSse({ tenantId: TENANT, query: "quantum" });
		expect(bare.calls[bare.calls.length - 1]?.url).not.toContain("sse=");
	});

	it("indexDocumentWithAutoSse works keyless and with a minimal document", async () => {
		clearActivationCache();
		const keyless = makeClient({ sseKey: undefined });
		keyless.queue({ body: ACTIVATION });
		keyless.queue({ body: { ok: true } });
		await keyless.client.indexDocumentWithAutoSse({
			tenantId: TENANT,
			documentId: ID,
			version: "1",
			sourceService: "docs",
			security: DOC.security,
		} as never);
		const body = JSON.parse(String(keyless.calls[keyless.calls.length - 1]?.init.body));
		expect(body.sseTokens).toBeUndefined();

		clearActivationCache();
		const keyed = makeClient();
		keyed.queue({ body: ACTIVATION });
		keyed.queue({ body: { ok: true } });
		await keyed.client.indexDocumentWithAutoSse({
			tenantId: TENANT,
			documentId: ID,
			version: "1",
			sourceService: "docs",
			security: DOC.security,
		} as never);
		const minimalBody = JSON.parse(String(keyed.calls[keyed.calls.length - 1]?.init.body));
		expect(Array.isArray(minimalBody.sseTokens)).toBe(true);
	});

	it("acknowledgeAlert carries optional notes without a caller-supplied actor", async () => {
		clearActivationCache();
		const { client, queue, calls } = makeClient();
		queue({ body: ACTIVATION });
		queue({ body: BACKEND_HEALTH_ALERT });
		await client.acknowledgeAlert({
			alertId: ID,
			tenantId: TENANT,
			notes: "checked",
		});
		expect(JSON.parse(String(calls[calls.length - 1]?.init.body))).toEqual({ notes: "checked" });
	});

	it("indexDocumentWithAutoSse attaches derived tokens", async () => {
		const { client, queue, calls } = makeClient();
		queue({ body: ACTIVATION });
		queue({ body: { ok: true } });
		await client.indexDocumentWithAutoSse(DOC as never);
		const body = JSON.parse(String(calls[calls.length - 1]?.init.body));
		expect(Array.isArray(body.sseTokens)).toBe(true);
		expect(body.sseTokens.length).toBeGreaterThan(0);
	});

	it("SSE helper methods require a configured key", () => {
		const { client } = makeClient({ sseKey: undefined });
		expect(() => client.createSseToken("v")).toThrow(/SSE key/);
		expect(() => client.deriveDocumentSseTokens(DOC as never)).toThrow(/SSE key/);
		expect(() => client.deriveQuerySseTokens("q")).toThrow(/SSE key/);

		const keyed = makeClient();
		expect(keyed.client.createSseToken("v")).toBeTruthy();
		expect(keyed.client.deriveDocumentSseTokens(DOC as never).length).toBeGreaterThan(0);
		expect(keyed.client.deriveQuerySseTokens("quantum").length).toBeGreaterThan(0);
	});
});

describe("sse primitives", () => {
	it("creates deterministic HMAC tokens with byte and base64 keys", () => {
		const a = createSseToken(SSE_KEY, "kw:quantum");
		const b = createSseToken(SSE_KEY, "kw:quantum");
		expect(a).toBe(b);
		const b64 = Buffer.from(SSE_KEY).toString("base64");
		expect(createSseToken(b64, "kw:quantum")).toBe(a);
		expect(a).not.toContain("=");
	});

	it("derives document and query tokens that intersect for shared terms", () => {
		const docTokens = deriveDocumentSseTokens(DOC, SSE_KEY);
		const queryTokens = deriveQuerySseTokens("quantum", SSE_KEY);
		expect(queryTokens.some((t) => docTokens.includes(t))).toBe(true);
		// Option branches: restricted derivation still yields tokens.
		const limited = deriveDocumentSseTokens(DOC, SSE_KEY, {
			includeContent: false,
			includeBody: false,
		} as never);
		expect(Array.isArray(limited)).toBe(true);
		expect(
			deriveQuerySseTokens("quantum", SSE_KEY, { maxTokens: 1, minTokenLength: 2 }),
		).toHaveLength(1);
	});

	it("checkSseAccess delegates to the tier contract", () => {
		expect(() => checkSseAccess("dev-pro" as never)).not.toThrow();
	});

	it("validateSseTokensRequired covers all arms", () => {
		expect(validateSseTokensRequired(false, [], null)).toEqual({ valid: true });
		expect(validateSseTokensRequired(true, ["t"], null)).toEqual({ valid: true });
		expect(validateSseTokensRequired(true, [], SSE_KEY)).toEqual({ valid: true });
		expect(validateSseTokensRequired(true, [], null).valid).toBe(false);
	});
});

describe("optimization", () => {
	it("analyzes frequency, optimizes tokens, and batches derivation", () => {
		const analysis = analyzeTokenFrequency(["a", "a", "b"]);
		expect(analysis.get("a")?.frequency).toBe(2);

		const many = Array.from({ length: 10 }, (_, i) => `t${i % 3}`);
		const optimized = optimizeSseTokens(many, { maxTokensPerDocument: 2, minTokenFrequency: 1 });
		expect(optimized).toHaveLength(2);
		expect(optimizeSseTokens(["x"], {})).toEqual(["x"]);

		const batch = batchDeriveDocumentSseTokens(
			{ documents: [DOC as never], options: {} as never },
			SSE_KEY,
		);
		expect(batch.get(ID)?.length).toBeGreaterThan(0);

		expect(
			createOptimizedSseTokens(DOC, SSE_KEY, { maxTokensPerDocument: 3 }).length,
		).toBeLessThanOrEqual(3);
		expect(precomputeCommonTokens(SSE_KEY, ["Quantum"])).toHaveLength(1);
	});

	it("SseTokenCache with zero capacity never retains entries", () => {
		const cache = new SseTokenCache(SSE_KEY, 0);
		expect(cache.get("a")).toBeTruthy();
	});

	it("SseTokenCache caches, evicts oldest, and clears", () => {
		const cache = new SseTokenCache(SSE_KEY, 2);
		const first = cache.get("a");
		expect(cache.get("a")).toBe(first);
		cache.get("b");
		cache.get("c"); // evicts "a"
		expect(cache.size).toBe(2);
		cache.clear();
		expect(cache.size).toBe(0);
	});
});

describe("full-filter variants", () => {
	async function full<T>(fn: (c: SearchClient) => Promise<T>, body: unknown): Promise<string> {
		clearActivationCache();
		const { client, queue, calls } = makeClient();
		queue({ body: ACTIVATION });
		queue({ body });
		await fn(client);
		return calls[calls.length - 1]?.url ?? "";
	}

	it("serializes every optional filter across the analytics and admin methods", async () => {
		expect(
			await full(
				(c) =>
					c.getQueryMetrics({
						tenantId: TENANT,
						since: "2026-01-01",
						until: "2026-02-01",
						groupBy: "day",
					} as never),
				{ total: 0 },
			),
		).toContain("groupBy=day");
		expect(await full((c) => c.getQueryMetrics(), { total: 0 })).not.toContain("groupBy");

		expect(
			await full(
				(c) =>
					c.getSearchQuality({
						tenantId: TENANT,
						since: "2026-01-01",
						until: "2026-02-01",
					} as never),
				{ score: 1 },
			),
		).toContain("until=");
		await full((c) => c.getSearchQuality(), { score: 1 });

		expect(
			await full(
				(c) =>
					c.getTopQueries({
						tenantId: TENANT,
						since: "2026-01-01",
						until: "2026-02-01",
						limit: 5,
						zeroResultsOnly: true,
					} as never),
				{ items: [] },
			),
		).toContain("zeroResultsOnly=true");
		await full((c) => c.getTopQueries(), { items: [] });

		expect(
			await full(
				(c) =>
					c.listSynonymGroups({
						tenantId: TENANT,
						language: "en",
						limit: 5,
						cursor: "5",
					}),
				{ groups: [], pagination: { limit: 5, offset: 5, total: 5 } },
			),
		).toContain("language=en");

		expect(
			await full((c) => c.expandTerm({ tenantId: TENANT, term: "a", language: "en" }), {
				inputTerm: "a",
				expansions: [],
			}),
		).not.toContain("language=en");

		expect(
			await full((c) => c.exportSynonyms({ tenantId: TENANT, format: "json", language: "en" }), {
				count: 0,
				groups: [],
			}),
		).toContain("language=en");

		expect(
			await full(
				(c) =>
					c.listHealthAlerts({
						tenantId: TENANT,
						status: "active",
						severity: "high",
						limit: 5,
						cursor: "opaque-cursor",
					}),
				{ alerts: [], count: 0, nextCursor: null },
			),
		).toContain("severity=high");
		expect(
			await full((c) => c.listHealthAlerts({ tenantId: TENANT, cursor: "opaque-cursor" }), {
				alerts: [],
				count: 0,
				nextCursor: null,
			}),
		).toContain("cursor=opaque-cursor");
		await full((c) => c.listHealthAlerts(), {
			alerts: [],
			count: 0,
			nextCursor: null,
		});

		expect(
			await full(
				(c) =>
					c.listIsolationPolicies({
						tenantId: TENANT,
						status: "active",
						limit: 5,
						cursor: "c",
					} as never),
				{ items: [] },
			),
		).toContain("status=active");
		await full((c) => c.listIsolationPolicies(), { items: [] });
	});
});

describe("sse branch tails", () => {
	it("flattens array and nested metadata, skips empty fields, honors token caps", () => {
		const tokens = deriveDocumentSseTokens(
			{
				tenantId: TENANT,
				documentId: ID,
				sourceService: "docs",
				tags: [],
				metadata: {
					list: ["a", 1, true, null, undefined as never, { nested: "x" }],
					deep: { inner: "y" },
					skip: undefined as never,
				},
				title: "",
				description: "",
				body: "",
			},
			SSE_KEY,
		);
		expect(tokens.length).toBeGreaterThan(0);

		// maxContentTokens cap breaks the keyword loop.
		const capped = deriveDocumentSseTokens(DOC, SSE_KEY, { maxContentTokens: 1 });
		expect(capped.length).toBeLessThan(deriveDocumentSseTokens(DOC, SSE_KEY).length);

		// sseTokens undefined exercises the ?? 0 arm.
		expect(validateSseTokensRequired(true, undefined, SSE_KEY)).toEqual({ valid: true });

		// Documents without tags/metadata exercise the ?? [] / ?? {} arms.
		const bare = deriveDocumentSseTokens(
			{
				tenantId: TENANT,
				documentId: ID,
				sourceService: "docs",
				title: "Quantum",
				description: null as never,
				body: null as never,
			} as never,
			SSE_KEY,
		);
		expect(bare.length).toBeGreaterThan(0);
	});
});

describe("telemetry and validation", () => {
	it("telemetry factory branches and error events with a real reader", async () => {
		const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
		const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
		const telemetry = createSearchClientTelemetry({
			serviceName: "search-test",
			serviceVersion: "1.0.0",
			environment: "test",
			exporterFactory: () => reader,
		});
		telemetry.record({
			operation: "o",
			method: "GET",
			route: "/x",
			status: "error",
			durationMs: 1,
			httpStatus: 500,
			target: "t",
			error: "boom",
		});
		telemetry.record({ operation: "o", method: "GET", route: "/x", status: "ok", durationMs: 1 });
		// Error status without an error string exercises the "unknown" fallback.
		telemetry.record({
			operation: "o",
			method: "GET",
			route: "/x",
			status: "error",
			durationMs: 1,
		});
		const { resourceMetrics } = await reader.collect();
		const names = resourceMetrics.scopeMetrics.flatMap((s) =>
			s.metrics.map((m) => m.descriptor.name),
		);
		expect(names).toContain("search_sdk_request_failures_total");

		createSearchClientTelemetry({
			serviceName: "s",
			otlpEndpoint: "http://localhost:4318/v1/metrics",
		});
		createSearchClientTelemetry({ serviceName: "s" });
		vi.stubEnv("NODE_ENV", "production");
		try {
			createSearchClientTelemetry({ serviceName: "s", metricsIntervalMs: 3_600_000 });
		} finally {
			vi.unstubAllEnvs();
		}
		expect(isSearchClientTelemetry({ record: () => {} })).toBe(true);
		expect(isSearchClientTelemetry({ serviceName: "s" })).toBe(false);
	});

	it("client accepts a telemetry CONFIG and builds it", async () => {
		const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
		const { client, queue } = makeClient({
			telemetry: {
				serviceName: "search-cfg",
				exporterFactory: () =>
					new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 }),
			},
		});
		queue({ body: ACTIVATION });
		queue({ body: { items: [] } });
		await client.search({ tenantId: TENANT, query: "x" });
	});

	it("validateUUID names the field", () => {
		expect(() => validateUUID(TENANT, "tenantId")).not.toThrow();
		expect(() => validateUUID("x", "tenantId")).toThrow(/Invalid tenantId/);
	});
});
