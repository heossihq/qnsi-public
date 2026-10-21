import Foundation

private let prefix = "/proxy/vault/v1"

private func vaultSegment(_ value: String) throws -> String {
    guard !value.isEmpty && value != "." && value != ".." else {
        throw QnsiError.api(message: "Invalid Vault resource identifier", statusCode: 400, code: "INVALID_RESOURCE_IDENTIFIER", body: nil)
    }
    return value.utf8.map { byte -> String in
        if (65...90).contains(byte) || (97...122).contains(byte) || (48...57).contains(byte) || [45, 46, 95, 126].contains(byte) { return String(UnicodeScalar(byte)) }
        return String(format: "%%%02X", byte)
    }.joined()
}

/// PQC-encrypted secret storage with versioning + rotation. Wraps vault-service `/vault/v1`.
public struct VaultClient: Sendable {
    let transport: Transport

    /// Create a PQC-encrypted secret. `payloadB64` is the base64-encoded plaintext.
    /// The backend `createSecretSchema` expects `{ name, payload, metadata }`
    /// (tenantId auto-injected); `algorithm` is folded into metadata.
    public func createSecret(
        name: String,
        payloadB64: String,
        algorithm: String? = nil,
        metadata: [String: JSONValue]? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var meta = metadata ?? [:]
        if let algorithm {
            meta["algorithm"] = .string(algorithm)
        }
        let body: JSONValue = .object([
            "name": .string(name),
            "payload": .string(payloadB64),
            "metadata": .object(meta),
        ])
        return try await transport.requestJson(
            "POST", "\(prefix)/secrets", body: body,
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func getSecret(secretId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/secrets/\(try vaultSegment(secretId))")
    }

    public func getSecretVersion(secretId: String, version: Int) async throws -> JSONValue {
        guard version > 0 else { throw QnsiError.api(message: "Secret version must be positive", statusCode: 400, code: "INVALID_SECRET_VERSION", body: nil) }
        return try await transport.requestJson("GET", "\(prefix)/secrets/\(try vaultSegment(secretId))/versions/\(version)")
    }

    /// Rotate a secret. The backend `rotateSecretSchema` expects `{ newPayload, metadata? }`.
    public func rotateSecret(
        secretId: String,
        payloadB64: String,
        algorithm: String? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        let encoded = try vaultSegment(secretId)
        var object: [String: JSONValue] = ["newPayload": .string(payloadB64)]
        if let algorithm {
            object["metadata"] = .object(["algorithm": .string(algorithm)])
        }
        return try await transport.requestJson(
            "POST", "\(prefix)/secrets/\(encoded)/rotate", body: .object(object),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func deleteSecret(secretId: String) async throws -> JSONValue {
        try await transport.requestJson("DELETE", "\(prefix)/secrets/\(try vaultSegment(secretId))")
    }

    public func listSecretVersions(secretId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/secrets/\(try vaultSegment(secretId))/versions")
    }

    /// Registration catalog, not independent provider-account assurance.
    public func listDynamicSecretEngines() async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/dynamic-secrets/engines")
    }

    /// Requires an approved connection reference, never inline administrator credentials.
    public func createDynamicSecretConfig(name: String, engineType: String, connectionRef: String,
        secretType: String? = nil, roleTemplate: [String: JSONValue]? = nil,
        defaultTtlSeconds: Int? = nil, maxTtlSeconds: Int? = nil,
        tenantId: String? = nil, idempotencyKey: String? = nil) async throws -> JSONValue {
        var body: [String: JSONValue] = ["name": .string(name), "engineType": .string(engineType), "connectionRef": .string(connectionRef)]
        if let secretType { body["secretType"] = .string(secretType) }
        if let roleTemplate { body["roleTemplate"] = .object(roleTemplate) }
        if let defaultTtlSeconds { body["defaultTtlSeconds"] = .number(Double(defaultTtlSeconds)) }
        if let maxTtlSeconds { body["maxTtlSeconds"] = .number(Double(maxTtlSeconds)) }
        if let tenantId { body["tenantId"] = .string(tenantId) }
        return try await transport.requestJson("POST", "\(prefix)/dynamic-secrets/configs", body: .object(body), options: RequestOptions(idempotencyKey: idempotencyKey))
    }

    public func listDynamicSecretConfigs(engineType: String? = nil, secretType: String? = nil) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/dynamic-secrets/configs", options: RequestOptions(query: ["engineType": engineType, "secretType": secretType]))
    }

    /// Returns engine-specific credential fields without inventing username/password fields.
    public func requestCredentials(configId: String, ttlSeconds: Int? = nil, metadata: [String: JSONValue]? = nil, idempotencyKey: String? = nil) async throws -> JSONValue {
        let encoded = try vaultSegment(configId)
        var body: [String: JSONValue] = [:]
        if let ttlSeconds { body["ttlSeconds"] = .number(Double(ttlSeconds)) }
        if let metadata { body["metadata"] = .object(metadata) }
        return try await transport.requestJson("POST", "\(prefix)/dynamic-secrets/configs/\(encoded)/credentials", body: .object(body), options: RequestOptions(idempotencyKey: idempotencyKey))
    }

    public func listLeases(configId: String, includeAllStatuses: Bool? = nil) async throws -> JSONValue {
        let encoded = try vaultSegment(configId)
        return try await transport.requestJson("GET", "\(prefix)/dynamic-secrets/configs/\(encoded)/leases", options: RequestOptions(query: ["includeAllStatuses": includeAllStatuses.map { String($0) }]))
    }

    public func renewLease(leaseId: String, ttlSeconds: Int? = nil) async throws -> JSONValue {
        let encoded = try vaultSegment(leaseId)
        var body: [String: JSONValue] = [:]
        if let ttlSeconds { body["ttlSeconds"] = .number(Double(ttlSeconds)) }
        return try await transport.requestJson("POST", "\(prefix)/dynamic-secrets/leases/\(encoded)/renew", body: .object(body))
    }

    /// Retains the revoking queue acknowledgement, not completed provider revocation.
    public func revokeLease(leaseId: String) async throws -> JSONValue {
        try await transport.requestJson("POST", "\(prefix)/dynamic-secrets/leases/\(try vaultSegment(leaseId))/revoke")
    }

    public func getDynamicSecretStats() async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/dynamic-secrets/stats")
    }
}
