import Foundation
import XCTest
@testable import QNSI

final class SurfaceTests: XCTestCase {
    override func setUp() { super.setUp(); MockURLProtocol.reset() }

    func testEveryCatalogOperationPreservesWireContract() async throws {
        let client = try mockedClient()
        let operations = try SurfaceClient.operations()
        XCTAssertGreaterThan(operations.count, 800)
        MockURLProtocol.enqueue(status: 200, body: activationBody)
        for operation in operations {
            MockURLProtocol.enqueue(status: 200, body: "{}")
            let parameters = Dictionary(uniqueKeysWithValues: operation.pathParameters.map { ($0, "\($0)/?# &%") })
            let body: JSONValue? = operation.method == "GET" ? nil : .object(["data": .string("aGVsbG8=")])
            _ = try await client.surface.callOperation(operationId: operation.id, pathParameters: parameters, body: body, options: RequestOptions(idempotencyKey: "request-1", query: ["cursor": "next & # page"]))
            let recorded = try XCTUnwrap(MockURLProtocol.takeRecorded().last)
            let components = try XCTUnwrap(URLComponents(string: recorded.url))
            var expected = operation.path
            for name in operation.pathParameters.sorted(by: { $0.count > $1.count }) {
                expected = expected.replacingOccurrences(of: ":\(name)", with: "\(name)%2F%3F%23%20%26%25")
            }
            XCTAssertEqual(components.percentEncodedPath, expected)
            XCTAssertEqual(recorded.method, operation.method)
            XCTAssertEqual(components.queryItems?.first(where: { $0.name == "cursor" })?.value, "next & # page")
            XCTAssertEqual(components.queryItems?.first(where: { $0.name == "tenantId" })?.value, "11111111-2222-3333-4444-555555555555")
            XCTAssertEqual(recorded.headers.first(where: { $0.key.lowercased() == "idempotency-key" })?.value, "request-1")
            if body != nil { XCTAssertEqual(JSONValue.parse(recorded.body)?["tenantId"]?.stringValue, "11111111-2222-3333-4444-555555555555") }
        }
    }

    func testInvalidContractsDoNotSendCredentials() async throws {
        let client = try mockedClient()
        for (id, parameters) in [
            ("unknown", [:]), ("kms-service.getKeysKeyId", [:]),
            ("kms-service.getKeysKeyId", ["extra": "x"]),
            ("kms-service.getKeysKeyId", ["keyId": ""]),
            ("kms-service.getKeysKeyId", ["keyId": "."]),
            ("kms-service.getKeysKeyId", ["keyId": ".."]),
        ] {
            do {
                _ = try await client.surface.callOperation(operationId: id, pathParameters: parameters)
                XCTFail("Invalid operation was accepted")
            } catch let error as QnsiError { XCTAssertEqual(error.statusCode, 0) }
        }
        XCTAssertTrue(MockURLProtocol.takeRecorded().isEmpty)
    }

    func testNonObjectResponsesArePreservedAndInvalidJsonFails() async throws {
        let client = try mockedClient()
        MockURLProtocol.enqueue(status: 200, body: activationBody)
        for response in ["[1,2]", "42", "null", "\"result\""] {
            MockURLProtocol.enqueue(status: 200, body: response)
            let actual = try await client.surface.callOperation(operationId: "kms-service.getKeys")
            XCTAssertEqual(actual, JSONValue.parse(Data(response.utf8)))
        }
        MockURLProtocol.enqueue(status: 204, body: "")
        let empty = try await client.surface.callOperation(operationId: "kms-service.getKeys")
        XCTAssertEqual(empty, .object([:]))
        MockURLProtocol.enqueue(status: 200, body: "not JSON")
        do { _ = try await client.surface.callOperation(operationId: "kms-service.getKeys"); XCTFail("Invalid JSON was accepted") }
        catch let error as QnsiError { XCTAssertEqual(error.statusCode, 200) }
    }
}
