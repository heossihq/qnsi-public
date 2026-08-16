package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class InternalTest {
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

    private fun activationBody(): String =
        """{"activated":true,"tenantId":"11111111-1111-1111-1111-111111111111","tier":"free",""" +
            """"limits":{"storageGB":10,"apiCalls":50000,"enclavesEnabled":false,"aiTrainingEnabled":false,""" +
            """"aiInferenceEnabled":false,"sseEnabled":false,"vaultEnabled":false},""" +
            """"activationToken":"tok","expiresInSeconds":3600,"activatedAt":"2026-05-31T00:00:00Z"}"""

    private fun internal(): Internal =
        Internal(
            apiKey = "key_test",
            baseUrlRaw = server.url("/").toString().trimEnd('/'),
            timeoutMs = 5_000L,
        )

    @Test
    fun activatesThenSendsAuthenticatedRequest() {
        server.enqueue(MockResponse().setBody(activationBody()))
        server.enqueue(MockResponse().setBody("""{"ok":true}"""))

        val text = internal().execute("GET", "/kms/v1/keys", null, RequestOptions())

        assertEquals("""{"ok":true}""", text)
        assertEquals("/billing/v1/sdk/activate", server.takeRequest().path)
        val req = server.takeRequest()
        // The activated tenantId is injected into every GET query (systemic query-tenantId fix).
        assertEquals("/kms/v1/keys?tenantId=11111111-1111-1111-1111-111111111111", req.path)
        assertEquals("Bearer key_test", req.getHeader("authorization"))
    }

    @Test
    fun retriesExactlyOnceOn401() {
        server.enqueue(MockResponse().setBody(activationBody()))
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"code":"EXPIRED"}"""))
        server.enqueue(MockResponse().setBody(activationBody()))
        server.enqueue(MockResponse().setBody("""{"ok":true}"""))

        val text = internal().execute("GET", "/vault/v1/secrets", null, RequestOptions())

        assertEquals("""{"ok":true}""", text)
    }

    @Test
    fun mapsNon2xxToApiException() {
        server.enqueue(MockResponse().setBody(activationBody()))
        server.enqueue(MockResponse().setResponseCode(404).setBody("""{"code":"NOT_FOUND","message":"no such key"}"""))

        val ex = assertFailsWith<QnsiApiException> {
            internal().execute("GET", "/kms/v1/keys/x", null, RequestOptions())
        }
        assertEquals(404, ex.statusCode)
        assertEquals("NOT_FOUND", ex.code)
    }

    @Test
    fun invalidApiKeyDuringActivationThrowsAuthException() {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"activated":false,"error":"bad key","code":"INVALID_API_KEY"}"""))

        val ex = assertFailsWith<QnsiAuthException> {
            internal().execute("GET", "/kms/v1/keys", null, RequestOptions())
        }
        assertEquals("INVALID_API_KEY", ex.code)
    }
}
