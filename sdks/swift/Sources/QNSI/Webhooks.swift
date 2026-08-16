import Foundation
import CryptoKit

/// A verified, parsed QNSP webhook event.
public struct QnsiWebhookEvent: Sendable, Equatable {
    public let eventType: String
    public let eventId: String
    public let occurredAt: String
    public let payload: [String: JSONValue]
}

/// Webhook signature verification + typed event parsing.
///
/// Every QNSP webhook is signed with HMAC-SHA-256 over the raw request body.
/// Always verify the **raw bytes** before parsing JSON. Implemented with CryptoKit's
/// constant-time `isValidAuthenticationCode`; no third-party dependency.
public enum QnsiWebhooks {
    /// Default replay-protection window: 5 minutes.
    public static let maxWebhookSkew: TimeInterval = 5 * 60

    /// Constant-time HMAC-SHA-256 verification. `signatureHeader` must be of the
    /// form `sha256=<hex>`. Throws `QnsiError.webhook` on mismatch.
    public static func verifySignature(body: Data, signatureHeader: String, secret: String) throws {
        guard signatureHeader.hasPrefix("sha256=") else {
            throw QnsiError.webhook(message: "signature header must start with 'sha256='")
        }
        let hex = String(signatureHeader.dropFirst("sha256=".count))
        guard let expected = dataFromHex(hex), !expected.isEmpty else {
            throw QnsiError.webhook(message: "signature is not valid hex")
        }
        let key = SymmetricKey(data: Data(secret.utf8))
        // CryptoKit's isValidAuthenticationCode is a constant-time comparison.
        guard HMAC<SHA256>.isValidAuthenticationCode(expected, authenticating: body, using: key) else {
            throw QnsiError.webhook(message: "signature mismatch")
        }
    }

    /// Convenience overload for UTF-8 string bodies.
    public static func verifySignature(body: String, signatureHeader: String, secret: String) throws {
        try verifySignature(body: Data(body.utf8), signatureHeader: signatureHeader, secret: secret)
    }

    /// Verify the HMAC, enforce replay protection (when a timestamp header is
    /// present), parse the JSON body, and return a typed `QnsiWebhookEvent`.
    public static func parse(
        body: Data,
        signatureHeader: String,
        secret: String,
        timestampHeader: String? = nil,
        maxSkew: TimeInterval = maxWebhookSkew,
        now: Date = Date()
    ) throws -> QnsiWebhookEvent {
        try verifySignature(body: body, signatureHeader: signatureHeader, secret: secret)

        if let timestampHeader, !timestampHeader.isEmpty {
            guard let ts = parseRfc3339(timestampHeader) else {
                throw QnsiError.webhook(message: "timestamp header is not RFC3339")
            }
            let delta = now.timeIntervalSince(ts)
            if delta > maxSkew { throw QnsiError.webhook(message: "timestamp is too old") }
            if -delta > maxSkew { throw QnsiError.webhook(message: "timestamp is in the future") }
        }

        guard let element = JSONValue.parse(body), let object = element.objectValue else {
            throw QnsiError.webhook(message: "body is not a JSON object")
        }
        guard let eventType = object["event_type"]?.stringValue else {
            throw QnsiError.webhook(message: "missing event_type")
        }
        guard let eventId = object["event_id"]?.stringValue else {
            throw QnsiError.webhook(message: "missing event_id")
        }
        return QnsiWebhookEvent(
            eventType: eventType,
            eventId: eventId,
            occurredAt: object["occurred_at"]?.stringValue ?? "",
            payload: object["payload"]?.objectValue ?? [:]
        )
    }

    private static func parseRfc3339(_ s: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: s) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: s)
    }

    private static func dataFromHex(_ hex: String) -> Data? {
        guard !hex.isEmpty, hex.count % 2 == 0 else { return nil }
        var bytes = Data(capacity: hex.count / 2)
        var index = hex.startIndex
        while index < hex.endIndex {
            let next = hex.index(index, offsetBy: 2)
            guard let byte = UInt8(hex[index..<next], radix: 16) else { return nil }
            bytes.append(byte)
            index = next
        }
        return bytes
    }
}
