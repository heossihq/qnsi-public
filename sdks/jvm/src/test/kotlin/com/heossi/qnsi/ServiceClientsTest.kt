package com.heossi.qnsi

import kotlinx.serialization.json.jsonPrimitive
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

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
    fun kmsCreateKeyPostsToKeysPathWithBody() {
        enqueueActivation()
        server.enqueue(MockResponse().setBody("""{"keyId":"k1","algorithm":"ml-dsa-65"}"""))

        val resp = client().kms.createKey(CreateKeyRequest(algorithm = "ml-dsa-65", purpose = "signing"))

        assertEquals("k1", resp["keyId"]!!.jsonPrimitive.content)
        server.takeRequest() // activation
        val req = server.takeRequest()
        assertEquals("POST", req.method)
        assertEquals("/proxy/kms/v1/keys", req.path)
        assertTrue(req.body.readUtf8().contains(""""algorithm":"ml-dsa-65""""))
    }

    @Test
    fun kmsSignDecodesSignatureBytes() {
        enqueueActivation()
        server.enqueue(MockResponse().setBody("""{"signature":"AQID"}""")) // base64 of [1,2,3]

        val sig = client().kms.sign("k1", byteArrayOf(9, 9))

        assertEquals(byteArrayOf(1, 2, 3).toList(), sig.toList())
        server.takeRequest()
        val req = server.takeRequest()
        assertEquals("/proxy/kms/v1/keys/k1/sign", req.path)
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
        assertEquals("/proxy/kms/v1/keys?limit=5", server.takeRequest().path)
    }

    @Test
    fun storageGetObjectDecodesDataAndKeepsDescriptor() {
        enqueueActivation()
        server.enqueue(MockResponse().setBody("""{"dataB64":"AQID","contentType":"text/plain"}"""))

        val obj = client().storage.getObject("b1", "k1")

        assertEquals(byteArrayOf(1, 2, 3).toList(), obj.data.toList())
        assertEquals("text/plain", obj.descriptor["contentType"]!!.jsonPrimitive.content)
        server.takeRequest()
        assertEquals("/proxy/storage/v1/buckets/b1/objects/k1", server.takeRequest().path)
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
        assertEquals("/proxy/search/v1/indexes/idx1/query", server.takeRequest().path)
    }
}
