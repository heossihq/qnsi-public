import Foundation

private let prefix = "/proxy/search/v1"

/// A vector to upsert into an index.
public struct Vector: Sendable {
    public var id: String
    public var values: [Double]
    public var metadata: [String: JSONValue]?

    public init(id: String, values: [Double], metadata: [String: JSONValue]? = nil) {
        self.id = id
        self.values = values
        self.metadata = metadata
    }

    var json: JSONValue {
        var object: [String: JSONValue] = [
            "id": .string(id),
            "values": .array(values.map { .number($0) }),
        ]
        if let metadata { object["metadata"] = .object(metadata) }
        return .object(object)
    }
}

/// Encrypted vector search with SSE-X. Wraps search-service `/search/v1`.
public struct SearchClient: Sendable {
    let transport: Transport

    /// Create a vector index. `metric` is one of `"cosine"`, `"l2"`, `"dot"`.
    public func createIndex(
        name: String,
        dimensions: Int,
        metric: String? = nil,
        algorithm: String? = nil,
        metadata: [String: JSONValue]? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = [
            "name": .string(name),
            "dimensions": .number(Double(dimensions)),
        ]
        if let metric { object["metric"] = .string(metric) }
        if let algorithm { object["algorithm"] = .string(algorithm) }
        if let metadata { object["metadata"] = .object(metadata) }
        return try await transport.requestJson(
            "POST", "\(prefix)/indexes", body: .object(object),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func listIndexes() async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/indexes")
    }

    public func deleteIndex(indexName: String) async throws {
        _ = try await transport.execute("DELETE", "\(prefix)/indexes/\(indexName)", body: nil, options: RequestOptions())
    }

    public func upsertVectors(
        indexName: String,
        vectors: [Vector],
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        try await transport.requestJson(
            "POST", "\(prefix)/indexes/\(indexName)/vectors",
            body: .object(["vectors": .array(vectors.map(\.json))]),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    /// A nearest-neighbour query.
    public func query(
        indexName: String,
        vector: [Double],
        topK: Int,
        filter: [String: JSONValue]? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = [
            "vector": .array(vector.map { .number($0) }),
            "topK": .number(Double(topK)),
        ]
        if let filter { object["filter"] = .object(filter) }
        return try await transport.requestJson("POST", "\(prefix)/indexes/\(indexName)/query", body: .object(object))
    }
}
