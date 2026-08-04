package com.heossi.qnsi

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class WebhooksTest {
    private val secret = "whsec_test"

    private fun sign(body: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(), "HmacSHA256"))
        return "sha256=" + mac.doFinal(body.toByteArray()).joinToString("") { "%02x".format(it.toInt() and 0xFF) }
    }

    @Test
    fun verifiesAndParsesValidEvent() {
        val body =
            """{"event_type":"key.rotated","event_id":"evt_1","occurred_at":"2026-05-31T00:00:00Z","payload":{"keyId":"k1"}}"""
        val evt = QnsiWebhooks.parse(body.toByteArray(), sign(body), secret)
        assertEquals("key.rotated", evt.eventType)
        assertEquals("evt_1", evt.eventId)
        assertEquals("2026-05-31T00:00:00Z", evt.occurredAt)
    }

    @Test
    fun rejectsTamperedBody() {
        val body = """{"event_type":"x","event_id":"e"}"""
        val sig = sign(body)
        assertFailsWith<QnsiWebhookException> {
            QnsiWebhooks.verifySignature("$body ".toByteArray(), sig, secret)
        }
    }

    @Test
    fun rejectsWrongPrefix() {
        assertFailsWith<QnsiWebhookException> {
            QnsiWebhooks.verifySignature("x".toByteArray(), "md5=abcd", secret)
        }
    }

    @Test
    fun rejectsStaleTimestamp() {
        val body = """{"event_type":"x","event_id":"e"}"""
        assertFailsWith<QnsiWebhookException> {
            QnsiWebhooks.parse(
                body.toByteArray(),
                sign(body),
                secret,
                timestampHeader = "2000-01-01T00:00:00Z",
                nowMs = System.currentTimeMillis(),
            )
        }
    }

    @Test
    fun rejectsMissingEventType() {
        val body = """{"event_id":"e"}"""
        assertFailsWith<QnsiWebhookException> {
            QnsiWebhooks.parse(body.toByteArray(), sign(body), secret)
        }
    }
}
