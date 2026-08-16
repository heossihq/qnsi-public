import Foundation

private let prefix = "/proxy/vault/v1"

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
        try await transport.requestJson("GET", "\(prefix)/secrets/\(secretId)")
    }

    public func getSecretVersion(secretId: String, version: Int) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/secrets/\(secretId)/versions/\(version)")
    }

    /// Rotate a secret. The backend `rotateSecretSchema` expects `{ newPayload, metadata? }`.
    public func rotateSecret(
        secretId: String,
        payloadB64: String,
        algorithm: String? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = ["newPayload": .string(payloadB64)]
        if let algorithm {
            object["metadata"] = .object(["algorithm": .string(algorithm)])
        }
        return try await transport.requestJson(
            "POST", "\(prefix)/secrets/\(secretId)/rotate", body: .object(object),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func deleteSecret(secretId: String) async throws -> JSONValue {
        try await transport.requestJson("DELETE", "\(prefix)/secrets/\(secretId)")
    }

    public func listSecretVersions(secretId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/secrets/\(secretId)/versions")
    }
}
