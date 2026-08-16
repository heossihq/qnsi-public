import Foundation

/// Entry point to the Quantum-Native Security Infrastructure (QNSI).
///
/// One client owns one URLSession and one activation cache. The eleven service
/// sub-clients (vault, kms, audit, auth, tenant, access, billing, cryptoInventory,
/// storage, search, ai) share both. Mirrors the `@heossihq/qnsp` (npm), `qnsp`
/// (PyPI), Go/Rust, and `com.heossi:qnsi` (JVM) SDKs.
///
/// ```swift
/// let qnsi = try QnsiClient(apiKey: ProcessInfo.processInfo.environment["QNSP_API_KEY"] ?? "")
/// try await qnsi.ensureActivated()   // surfaces an invalid key at startup
/// print("tenant=\(try await qnsi.tenantId()) tier=\(try await qnsi.tier())")
/// ```
///
/// On-device PQC (CryptoKit ML-KEM / ML-DSA, iOS 26+/macOS 26+) is exposed via
/// `QnsiDevicePqc` and fails closed below the OS floor.
public final class QnsiClient: Sendable {
    /// Default QNSI edge-gateway URL.
    public static let defaultBaseUrl = "https://api.qnsi.heossi.com"

    /// Default per-request timeout in seconds.
    public static let defaultTimeout: TimeInterval = 15

    let transport: Transport

    /// PQC-encrypted secret storage (vault-service).
    public let vault: VaultClient

    /// Server-side PQC key management: sign/verify/wrap/unwrap (kms-service).
    public let kms: KmsClient

    /// Immutable, hash-chained audit log (audit-service).
    public let audit: AuditClient

    /// Authentication: JWT, MFA, risk (auth-service).
    public let auth: AuthClient

    /// Tenant CRUD + crypto-policy + health/quotas (tenant-service).
    public let tenant: TenantClient

    /// RBAC roles, permissions, assignments (access-control-service).
    public let access: AccessClient

    /// Entitlements, usage meters, invoices, credits (billing-service).
    public let billing: BillingClient

    /// Cryptographic asset inventory / CBOM (crypto-inventory-service).
    public let cryptoInventory: CryptoInventoryClient

    /// PQC-encrypted object storage with SSE-X (storage-service).
    public let storage: StorageClient

    /// Encrypted vector search with SSE-X (search-service).
    public let search: SearchClient

    /// AI workload orchestration, inference, model registry (ai-orchestrator).
    public let ai: AiClient

    /// Create a client. Throws `QnsiError.auth` when the API key is blank.
    public init(
        apiKey: String,
        baseUrl: String = QnsiClient.defaultBaseUrl,
        timeout: TimeInterval = QnsiClient.defaultTimeout,
        sessionConfiguration: URLSessionConfiguration = .ephemeral
    ) throws {
        guard !apiKey.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw QnsiError.auth(
                message: "api key required (sign up at https://cloud.qnsi.heossi.com/auth)",
                code: "MISSING_API_KEY"
            )
        }
        let transport = Transport(
            apiKey: apiKey, baseUrl: baseUrl, timeout: timeout, configuration: sessionConfiguration
        )
        self.transport = transport
        vault = VaultClient(transport: transport)
        kms = KmsClient(transport: transport)
        audit = AuditClient(transport: transport)
        auth = AuthClient(transport: transport)
        tenant = TenantClient(transport: transport)
        access = AccessClient(transport: transport)
        billing = BillingClient(transport: transport)
        cryptoInventory = CryptoInventoryClient(transport: transport)
        storage = StorageClient(transport: transport)
        search = SearchClient(transport: transport)
        ai = AiClient(transport: transport)
    }

    /// Force the activation handshake now; surfaces an invalid API key eagerly.
    public func ensureActivated() async throws {
        _ = try await transport.ensureActivated()
    }

    /// Tenant ID resolved by activation.
    public func tenantId() async throws -> String {
        try await transport.ensureActivated().tenantId
    }

    /// Plan tier resolved by activation (e.g. `"free"`, `"business-team"`).
    public func tier() async throws -> String {
        try await transport.ensureActivated().tier
    }

    /// Tier limits resolved by activation.
    public func limits() async throws -> ActivationLimits {
        try await transport.ensureActivated().limits
    }
}
