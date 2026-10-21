import Foundation

/// Manifest-declared operation, not an attestation of live availability or authorization.
public struct QnsiOperation: Decodable, Sendable {
    public let id: String
    public let service: String
    public let method: String
    public let manifestPath: String
    public let path: String
    public let pathParameters: [String]
    public let description: String
}

public struct SurfaceClient: Sendable {
    let transport: Transport

    public static func operations() throws -> [QnsiOperation] {
        guard let url = Bundle.module.url(forResource: "surface-operations", withExtension: "json") else {
            throw QnsiError.api(message: "Missing bundled operation catalog", statusCode: 0, code: "LOCAL_OPERATION_CONTRACT", body: nil)
        }
        return try JSONDecoder().decode([QnsiOperation].self, from: Data(contentsOf: url))
    }

    /// Execute with shared activation, tenant binding, retry, and backend policy enforcement.
    public func callOperation(operationId: String, pathParameters: [String: String] = [:], body: JSONValue? = nil, options: RequestOptions = RequestOptions()) async throws -> JSONValue {
        guard let operation = try Self.operations().first(where: { $0.id == operationId }) else {
            throw QnsiError.api(message: "Unknown operation ID", statusCode: 0, code: "LOCAL_OPERATION_CONTRACT", body: nil)
        }
        guard Set(pathParameters.keys) == Set(operation.pathParameters), pathParameters.values.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." }) else {
            throw QnsiError.api(message: "Required path parameters: \(operation.pathParameters)", statusCode: 0, code: "LOCAL_OPERATION_CONTRACT", body: nil)
        }
        var path = operation.path
        for (name, value) in pathParameters.sorted(by: { $0.key.count > $1.key.count }) {
            let encoded = value.utf8.map { byte -> String in
                if (65...90).contains(byte) || (97...122).contains(byte) || (48...57).contains(byte) || [45, 46, 95, 126].contains(byte) { return String(UnicodeScalar(byte)) }
                return String(format: "%%%02X", byte)
            }.joined()
            path = path.replacingOccurrences(of: ":\(name)", with: encoded)
        }
        let (data, response) = try await transport.executeResponse(operation.method, path, body: body, options: options)
        if data.isEmpty { return .object([:]) }
        guard let parsed = JSONValue.parse(data) else {
            throw QnsiError.api(message: "Response is not valid JSON", statusCode: response.statusCode, code: "LOCAL_RESPONSE_CONTRACT", body: nil)
        }
        return parsed
    }
}
