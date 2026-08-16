package com.heossi.qnsi

import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assumptions.assumeTrue

/**
 * REAL end-to-end smoke against PRODUCTION through the actual JVM SDK (provable-evidence
 * mandate - prove the wire contract with a real call, not a mock). Gated on QNSP_CANARY_KEY
 * (the persistent synthetic-canary free-tenant key in Secrets Manager
 * qnsp/prod/synthetic-canary-key); skips cleanly when unset so normal `./gradlew test`
 * (MockWebServer suites) never hits the network.
 *
 *   QNSP_CANARY_KEY=… ./gradlew test --tests 'com.heossi.qnsi.ProdSmokeTest'
 *
 * Proves the 2026-06-13 routing fix: the service clients now target /proxy/<svc>/v1 (was
 * bare /<svc>/v1, which returned 400 "Missing tenant" against prod). A successful call =
 * the JVM SDK activated and reached the mounted backend route through the edge gateway.
 */
class ProdSmokeTest {
    private val canaryKey: String? = System.getenv("QNSP_CANARY_KEY")
    private val baseUrl: String = System.getenv("QNSP_E2E_API") ?: "https://api.qnsi.heossi.com"

    @Test
    fun `JVM SDK activates and reaches storage plus kms via proxy against prod`() {
        assumeTrue(canaryKey != null && canaryKey!!.isNotBlank(), "QNSP_CANARY_KEY not set - skipping prod smoke")
        val client = QnsiClient(apiKey = canaryKey!!, baseUrl = baseUrl)

        // Activation (POST /billing/v1/sdk/activate) - resolves the tenant from the key.
        client.ensureActivated()
        val tenantId = client.tenantId()
        assertNotNull(tenantId, "activation should resolve a tenantId")

        // storage.listBuckets -> GET /proxy/storage/v1/buckets. Throws QnsiApiException on
        // a non-2xx; reaching here = 200 (the fixed prefix routed correctly). The old bare
        // /storage/storage/v1 would have thrown.
        val buckets = client.storage.listBuckets()
        assertNotNull(buckets, "listBuckets should return a JSON body")

        // kms.listKeys -> GET /proxy/kms/v1/keys?tenantId=… (kms requires the tenant query).
        val keys = client.kms.listKeys(mapOf("tenantId" to tenantId))
        assertNotNull(keys, "listKeys should return a JSON body")
    }

    @Test
    fun `auth login then a session-authenticated op against prod`() {
        val email = System.getenv("QNSP_CANARY_EMAIL")
        val password = System.getenv("QNSP_CANARY_PASSWORD")
        val tenant = System.getenv("QNSP_CANARY_TENANT")
        assumeTrue(
            canaryKey != null && email != null && password != null && tenant != null,
            "canary login creds not set - skipping auth prod smoke",
        )
        val client = QnsiClient(apiKey = canaryKey!!, baseUrl = baseUrl)

        // login -> POST /edge/auth/login (creds in body, no auth header). Caches the session.
        val loginBody = client.auth.login(LoginRequest(email = email!!, password = password!!, tenantId = tenant!!))
        assertNotNull(loginBody["accessToken"], "login should return an accessToken")
        assertNotNull(client.auth.session(), "login should cache a session")

        // listRiskPolicies -> GET /auth/risk/policies with the session JWT + x-qnsp-tenant-id.
        // (Returns 200 against prod; the old /auth/v1/risk/policies path 404'd.) A non-2xx
        // throws QnsiApiException, so reaching here proves the session-authenticated route.
        val policies = client.auth.listRiskPolicies()
        assertNotNull(policies, "listRiskPolicies should return a JSON body")
    }

    /**
     * reaudit 2026-06-13 #37/#38/#41/#42 - the JVM KmsClient/VaultClient sent the WRONG request
     * field names (dataB64/signatureB64/payloadB64), which the backend Zod schemas reject (they
     * expect data/signature/payload/newPayload). This exercises the real wire contract against
     * prod: a non-2xx (or a wrong response field) throws QnsiApiException, so reaching the asserts
     * proves the corrected field names are accepted and the responses are read back correctly.
     */
    @Test
    fun `kms sign-verify and vault create-rotate against prod (field-name contract)`() {
        assumeTrue(canaryKey != null && canaryKey!!.isNotBlank(), "QNSP_CANARY_KEY not set - skipping prod smoke")
        val client = QnsiClient(apiKey = canaryKey!!, baseUrl = baseUrl)
        client.ensureActivated()

        fun jstr(o: JsonObject, vararg keys: String): String? =
            keys.firstNotNullOfOrNull { o[it]?.jsonPrimitive?.content }

        // kms createKey(signing) -> sign -> verify. Proves #37 (data/signature request fields) and
        // #38 (verify fields) - the SDK sent dataB64/signatureB64 before, which 400'd.
        val key = client.kms.createKey(CreateKeyRequest(algorithm = "dilithium-3", purpose = "signing"))
        val keyId = jstr(key, "keyId", "id")
        assertNotNull(keyId, "createKey should return a keyId")
        val data = "jvm-prod-smoke".toByteArray()
        val sig = client.kms.sign(keyId!!, data)
        assertTrue(sig.isNotEmpty(), "sign should return a non-empty signature (response field 'signature')")
        assertTrue(client.kms.verify(keyId, data, sig), "verify should return valid=true for a real signature")

        // Clean up: the canary tenant has a hard kms.keys quota (100). Months of
        // smoke runs without cleanup filled it (402 observed 2026-08-17).
        client.kms.deleteKey(keyId)

        // vault createSecret -> rotateSecret. Proves #41 (payload) and #42 (newPayload) request fields.
        val payload = Base64.getEncoder().encodeToString("jvm-secret-value".toByteArray())
        val created = client.vault.createSecret(CreateSecretRequest(name = "jvm-smoke-${System.nanoTime()}", payloadB64 = payload))
        val secretId = jstr(created, "id", "secretId")
        assertNotNull(secretId, "createSecret should return a secret id (proves 'payload' accepted)")
        val newPayload = Base64.getEncoder().encodeToString("jvm-secret-rotated".toByteArray())
        val rotated = client.vault.rotateSecret(secretId!!, newPayload)
        assertNotNull(rotated, "rotateSecret should return a JSON body (proves 'newPayload' accepted)")

        // Clean up: the canary tenant is a FREE tier with a hard vault.secrets quota.
        // Leaving each run's secret behind eventually fills the quota and turns this
        // smoke red with 402 "vault.secrets quota exceeded" (observed 2026-08-17).
        client.vault.deleteSecret(secretId)
    }
}
