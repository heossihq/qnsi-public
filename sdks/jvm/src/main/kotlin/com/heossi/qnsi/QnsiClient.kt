package com.heossi.qnsi

import com.heossi.qnsi.internal.ActivationLimits
import com.heossi.qnsi.internal.Internal

/**
 * Entry point to the Quantum-Native Security Infrastructure (QNSI).
 *
 * One client owns one OkHttp connection pool and one activation cache. The
 * eleven service sub-clients (vault, kms, audit, auth, tenant, access, billing,
 * cryptoInventory, storage, search, ai) are added in Phase 2 and share both.
 * Mirrors the `@heossihq/qnsp` (npm), `qnsp` (PyPI), and Go/Rust SDKs.
 *
 * Kotlin:
 * ```kotlin
 * val qnsp = QnsiClient(System.getenv("QNSP_API_KEY"))
 * qnsp.ensureActivated()            // surfaces an invalid key at startup
 * println("tenant=${qnsp.tenantId()} tier=${qnsp.tier()}")
 * ```
 *
 * Java:
 * ```java
 * QnsiClient qnsp = new QnsiClient(System.getenv("QNSP_API_KEY"));
 * qnsp.ensureActivated();
 * System.out.println("tier=" + qnsp.tier());
 * ```
 */
public class QnsiClient @JvmOverloads constructor(
    apiKey: String,
    baseUrl: String = DEFAULT_BASE_URL,
    timeoutMs: Long = DEFAULT_TIMEOUT_MS,
) {
    private val internal: Internal

    /** PQC-encrypted secret storage (vault-service). */
    public val vault: VaultClient

    /** Server-side PQC key management - sign/verify/wrap/unwrap (kms-service). */
    public val kms: KmsClient

    /** Immutable, hash-chained audit log (audit-service). */
    public val audit: AuditClient

    /** Authentication: JWT, passkeys, MFA, federation, risk (auth-service). */
    public val auth: AuthClient

    /** Tenant CRUD + crypto-policy + health/quotas (tenant-service). */
    public val tenant: TenantClient

    /** RBAC roles, permissions, assignments (access-control-service). */
    public val access: AccessClient

    /** Entitlements, usage meters, invoices, credits (billing-service). */
    public val billing: BillingClient

    /** Cryptographic asset inventory / CBOM (crypto-inventory-service). */
    public val cryptoInventory: CryptoInventoryClient

    /** PQC-encrypted object storage with SSE-X (storage-service). */
    public val storage: StorageClient

    /** Encrypted vector search with SSE-X (search-service). */
    public val search: SearchClient

    /** AI workload orchestration, inference, model registry (ai-orchestrator). */
    public val ai: AiClient

    init {
        if (apiKey.isBlank()) {
            throw QnsiAuthException("api key required (sign up at https://cloud.qnsi.heossi.com/auth)")
        }
        val t = Internal(apiKey = apiKey, baseUrlRaw = baseUrl, timeoutMs = timeoutMs)
        internal = t
        vault = VaultClient(t)
        kms = KmsClient(t)
        audit = AuditClient(t)
        auth = AuthClient(t)
        tenant = TenantClient(t)
        access = AccessClient(t)
        billing = BillingClient(t)
        cryptoInventory = CryptoInventoryClient(t)
        storage = StorageClient(t)
        search = SearchClient(t)
        ai = AiClient(t)
    }

    /** Force the activation handshake now; surfaces an invalid API key eagerly. */
    public fun ensureActivated() {
        internal.ensureActivated()
    }

    /** Tenant ID resolved by activation. */
    public fun tenantId(): String = internal.ensureActivated().tenantId

    /** Plan tier resolved by activation (e.g. `"free"`, `"business-team"`). */
    public fun tier(): String = internal.ensureActivated().tier

    /** Tier limits resolved by activation. */
    public fun limits(): ActivationLimits = internal.ensureActivated().limits

    public companion object {
        /** Default QNSI edge-gateway URL. */
        public const val DEFAULT_BASE_URL: String = "https://api.qnsi.heossi.com"

        /** Default per-request timeout in milliseconds. */
        public const val DEFAULT_TIMEOUT_MS: Long = 15_000L
    }
}
