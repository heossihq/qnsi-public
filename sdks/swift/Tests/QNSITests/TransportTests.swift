import XCTest
@testable import QNSI

final class TransportTests: XCTestCase {
    func testDynamicVaultConfigurationContracts() async throws {
        let client = try mockedClient()
        MockURLProtocol.enqueue(status: 200, body: activationBody)
        MockURLProtocol.enqueue(status: 200, body: "{\"engines\":[]}")
        _ = try await client.vault.listDynamicSecretEngines()
        for full in [false, true] {
            MockURLProtocol.enqueue(status: 201, body: "{\"id\":\"owned-config\"}")
            _ = try await client.vault.createDynamicSecretConfig(name: "owned", engineType: "postgresql", connectionRef: "approved-test-reference",
                secretType: full ? "database" : nil, roleTemplate: full ? [:] : nil,
                defaultTtlSeconds: full ? 60 : nil, maxTtlSeconds: full ? 120 : nil,
                tenantId: full ? "explicit-tenant" : nil, idempotencyKey: "owned-config-idempotency")
            let request = try XCTUnwrap(MockURLProtocol.takeRecorded().last)
            let body = try XCTUnwrap(JSONValue.parse(request.body))
            XCTAssertEqual(body["engineType"]?.stringValue, "postgresql")
            XCTAssertEqual(body["connectionRef"]?.stringValue, "approved-test-reference")
            XCTAssertEqual(body["tenantId"]?.stringValue, full ? "explicit-tenant" : "11111111-2222-3333-4444-555555555555")
            XCTAssertEqual(body["defaultTtlSeconds"] != nil, full)
            XCTAssertEqual(body["roleTemplate"] != nil, full)
            XCTAssertEqual(request.headers.first(where: { $0.key.lowercased() == "idempotency-key" })?.value, "owned-config-idempotency")
        }
        for full in [false, true] {
            MockURLProtocol.enqueue(status: 200, body: "{\"configs\":[]}")
            _ = try await client.vault.listDynamicSecretConfigs(engineType: full ? "postgresql" : nil, secretType: full ? "database" : nil)
            let request = try XCTUnwrap(MockURLProtocol.takeRecorded().last)
            let components = try XCTUnwrap(URLComponents(string: request.url))
            XCTAssertEqual(components.queryItems?.first(where: { $0.name == "engineType" })?.value, full ? "postgresql" : nil)
        }
        MockURLProtocol.enqueue(status: 503, body: "{\"error\":\"DYNAMIC_SECRET_STATS_UNAVAILABLE\"}")
        do { _ = try await client.vault.getDynamicSecretStats(); XCTFail("Unavailable statistics returned success") }
        catch { guard case QnsiError.api(_, let status, _, _) = error else { return XCTFail("Unexpected error") }; XCTAssertEqual(status, 503) }
    }

    func testDynamicVaultCredentialsRecoveryAndQueuedRevocation() async throws {
        let client = try mockedClient()
        MockURLProtocol.enqueue(status: 200, body: activationBody)
        for full in [false, true] {
            MockURLProtocol.enqueue(status: 201, body: "{\"credentials\":{\"sessionToken\":\"owned-test-session\"},\"leaseId\":\"owned-lease\"}")
            let result = try await client.vault.requestCredentials(configId: "config/encoded", ttlSeconds: full ? 60 : nil, metadata: full ? ["scope": .string("owned")] : nil)
            XCTAssertEqual(result["credentials"]?["sessionToken"]?.stringValue, "owned-test-session")
            let request = try XCTUnwrap(MockURLProtocol.takeRecorded().last)
            XCTAssertTrue(request.url.contains("/dynamic-secrets/configs/config%2Fencoded/credentials"))
            let body = try XCTUnwrap(JSONValue.parse(request.body))
            XCTAssertEqual(body["ttlSeconds"] != nil, full)
            XCTAssertEqual(body["metadata"] != nil, full)
        }
        for include in [nil, false, true] as [Bool?] {
            MockURLProtocol.enqueue(status: 200, body: "{\"leases\":[{\"status\":\"revoking\",\"metadata\":null}]}")
            _ = try await client.vault.listLeases(configId: "config/encoded", includeAllStatuses: include)
            let request = try XCTUnwrap(MockURLProtocol.takeRecorded().last)
            let components = try XCTUnwrap(URLComponents(string: request.url))
            XCTAssertEqual(components.queryItems?.first(where: { $0.name == "includeAllStatuses" })?.value, include.map { String($0) })
        }
        for ttl in [nil, 120] as [Int?] {
            MockURLProtocol.enqueue(status: 200, body: "{\"leaseId\":\"owned-lease\",\"ttlSeconds\":120}")
            _ = try await client.vault.renewLease(leaseId: "lease/encoded", ttlSeconds: ttl)
            let request = try XCTUnwrap(MockURLProtocol.takeRecorded().last)
            XCTAssertTrue(request.url.contains("/dynamic-secrets/leases/lease%2Fencoded/renew"))
            XCTAssertEqual(JSONValue.parse(request.body)?["ttlSeconds"] != nil, ttl != nil)
        }
        MockURLProtocol.enqueue(status: 202, body: "{\"leaseId\":\"owned-lease\",\"status\":\"revoking\"}")
        let queued = try await client.vault.revokeLease(leaseId: "lease/encoded")
        XCTAssertEqual(queued["status"]?.stringValue, "revoking")
    }

    func testInvalidVaultResourcesFailBeforeActivation() async throws {
        let client = try mockedClient()
        for id in ["", ".", ".."] {
            let operations: [() async throws -> JSONValue] = [
                { try await client.vault.getSecret(secretId: id) },
                { try await client.vault.getSecretVersion(secretId: id, version: 1) },
                { try await client.vault.rotateSecret(secretId: id, payloadB64: "Zg==") },
                { try await client.vault.deleteSecret(secretId: id) },
                { try await client.vault.listSecretVersions(secretId: id) },
                { try await client.vault.requestCredentials(configId: id) },
                { try await client.vault.listLeases(configId: id) },
                { try await client.vault.renewLease(leaseId: id) },
                { try await client.vault.revokeLease(leaseId: id) },
            ]
            for operation in operations {
                do { _ = try await operation(); XCTFail("Invalid resource accepted") }
                catch { guard case QnsiError.api(_, let status, _, _) = error else { return XCTFail("Unexpected error") }; XCTAssertEqual(status, 400) }
            }
        }
        do { _ = try await client.vault.getSecretVersion(secretId: "owned-secret", version: 0); XCTFail("Zero version accepted") }
        catch { guard case QnsiError.api(_, let status, _, _) = error else { return XCTFail("Unexpected error") }; XCTAssertEqual(status, 400) }
        XCTAssertEqual(MockURLProtocol.takeRecorded().count, 0)
    }
    func testInventorySourceAndExplicitTenantReachTransport() async throws {
        let client = try mockedClient()
        MockURLProtocol.enqueue(status: 200, body: activationBody)
        MockURLProtocol.enqueue(status: 200, body: "{\"runs\":[]}")
        _ = try await client.cryptoInventory.discoverAssetsFromSource(source: "code_repo", idempotencyKey: "owned-discovery")
        for tenant in ["explicit-tenant", ""] {
            MockURLProtocol.enqueue(status: 200, body: "{\"stats\":{}}")
            _ = try await client.cryptoInventory.getAssetStats(tenantId: tenant)
            MockURLProtocol.enqueue(status: 200, body: "{\"readiness\":{}}")
            _ = try await client.cryptoInventory.getReadinessScore(tenantId: tenant)
        }
        MockURLProtocol.enqueue(status: 200, body: "{\"stats\":{}}")
        _ = try await client.cryptoInventory.getAssetStats()
        MockURLProtocol.enqueue(status: 200, body: "{\"readiness\":{}}")
        _ = try await client.cryptoInventory.getReadinessScore()
        let requests = MockURLProtocol.takeRecorded()
        XCTAssertEqual(requests.count, 8)
        XCTAssertEqual(requests[1].method, "POST")
        XCTAssertEqual(JSONValue.parse(requests[1].body)?["source"]?.stringValue, "code_repo")
        XCTAssertEqual(requests[1].headers.first(where: { $0.key.lowercased() == "idempotency-key" })?.value, "owned-discovery")
        for (index, tenant) in [(2, "explicit-tenant"), (3, "explicit-tenant"), (4, ""), (5, "")] {
            let components = try XCTUnwrap(URLComponents(string: requests[index].url))
            XCTAssertEqual(components.queryItems?.first(where: { $0.name == "tenantId" })?.value, tenant)
        }
        XCTAssertTrue(requests[6].url.contains("tenantId=11111111-2222-3333-4444-555555555555"))
        XCTAssertTrue(requests[7].url.contains("tenantId=11111111-2222-3333-4444-555555555555"))
    }
	func testKmsCustodyFlagsAreSeparateFromMetadata() async throws {
		let client = try mockedClient()
		MockURLProtocol.enqueue(status: 200, body: activationBody)
		MockURLProtocol.enqueue(status: 201, body: "{\"keyId\":\"owned-key\",\"exportable\":false}")
		let result = try await client.kms.createKey(algorithm: "ml-dsa-65", purpose: "signing", metadata: ["exportable": .bool(true)], exportable: false, custodyEnforcement: "service")
		XCTAssertEqual(result["exportable"]?.boolValue, false)
		let recorded = MockURLProtocol.takeRecorded()
		XCTAssertEqual(recorded.count, 2)
		let body = JSONValue.parse(recorded[1].body)
		XCTAssertEqual(body?["exportable"]?.boolValue, false)
		XCTAssertEqual(body?["custodyEnforcement"]?.stringValue, "service")
		XCTAssertEqual(body?["metadata"]?["exportable"]?.boolValue, true)
	}
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
