package com.heossi.qnsi

import kotlinx.serialization.json.jsonPrimitive
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.assertFailsWith
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class ServiceClientsTest {
    private lateinit var server: MockWebServer

    @BeforeTest
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @AfterTest
    fun tearDown() {
        server.shutdown()
    }

    private fun activation(): String =
        """{"activated":true,"tenantId":"11111111-1111-1111-1111-111111111111","tier":"free",""" +
            """"limits":{"storageGB":10,"apiCalls":50000,"enclavesEnabled":false,"aiTrainingEnabled":false,""" +
            """"aiInferenceEnabled":false,"sseEnabled":false,"vaultEnabled":false},""" +
            """"activationToken":"tok","expiresInSeconds":3600,"activatedAt":"2026-05-31T00:00:00Z"}"""

    private fun client(): QnsiClient =
        QnsiClient("key_test", server.url("/").toString().trimEnd('/'))

    private fun enqueueActivation() = server.enqueue(MockResponse().setBody(activation()))

    @Test
    fun inventorySourceAndExplicitTenantsArePreserved() {
        enqueueActivation()
        val inventory = client().cryptoInventory
        server.enqueue(MockResponse().setBody("""{"runs":[]}"""))
        inventory.discoverAssetsFromSource("code_repo", "owned-discovery")
        server.takeRequest()
        val discovery = server.takeRequest()
        assertEquals("POST", discovery.method)
        assertEquals("owned-discovery", discovery.getHeader("idempotency-key"))
        assertTrue(discovery.body.readUtf8().contains("\"source\":\"code_repo\""))
        for (tenant in listOf("explicit-tenant", "")) {
            server.enqueue(MockResponse().setBody("""{"stats":{}}"""))
            inventory.getAssetStats(tenant)
            assertEquals(tenant, server.takeRequest().requestUrl!!.queryParameter("tenantId"))
            server.enqueue(MockResponse().setBody("""{"readiness":{}}"""))
            inventory.getReadinessScore(tenant)
            assertEquals(tenant, server.takeRequest().requestUrl!!.queryParameter("tenantId"))
        }
    }

    @Test
    fun dynamicVaultConfigurationWireContract() {
        enqueueActivation()
        val vault = client().vault
        server.enqueue(MockResponse().setBody("""{"engines":[]}"""))
        vault.listDynamicSecretEngines()
        server.takeRequest()
        assertTrue(server.takeRequest().path!!.startsWith("/proxy/vault/v1/dynamic-secrets/engines?"))
        for (full in listOf(false, true)) {
            server.enqueue(MockResponse().setResponseCode(201).setBody("""{"id":"owned-config"}"""))
            vault.createDynamicSecretConfig(DynamicSecretConfigRequest(
                name = "owned", engineType = "postgresql", connectionRef = "approved-test-reference",
                secretType = if (full) "database" else null, roleTemplate = if (full) JsonObject(emptyMap()) else null,
                defaultTtlSeconds = if (full) 60 else null, maxTtlSeconds = if (full) 120 else null,
                tenantId = if (full) "explicit-tenant" else null,
            ), "owned-config-idempotency")
            val request = server.takeRequest()
            assertEquals("POST", request.method)
            assertEquals("owned-config-idempotency", request.getHeader("idempotency-key"))
            val body = Json.parseToJsonElement(request.body.readUtf8()) as JsonObject
            assertEquals("postgresql", body["engineType"]!!.jsonPrimitive.content)
            assertEquals("approved-test-reference", body["connectionRef"]!!.jsonPrimitive.content)
            assertEquals(if (full) "explicit-tenant" else "11111111-1111-1111-1111-111111111111", body["tenantId"]!!.jsonPrimitive.content)
            assertEquals(full, body.containsKey("defaultTtlSeconds"))
            assertEquals(full, body.containsKey("roleTemplate"))
        }
        for (full in listOf(false, true)) {
            server.enqueue(MockResponse().setBody("""{"configs":[]}"""))
            vault.listDynamicSecretConfigs(if (full) "postgresql" else null, if (full) "database" else null)
            assertEquals(if (full) "postgresql" else null, server.takeRequest().requestUrl!!.queryParameter("engineType"))
        }
        server.enqueue(MockResponse().setResponseCode(503).setBody("""{"error":"DYNAMIC_SECRET_STATS_UNAVAILABLE"}"""))
        assertFailsWith<QnsiApiException> { vault.getDynamicSecretStats() }
        server.takeRequest()
    }

    @Test
    fun dynamicVaultCredentialsRenewalAndQueueAcknowledgements() {
        enqueueActivation()
        val vault = client().vault
        for (full in listOf(false, true)) {
            server.enqueue(MockResponse().setResponseCode(201).setBody("""{"credentials":{"sessionToken":"owned-test-session"},"leaseId":"owned-lease"}"""))
            val result = vault.requestCredentials("config/encoded", if (full) 60 else null, if (full) buildJsonObject { put("scope", "owned") } else null, "owned-issue")
            assertTrue((result["credentials"] as JsonObject).containsKey("sessionToken"))
            if (!full) server.takeRequest()
            val request = server.takeRequest()
            assertTrue(request.path!!.startsWith("/proxy/vault/v1/dynamic-secrets/configs/config%2Fencoded/credentials?"))
            val body = Json.parseToJsonElement(request.body.readUtf8()) as JsonObject
            assertEquals(full, body.containsKey("ttlSeconds"))
            assertEquals(full, body.containsKey("metadata"))
        }
        for (include in listOf(null, false, true)) {
            server.enqueue(MockResponse().setBody("""{"leases":[{"status":"revoking","metadata":null}]}"""))
            val leases = vault.listLeases("config/encoded", include)
            assertTrue(leases.containsKey("leases"))
            assertEquals(include?.toString(), server.takeRequest().requestUrl!!.queryParameter("includeAllStatuses"))
        }
        for (ttl in listOf(null, 120)) {
            server.enqueue(MockResponse().setBody("""{"leaseId":"owned-lease","ttlSeconds":120}"""))
            vault.renewLease("lease/encoded", ttl)
            val request = server.takeRequest()
            assertTrue(request.path!!.startsWith("/proxy/vault/v1/dynamic-secrets/leases/lease%2Fencoded/renew?"))
            assertEquals(ttl != null, (Json.parseToJsonElement(request.body.readUtf8()) as JsonObject).containsKey("ttlSeconds"))
        }
        server.enqueue(MockResponse().setResponseCode(202).setBody("""{"leaseId":"owned-lease","status":"revoking"}"""))
        assertEquals("revoking", vault.revokeLease("lease/encoded")["status"]!!.jsonPrimitive.content)
        assertEquals("POST", server.takeRequest().method)
    }

    @Test
    fun invalidVaultResourcesFailBeforeActivation() {
        val vault = client().vault
        for (id in listOf("", ".", "..")) {
            val operations = listOf<() -> JsonObject>(
                { vault.getSecret(id) }, { vault.getSecretVersion(id, 1) },
                { vault.rotateSecret(id, "Zg==") }, { vault.deleteSecret(id) }, { vault.listSecretVersions(id) },
                { vault.requestCredentials(id) }, { vault.listLeases(id) }, { vault.renewLease(id) }, { vault.revokeLease(id) },
            )
            for (operation in operations) assertFailsWith<IllegalArgumentException> { operation() }
        }
        assertFailsWith<IllegalArgumentException> { vault.getSecretVersion("owned-secret", 0) }
        assertEquals(0, server.requestCount)
    }

    @Test
    fun kmsCreateKeyPostsToKeysPathWithBody() {
        enqueueActivation()
        server.enqueue(MockResponse().setBody("""{"keyId":"k1","algorithm":"ml-dsa-65"}"""))

        val resp = client().kms.createKey(CreateKeyRequest(algorithm = "ml-dsa-65", purpose = "signing", exportable = false, custodyEnforcement = "service"))

        assertEquals("k1", resp["keyId"]!!.jsonPrimitive.content)
        server.takeRequest() // activation
        val req = server.takeRequest()
        assertEquals("POST", req.method)
        assertEquals("/proxy/kms/v1/keys?tenantId=11111111-1111-1111-1111-111111111111", req.path)
        val body = req.body.readUtf8()
        assertTrue(body.contains(""""algorithm":"ml-dsa-65""""))
        assertTrue(body.contains(""""exportable":false"""))
        assertTrue(body.contains(""""custodyEnforcement":"service""""))
    }

    @Test
    fun kmsSignDecodesSignatureBytes() {
        enqueueActivation()
        server.enqueue(MockResponse().setBody("""{"signature":"AQID"}""")) // base64 of [1,2,3]

        val sig = client().kms.sign("k1", byteArrayOf(9, 9))

        assertEquals(byteArrayOf(1, 2, 3).toList(), sig.toList())
        server.takeRequest()
        val req = server.takeRequest()
        assertEquals("/proxy/kms/v1/keys/k1/sign?tenantId=11111111-1111-1111-1111-111111111111", req.path)
        // Request field is `data` (NOT dataB64) - the 2026-06-13 contract, prod-proven.
        assertTrue(req.body.readUtf8().contains(""""data":"""))
    }

    @Test
    fun kmsVerifyReturnsBoolean() {
        enqueueActivation()
        server.enqueue(MockResponse().setBody("""{"valid":true}"""))

        assertTrue(client().kms.verify("k1", byteArrayOf(1), byteArrayOf(2)))
    }

    @Test
    fun listKeysAppendsQueryString() {
        enqueueActivation()
        server.enqueue(MockResponse().setBody("""{"keys":[]}"""))

        client().kms.listKeys(mapOf("limit" to "5"))

        server.takeRequest()
        assertEquals("/proxy/kms/v1/keys?limit=5&tenantId=11111111-1111-1111-1111-111111111111", server.takeRequest().path)
    }

    @Test
    fun storageGetObjectDecodesDataAndKeepsDescriptor() {
        enqueueActivation()
        server.enqueue(MockResponse().setBody("""{"dataB64":"AQID","contentType":"text/plain"}"""))

        val obj = client().storage.getObject("b1", "k1")

        assertEquals(byteArrayOf(1, 2, 3).toList(), obj.data.toList())
        assertEquals("text/plain", obj.descriptor["contentType"]!!.jsonPrimitive.content)
        server.takeRequest()
        assertEquals("/proxy/storage/v1/buckets/b1/objects/k1?tenantId=11111111-1111-1111-1111-111111111111", server.takeRequest().path)
    }

    @Test
    fun authRevokeReturnsUnitAndPosts() {
        // Auth flows do NOT activate (no API-key handshake). login() establishes the
        // session; revoke() then uses the session JWT against the bare /auth route.
        server.enqueue(MockResponse().setBody("""{"accessToken":"at_1","refreshToken":"rt_1"}"""))
        server.enqueue(MockResponse().setResponseCode(204))

        val auth = client().auth
        auth.login(LoginRequest(email = "a@b.co", password = "passwordpass", tenantId = "t1"))
        auth.revoke("rt_1")

        val loginReq = server.takeRequest()
        assertEquals("POST", loginReq.method)
        assertEquals("/edge/auth/login", loginReq.path)

        val req = server.takeRequest()
        assertEquals("POST", req.method)
        assertEquals("/auth/token/revoke", req.path)
        // post-login ops carry the session JWT (not the API key) + the tenant header.
        assertEquals("Bearer at_1", req.getHeader("authorization"))
        assertEquals("t1", req.getHeader("x-qnsp-tenant-id"))
    }

    @Test
    fun searchQueryHitsIndexQueryPath() {
        enqueueActivation()
        server.enqueue(MockResponse().setBody("""{"matches":[]}"""))

        client().search.query("idx1", QueryRequest(vector = listOf(0.1, 0.2), topK = 5))

        server.takeRequest()
        assertEquals("/proxy/search/v1/indexes/idx1/query?tenantId=11111111-1111-1111-1111-111111111111", server.takeRequest().path)
    }
}
