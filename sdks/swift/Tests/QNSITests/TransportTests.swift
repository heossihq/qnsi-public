import XCTest
@testable import QNSI

final class TransportTests: XCTestCase {
    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
    }

    func testBlankApiKeyThrowsAuthError() {
        XCTAssertThrowsError(try QnsiClient(apiKey: "  ")) { error in
            guard case QnsiError.auth(_, let code) = error else {
                return XCTFail("expected auth error, got \(error)")
            }
            XCTAssertEqual(code, "MISSING_API_KEY")
        }
    }

    func testActivationHandshakeSendsSdkIdentityAndCaches() async throws {
        let client = try mockedClient()
        MockURLProtocol.enqueue(status: 200, body: activationBody)
        let tenant = try await client.tenantId()
        XCTAssertEqual(tenant, "11111111-2222-3333-4444-555555555555")
        let tier = try await client.tier()
        XCTAssertEqual(tier, "free")
        let limits = try await client.limits()
        XCTAssertTrue(limits.vaultEnabled)
        XCTAssertEqual(limits.apiCalls, 1000)

        let recorded = MockURLProtocol.takeRecorded()
        // One activation POST despite three accessor calls (cache hit).
        XCTAssertEqual(recorded.count, 1)
        let act = recorded[0]
        XCTAssertEqual(act.method, "POST")
        XCTAssertTrue(act.url.hasSuffix("/billing/v1/sdk/activate"))
        XCTAssertEqual(act.headers["Authorization"], "Bearer test-key")
        XCTAssertEqual(act.headers["User-Agent"], "qnsi-swift/0.1.0")
        let body = JSONValue.parse(act.body)
        XCTAssertEqual(body?["sdkId"]?.stringValue, "qnsi-swift")
        XCTAssertEqual(body?["runtime"]?.stringValue, "swift")
        XCTAssertEqual(body?["sdkVersion"]?.stringValue, "0.1.0")
    }

    func testActivation401MapsToAuthError() async throws {
        let client = try mockedClient()
        MockURLProtocol.enqueue(status: 401, body: "{\"error\":\"invalid API key\",\"code\":\"INVALID_API_KEY\"}")
        do {
            try await client.ensureActivated()
            XCTFail("expected auth error")
        } catch let error as QnsiError {
            guard case .auth(_, let code) = error else {
                return XCTFail("expected auth error, got \(error)")
            }
            XCTAssertEqual(code, "INVALID_API_KEY")
        }
    }

    func testTenantIdInjectedIntoWriteBodyAndQuery() async throws {
        let client = try mockedClient()
        MockURLProtocol.enqueue(status: 200, body: activationBody)
        MockURLProtocol.enqueue(status: 200, body: "{\"id\":\"sec-1\"}")
        _ = try await client.vault.createSecret(name: "s", payloadB64: "cGF5bG9hZA==")

        MockURLProtocol.enqueue(status: 200, body: "{\"keys\":[]}")
        _ = try await client.kms.listKeys()

        let recorded = MockURLProtocol.takeRecorded()
        XCTAssertEqual(recorded.count, 3)
        // Write: tenantId injected into the JSON body.
        let createBody = JSONValue.parse(recorded[1].body)
        XCTAssertEqual(createBody?["tenantId"]?.stringValue, "11111111-2222-3333-4444-555555555555")
        XCTAssertEqual(createBody?["payload"]?.stringValue, "cGF5bG9hZA==")
        XCTAssertNil(createBody?["payloadB64"], "wire field must be 'payload', not 'payloadB64'")
        // Read: tenantId injected into the query string.
        XCTAssertTrue(
            recorded[2].url.contains("tenantId=11111111-2222-3333-4444-555555555555"),
            "GET must carry tenantId in the query, got \(recorded[2].url)"
        )
    }

    func testRequest401InvalidatesActivationAndRetriesOnce() async throws {
        let client = try mockedClient()
        MockURLProtocol.enqueue(status: 200, body: activationBody)   // initial activation
        MockURLProtocol.enqueue(status: 401, body: "{\"error\":\"expired\"}")  // request 401
        MockURLProtocol.enqueue(status: 200, body: activationBody)   // re-activation
        MockURLProtocol.enqueue(status: 200, body: "{\"buckets\":[]}")  // retried request
        let buckets = try await client.storage.listBuckets()
        XCTAssertNotNil(buckets["buckets"])
        let recorded = MockURLProtocol.takeRecorded()
        XCTAssertEqual(recorded.count, 4, "activation, 401, re-activation, retry")
        XCTAssertTrue(recorded[3].url.contains("/proxy/storage/v1/buckets"))
    }

    func testApiErrorParsesCodeAndMessage() async throws {
        let client = try mockedClient()
        MockURLProtocol.enqueue(status: 200, body: activationBody)
        MockURLProtocol.enqueue(status: 400, body: "{\"message\":\"Invalid request body\",\"code\":\"BAD_REQUEST\"}")
        do {
            _ = try await client.kms.getKey(keyId: "nope")
            XCTFail("expected api error")
        } catch let error as QnsiError {
            guard case .api(let message, let status, let code, _) = error else {
                return XCTFail("expected api error, got \(error)")
            }
            XCTAssertEqual(status, 400)
            XCTAssertEqual(code, "BAD_REQUEST")
            XCTAssertEqual(message, "Invalid request body")
        }
    }

    func testKmsSignDecodesSignatureAndSendsVerifiedFieldNames() async throws {
        let client = try mockedClient()
        MockURLProtocol.enqueue(status: 200, body: activationBody)
        let sigB64 = Data("signature-bytes".utf8).base64EncodedString()
        MockURLProtocol.enqueue(status: 200, body: "{\"signature\":\"\(sigB64)\"}")
        let sig = try await client.kms.sign(keyId: "k1", data: Data("msg".utf8))
        XCTAssertEqual(String(data: sig, encoding: .utf8), "signature-bytes")

        MockURLProtocol.enqueue(status: 200, body: "{\"valid\":true}")
        let ok = try await client.kms.verify(keyId: "k1", data: Data("msg".utf8), signature: sig)
        XCTAssertTrue(ok)

        let recorded = MockURLProtocol.takeRecorded()
        let signBody = JSONValue.parse(recorded[1].body)
        XCTAssertNotNil(signBody?["data"], "sign request field must be 'data' (base64)")
        XCTAssertNil(signBody?["dataB64"], "reaudit 2026-06-13 #37: 'dataB64' is rejected by the backend")
        let verifyBody = JSONValue.parse(recorded[2].body)
        XCTAssertNotNil(verifyBody?["signature"], "verify request field must be 'signature'")
    }

    func testSessionAuthFlowUsesEdgeLoginThenBearerAndTenantHeader() async throws {
        let client = try mockedClient()
        MockURLProtocol.enqueue(
            status: 200,
            body: "{\"accessToken\":\"jwt-abc\",\"refreshToken\":{\"token\":\"r-1\"}}"
        )
        let login = try await client.auth.login(email: "e@x.io", password: "pw", tenantId: "t-1")
        XCTAssertEqual(login["accessToken"]?.stringValue, "jwt-abc")
        XCTAssertEqual(client.auth.session()?.refreshToken, "r-1", "object-form refresh token must be unwrapped")

        MockURLProtocol.enqueue(status: 200, body: "{\"policies\":[]}")
        _ = try await client.auth.listRiskPolicies()

        let recorded = MockURLProtocol.takeRecorded()
        XCTAssertEqual(recorded.count, 2)
        XCTAssertTrue(recorded[0].url.hasSuffix("/edge/auth/login"))
        XCTAssertNil(recorded[0].headers["Authorization"], "login must send no auth header")
        XCTAssertTrue(recorded[1].url.hasSuffix("/auth/risk/policies"))
        XCTAssertEqual(recorded[1].headers["Authorization"], "Bearer jwt-abc")
        XCTAssertEqual(recorded[1].headers["x-qnsp-tenant-id"], "t-1")
    }

    func testSessionRequiredForPostLoginOps() async throws {
        let client = try mockedClient()
        do {
            _ = try await client.auth.listRiskPolicies()
            XCTFail("expected NO_SESSION error")
        } catch let error as QnsiError {
            guard case .auth(_, let code) = error else {
                return XCTFail("expected auth error, got \(error)")
            }
            XCTAssertEqual(code, "NO_SESSION")
        }
    }

    func testBuildUrlEncodesQuery() {
        let url = Transport.buildUrl(
            base: "https://api.qnsi.heossi.com",
            path: "/proxy/kms/v1/keys",
            query: ["a b": "c&d", "skip": nil]
        )
        XCTAssertEqual(url, "https://api.qnsi.heossi.com/proxy/kms/v1/keys?a%20b=c%26d")
    }
}
