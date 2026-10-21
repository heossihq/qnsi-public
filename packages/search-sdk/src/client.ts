import { performance } from "node:perf_hooks";

import { activateSdk, type SdkActivationConfig } from "@heossihq/qnsi-sdk-activation";
import { type RequestInit as UndiciRequestInit, fetch as undiciFetch } from "undici";
import { z } from "zod";

import type { SearchClientTelemetry, SearchClientTelemetryConfig } from "./observability.js";
import { createSearchClientTelemetry, isSearchClientTelemetry } from "./observability.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";
import { createSseToken, deriveDocumentSseTokens, deriveQuerySseTokens } from "./sse.js";
import type {
	AcknowledgeAlertRequest,
	CreateIsolationPolicyRequest,
	CreateMaintenanceWindowRequest,
	CreateSynonymGroupRequest,
	CurrentIndexHealth,
	ExpandTermRequest,
	ExpandTermResponse,
	ExportSynonymsRequest,
	ExportSynonymsResponse,
	GetIndexHealthRequest,
	HealthAlert,
	ImportSynonymsRequest,
	ImportSynonymsResponse,
	IndexDocumentRequest,
	IndexHealthSnapshot,
	IsolationPolicy,
	IsolationVerificationResult,
	IsolationViolation,
	ListHealthAlertsRequest,
	ListHealthAlertsResponse,
	ListIsolationPoliciesRequest,
	ListIsolationPoliciesResponse,
	ListSynonymGroupsRequest,
	ListSynonymGroupsResponse,
	MaintenanceWindow,
	QueryMetrics,
	QueryMetricsRequest,
	RecordHealthSnapshotRequest,
	RecordQueryRequest,
	ReportViolationRequest,
	RunIsolationVerificationRequest,
	SearchQuality,
	SearchQualityRequest,
	SearchQueryRequest,
	SearchQueryResponse,
	SynonymGroup,
	TopQueriesRequest,
	TopQueriesResponse,
	UpdateSynonymGroupRequest,
} from "./types.js";
import { validateUUID } from "./validation.js";

/** Default QNSP cloud API base URL. Get a free API key at https://cloud.qnsi.heossi.com/signup */
export const DEFAULT_BASE_URL = "https://api.qnsi.heossi.com";

const synonymTypeSchema = z.enum(["equivalent", "one_way", "hyponym", "hypernym"]);
const synonymTermSchema = z
	.string()
	.trim()
	.min(1)
	.max(256)
	.transform((term) => term.toLowerCase());
const synonymTermsSchema = z
	.array(synonymTermSchema)
	.min(2)
	.max(100)
	.transform((terms) => [...new Set(terms)])
	.refine((terms) => terms.length >= 2, "Synonym groups require at least two distinct terms");
const backendSynonymGroupInputSchema = z
	.object({
		name: z.string().trim().min(1).max(255),
		description: z.string().max(1000).nullable().optional(),
		synonymType: synonymTypeSchema.default("equivalent"),
		language: z.string().trim().min(2).max(32).default("en"),
		terms: synonymTermsSchema,
		primaryTerm: synonymTermSchema.nullable().optional(),
		enabled: z.boolean().default(true),
		weight: z.number().min(0).max(10).default(1),
		indexIds: z.array(z.string().uuid()).max(100).default([]),
		metadata: z.record(z.string(), z.unknown()).default({}),
	})
	.strict()
	.superRefine((group, context) => {
		if (group.synonymType !== "one_way") return;
		if (!group.primaryTerm) {
			context.addIssue({
				code: "custom",
				path: ["primaryTerm"],
				message: "Primary term is required for one_way synonym type",
			});
			return;
		}
		if (!group.terms.includes(group.primaryTerm)) {
			context.addIssue({
				code: "custom",
				path: ["primaryTerm"],
				message: "Primary term must be included in terms",
			});
		}
	});
const backendSynonymResourceSchema = z.object({
	id: z.string().uuid(),
	tenantId: z.string().uuid(),
	name: z.string(),
	description: z.string().nullable().optional(),
	terms: z.array(z.string()),
	enabled: z.boolean(),
	language: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});
const backendSynonymListSchema = z.object({
	groups: z.array(backendSynonymResourceSchema),
	pagination: z.object({
		limit: z.number().int().positive(),
		offset: z.number().int().nonnegative(),
		total: z.number().int().nonnegative(),
	}),
});
const backendSynonymExpansionSchema = z.object({
	inputTerm: z.string(),
	expansions: z.array(
		z.object({
			term: z.string(),
			groupId: z.string().uuid(),
		}),
	),
});
const backendSynonymImportResponseSchema = z.object({
	imported: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
});
const backendSynonymExportResponseSchema = z.object({
	count: z.number().int().nonnegative(),
	groups: z.array(backendSynonymGroupInputSchema),
});
const synonymImportDataSchema = z.array(backendSynonymGroupInputSchema).min(1).max(1000);

const reportedAssessmentSchema = z.enum(["healthy", "degraded", "unhealthy"]);
const healthAlertSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
const healthAlertStatusSchema = z.enum(["active", "acknowledged", "resolved"]);
const indexAlertTypeSchema = z.enum([
	"high_fragmentation",
	"slow_query",
	"index_lag",
	"size_threshold",
	"error_rate",
	"replication_lag",
	"memory_pressure",
	"disk_usage",
	"custom",
]);
const exactIntegerSchema = z.string().regex(/^(0|[1-9]\d*)$/);
const nullableMetricSchema = z.number().finite().nonnegative().nullable();
const backendIndexHealthSnapshotSchema = z
	.object({
		id: z.string().uuid(),
		tenantId: z.string().min(1),
		indexId: z.string().uuid(),
		indexName: z.string().min(1),
		healthStatus: z.literal("unknown"),
		actualHealthStatus: z.literal("unknown"),
		reportedAssessment: reportedAssessmentSchema,
		verificationStatus: z.literal("unverified"),
		measurementSource: z.literal("client_reported"),
		totalDocuments: z.number().int().nonnegative().safe().nullable(),
		totalDocumentsExact: exactIntegerSchema,
		totalSizeBytes: z.number().int().nonnegative().safe().nullable(),
		totalSizeBytesExact: exactIntegerSchema,
		indexSizeBytes: z.number().int().nonnegative().safe().nullable(),
		indexSizeBytesExact: exactIntegerSchema,
		fragmentationPercent: z.number().finite().min(0).max(100),
		avgDocumentSizeBytes: nullableMetricSchema,
		lastIndexedAt: z.string().datetime().nullable(),
		lastOptimizedAt: z.string().datetime().nullable(),
		searchLatencyP50Ms: nullableMetricSchema,
		searchLatencyP95Ms: nullableMetricSchema,
		searchLatencyP99Ms: nullableMetricSchema,
		indexLatencyP50Ms: nullableMetricSchema,
		indexLatencyP95Ms: nullableMetricSchema,
		errorRate: nullableMetricSchema,
		metadata: z.record(z.string(), z.unknown()),
		collectedAt: z.string().datetime(),
	})
	.superRefine((snapshot, context) => {
		for (const [numericField, exactField] of [
			["totalDocuments", "totalDocumentsExact"],
			["totalSizeBytes", "totalSizeBytesExact"],
			["indexSizeBytes", "indexSizeBytesExact"],
		] as const) {
			const exact = BigInt(snapshot[exactField]);
			const numeric = snapshot[numericField];
			const isSafelyRepresentable = exact <= BigInt(Number.MAX_SAFE_INTEGER);
			if (
				(isSafelyRepresentable && numeric !== Number(exact)) ||
				(!isSafelyRepresentable && numeric !== null)
			) {
				context.addIssue({
					code: "custom",
					path: [numericField],
					message: `${numericField} must be the safe projection of ${exactField}`,
				});
			}
		}
	});
const backendHealthAlertSchema = z.object({
	id: z.string().uuid(),
	tenantId: z.string().min(1),
	indexId: z.string().uuid().nullable(),
	indexName: z.string().min(1),
	alertType: indexAlertTypeSchema,
	severity: healthAlertSeveritySchema,
	status: healthAlertStatusSchema,
	message: z.string().min(1),
	thresholdValue: z.number().finite().nullable(),
	currentValue: z.number().finite().nullable(),
	metadata: z.record(z.string(), z.unknown()),
	reportingSource: z.literal("client_reported"),
	verificationStatus: z.literal("unverified"),
	triggeredAt: z.string().datetime(),
	acknowledgedAt: z.string().datetime().nullable(),
	acknowledgedBy: z.string().nullable(),
	acknowledgedNotes: z.string().nullable(),
	resolvedAt: z.string().datetime().nullable(),
	resolvedBy: z.string().nullable(),
	resolutionNotes: z.string().nullable(),
});
const backendCurrentIndexHealthSchema = z.object({
	tenantId: z.string().min(1),
	overallStatus: z.literal("unknown"),
	actualHealthStatus: z.literal("unknown"),
	verificationStatus: z.literal("unverified"),
	summary: z.object({
		totalIndices: z.number().int().nonnegative(),
		actualHealthStatus: z.literal("unknown"),
		reportedAssessmentCounts: z.object({
			healthy: z.number().int().nonnegative(),
			degraded: z.number().int().nonnegative(),
			unhealthy: z.number().int().nonnegative(),
		}),
		activeReportedAlerts: z.number().int().nonnegative(),
	}),
	indices: z.array(backendIndexHealthSnapshotSchema),
	alerts: z.array(backendHealthAlertSchema),
});
const backendHealthAlertListSchema = z
	.object({
		alerts: z.array(backendHealthAlertSchema),
		count: z.number().int().nonnegative(),
		nextCursor: z.string().min(1).max(512).nullable(),
	})
	.superRefine((result, context) => {
		if (result.count !== result.alerts.length) {
			context.addIssue({
				code: "custom",
				path: ["count"],
				message: "count must equal the number of returned alerts",
			});
		}
	});
const backendMaintenanceWindowSchema = z.object({
	id: z.string().uuid(),
	tenantId: z.string().min(1),
	indexId: z.string().uuid().nullable(),
	indexName: z.string().min(1).nullable(),
	maintenanceType: z.enum([
		"optimize",
		"reindex",
		"vacuum",
		"compact",
		"analyze",
		"backup",
		"restore",
	]),
	scheduledAt: z.string().datetime(),
	estimatedDurationMinutes: z.number().int().positive().nullable(),
	scheduleStatus: z.enum([
		"scheduled",
		"overdue",
		"cancelled",
		"recorded_in_progress",
		"recorded_completed",
	]),
	executionStatus: z.enum(["unavailable", "unverified_record"]),
	executionStatusReason: z.string().min(1),
	recordedStartedAt: z.string().datetime().nullable(),
	recordedCompletedAt: z.string().datetime().nullable(),
	metadata: z.record(z.string(), z.unknown()),
	createdBy: z.string().min(1).nullable(),
	cancelledAt: z.string().datetime().nullable(),
	cancelledBy: z.string().nullable(),
	createdAt: z.string().datetime(),
	observedAt: z.string().datetime(),
});

export class UnsupportedSynonymFormatError extends Error {
	readonly format: "csv" | "solr";

	constructor(format: "csv" | "solr") {
		super(
			`Synonym ${format} format is not supported because no authoritative parser contract is available`,
		);
		this.name = "UnsupportedSynonymFormatError";
		this.format = format;
	}
}

export class InvalidSynonymImportError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "InvalidSynonymImportError";
	}
}

export class SearchTenantMismatchError extends Error {
	constructor() {
		super("Requested tenantId does not match the tenant authorized by SDK activation");
		this.name = "SearchTenantMismatchError";
	}
}

export class InvalidSynonymCursorError extends Error {
	constructor() {
		super("Synonym cursor must be a nonnegative decimal safe integer");
		this.name = "InvalidSynonymCursorError";
	}
}

function mapBackendSynonymGroup(input: z.infer<typeof backendSynonymResourceSchema>): SynonymGroup {
	return {
		id: input.id,
		tenantId: input.tenantId,
		name: input.name,
		...(input.description !== null && input.description !== undefined
			? { description: input.description }
			: {}),
		synonyms: input.terms,
		isExpanded: input.enabled,
		language: input.language,
		createdAt: input.createdAt,
		updatedAt: input.updatedAt,
	};
}

function parseSynonymCursor(cursor: string | undefined): number {
	if (cursor === undefined) return 0;
	if (!/^(0|[1-9]\d*)$/.test(cursor)) throw new InvalidSynonymCursorError();
	const offset = Number(cursor);
	if (!Number.isSafeInteger(offset)) throw new InvalidSynonymCursorError();
	return offset;
}

function parseSynonymImportData(data: string): z.infer<typeof synonymImportDataSchema> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(data) as unknown;
	} catch (error) {
		throw new InvalidSynonymImportError("Synonym import data must be valid JSON", {
			cause: error,
		});
	}
	const result = synonymImportDataSchema.safeParse(parsed);
	if (!result.success) {
		throw new InvalidSynonymImportError(
			`Synonym import data does not match the mounted service contract: ${z.prettifyError(result.error)}`,
			{ cause: result.error },
		);
	}
	return result.data;
}

export interface SearchClientOptions {
	readonly baseUrl?: string;
	readonly apiKey: string;
	readonly timeoutMs?: number;
	readonly maxRetries?: number;
	readonly retryDelayMs?: number;
	readonly fetchImpl?: typeof undiciFetch;
	readonly sseKey?: Uint8Array | string;
	readonly telemetry?: SearchClientTelemetry | SearchClientTelemetryConfig;
}

export class SearchClient {
	private readonly baseUrl: string;
	private readonly apiKey: string;
	private readonly timeoutMs: number;
	private readonly maxRetries: number;
	private readonly retryDelayMs: number;
	private readonly fetchImpl: typeof undiciFetch;
	private readonly sseKey: Uint8Array | string | null;
	private readonly telemetry: SearchClientTelemetry | null;
	private readonly targetService: string;
	private activationPromise: Promise<void> | null = null;
	private readonly activationConfig: SdkActivationConfig;
	private resolvedTenantId: string | null = null;

	private async ensureActivated(): Promise<void> {
		if (!this.activationPromise) {
			this.activationPromise = activateSdk(this.activationConfig).then((response) => {
				this.resolvedTenantId = response.tenantId;
			});
		}
		return this.activationPromise;
	}

	private async ensureTenantAuthorized(tenantId: string): Promise<void> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();
		if (this.resolvedTenantId !== tenantId) {
			throw new SearchTenantMismatchError();
		}
	}

	private async ensureOptionalTenantAuthorized(tenantId?: string): Promise<void> {
		if (tenantId === undefined) {
			await this.ensureActivated();
			return;
		}
		await this.ensureTenantAuthorized(tenantId);
	}

	constructor(options: SearchClientOptions) {
		if (!options.apiKey || options.apiKey.trim().length === 0) {
			throw new Error(
				"QNSP Search SDK: apiKey is required. " +
					"Get your free API key at https://cloud.qnsi.heossi.com/signup - " +
					"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
					"Docs: https://docs.qnsi.heossi.com/sdk/search-sdk",
			);
		}
		const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");

		// Enforce HTTPS in production (allow HTTP for localhost in development and
		// for internal service-mesh hostnames - e.g. *.internal - which are on a
		// private VPC network and do not require TLS termination at the transport layer).
		if (!baseUrl.startsWith("https://")) {
			const isLocalhost =
				baseUrl.startsWith("http://localhost") || baseUrl.startsWith("http://127.0.0.1");
			let isInternalService = false;
			try {
				const parsed = new URL(baseUrl);
				isInternalService =
					parsed.protocol === "http:" &&
					(parsed.hostname.endsWith(".internal") ||
						parsed.hostname === "localhost" ||
						parsed.hostname === "127.0.0.1");
			} catch {
				// ignore; invalid URL will be caught later by fetch
			}
			const isDevelopment =
				process.env["NODE_ENV"] === "development" || process.env["NODE_ENV"] === "test";
			if ((!isLocalhost || !isDevelopment) && !isInternalService) {
				throw new Error(
					"baseUrl must use HTTPS in production. HTTP is only allowed for localhost in development.",
				);
			}
		}

		this.baseUrl = baseUrl;
		this.apiKey = options.apiKey;
		this.timeoutMs = options.timeoutMs ?? 15_000;
		this.maxRetries = options.maxRetries ?? 3;
		this.retryDelayMs = options.retryDelayMs ?? 1_000;
		this.fetchImpl = options.fetchImpl ?? undiciFetch;
		this.sseKey = options.sseKey ?? null;

		this.telemetry = options.telemetry
			? isSearchClientTelemetry(options.telemetry)
				? options.telemetry
				: createSearchClientTelemetry(options.telemetry)
			: null;

		try {
			this.targetService = new URL(this.baseUrl).host;
		} catch {
			this.targetService = "search-service";
		}

		this.activationConfig = {
			apiKey: options.apiKey,
			sdkId: "search-sdk",
			sdkVersion: SDK_PACKAGE_VERSION,
			platformUrl: options.baseUrl,
			fetchImpl: options.fetchImpl as unknown as (typeof globalThis)["fetch"] | undefined,
		};
	}

	private async fetchWithRetry(
		url: string,
		init: UndiciRequestInit,
		attempt: number,
	): Promise<Response> {
		// Auto-inject tenant ID header from activation response. Every public
		// method awaits ensureActivated() before requesting, and activation
		// always carries a tenantId, so this is set unconditionally.
		{
			const headers = {
				...(init.headers as Record<string, string> | undefined),
				"x-qnsp-tenant-id": this.resolvedTenantId as string,
			};
			init = { ...init, headers };
		}
		const response = await this.fetchImpl(url, init);

		if (response.status === 429) {
			if (attempt < this.maxRetries) {
				const retryAfterHeader = response.headers.get("Retry-After");
				let delayMs = this.retryDelayMs;

				if (retryAfterHeader) {
					const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
					if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
						delayMs = retryAfterSeconds * 1_000;
					}
				} else {
					// Exponential backoff: 2^attempt * baseDelay, capped at 30 seconds
					delayMs = Math.min(2 ** attempt * this.retryDelayMs, 30_000);
				}

				await new Promise((resolve) => setTimeout(resolve, delayMs));
				return this.fetchWithRetry(url, init, attempt + 1);
			}

			throw new Error(`Search API error: Rate limit exceeded after ${this.maxRetries} retries`);
		}

		return response;
	}

	async indexDocument(input: IndexDocumentRequest): Promise<void> {
		await this.ensureTenantAuthorized(input.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/documents/index";
		const method = "POST";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify(input),
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "indexDocument",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	async search(params: SearchQueryRequest): Promise<SearchQueryResponse> {
		if (!params.query && (!params.sseTokens || params.sseTokens.length === 0)) {
			throw new Error("search query requires either plaintext query or SSE tokens");
		}
		await this.ensureTenantAuthorized(params.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/documents";
		const method = "GET";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams();
			query.set("tenantId", params.tenantId);
			if (params.query && params.query.length > 0) {
				query.set("q", params.query);
			}
			if (params.limit) {
				query.set("limit", params.limit.toString());
			}
			if (params.cursor) {
				query.set("cursor", params.cursor);
			}
			if (params.language) {
				query.set("language", params.language);
			}
			for (const token of params.sseTokens ?? []) {
				query.append("sse", token);
			}

			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}?${query.toString()}`,
				{
					method,
					headers: { Authorization: `Bearer ${this.apiKey}` },
					signal: controller.signal,
				},
				0,
			);

			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return (await response.json()) as SearchQueryResponse;
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "search",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	createSseToken(value: string): string {
		if (!this.sseKey) {
			throw new Error("SearchClient was not configured with an SSE key");
		}
		return createSseToken(this.sseKey, value);
	}

	deriveDocumentSseTokens(
		document: Pick<
			IndexDocumentRequest,
			| "tenantId"
			| "documentId"
			| "sourceService"
			| "tags"
			| "metadata"
			| "body"
			| "title"
			| "description"
		>,
	): string[] {
		if (!this.sseKey) {
			throw new Error("SearchClient was not configured with an SSE key");
		}
		return deriveDocumentSseTokens(document, this.sseKey);
	}

	deriveQuerySseTokens(query: string): string[] {
		if (!this.sseKey) {
			throw new Error("SearchClient was not configured with an SSE key");
		}
		return deriveQuerySseTokens(query, this.sseKey);
	}

	/**
	 * Batch index multiple documents efficiently.
	 * This reduces network overhead by sending multiple documents in parallel.
	 */
	async batchIndexDocuments(documents: readonly IndexDocumentRequest[]): Promise<void> {
		await Promise.all(documents.map((document) => this.ensureTenantAuthorized(document.tenantId)));
		await Promise.all(documents.map((doc) => this.indexDocument(doc)));
	}

	/**
	 * Search with automatic SSE token derivation if key is configured.
	 * Falls back to plaintext query if SSE key is not available.
	 */
	async searchWithAutoSse(
		params: Omit<SearchQueryRequest, "sseTokens"> & { query: string },
	): Promise<SearchQueryResponse> {
		await this.ensureTenantAuthorized(params.tenantId);
		const sseTokens = this.sseKey ? this.deriveQuerySseTokens(params.query) : undefined;
		const request: SearchQueryRequest = {
			...params,
			...(sseTokens !== undefined ? { sseTokens } : {}),
		};
		return this.search(request);
	}

	/**
	 * Index document with automatic SSE token derivation if key is configured.
	 */
	async indexDocumentWithAutoSse(document: Omit<IndexDocumentRequest, "sseTokens">): Promise<void> {
		await this.ensureTenantAuthorized(document.tenantId);
		const sseTokens = this.sseKey
			? deriveDocumentSseTokens(
					{
						tenantId: document.tenantId,
						documentId: document.documentId,
						sourceService: document.sourceService,
						tags: document.tags ?? [],
						metadata: document.metadata ?? {},
						title: document.title ?? null,
						description: document.description ?? null,
						body: document.body ?? null,
					},
					this.sseKey,
					{
						includeContent: true,
						includeBody: true,
					},
				)
			: undefined;

		const request: IndexDocumentRequest = {
			...document,
			...(sseTokens !== undefined ? { sseTokens } : {}),
		};
		return this.indexDocument(request);
	}

	/**
	 * Record a search query for analytics tracking.
	 */
	async recordQuery(input: RecordQueryRequest): Promise<void> {
		await this.ensureTenantAuthorized(input.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/analytics/queries";
		const method = "POST";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify(input),
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "recordQuery",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Get query metrics for analytics.
	 */
	async getQueryMetrics(params?: QueryMetricsRequest): Promise<QueryMetrics> {
		await this.ensureOptionalTenantAuthorized(params?.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/analytics/metrics";
		const method = "GET";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams();
			if (params?.tenantId) {
				query.set("tenantId", params.tenantId);
			}
			if (params?.since) query.set("since", params.since);
			if (params?.until) query.set("until", params.until);
			if (params?.groupBy) query.set("groupBy", params.groupBy);

			const queryString = query.toString();
			const url = queryString
				? `${this.baseUrl}${route}?${queryString}`
				: `${this.baseUrl}${route}`;

			const response = await this.fetchWithRetry(
				url,
				{
					method,
					headers: { Authorization: `Bearer ${this.apiKey}` },
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return (await response.json()) as QueryMetrics;
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "getQueryMetrics",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Get search quality metrics.
	 */
	async getSearchQuality(params?: SearchQualityRequest): Promise<SearchQuality> {
		await this.ensureOptionalTenantAuthorized(params?.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/analytics/quality";
		const method = "GET";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams();
			if (params?.tenantId) {
				query.set("tenantId", params.tenantId);
			}
			if (params?.since) query.set("since", params.since);
			if (params?.until) query.set("until", params.until);

			const queryString = query.toString();
			const url = queryString
				? `${this.baseUrl}${route}?${queryString}`
				: `${this.baseUrl}${route}`;

			const response = await this.fetchWithRetry(
				url,
				{
					method,
					headers: { Authorization: `Bearer ${this.apiKey}` },
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return (await response.json()) as SearchQuality;
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "getSearchQuality",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Get top queries for analytics.
	 */
	async getTopQueries(params?: TopQueriesRequest): Promise<TopQueriesResponse> {
		await this.ensureOptionalTenantAuthorized(params?.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/analytics/top-queries";
		const method = "GET";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams();
			if (params?.tenantId) {
				query.set("tenantId", params.tenantId);
			}
			if (params?.since) query.set("since", params.since);
			if (params?.until) query.set("until", params.until);
			if (params?.limit) query.set("limit", String(params.limit));
			if (params?.zeroResultsOnly) query.set("zeroResultsOnly", "true");

			const queryString = query.toString();
			const url = queryString
				? `${this.baseUrl}${route}?${queryString}`
				: `${this.baseUrl}${route}`;

			const response = await this.fetchWithRetry(
				url,
				{
					method,
					headers: { Authorization: `Bearer ${this.apiKey}` },
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return (await response.json()) as TopQueriesResponse;
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "getTopQueries",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Create a synonym group for query expansion.
	 */
	async createSynonymGroup(input: CreateSynonymGroupRequest): Promise<SynonymGroup> {
		await this.ensureTenantAuthorized(input.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/synonyms";
		const method = "POST";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams({ tenantId: input.tenantId });
			const body = {
				name: input.name,
				...(input.description !== undefined ? { description: input.description } : {}),
				terms: input.synonyms,
				...(input.isExpanded !== undefined ? { enabled: input.isExpanded } : {}),
				...(input.language !== undefined ? { language: input.language } : {}),
			};
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}?${query.toString()}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify(body),
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return mapBackendSynonymGroup(backendSynonymResourceSchema.parse(await response.json()));
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "createSynonymGroup",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * List synonym groups for a tenant.
	 */
	async listSynonymGroups(params: ListSynonymGroupsRequest): Promise<ListSynonymGroupsResponse> {
		const offset = parseSynonymCursor(params.cursor);
		await this.ensureTenantAuthorized(params.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/synonyms";
		const method = "GET";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams();
			query.set("tenantId", params.tenantId);
			if (params.language) query.set("language", params.language);
			if (params.limit) query.set("limit", String(params.limit));
			query.set("offset", String(offset));

			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}?${query.toString()}`,
				{
					method,
					headers: { Authorization: `Bearer ${this.apiKey}` },
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			const result = backendSynonymListSchema.parse(await response.json());
			const nextOffset = result.pagination.offset + result.pagination.limit;
			return {
				items: result.groups.map(mapBackendSynonymGroup),
				nextCursor: nextOffset < result.pagination.total ? String(nextOffset) : null,
			};
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "listSynonymGroups",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Update a synonym group.
	 */
	async updateSynonymGroup(
		groupId: string,
		input: UpdateSynonymGroupRequest,
	): Promise<SynonymGroup> {
		validateUUID(groupId, "groupId");
		await this.ensureActivated();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = `/search/v1/synonyms/${groupId}`;
		const method = "PATCH";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const body = {
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.description !== undefined ? { description: input.description } : {}),
				...(input.synonyms !== undefined ? { terms: input.synonyms } : {}),
				...(input.isExpanded !== undefined ? { enabled: input.isExpanded } : {}),
				...(input.language !== undefined ? { language: input.language } : {}),
			};
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify(body),
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return mapBackendSynonymGroup(backendSynonymResourceSchema.parse(await response.json()));
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "updateSynonymGroup",
					method,
					route: "/search/v1/synonyms/:groupId",
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Delete a synonym group.
	 */
	async deleteSynonymGroup(groupId: string): Promise<void> {
		validateUUID(groupId, "groupId");
		await this.ensureActivated();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = `/search/v1/synonyms/${groupId}`;
		const method = "DELETE";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}`,
				{
					method,
					headers: { Authorization: `Bearer ${this.apiKey}` },
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "deleteSynonymGroup",
					method,
					route: "/search/v1/synonyms/:groupId",
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Expand a term using configured synonyms.
	 */
	async expandTerm(params: ExpandTermRequest): Promise<ExpandTermResponse> {
		await this.ensureTenantAuthorized(params.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/synonyms/expand";
		const method = "POST";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams({ tenantId: params.tenantId });
			const body = {
				term: params.term,
				...(params.language !== undefined ? { language: params.language } : {}),
			};
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}?${query.toString()}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify(body),
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			const result = backendSynonymExpansionSchema.parse(await response.json());
			return {
				originalTerm: result.inputTerm,
				expandedTerms: result.expansions.map((expansion) => expansion.term),
				matchedGroups: [...new Set(result.expansions.map((expansion) => expansion.groupId))],
			};
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "expandTerm",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Import synonyms from various formats.
	 */
	async importSynonyms(input: ImportSynonymsRequest): Promise<ImportSynonymsResponse> {
		if (input.format !== "json") throw new UnsupportedSynonymFormatError(input.format);
		const groups = parseSynonymImportData(input.data);
		await this.ensureTenantAuthorized(input.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/synonyms/import";
		const method = "POST";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams({ tenantId: input.tenantId });
			const body = {
				groups,
				...(input.replaceExisting !== undefined ? { replaceExisting: input.replaceExisting } : {}),
				...(input.language !== undefined ? { language: input.language } : {}),
			};
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}?${query.toString()}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify(body),
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			const result = backendSynonymImportResponseSchema.parse(await response.json());
			return { imported: result.imported, skipped: result.failed, errors: [] };
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "importSynonyms",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Export synonyms to various formats.
	 */
	async exportSynonyms(params: ExportSynonymsRequest): Promise<ExportSynonymsResponse> {
		if (params.format !== "json") throw new UnsupportedSynonymFormatError(params.format);
		await this.ensureTenantAuthorized(params.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/synonyms/export";
		const method = "GET";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams({ tenantId: params.tenantId });
			if (params.language) query.set("language", params.language);

			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}?${query.toString()}`,
				{
					method,
					headers: { Authorization: `Bearer ${this.apiKey}` },
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			const result = backendSynonymExportResponseSchema.parse(await response.json());
			return { data: JSON.stringify(result.groups), count: result.count, format: "json" };
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "exportSynonyms",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Record an index health snapshot for monitoring.
	 */
	async recordHealthSnapshot(input: RecordHealthSnapshotRequest): Promise<IndexHealthSnapshot> {
		validateUUID(input.indexId, "indexId");
		await this.ensureTenantAuthorized(input.tenantId);
		const { tenantId: _tenantId, ...observation } = input;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v2/health/snapshots";
		const method = "POST";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}?tenantId=${encodeURIComponent(input.tenantId)}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
						"x-qnsp-tenant-id": input.tenantId,
					},
					body: JSON.stringify(observation),
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return backendIndexHealthSnapshotSchema.parse(await response.json());
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "recordHealthSnapshot",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Get current index health for a tenant.
	 */
	async getIndexHealth(params: GetIndexHealthRequest): Promise<CurrentIndexHealth> {
		await this.ensureTenantAuthorized(params.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v2/health/current";
		const method = "GET";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams();
			query.set("tenantId", params.tenantId);

			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}?${query.toString()}`,
				{
					method,
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"x-qnsp-tenant-id": params.tenantId,
					},
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return backendCurrentIndexHealthSchema.parse(await response.json());
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "getIndexHealth",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * List health alerts for monitoring.
	 */
	async listHealthAlerts(params?: ListHealthAlertsRequest): Promise<ListHealthAlertsResponse> {
		await this.ensureOptionalTenantAuthorized(params?.tenantId);
		const tenantId = params?.tenantId ?? this.resolvedTenantId;
		if (!tenantId) throw new Error("SDK activation did not return a tenantId");
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v2/health/alerts";
		const method = "GET";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams();
			query.set("tenantId", tenantId);
			if (params?.status) query.set("status", params.status);
			if (params?.severity) query.set("severity", params.severity);
			if (params?.limit) query.set("limit", String(params.limit));
			if (params?.cursor) query.set("cursor", params.cursor);

			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}?${query.toString()}`,
				{
					method,
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"x-qnsp-tenant-id": tenantId,
					},
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			const result = backendHealthAlertListSchema.parse(await response.json());
			return {
				items: result.alerts,
				nextCursor: result.nextCursor,
			};
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "listHealthAlerts",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Acknowledge a health alert.
	 */
	async acknowledgeAlert(input: AcknowledgeAlertRequest): Promise<HealthAlert> {
		validateUUID(input.alertId, "alertId");
		await this.ensureTenantAuthorized(input.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = `/search/v2/health/alerts/${input.alertId}/acknowledge`;
		const method = "POST";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}?tenantId=${encodeURIComponent(input.tenantId)}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
						"x-qnsp-tenant-id": input.tenantId,
					},
					body: JSON.stringify(input.notes === undefined ? {} : { notes: input.notes }),
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return backendHealthAlertSchema.parse(await response.json());
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "acknowledgeAlert",
					method,
					route: "/search/v2/health/alerts/:alertId/acknowledge",
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Create a maintenance window for planned operations.
	 */
	async createMaintenanceWindow(input: CreateMaintenanceWindowRequest): Promise<MaintenanceWindow> {
		validateUUID(input.indexId, "indexId");
		await this.ensureTenantAuthorized(input.tenantId);
		const { tenantId: _tenantId, ...schedule } = input;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v2/health/maintenance";
		const method = "POST";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}?tenantId=${encodeURIComponent(input.tenantId)}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
						"x-qnsp-tenant-id": input.tenantId,
					},
					body: JSON.stringify(schedule),
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return backendMaintenanceWindowSchema.parse(await response.json());
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "createMaintenanceWindow",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Create an isolation policy for tenant data protection.
	 */
	async createIsolationPolicy(input: CreateIsolationPolicyRequest): Promise<IsolationPolicy> {
		await this.ensureTenantAuthorized(input.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/isolation/policies";
		const method = "POST";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify(input),
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return (await response.json()) as IsolationPolicy;
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "createIsolationPolicy",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * List isolation policies.
	 */
	async listIsolationPolicies(
		params?: ListIsolationPoliciesRequest,
	): Promise<ListIsolationPoliciesResponse> {
		await this.ensureOptionalTenantAuthorized(params?.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/isolation/policies";
		const method = "GET";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams();
			if (params?.tenantId) {
				query.set("tenantId", params.tenantId);
			}
			if (params?.status) query.set("status", params.status);
			if (params?.limit) query.set("limit", String(params.limit));
			if (params?.cursor) query.set("cursor", params.cursor);

			const queryString = query.toString();
			const url = queryString
				? `${this.baseUrl}${route}?${queryString}`
				: `${this.baseUrl}${route}`;

			const response = await this.fetchWithRetry(
				url,
				{
					method,
					headers: { Authorization: `Bearer ${this.apiKey}` },
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return (await response.json()) as ListIsolationPoliciesResponse;
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "listIsolationPolicies",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Report an isolation violation.
	 */
	async reportViolation(input: ReportViolationRequest): Promise<IsolationViolation> {
		validateUUID(input.policyId, "policyId");
		await this.ensureTenantAuthorized(input.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/isolation/violations";
		const method = "POST";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify(input),
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return (await response.json()) as IsolationViolation;
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "reportViolation",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * Run isolation verification to check tenant data boundaries.
	 */
	async runIsolationVerification(
		input: RunIsolationVerificationRequest,
	): Promise<IsolationVerificationResult> {
		await this.ensureTenantAuthorized(input.tenantId);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/isolation/verify";
		const method = "POST";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const response = await this.fetchWithRetry(
				`${this.baseUrl}${route}`,
				{
					method,
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify(input),
					signal: controller.signal,
				},
				0,
			);
			httpStatus = response.status;
			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return (await response.json()) as IsolationVerificationResult;
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			clearTimeout(timer);
			if (this.telemetry) {
				this.telemetry.record({
					operation: "runIsolationVerification",
					method,
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}
}
