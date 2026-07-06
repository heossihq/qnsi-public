/**
 * QNSP Search — encrypted vector search with SSE-X. Wraps
 * `apps/search-service` (`/search/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";

const PATH_PREFIX = "/proxy/search/v1";

export interface CreateIndexRequest {
	readonly name: string;
	readonly dimensions: number;
	readonly metric?: string; // "cosine" | "l2" | "dot"
	readonly algorithm?: string;
	readonly metadata?: Record<string, unknown>;
}

export interface Vector {
	readonly id: string;
	readonly values: readonly number[];
	readonly metadata?: Record<string, unknown>;
}

export interface QueryRequest {
	readonly vector: readonly number[];
	readonly topK: number;
	readonly filter?: Record<string, unknown>;
}

export class SearchClient {
	constructor(private readonly internal: Internal) {}

	createIndex(req: CreateIndexRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/indexes`, req, opts);
	}

	listIndexes() {
		return this.internal.request("GET", `${PATH_PREFIX}/indexes`);
	}

	async deleteIndex(indexName: string): Promise<void> {
		await this.internal.request("DELETE", `${PATH_PREFIX}/indexes/${indexName}`);
	}

	upsertVectors(
		indexName: string,
		vectors: readonly Vector[],
		opts?: Pick<RequestOptions, "idempotencyKey">,
	) {
		return this.internal.request(
			"POST",
			`${PATH_PREFIX}/indexes/${indexName}/vectors`,
			{ vectors },
			opts,
		);
	}

	query(indexName: string, req: QueryRequest) {
		return this.internal.request("POST", `${PATH_PREFIX}/indexes/${indexName}/query`, req);
	}
}
