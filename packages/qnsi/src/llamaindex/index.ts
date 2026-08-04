import { bridgeQnsiEnv } from "../internal/env-aliases.js";

// Accept both QNSI_* (canonical) and legacy QNSP_* user env vars.
bridgeQnsiEnv();

/**
 * `@heossihq/qnsi/llamaindex` - LlamaIndex adapters for QNSP.
 *
 * PQC-encrypted vector store backed by QNSP search-service (SSE-X). Folded in
 * from the former standalone `@heossihq/qnsi-llamaindex-qnsp` (2026-05-16).
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
