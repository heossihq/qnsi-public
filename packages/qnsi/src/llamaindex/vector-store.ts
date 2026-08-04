/**
 * QNSP Vector Store for LlamaIndex - `@heossihq/qnsi/llamaindex` subpath.
 *
 * PQC-encrypted semantic search backed by QNSP search-service (SSE-X).
 * LlamaIndex `VectorStore`-compatible without importing `llamaindex`.
 *
 * Folded in from the former standalone `@heossihq/qnsi-llamaindex-qnsp`
 * (2026-05-16). The search-service HTTP (`indexDocument` POST
 * `/search/v1/documents/index`, `search` GET `/search/v1/documents`, 429
 * retry w/ backoff + `x-qnsp-tenant-id` header) is inlined here faithfully
 * from the former `@heossihq/qnsi-search-sdk`, and SSE-X auto-token derivation
 * uses the inlined `./sse.js` - so this subpath has no `@heossihq/qnsi-*`
 * workspace dependency (same pattern as `../_activation`). A single
 * activation (sdkId `llamaindex-qnsp`) resolves the tenant; that tenant id is
 * sent both in the request and the `x-qnsp-tenant-id` header.
 */

import { z } from "zod";

import { activateSdk } from "../_activation/index.js";
import { bridgeQnsiEnv } from "../internal/env-aliases.js";
import { deriveDocumentSseTokens, deriveQuerySseTokens } from "./sse.js";

// Accept both QNSI_* (canonical) and legacy QNSP_* user env vars.
bridgeQnsiEnv();

const SDK_VERSION = "0.3.0";
const SDK_ID = "llamaindex-qnsi";
const DEFAULT_BASE_URL = "https://api.qnsi.heossi.com";

async function resolveActivationTenantId(apiKey: string, baseUrl: string): Promise<string> {
	const activation = await activateSdk({
		apiKey,
		sdkId: SDK_ID,
		sdkVersion: SDK_VERSION,
		platformUrl: baseUrl,
	});
	return activation.tenantId;
}

// ─── Faithful search-service types (ported from @heossihq/qnsi-search-sdk) ──────

export interface SearchSecurityEnvelope {
	readonly controlPlaneTokenSha256: string | null;
	readonly pqcSignatures: ReadonlyArray<{
		readonly provider: string;
		readonly algorithm: string;
		readonly value: string;
		readonly publicKey: string;
	}>;
	readonly hardwareProvider: string | null;
	readonly attestationStatus: string | null;
	readonly attestationProof: string | null;
}

interface IndexDocumentRequest {
	readonly tenantId: string;
	readonly documentId: string;
	readonly version: string;
	readonly sourceService: string;
	readonly title?: string | null;
	readonly description?: string | null;
	readonly body?: string | null;
	readonly tags?: readonly string[];
	readonly language?: string;
	readonly metadata?: Record<string, unknown>;
	readonly security: SearchSecurityEnvelope;
	readonly signature: {
		readonly provider: string;
		readonly algorithm: string;
		readonly value: string;
		readonly publicKey: string;
	};
	readonly sseTokens?: readonly string[];
}

interface SearchDocumentHit {
	readonly tenantId: string;
	readonly documentId: string;
	readonly version: string;
	readonly title: string | null;
	readonly description: string | null;
	readonly tags: string[];
	readonly metadata: Record<string, unknown>;
	readonly score: number;
	readonly updatedAt: string;
}

interface SearchQueryResponse {
	readonly items: SearchDocumentHit[];
	readonly nextCursor: string | null;
}

// ─── LlamaIndex-compatible types (no llamaindex import required) ───────────────

export interface TextNode {
	readonly id_: string;
	readonly text: string;
	readonly metadata?: Record<string, unknown>;
	readonly embedding?: readonly number[];
}

export interface VectorStoreQuery {
	readonly queryStr?: string;
	readonly queryEmbedding?: readonly number[];
	readonly similarityTopK?: number;
}

export interface VectorStoreQueryResult {
	readonly nodes: TextNode[];
	readonly similarities: number[];
	readonly ids: string[];
}

export interface QnsiVectorStoreConfig {
	/**
	 * QNSP API key. Get one at https://cloud.qnsi.heossi.com/api-keys
	 * The API key carries the tenant ID internally - no separate tenantId needed.
	 */
	readonly apiKey: string;
	/**
	 * Tenant ID for all search operations. Optional - resolved automatically
	 * from the API key via SDK activation when omitted.
	 */
	readonly tenantId?: string;
	/** Source service label used when indexing documents. Defaults to "llamaindex-qnsp". */
	readonly sourceService?: string;
	/** Base URL for the QNSP API. Defaults to https://api.qnsi.heossi.com */
	readonly baseUrl?: string;
	/** Request timeout in milliseconds. Defaults to 15000. */
	readonly timeoutMs?: number;
	/**
	 * Optional SSE key for encrypted search tokens. When provided, all index
	 * and query operations derive SSE-X encrypted tokens automatically.
	 */
	readonly sseKey?: Uint8Array | string;
}

// ─── Zod schema for validating search hits ────────────────────────────────────

const searchHitSchema = z.object({
	documentId: z.string(),
	title: z.string().nullable(),
	description: z.string().nullable(),
	metadata: z.record(z.string(), z.unknown()),
	score: z.number(),
});

// ─── Null PQC envelope helpers ────────────────────────────────────────────────
// The edge gateway fills in PQC signatures for API key callers server-side.

const NULL_SECURITY_ENVELOPE: SearchSecurityEnvelope = {
	controlPlaneTokenSha256: null,
	pqcSignatures: [],
	hardwareProvider: null,
	attestationStatus: null,
	attestationProof: null,
};

const NULL_SIGNATURE = {
	provider: "none",
	algorithm: "none",
	value: "",
	publicKey: "",
} as const;

// ─── Inlined faithful search-service HTTP (from @heossihq/qnsi-search-sdk) ──────

function assertHttpsOrLocal(baseUrl: string): void {
	if (baseUrl.startsWith("https://")) return;
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
		// ignore; invalid URL caught later by fetch
	}
	const isDevelopment =
		process.env["NODE_ENV"] === "development" || process.env["NODE_ENV"] === "test";
	if ((!isLocalhost || !isDevelopment) && !isInternalService) {
		throw new Error(
			"baseUrl must use HTTPS in production. HTTP is only allowed for localhost in development.",
		);
	}
}

class SearchTransport {
	readonly #baseUrl: string;
	readonly #apiKey: string;
	readonly #timeoutMs: number;
	readonly #maxRetries: number;
	readonly #retryDelayMs: number;
	readonly #sseKey: Uint8Array | string | null;
	#tenantId: string | null = null;

	constructor(opts: {
		baseUrl: string;
		apiKey: string;
		timeoutMs: number;
		sseKey: Uint8Array | string | null;
	}) {
		const baseUrl = opts.baseUrl.replace(/\/$/, "");
		assertHttpsOrLocal(baseUrl);
		this.#baseUrl = baseUrl;
		this.#apiKey = opts.apiKey;
		this.#timeoutMs = opts.timeoutMs;
		this.#maxRetries = 3;
		this.#retryDelayMs = 1_000;
		this.#sseKey = opts.sseKey;
	}

	setTenantId(tenantId: string): void {
		this.#tenantId = tenantId;
	}

	get sseKey(): Uint8Array | string | null {
		return this.#sseKey;
	}

	async #fetchWithRetry(url: string, init: RequestInit, attempt: number): Promise<Response> {
		const headers: Record<string, string> = {
			...(init.headers as Record<string, string> | undefined),
		};
		if (this.#tenantId) {
			headers["x-qnsp-tenant-id"] = this.#tenantId;
		}
		const response = await fetch(url, { ...init, headers });
		if (response.status === 429) {
			if (attempt < this.#maxRetries) {
				const retryAfterHeader = response.headers.get("Retry-After");
				let delayMs = this.#retryDelayMs;
				if (retryAfterHeader) {
					const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
					if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
						delayMs = retryAfterSeconds * 1_000;
					}
				} else {
					delayMs = Math.min(2 ** attempt * this.#retryDelayMs, 30_000);
				}
				await new Promise((resolve) => setTimeout(resolve, delayMs));
				return this.#fetchWithRetry(url, init, attempt + 1);
			}
			throw new Error(`Search API error: Rate limit exceeded after ${this.#maxRetries} retries`);
		}
		return response;
	}

	async indexDocument(input: IndexDocumentRequest): Promise<void> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
		try {
			const response = await this.#fetchWithRetry(
				`${this.#baseUrl}/search/v1/documents/index`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.#apiKey}`,
					},
					body: JSON.stringify(input),
					signal: controller.signal,
				},
				0,
			);
			if (!response.ok) {
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
		} finally {
			clearTimeout(timer);
		}
	}

	async search(params: {
		tenantId: string;
		query?: string;
		limit?: number;
		cursor?: string | null;
		language?: string;
		sseTokens?: readonly string[];
	}): Promise<SearchQueryResponse> {
		if (!params.query && (!params.sseTokens || params.sseTokens.length === 0)) {
			throw new Error("search query requires either plaintext query or SSE tokens");
		}
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
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
			const response = await this.#fetchWithRetry(
				`${this.#baseUrl}/search/v1/documents?${query.toString()}`,
				{
					method: "GET",
					headers: { Authorization: `Bearer ${this.#apiKey}` },
					signal: controller.signal,
				},
				0,
			);
			if (!response.ok) {
				throw new Error(`Search API error: ${response.status} ${response.statusText}`);
			}
			return (await response.json()) as SearchQueryResponse;
		} finally {
			clearTimeout(timer);
		}
	}

	async indexDocumentWithAutoSse(document: Omit<IndexDocumentRequest, "sseTokens">): Promise<void> {
		const sseTokens = this.#sseKey
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
					this.#sseKey,
					{ includeContent: true, includeBody: true },
				)
			: undefined;
		const request: IndexDocumentRequest = {
			...document,
			...(sseTokens !== undefined ? { sseTokens } : {}),
		};
		return this.indexDocument(request);
	}

	async searchWithAutoSse(params: {
		tenantId: string;
		query: string;
		limit?: number;
	}): Promise<SearchQueryResponse> {
		const sseTokens = this.#sseKey ? deriveQuerySseTokens(params.query, this.#sseKey) : undefined;
		return this.search({
			...params,
			...(sseTokens !== undefined ? { sseTokens } : {}),
		});
	}
}

// ─── QnsiVectorStore ──────────────────────────────────────────────────────────

/**
 * LlamaIndex-compatible vector store backed by QNSP encrypted search (SSE-X).
 *
 * @example
 * ```typescript
 * import { QnsiVectorStore } from "@heossihq/qnsi/llamaindex";
 *
 * const store = new QnsiVectorStore({ apiKey: process.env.QNSI_API_KEY });
 * await store.add([{ id_: "doc-1", text: "Quantum-safe overview", metadata: {} }]);
 * const result = await store.query({ queryStr: "post-quantum cryptography" });
 * ```
 */
export class QnsiVectorStore {
	readonly #transport: SearchTransport;
	readonly #sourceService: string;
	readonly #apiKey: string;
	readonly #baseUrl: string;
	#resolvedTenantId: string | null;
	#activationPromise: Promise<void> | null = null;

	constructor(config: QnsiVectorStoreConfig) {
		this.#resolvedTenantId = config.tenantId ?? null;
		this.#sourceService = config.sourceService ?? "llamaindex-qnsp";
		this.#apiKey = config.apiKey;
		this.#baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
		this.#transport = new SearchTransport({
			baseUrl: this.#baseUrl,
			apiKey: config.apiKey,
			timeoutMs: config.timeoutMs ?? 15_000,
			sseKey: config.sseKey ?? null,
		});
		if (this.#resolvedTenantId) {
			this.#transport.setTenantId(this.#resolvedTenantId);
		}
	}

	async #ensureTenantId(): Promise<string> {
		if (this.#resolvedTenantId) {
			return this.#resolvedTenantId;
		}
		if (!this.#activationPromise) {
			this.#activationPromise = resolveActivationTenantId(this.#apiKey, this.#baseUrl).then(
				(tenantId) => {
					this.#resolvedTenantId = tenantId;
					this.#transport.setTenantId(tenantId);
				},
			);
		}
		await this.#activationPromise;
		if (!this.#resolvedTenantId) {
			throw new Error(
				"QNSP LlamaIndex: tenantId could not be resolved. Ensure your API key is valid.",
			);
		}
		return this.#resolvedTenantId;
	}

	/**
	 * Add nodes to the QNSP encrypted search index. Returns indexed node IDs.
	 */
	async add(nodes: TextNode[]): Promise<string[]> {
		if (nodes.length === 0) {
			return [];
		}
		const tenantId = await this.#ensureTenantId();
		await Promise.all(
			nodes.map((node) =>
				this.#transport.indexDocumentWithAutoSse({
					tenantId,
					documentId: node.id_,
					version: "1",
					sourceService: this.#sourceService,
					title: node.id_,
					description: null,
					body: node.text,
					tags: [],
					metadata: node.metadata ?? {},
					security: NULL_SECURITY_ENVELOPE,
					signature: NULL_SIGNATURE,
				}),
			),
		);
		return nodes.map((n) => n.id_);
	}

	/**
	 * Query the QNSP encrypted search index. Uses SSE-X token derivation when
	 * an SSE key is configured.
	 */
	async query(query: VectorStoreQuery): Promise<VectorStoreQueryResult> {
		const queryStr = query.queryStr ?? "";
		if (!queryStr) {
			return { nodes: [], similarities: [], ids: [] };
		}
		const tenantId = await this.#ensureTenantId();
		const limit = query.similarityTopK ?? 10;

		const response = await this.#transport.searchWithAutoSse({
			tenantId,
			query: queryStr,
			limit,
		});

		const nodes: TextNode[] = [];
		const similarities: number[] = [];
		const ids: string[] = [];

		for (const hit of response.items) {
			const parsed = searchHitSchema.safeParse(hit);
			if (!parsed.success) {
				continue;
			}
			const { documentId, title, metadata, score } = parsed.data;
			nodes.push({
				id_: documentId,
				text: title ?? documentId,
				metadata,
			});
			similarities.push(score);
			ids.push(documentId);
		}

		return { nodes, similarities, ids };
	}

	/**
	 * Remove a node from the search index by document ID.
	 *
	 * QNSP search-service does not expose a delete-document endpoint; this
	 * re-indexes the document with empty content and a "__deleted__" tag so it
	 * no longer matches queries (tombstone).
	 */
	async delete(nodeId: string): Promise<void> {
		const tenantId = await this.#ensureTenantId();
		await this.#transport.indexDocumentWithAutoSse({
			tenantId,
			documentId: nodeId,
			version: "deleted",
			sourceService: this.#sourceService,
			title: null,
			description: null,
			body: null,
			tags: ["__deleted__"],
			metadata: { deleted: true, deletedAt: new Date().toISOString() },
			security: NULL_SECURITY_ENVELOPE,
			signature: NULL_SIGNATURE,
		});
	}
}
