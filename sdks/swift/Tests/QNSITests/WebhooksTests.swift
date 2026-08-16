import XCTest
import CryptoKit
@testable import QNSI

final class WebhooksTests: XCTestCase {
    private let secret = "whsec_test_secret"

    private func sign(_ body: String) -> String {
        let key = SymmetricKey(data: Data(secret.utf8))
        let mac = HMAC<SHA256>.authenticationCode(for: Data(body.utf8), using: key)
        return "sha256=" + mac.map { String(format: "%02x", $0) }.joined()
    }

    func testValidSignatureVerifies() throws {
        let body = "{\"event_type\":\"key.rotated\",\"event_id\":\"evt_1\"}"
        try QnsiWebhooks.verifySignature(body: body, signatureHeader: sign(body), secret: secret)
    }

    func testBadPrefixRejected() {
        XCTAssertThrowsError(
            try QnsiWebhooks.verifySignature(body: "x", signatureHeader: "md5=abc", secret: secret)
        )
    }

    func testMismatchRejected() {
        let body = "{\"event_type\":\"a\",\"event_id\":\"b\"}"
        let otherSignature = sign(body + "tampered")
        XCTAssertThrowsError(
            try QnsiWebhooks.verifySignature(body: body, signatureHeader: otherSignature, secret: secret)
        )
    }

    func testInvalidHexRejected() {
        XCTAssertThrowsError(
            try QnsiWebhooks.verifySignature(body: "x", signatureHeader: "sha256=zz", secret: secret)
        )
    }

    func testParseReturnsTypedEvent() throws {
        let body = """
        {"event_type":"secret.rotated","event_id":"evt_42",\
        "occurred_at":"2026-08-17T10:00:00Z","payload":{"secretId":"s-1"}}
        """
        let event = try QnsiWebhooks.parse(
            body: Data(body.utf8), signatureHeader: sign(body), secret: secret
        )
        XCTAssertEqual(event.eventType, "secret.rotated")
        XCTAssertEqual(event.eventId, "evt_42")
        XCTAssertEqual(event.occurredAt, "2026-08-17T10:00:00Z")
        XCTAssertEqual(event.payload["secretId"]?.stringValue, "s-1")
    }

    func testReplayProtectionRejectsOldTimestamp() {
        let body = "{\"event_type\":\"a\",\"event_id\":\"b\"}"
        let now = Date()
        let old = ISO8601DateFormatter().string(from: now.addingTimeInterval(-600))
        XCTAssertThrowsError(
            try QnsiWebhooks.parse(
                body: Data(body.utf8), signatureHeader: sign(body), secret: secret,
                timestampHeader: old, now: now
            )
        )
    }

    func testReplayProtectionRejectsFutureTimestamp() {
        let body = "{\"event_type\":\"a\",\"event_id\":\"b\"}"
        let now = Date()
        let future = ISO8601DateFormatter().string(from: now.addingTimeInterval(600))
        XCTAssertThrowsError(
            try QnsiWebhooks.parse(
                body: Data(body.utf8), signatureHeader: sign(body), secret: secret,
                timestampHeader: future, now: now
            )
        )
    }

    func testMissingEventFieldsRejected() {
        let body = "{\"payload\":{}}"
        XCTAssertThrowsError(
            try QnsiWebhooks.parse(body: Data(body.utf8), signatureHeader: sign(body), secret: secret)
        )
    }
}
