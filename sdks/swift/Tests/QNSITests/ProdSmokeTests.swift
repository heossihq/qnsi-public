import XCTest
@testable import QNSI

/// REAL end-to-end smoke against PRODUCTION through the actual Swift SDK
/// (provable-evidence mandate: prove the wire contract with a real call, not a
/// mock). Gated on QNSP_CANARY_KEY (the persistent synthetic-canary free-tenant
/// key in Secrets Manager qnsp/prod/synthetic-canary-key); skips cleanly when
/// unset so a normal `swift test` (mocked suites) never hits the network.
///
///   QNSP_CANARY_KEY=... swift test --filter ProdSmokeTests
///
/// Requires billing-service deployed with `qnsi-swift`/`swift` in the activation
/// enum; a Zod rejection here means the backend predates that deploy.
final class ProdSmokeTests: XCTestCase {
    private var canaryKey: String? {
        ProcessInfo.processInfo.environment["QNSP_CANARY_KEY"]
    }

    private var baseUrl: String {
        ProcessInfo.processInfo.environment["QNSP_E2E_API"] ?? "https://api.qnsi.heossi.com"
    }

    func testSwiftSdkActivatesAndReachesStoragePlusKmsViaProxyAgainstProd() async throws {
        guard let key = canaryKey, !key.isEmpty else {
            throw XCTSkip("QNSP_CANARY_KEY not set - skipping prod smoke")
        }
        let client = try QnsiClient(apiKey: key, baseUrl: baseUrl)

        // Activation (POST /billing/v1/sdk/activate) resolves the tenant from the key.
        try await client.ensureActivated()
        let tenantId = try await client.tenantId()
        XCTAssertFalse(tenantId.isEmpty, "activation should resolve a tenantId")

        // storage.listBuckets -> GET /proxy/storage/v1/buckets. A non-2xx throws;
        // reaching the assert = the SDK activated and the edge routed the call.
        let buckets = try await client.storage.listBuckets()
        XCTAssertNotNil(buckets.objectValue, "listBuckets should return a JSON body")

        // kms.listKeys -> GET /proxy/kms/v1/keys?tenantId=... (tenant query injected).
        let keys = try await client.kms.listKeys()
        XCTAssertNotNil(keys.objectValue, "listKeys should return a JSON body")
    }

    func testKmsSignVerifyAndVaultCreateRotateAgainstProd() async throws {
        guard let key = canaryKey, !key.isEmpty else {
            throw XCTSkip("QNSP_CANARY_KEY not set - skipping prod smoke")
        }
        let client = try QnsiClient(apiKey: key, baseUrl: baseUrl)
        try await client.ensureActivated()

        func firstString(_ object: JSONValue, _ keys: String...) -> String? {
            for k in keys {
                if let s = object[k]?.stringValue { return s }
            }
            return nil
        }

        // kms createKey(signing) -> sign -> verify: proves the data/signature wire
        // fields against the real backend Zod schemas.
        let created = try await client.kms.createKey(algorithm: "dilithium-3", purpose: "signing")
        guard let keyId = firstString(created, "keyId", "id") else {
            return XCTFail("createKey should return a keyId, got \(created)")
        }
        let message = Data("swift-prod-smoke".utf8)
        let signature = try await client.kms.sign(keyId: keyId, data: message)
        XCTAssertFalse(signature.isEmpty, "sign should return a non-empty signature")
        let valid = try await client.kms.verify(keyId: keyId, data: message, signature: signature)
        XCTAssertTrue(valid, "verify should return valid=true for a real signature")

        // Clean up: the canary tenant has a hard kms.keys quota (100). Months of
        // smoke runs without cleanup filled it (402 observed 2026-08-17).
        _ = try await client.kms.deleteKey(keyId: keyId)

        // vault createSecret -> rotateSecret: proves payload/newPayload wire fields.
        let payload = Data("swift-secret-value".utf8).base64EncodedString()
        let secret = try await client.vault.createSecret(
            name: "swift-smoke-\(UInt64(Date().timeIntervalSince1970 * 1000))",
            payloadB64: payload
        )
        guard let secretId = firstString(secret, "id", "secretId") else {
            return XCTFail("createSecret should return a secret id, got \(secret)")
        }
        let rotatedPayload = Data("swift-secret-rotated".utf8).base64EncodedString()
        let rotated = try await client.vault.rotateSecret(secretId: secretId, payloadB64: rotatedPayload)
        XCTAssertNotNil(rotated.objectValue, "rotateSecret should return a JSON body")

        // Clean up: the canary tenant is a FREE tier with a hard vault.secrets quota.
        // Leaving each run's secret behind eventually fills the quota and turns this
        // smoke red with 402 "vault.secrets quota exceeded" (observed 2026-08-17).
        _ = try await client.vault.deleteSecret(secretId: secretId)
    }

    /// Device PQC + server round trip: an ML-DSA-65 signature made ON DEVICE with
    /// CryptoKit is INDEPENDENTLY verifiable, and device ML-KEM decapsulation
    /// recovers the same secret encapsulated to the device key. Runs with the prod
    /// smoke because it proves the on-device leg of the client-side PQC story.
    func testDevicePqcOperationsExecuteReal() throws {
        guard QnsiDevicePqc.isAvailable else {
            throw XCTSkip("CryptoKit PQC unavailable on this OS - device PQC fails closed")
        }
        let signPair = try QnsiDevicePqc.generateSigningKeyPair(.mlDsa65)
        let message = Data("device-attested".utf8)
        let signature = try QnsiDevicePqc.sign(.mlDsa65, privateSeed: signPair.privateSeed, message: message)
        XCTAssertTrue(
            try QnsiDevicePqc.verify(.mlDsa65, publicKey: signPair.publicKey, message: message, signature: signature)
        )

        let kemPair = try QnsiDevicePqc.generateKemKeyPair(.mlKem768)
        let encap = try QnsiDevicePqc.encapsulate(.mlKem768, publicKey: kemPair.publicKey)
        let recovered = try QnsiDevicePqc.decapsulate(
            .mlKem768, privateSeed: kemPair.privateSeed, ciphertext: encap.ciphertext
        )
        XCTAssertEqual(recovered, encap.sharedSecret)
    }
}
