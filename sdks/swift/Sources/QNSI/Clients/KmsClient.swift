import Foundation

private let prefix = "/proxy/kms/v1"

/// Server-side PQC keys: create / rotate / sign / verify / wrap / unwrap.
/// Wraps kms-service `/kms/v1`.
public struct KmsClient: Sendable {
    let transport: Transport

    /// Create a server-side PQC key. `purpose` is one of `"signing"`, `"encryption"`, `"kem"`.
    /// The backend `createKeySchema` is `{ tenantId(auto), keyId(required), keyType(required),
    /// algorithm, metadata }`; `purpose` is folded into metadata, a keyId is generated,
    /// and keyType defaults to `"data"` (mirrors the JVM SDK's verified wire contract).
    public func createKey(
        algorithm: String,
        purpose: String,
        metadata: [String: JSONValue]? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var meta = metadata ?? [:]
        meta["purpose"] = .string(purpose)
        let body: JSONValue = .object([
            "keyId": .string(UUID().uuidString.lowercased()),
            "keyType": .string("data"),
            "algorithm": .string(algorithm),
            "metadata": .object(meta),
        ])
        return try await transport.requestJson(
            "POST", "\(prefix)/keys", body: body,
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func listKeys(query: [String: String?] = [:]) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/keys", options: RequestOptions(query: query))
    }

    public func getKey(keyId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/keys/\(keyId)")
    }

    public func rotateKey(keyId: String, idempotencyKey: String? = nil) async throws -> JSONValue {
        try await transport.requestJson(
            "POST", "\(prefix)/keys/\(keyId)/rotate",
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func deleteKey(keyId: String) async throws -> JSONValue {
        try await transport.requestJson("DELETE", "\(prefix)/keys/\(keyId)")
    }

    /// Sign `data` with a server-side key. Request field is `data` (base64); the
    /// response field is `signature` (base64).
    public func sign(keyId: String, data: Data, idempotencyKey: String? = nil) async throws -> Data {
        let body: JSONValue = .object(["data": .string(encodeB64(data))])
        let resp = try await transport.requestJson(
            "POST", "\(prefix)/keys/\(keyId)/sign", body: body,
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
        return try decodeField(resp, field: "signature", op: "sign")
    }

    /// Verify a signature with a server-side key. Returns the backend's `valid` verdict.
    public func verify(keyId: String, data: Data, signature: Data) async throws -> Bool {
        let body: JSONValue = .object([
            "data": .string(encodeB64(data)),
            "signature": .string(encodeB64(signature)),
        ])
        let resp = try await transport.requestJson("POST", "\(prefix)/keys/\(keyId)/verify", body: body)
        return resp["valid"]?.boolValue == true
    }

    /// Wrap a data key. Request field is `dataKey`; response field is `wrappedKey`.
    public func wrap(keyId: String, plaintext: Data, idempotencyKey: String? = nil) async throws -> Data {
        let body: JSONValue = .object(["dataKey": .string(encodeB64(plaintext))])
        let resp = try await transport.requestJson(
            "POST", "\(prefix)/keys/\(keyId)/wrap", body: body,
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
        return try decodeField(resp, field: "wrappedKey", op: "wrap")
    }

    /// Unwrap a wrapped data key. Request field is `wrappedKey`; response field is `dataKey`.
    public func unwrap(keyId: String, ciphertext: Data, idempotencyKey: String? = nil) async throws -> Data {
        let body: JSONValue = .object(["wrappedKey": .string(encodeB64(ciphertext))])
        let resp = try await transport.requestJson(
            "POST", "\(prefix)/keys/\(keyId)/unwrap", body: body,
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
        return try decodeField(resp, field: "dataKey", op: "unwrap")
    }

    private func decodeField(_ resp: JSONValue, field: String, op: String) throws -> Data {
        guard let b64 = resp[field]?.stringValue else {
            throw QnsiError.api(message: "kms.\(op): response missing \(field)", statusCode: 200, code: nil, body: nil)
        }
        guard let bytes = decodeB64(b64) else {
            throw QnsiError.api(message: "kms.\(op): \(field) is not valid base64", statusCode: 200, code: nil, body: nil)
        }
        return bytes
    }
}
