package com.heossi.qnsi

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.security.MessageDigest
import java.time.Instant
import java.time.OffsetDateTime
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/** A verified, parsed QNSP webhook event. */
public data class QnsiWebhookEvent(
    public val eventType: String,
    public val eventId: String,
    public val occurredAt: String,
    public val payload: JsonObject,
)

/**
 * Webhook signature verification + typed event parsing.
 *
 * Every QNSP webhook is signed with HMAC-SHA-256 over the raw request body.
 * Always verify the **raw bytes** before parsing JSON. Implemented with
 * `javax.crypto` + a constant-time compare - no third-party dependency.
 */
public object QnsiWebhooks {
    /** Default replay-protection window - 5 minutes. */
    public const val MAX_WEBHOOK_SKEW_MS: Long = 5 * 60 * 1000

    private val WEBHOOK_JSON = Json { ignoreUnknownKeys = true; isLenient = true }

    /**
     * Constant-time HMAC-SHA-256 verification. [signatureHeader] must be of the
     * form `sha256=<hex>`. Throws [QnsiWebhookException] on mismatch.
     */
    @JvmStatic
    public fun verifySignature(body: ByteArray, signatureHeader: String, secret: String) {
        if (!signatureHeader.startsWith("sha256=")) {
            throw QnsiWebhookException("signature header must start with 'sha256='")
        }
        val expected = hexToBytes(signatureHeader.substring("sha256=".length))
        if (expected.isEmpty()) throw QnsiWebhookException("signature is not valid hex")
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        val actual = mac.doFinal(body)
        // MessageDigest.isEqual is constant-time and length-safe in modern JDKs.
        if (!MessageDigest.isEqual(actual, expected)) {
            throw QnsiWebhookException("signature mismatch")
        }
    }

    /** Convenience overload for UTF-8 string bodies. */
    @JvmStatic
    public fun verifySignature(body: String, signatureHeader: String, secret: String) {
        verifySignature(body.toByteArray(Charsets.UTF_8), signatureHeader, secret)
    }

    /**
     * Verify the HMAC, enforce replay protection (when a timestamp header is
     * present), parse the JSON body, and return a typed [QnsiWebhookEvent].
     */
    @JvmStatic
    @JvmOverloads
    public fun parse(
        body: ByteArray,
        signatureHeader: String,
        secret: String,
        timestampHeader: String? = null,
        maxSkewMs: Long = MAX_WEBHOOK_SKEW_MS,
        nowMs: Long = System.currentTimeMillis(),
    ): QnsiWebhookEvent {
        verifySignature(body, signatureHeader, secret)

        if (!timestampHeader.isNullOrEmpty()) {
            val ts = parseRfc3339Millis(timestampHeader)
                ?: throw QnsiWebhookException("timestamp header is not RFC3339")
            val delta = nowMs - ts
            if (delta > maxSkewMs) throw QnsiWebhookException("timestamp is too old")
            if (-delta > maxSkewMs) throw QnsiWebhookException("timestamp is in the future")
        }

        val element = try {
            WEBHOOK_JSON.parseToJsonElement(String(body, Charsets.UTF_8))
        } catch (_: Exception) {
            throw QnsiWebhookException("body is not valid JSON")
        }
        if (element !is JsonObject) throw QnsiWebhookException("body is not a JSON object")

        val eventType = (element["event_type"] as? JsonPrimitive)?.contentOrNull
            ?: throw QnsiWebhookException("missing event_type")
        val eventId = (element["event_id"] as? JsonPrimitive)?.contentOrNull
            ?: throw QnsiWebhookException("missing event_id")
        val occurredAt = (element["occurred_at"] as? JsonPrimitive)?.contentOrNull ?: ""
        val payload = element["payload"] as? JsonObject ?: JsonObject(emptyMap())

        return QnsiWebhookEvent(eventType, eventId, occurredAt, payload)
    }

    private fun parseRfc3339Millis(s: String): Long? =
        try {
            Instant.parse(s).toEpochMilli()
        } catch (_: Exception) {
            try {
                OffsetDateTime.parse(s).toInstant().toEpochMilli()
            } catch (_: Exception) {
                null
            }
        }

    private fun hexToBytes(hex: String): ByteArray {
        if (hex.isEmpty() || hex.length % 2 != 0) return ByteArray(0)
        return try {
            ByteArray(hex.length / 2) { i ->
                ((hexDigit(hex[i * 2]) shl 4) or hexDigit(hex[i * 2 + 1])).toByte()
            }
        } catch (_: IllegalArgumentException) {
            ByteArray(0)
        }
    }

    private fun hexDigit(c: Char): Int = when (c) {
        in '0'..'9' -> c - '0'
        in 'a'..'f' -> c - 'a' + 10
        in 'A'..'F' -> c - 'A' + 10
        else -> throw IllegalArgumentException("bad hex digit")
    }
}
