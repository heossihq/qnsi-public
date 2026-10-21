package com.heossi.qnsi

import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.SerializationException
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class SurfaceClientTest {
    @Test
    fun everyCatalogOperationPreservesWireContract() {
        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse().setBody("""{"tenantId":"tenant-test","tier":"free","limits":{},"activationToken":"test","expiresInSeconds":3600}"""))
            val client = QnsiClient("test-key", server.url("/").toString().trimEnd('/'))
            val operations = SurfaceClient.operations()
            assertTrue(operations.size > 800)
            client.ensureActivated()
            server.takeRequest()
            for (operation in operations) {
                server.enqueue(MockResponse().setBody("{}"))
                val parameters = operation.pathParameters.associateWith { "$it/?# &%" }
                val body = if (operation.method == "GET") null else JsonObject(mapOf("data" to JsonPrimitive("aGVsbG8=")))
                client.surface.callOperation(operation.id, parameters, body, RequestOptions(idempotencyKey = "request-1", query = mapOf("cursor" to "next & # page")))
                val request = server.takeRequest()
                val target = requireNotNull(request.requestUrl)
                var expected = operation.path
                operation.pathParameters.sortedByDescending { it.length }.forEach { expected = expected.replace(":$it", "$it%2F%3F%23%20%26%25") }
                assertEquals(expected, target.encodedPath)
                assertEquals(operation.method, request.method)
                assertEquals("tenant-test", target.queryParameter("tenantId"))
                assertEquals("next & # page", target.queryParameter("cursor"))
                assertEquals("request-1", request.getHeader("idempotency-key"))
                if (body != null) assertTrue(request.body.readUtf8().contains("\"tenantId\":\"tenant-test\""))
            }
        }
    }

    @Test
    fun invalidContractsDoNotSendCredentials() {
        MockWebServer().use { server ->
            server.start()
            val client = QnsiClient("test-key", server.url("/").toString().trimEnd('/'))
            for ((id, parameters) in listOf(
                "unknown" to emptyMap(), "kms-service.getKeysKeyId" to emptyMap(),
                "kms-service.getKeysKeyId" to mapOf("extra" to "x"),
                "kms-service.getKeysKeyId" to mapOf("keyId" to ""),
                "kms-service.getKeysKeyId" to mapOf("keyId" to "."),
                "kms-service.getKeysKeyId" to mapOf("keyId" to ".."),
            )) assertFailsWith<IllegalArgumentException> { client.surface.callOperation(id, parameters) }
            assertEquals(0, server.requestCount)
        }
    }

    @Test
    fun nonObjectResponsesArePreserved() {
        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse().setBody("""{"tenantId":"tenant-test","tier":"free","limits":{},"activationToken":"test","expiresInSeconds":3600}"""))
            val client = QnsiClient("test-key", server.url("/").toString().trimEnd('/'))
            for (response in listOf("[1,2]", "42", "null", "\"result\"")) {
                server.enqueue(MockResponse().setBody(response))
                assertEquals(response, client.surface.callOperation("kms-service.getKeys").toString())
            }
            server.enqueue(MockResponse().setResponseCode(204))
            assertEquals("{}", client.surface.callOperation("kms-service.getKeys").toString())
            server.enqueue(MockResponse().setBody("not JSON"))
            assertFailsWith<SerializationException> { client.surface.callOperation("kms-service.getKeys") }
        }
    }
}
