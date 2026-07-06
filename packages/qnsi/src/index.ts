/**
 * `@heossi/qnsi` — official Node.js / TypeScript SDK for the
 * Quantum-Native Security Infrastructure.
 *
 * Single package covering vault, kms, audit, auth, tenant, access,
 * billing, crypto-inventory, storage, search, and ai-orchestrator,
 * plus webhook signature verification. Mirrors the `qnsp` Python /
 * Go / Rust SDK surface byte-for-byte.
 *
 * @example
 * ```ts
 * import { QnsiClient } from "@heossi/qnsi";
 *
 * const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
 *
 * // Vault
 * const secret = await qnsi.vault.createSecret({
 *   name: "openai-api-key",
 *   payloadB64: Buffer.from("sk-...").toString("base64"),
 *   algorithm: "ml-kem-768",
 * });
 *
 * // KMS
 * const key = await qnsi.kms.createKey({ algorithm: "ml-dsa-65", purpose: "signing" });
 * const sig = await qnsi.kms.sign(key.keyId, new TextEncoder().encode("hello"));
 *
 * // Audit
 * await qnsi.audit.logEvent({
 *   eventType: "model.inference",
 *   payload: { modelId: "gpt-4o", latencyMs: 412 },
 * });
 * ```
 *
 * Sign up for a free QNSI account at https://cloud.qnsi.heossi.com/auth.
 */

export {
	AccessClient,
	type AssignRoleRequest,
	type CheckPermissionRequest,
	type CreateRoleRequest,
} from "./access.js";
export {
	AiClient,
	type InferenceRequest,
	type RegisterArtifactRequest,
	type RegisterModelRequest,
	type SubmitWorkloadRequest,
} from "./ai.js";
export { AuditClient, type LogEventRequest } from "./audit.js";
export { AuthClient, type LoginRequest } from "./auth.js";
export { BillingClient, type IngestMeterRequest } from "./billing.js";
// QnsiClient is the canonical name (product is QNSI). QnspClient is kept as a
// @deprecated back-compat alias for consumers on the pre-rebrand name.
export {
	QnsiClient,
	/** @deprecated Use `QnsiClient`. Kept for pre-rebrand consumers. */
	QnsiClient as QnspClient,
	type QnsiClientOptions,
	/** @deprecated Use `QnsiClientOptions`. */
	type QnsiClientOptions as QnspClientOptions,
} from "./client.js";
export { CryptoInventoryClient, type DiscoverAssetsRequest } from "./crypto-inventory.js";
export {
	QnsiApiError,
	/** @deprecated Use `QnsiApiError`. */
	QnsiApiError as QnspApiError,
	QnsiAuthError,
	/** @deprecated Use `QnsiAuthError`. */
	QnsiAuthError as QnspAuthError,
	QnsiError,
	/** @deprecated Use `QnsiError`. */
	QnsiError as QnspError,
	QnsiNetworkError,
	/** @deprecated Use `QnsiNetworkError`. */
	QnsiNetworkError as QnspNetworkError,
	QnsiWebhookError,
	/** @deprecated Use `QnsiWebhookError`. */
	QnsiWebhookError as QnspWebhookError,
} from "./errors.js";
export { type CreateKeyRequest, KmsClient } from "./kms.js";
export {
	type CreateIndexRequest,
	type QueryRequest,
	SearchClient,
	type Vector,
} from "./search.js";
export { type PutObjectInput, StorageClient } from "./storage.js";
export { type CreateTenantRequest, TenantClient } from "./tenant.js";
// Service classes — exported so callers can construct mocks for testing.
export { type CreateSecretRequest, VaultClient } from "./vault.js";
export {
	MAX_WEBHOOK_SKEW_MS,
	parseQnsiWebhook,
	/** @deprecated Use `parseQnsiWebhook`. */
	parseQnsiWebhook as parseQnspWebhook,
	type QnsiWebhookEvent,
	/** @deprecated Use `QnsiWebhookEvent`. */
	type QnsiWebhookEvent as QnspWebhookEvent,
	verifyQnsiWebhookSignature,
	/** @deprecated Use `verifyQnsiWebhookSignature`. */
	verifyQnsiWebhookSignature as verifyQnspWebhookSignature,
} from "./webhooks.js";
