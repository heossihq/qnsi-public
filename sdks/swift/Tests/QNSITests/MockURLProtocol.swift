import Foundation
import XCTest
@testable import QNSI

/// URLProtocol-based mock so transport tests exercise the REAL URLSession stack
/// (request building, headers, body encoding) with scripted responses; only the
/// network socket is replaced. Mirrors the JVM SDK's MockWebServer approach.
final class MockURLProtocol: URLProtocol {
    struct Recorded: Sendable {
        let method: String
        let url: String
        let headers: [String: String]
        let body: Data
    }

    struct Scripted {
        let status: Int
        let body: String
    }

    private static let lock = NSLock()
    nonisolated(unsafe) private static var queue: [Scripted] = []
    nonisolated(unsafe) private static var recorded: [Recorded] = []

    static func reset() {
        lock.lock()
        defer { lock.unlock() }
        queue = []
        recorded = []
    }

    static func enqueue(status: Int, body: String) {
        lock.lock()
        defer { lock.unlock() }
        queue.append(Scripted(status: status, body: body))
    }

    static func takeRecorded() -> [Recorded] {
        lock.lock()
        defer { lock.unlock() }
        return recorded
    }

    private static func dequeue() -> Scripted {
        lock.lock()
        defer { lock.unlock() }
        guard !queue.isEmpty else {
            return Scripted(status: 599, body: "{\"error\":\"mock queue empty\"}")
        }
        return queue.removeFirst()
    }

    private static func record(_ r: Recorded) {
        lock.lock()
        defer { lock.unlock() }
        recorded.append(r)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let bodyData: Data
        if let stream = request.httpBodyStream {
            stream.open()
            var collected = Data()
            let bufferSize = 4096
            let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
            defer { buffer.deallocate() }
            while stream.hasBytesAvailable {
                let read = stream.read(buffer, maxLength: bufferSize)
                if read <= 0 { break }
                collected.append(buffer, count: read)
            }
            stream.close()
            bodyData = collected
        } else {
            bodyData = request.httpBody ?? Data()
        }
        Self.record(Recorded(
            method: request.httpMethod ?? "",
            url: request.url?.absoluteString ?? "",
            headers: request.allHTTPHeaderFields ?? [:],
            body: bodyData
        ))
        let scripted = Self.dequeue()
        let response = HTTPURLResponse(
            url: request.url!, statusCode: scripted.status,
            httpVersion: "HTTP/1.1", headerFields: ["content-type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(scripted.body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

func mockedClient(apiKey: String = "test-key") throws -> QnsiClient {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [MockURLProtocol.self]
    return try QnsiClient(
        apiKey: apiKey, baseUrl: "https://mock.qnsi.test", sessionConfiguration: config
    )
}

let activationBody = """
{"activated":true,"tenantId":"11111111-2222-3333-4444-555555555555","tier":"free",\
"limits":{"storageGB":1,"apiCalls":1000,"vaultEnabled":true},\
"activationToken":"tok","expiresInSeconds":3600,"activatedAt":"2026-08-17T00:00:00Z"}
"""
