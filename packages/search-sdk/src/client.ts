import { performance } from "node:perf_hooks";

import { activateSdk, type SdkActivationConfig } from "@heossi/qnsi-sdk-activation";
import { type RequestInit as UndiciRequestInit, fetch as undiciFetch } from "undici";

import type { SearchClientTelemetry, SearchClientTelemetryConfig } from "./observability.js";
import { createSearchClientTelemetry, isSearchClientTelemetry } from "./observability.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";
import { createSseToken, deriveDocumentSseTokens, deriveQuerySseTokens } from "./sse.js";
import type {
	AcknowledgeAlertRequest,
	CreateIsolationPolicyRequest,
	CreateMaintenanceWindowRequest,
	CreateSynonymGroupRequest,
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

	constructor(options: SearchClientOptions) {
		if (!options.apiKey || options.apiKey.trim().length === 0) {
			throw new Error(
				"QNSP Search SDK: apiKey is required. " +
					"Get your free API key at https://cloud.qnsi.heossi.com/signup — " +
					"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
					"Docs: https://docs.qnsi.heossi.com/sdk/search-sdk",
			);
		}
		const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");

		// Enforce HTTPS in production (allow HTTP for localhost in development and
		// for internal service-mesh hostnames — e.g. *.internal — which are on a
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
		// Auto-inject tenant ID header from activation response
		if (this.resolvedTenantId) {
			const headers = {
				...(init.headers as Record<string, string> | undefined),
				"x-qnsp-tenant-id": this.resolvedTenantId,
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
		await this.ensureActivated();
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
		validateUUID(params.tenantId, "tenantId");
		await this.ensureActivated();
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
		await this.ensureActivated();
		await Promise.all(documents.map((doc) => this.indexDocument(doc)));
	}

	/**
	 * Search with automatic SSE token derivation if key is configured.
	 * Falls back to plaintext query if SSE key is not available.
	 */
	async searchWithAutoSse(
		params: Omit<SearchQueryRequest, "sseTokens"> & { query: string },
	): Promise<SearchQueryResponse> {
		await this.ensureActivated();
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
		await this.ensureActivated();
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
		validateUUID(input.tenantId, "tenantId");
		await this.ensureActivated();
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
		await this.ensureActivated();
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
				validateUUID(params.tenantId, "tenantId");
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
		await this.ensureActivated();
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
				validateUUID(params.tenantId, "tenantId");
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
		await this.ensureActivated();
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
				validateUUID(params.tenantId, "tenantId");
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
		validateUUID(input.tenantId, "tenantId");
		await this.ensureActivated();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/synonyms/groups";
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
			return (await response.json()) as SynonymGroup;
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
		validateUUID(params.tenantId, "tenantId");
		await this.ensureActivated();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/synonyms/groups";
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
			if (params.cursor) query.set("cursor", params.cursor);

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
			return (await response.json()) as ListSynonymGroupsResponse;
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
		const route = `/search/v1/synonyms/groups/${groupId}`;
		const method = "PATCH";
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
			return (await response.json()) as SynonymGroup;
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
					route: "/search/v1/synonyms/groups/:groupId",
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
		const route = `/search/v1/synonyms/groups/${groupId}`;
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
					route: "/search/v1/synonyms/groups/:groupId",
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
		validateUUID(params.tenantId, "tenantId");
		await this.ensureActivated();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/synonyms/expand";
		const method = "GET";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams();
			query.set("tenantId", params.tenantId);
			query.set("term", params.term);
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
			return (await response.json()) as ExpandTermResponse;
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
		validateUUID(input.tenantId, "tenantId");
		await this.ensureActivated();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/synonyms/import";
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
			return (await response.json()) as ImportSynonymsResponse;
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
		validateUUID(params.tenantId, "tenantId");
		await this.ensureActivated();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/synonyms/export";
		const method = "GET";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams();
			query.set("tenantId", params.tenantId);
			query.set("format", params.format);
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
			return (await response.json()) as ExportSynonymsResponse;
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
		validateUUID(input.tenantId, "tenantId");
		await this.ensureActivated();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/health/snapshots";
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
			return (await response.json()) as IndexHealthSnapshot;
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
	async getIndexHealth(params: GetIndexHealthRequest): Promise<IndexHealthSnapshot> {
		validateUUID(params.tenantId, "tenantId");
		await this.ensureActivated();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/health";
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
			return (await response.json()) as IndexHealthSnapshot;
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
		await this.ensureActivated();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/health/alerts";
		const method = "GET";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const query = new URLSearchParams();
			if (params?.tenantId) {
				validateUUID(params.tenantId, "tenantId");
				query.set("tenantId", params.tenantId);
			}
			if (params?.status) query.set("status", params.status);
			if (params?.severity) query.set("severity", params.severity);
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
			return (await response.json()) as ListHealthAlertsResponse;
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
		await this.ensureActivated();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = `/search/v1/health/alerts/${input.alertId}/acknowledge`;
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
					body: JSON.stringify({
						acknowledgedBy: input.acknowledgedBy,
						...(input.note !== undefined ? { note: input.note } : {}),
					}),
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
			return (await response.json()) as HealthAlert;
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
					route: "/search/v1/health/alerts/:alertId/acknowledge",
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
		validateUUID(input.tenantId, "tenantId");
		await this.ensureActivated();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);
		const route = "/search/v1/health/maintenance";
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
			return (await response.json()) as MaintenanceWindow;
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
		validateUUID(input.tenantId, "tenantId");
		await this.ensureActivated();
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
		await this.ensureActivated();
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
				validateUUID(params.tenantId, "tenantId");
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
		validateUUID(input.tenantId, "tenantId");
		validateUUID(input.policyId, "policyId");
		await this.ensureActivated();
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
		validateUUID(input.tenantId, "tenantId");
		await this.ensureActivated();
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
