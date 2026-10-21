import Foundation
import XCTest
@testable import QNSI

final class TransportSecurityTests: XCTestCase {
    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
    }

    func testInvalidActivationLifetimeAndTenantFailClosed() throws {
        let date = Date()
        for invalid: JSONValue in [.null, .string("3600"), .bool(true), .number(0), .number(-1), .number(.nan), .number(.infinity)] {
            XCTAssertThrowsError(try ActivationState(json: .object(["tenantId": .string("tenant-test"), "expiresInSeconds": invalid]), fetchedAt: date))
        }
        XCTAssertThrowsError(try ActivationState(json: .object(["tenantId": .string("tenant-test")]), fetchedAt: date))
        for tenant in ["", "   "] {
            XCTAssertThrowsError(try ActivationState(json: .object(["tenantId": .string(tenant), "expiresInSeconds": .number(3600)]), fetchedAt: date))
        }
        let state = try ActivationState(json: .object(["tenantId": .string("tenant-test"), "expiresInSeconds": .number(3600)]), fetchedAt: date)
        XCTAssertFalse(state.isExpired(now: date.addingTimeInterval(3539)))
        XCTAssertTrue(state.isExpired(now: date.addingTimeInterval(3540)))
    }

    func testBorrowedConfigurationIsNotMutated() throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 23
        configuration.timeoutIntervalForResource = 42
        _ = try QnsiClient(apiKey: "test-key", timeout: 5, sessionConfiguration: configuration)
        XCTAssertEqual(configuration.timeoutIntervalForRequest, 23)
        XCTAssertEqual(configuration.timeoutIntervalForResource, 42)
    }

    func testMalformedServiceJSONFailsWithActualStatus() async throws {
        let client = try mockedClient()
        MockURLProtocol.enqueue(status: 200, body: activationBody)
        MockURLProtocol.enqueue(status: 201, body: "not-json")
        do {
            _ = try await client.kms.listKeys()
            XCTFail("malformed JSON returned success")
        } catch let error as QnsiError {
            XCTAssertEqual(error.statusCode, 201)
        }
    }

    func testSessionJSONPreservesArraysAndRejectsMalformedBodies() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        let transport = try Transport(apiKey: "test-key", baseUrl: "https://mock.qnsi.test", timeout: 5, configuration: configuration)
        MockURLProtocol.enqueue(status: 200, body: "[1,2]")
        let value = try await transport.requestJsonSession("GET", "/session", bearer: "test-session", tenantId: "tenant-test")
        XCTAssertEqual(value, .array([.number(1), .number(2)]))
        MockURLProtocol.enqueue(status: 202, body: "not-json")
        do {
            _ = try await transport.requestJsonSession("GET", "/session", bearer: "test-session", tenantId: "tenant-test")
            XCTFail("malformed session JSON returned success")
        } catch let error as QnsiError {
            XCTAssertEqual(error.statusCode, 202)
        }
    }

    func testRedirectDelegateRejectsNewRequest() throws {
        let session = URLSession(configuration: .ephemeral)
        defer { session.invalidateAndCancel() }
        let request = URLRequest(url: URL(string: "https://untrusted.example/receive")!)
        let task = session.dataTask(with: request)
        let response = HTTPURLResponse(url: URL(string: "https://mock.qnsi.test")!, statusCode: 307, httpVersion: "HTTP/1.1", headerFields: [:])!
        let delegate = RejectRedirects()
        var calls = 0
        delegate.urlSession(session, task: task, willPerformHTTPRedirection: response, newRequest: request) { redirected in
            calls += 1
            XCTAssertNil(redirected)
        }
        XCTAssertEqual(calls, 1)
    }
}
