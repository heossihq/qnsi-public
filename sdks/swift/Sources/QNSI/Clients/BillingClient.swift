import Foundation

private let prefix = "/proxy/billing/v1"

/// A usage-meter reading. `occurredAt` is an optional ISO-8601 timestamp.
public struct IngestMeterRequest: Sendable {
    public var meterId: String
    public var quantity: Double
    public var occurredAt: String?
    public var metadata: [String: JSONValue]?

    public init(meterId: String, quantity: Double, occurredAt: String? = nil, metadata: [String: JSONValue]? = nil) {
        self.meterId = meterId
        self.quantity = quantity
        self.occurredAt = occurredAt
        self.metadata = metadata
    }

    var json: JSONValue {
        var object: [String: JSONValue] = [
            "meterId": .string(meterId),
            "quantity": .number(quantity),
        ]
        if let occurredAt { object["occurredAt"] = .string(occurredAt) }
        if let metadata { object["metadata"] = .object(metadata) }
        return .object(object)
    }
}

/// Entitlements, usage meters, invoices, credit balance. Wraps billing-service `/billing/v1`.
public struct BillingClient: Sendable {
    let transport: Transport

    public func getEntitlements() async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/entitlements")
    }

    public func ingestMeter(_ meter: IngestMeterRequest, idempotencyKey: String? = nil) async throws -> JSONValue {
        try await transport.requestJson(
            "POST", "\(prefix)/meters", body: meter.json,
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func ingestMeters(_ meters: [IngestMeterRequest], idempotencyKey: String? = nil) async throws -> JSONValue {
        try await transport.requestJson(
            "POST", "\(prefix)/meters/batch",
            body: .object(["meters": .array(meters.map(\.json))]),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func listInvoices(query: [String: String?] = [:]) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/invoices", options: RequestOptions(query: query))
    }

    public func getInvoice(invoiceId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/invoices/\(invoiceId)")
    }

    public func getCreditBalance(tenantId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/credits/balance/\(tenantId)")
    }
}
