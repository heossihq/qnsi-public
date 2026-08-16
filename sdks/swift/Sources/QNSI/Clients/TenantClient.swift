import Foundation

private let prefix = "/proxy/tenant/v1"

/// Tenant CRUD, crypto-policy, current health/quotas. Wraps tenant-service `/tenant/v1`.
public struct TenantClient: Sendable {
    let transport: Transport

    /// Provision a tenant.
    public func createTenant(
        name: String,
        slug: String? = nil,
        tier: String? = nil,
        parentTenantId: String? = nil,
        metadata: [String: JSONValue]? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = ["name": .string(name)]
        if let slug { object["slug"] = .string(slug) }
        if let tier { object["tier"] = .string(tier) }
        if let parentTenantId { object["parentTenantId"] = .string(parentTenantId) }
        if let metadata { object["metadata"] = .object(metadata) }
        return try await transport.requestJson(
            "POST", "\(prefix)/tenants", body: .object(object),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func getTenant(tenantId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/tenants/\(tenantId)")
    }

    public func updateTenant(
        tenantId: String,
        body: [String: JSONValue],
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        try await transport.requestJson(
            "PATCH", "\(prefix)/tenants/\(tenantId)", body: .object(body),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func listTenants(query: [String: String?] = [:]) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/tenants", options: RequestOptions(query: query))
    }

    public func getCryptoPolicy(tenantId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/tenants/\(tenantId)/crypto-policy")
    }

    public func upsertCryptoPolicy(
        tenantId: String,
        body: [String: JSONValue],
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        try await transport.requestJson(
            "PUT", "\(prefix)/tenants/\(tenantId)/crypto-policy", body: .object(body),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func getCurrentHealth(tenantId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/tenants/\(tenantId)/health")
    }

    public func getCurrentQuotas(tenantId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/tenants/\(tenantId)/quotas")
    }
}
