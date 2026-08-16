import Foundation

private let prefix = "/proxy/storage/v1"

/// Decrypted object payload plus the descriptor JSON returned by the service.
public struct StorageObject: Sendable {
    public let data: Data
    public let descriptor: JSONValue
}

/// PQC-encrypted object storage with SSE-X. Wraps storage-service routes at
/// `/proxy/storage/v1` on the edge gateway.
public struct StorageClient: Sendable {
    let transport: Transport

    public func putObject(
        bucket: String,
        key: String,
        data: Data,
        contentType: String? = nil,
        sseAlgorithm: String? = nil,
        metadata: [String: JSONValue]? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = ["dataB64": .string(encodeB64(data))]
        if let contentType { object["contentType"] = .string(contentType) }
        if let sseAlgorithm { object["sseAlgorithm"] = .string(sseAlgorithm) }
        if let metadata { object["metadata"] = .object(metadata) }
        return try await transport.requestJson(
            "PUT", "\(prefix)/buckets/\(bucket)/objects/\(key)", body: .object(object),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    /// Fetch and decrypt an object. Throws `QnsiError.api` if the descriptor omits `dataB64`.
    public func getObject(bucket: String, key: String) async throws -> StorageObject {
        let resp = try await transport.requestJson("GET", "\(prefix)/buckets/\(bucket)/objects/\(key)")
        guard let b64 = resp["dataB64"]?.stringValue else {
            throw QnsiError.api(
                message: "storage.getObject: response missing dataB64", statusCode: 200, code: nil, body: nil
            )
        }
        guard let bytes = decodeB64(b64) else {
            throw QnsiError.api(
                message: "storage.getObject: dataB64 is not valid base64", statusCode: 200, code: nil, body: nil
            )
        }
        return StorageObject(data: bytes, descriptor: resp)
    }

    public func deleteObject(bucket: String, key: String) async throws {
        _ = try await transport.execute(
            "DELETE", "\(prefix)/buckets/\(bucket)/objects/\(key)", body: nil, options: RequestOptions()
        )
    }

    public func listObjects(bucket: String, query: [String: String?] = [:]) async throws -> JSONValue {
        try await transport.requestJson(
            "GET", "\(prefix)/buckets/\(bucket)/objects", options: RequestOptions(query: query)
        )
    }

    public func listBuckets() async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/buckets")
    }
}
