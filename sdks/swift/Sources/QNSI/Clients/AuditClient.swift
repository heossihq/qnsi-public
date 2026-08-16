import Foundation

private let prefix = "/proxy/audit/v1"

/// An audit event. `payload` is an arbitrary JSON object.
public struct LogEventRequest: Sendable {
    public var eventType: String
    public var payload: [String: JSONValue]
    public var tags: [String]?

    public init(eventType: String, payload: [String: JSONValue], tags: [String]? = nil) {
        self.eventType = eventType
        self.payload = payload
        self.tags = tags
    }

    var json: JSONValue {
        var object: [String: JSONValue] = [
            "eventType": .string(eventType),
            "payload": .object(payload),
        ]
        if let tags {
            object["tags"] = .array(tags.map { .string($0) })
        }
        return .object(object)
    }
}

/// Immutable, hash-chained audit log. Wraps audit-service `/audit/v1`.
public struct AuditClient: Sendable {
    let transport: Transport

    public func logEvent(_ event: LogEventRequest, idempotencyKey: String? = nil) async throws -> JSONValue {
        try await transport.requestJson(
            "POST", "\(prefix)/events", body: event.json,
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func ingestEvents(_ events: [LogEventRequest], idempotencyKey: String? = nil) async throws -> JSONValue {
        try await transport.requestJson(
            "POST", "\(prefix)/events/batch",
            body: .object(["events": .array(events.map(\.json))]),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func listEvents(query: [String: String?] = [:]) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/events", options: RequestOptions(query: query))
    }
}
