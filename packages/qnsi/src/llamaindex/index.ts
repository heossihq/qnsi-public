import { bridgeQnsiEnv } from "../internal/env-aliases.js";

// Accept canonical environment variables and legacy-prefixed aliases.
bridgeQnsiEnv();

/**
 * `@heossihq/qnsi/llamaindex` - LlamaIndex adapters for QNSI.
 *
 * PQC-encrypted vector store backed by QNSI search-service (SSE-X). Folded in
 * from the former standalone `former standalone LlamaIndex integration package` (2026-05-16).
 *
 * @example
 * ```typescript
 * import { QnsiVectorStore } from "@heossihq/qnsi/llamaindex";
 *
 * const store = new QnsiVectorStore({ apiKey: process.env.QNSI_API_KEY });
 * ```
 */

export type {
	QnsiVectorStoreConfig,
	SearchSecurityEnvelope,
	TextNode,
	VectorStoreQuery,
	VectorStoreQueryResult,
} from "./vector-store.js";
export { QnsiVectorStore } from "./vector-store.js";
