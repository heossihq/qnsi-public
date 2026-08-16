import Foundation

private let prefix = "/proxy/crypto/v1"

/// Cryptographic asset inventory / CBOM. Wraps crypto-inventory-service `/crypto/v1`.
public struct CryptoInventoryClient: Sendable {
    let transport: Transport

    public func listAssets(query: [String: String?] = [:]) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/assets", options: RequestOptions(query: query))
    }

    public func getAsset(assetId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/assets/\(assetId)")
    }

    /// Asset stats for the activated tenant (tenantId is injected into the query).
    public func getAssetStats() async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/assets/stats")
    }

    /// Kick off a discovery run over the given targets/modes.
    public func discoverAssets(
        targets: [String]? = nil,
        modes: [String]? = nil,
        options: [String: JSONValue]? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = [:]
        if let targets { object["targets"] = .array(targets.map { .string($0) }) }
        if let modes { object["modes"] = .array(modes.map { .string($0) }) }
        if let options { object["options"] = .object(options) }
        return try await transport.requestJson(
            "POST", "\(prefix)/assets/discover", body: .object(object),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    /// PQC readiness score for the activated tenant (tenantId is injected into the query).
    public func getReadinessScore() async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/readiness")
    }
}
