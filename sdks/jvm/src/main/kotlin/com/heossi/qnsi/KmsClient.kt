package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import com.heossi.qnsi.internal.decodeB64
import com.heossi.qnsi.internal.encodeB64
import com.heossi.qnsi.internal.boolField
import com.heossi.qnsi.internal.stringField
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

private const val PREFIX = "/proxy/kms/v1"

/** Create a server-side PQC key. `purpose` is one of `"signing"`, `"encryption"`, `"kem"`. */
@Serializable
public data class CreateKeyRequest constructor(
    public val algorithm: String,
    public val purpose: String,
    public val metadata: JsonObject? = null,
    public val exportable: Boolean? = null,
    public val custodyEnforcement: String? = null,
) {
    // Retain the original Kotlin default-constructor descriptor as well as Java overloads.
    @JvmOverloads
    public constructor(algorithm: String, purpose: String, metadata: JsonObject? = null) :
        this(algorithm, purpose, metadata, null, null)

    public constructor(algorithm: String, purpose: String, metadata: JsonObject?, exportable: Boolean?) :
        this(algorithm, purpose, metadata, exportable, null)

    // Old compiled consumers call the three-field copy descriptor. Preserve custody policy.
    public fun copy(algorithm: String, purpose: String, metadata: JsonObject?): CreateKeyRequest =
        CreateKeyRequest(algorithm, purpose, metadata, exportable, custodyEnforcement)

    public companion object {
        @JvmStatic
        @JvmName("copy\$default")
        public fun legacyCopyDefault(
            source: CreateKeyRequest,
            algorithm: String?,
            purpose: String?,
            metadata: JsonObject?,
            mask: Int,
            marker: Any?,
        ): CreateKeyRequest = source.copy(
            if (mask and 1 != 0) source.algorithm else requireNotNull(algorithm),
            if (mask and 2 != 0) source.purpose else requireNotNull(purpose),
            if (mask and 4 != 0) source.metadata else metadata,
        )
    }
}

/** Server-side PQC keys: create / rotate / sign / verify / wrap / unwrap. Wraps kms-service `/kms/v1`. */
public class KmsClient internal constructor(private val transport: Internal) {
    @JvmOverloads
    public fun createKey(req: CreateKeyRequest, idempotencyKey: String? = null): JsonObject {
        // Backend createKeySchema = { tenantId(auto), keyId(required), keyType(required:
        // root|master|data|byok), algorithm, metadata }. The SDK's `purpose` is NOT a backend
        // field, so fold it into metadata, generate a keyId, and default keyType to "data"
        // (createKey previously serialized {algorithm, purpose} with no keyId/keyType -> 400).
        val meta = buildJsonObject {
            req.metadata?.forEach { (k, v) -> put(k, v) }
            put("purpose", req.purpose)
        }
        val body = buildJsonObject {
            put("keyId", java.util.UUID.randomUUID().toString())
            put("keyType", "data")
            put("algorithm", req.algorithm)
            put("metadata", meta)
            req.exportable?.let { put("exportable", it) }
            req.custodyEnforcement?.let { put("custodyEnforcement", it) }
        }.toString()
        return transport.requestJson(
            "POST", "$PREFIX/keys", body,
            RequestOptions(idempotencyKey = idempotencyKey),
        )
    }

    @JvmOverloads
    public fun listKeys(query: Map<String, String?> = emptyMap()): JsonObject =
        transport.requestJson("GET", "$PREFIX/keys", null, RequestOptions(query = query))

    public fun getKey(keyId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/keys/$keyId", null)

    @JvmOverloads
    public fun rotateKey(keyId: String, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/keys/$keyId/rotate", null,
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    public fun deleteKey(keyId: String): JsonObject =
        transport.requestJson("DELETE", "$PREFIX/keys/$keyId", null)

    @JvmOverloads
    public fun sign(keyId: String, data: ByteArray, idempotencyKey: String? = null): ByteArray {
        val body = buildJsonObject { put("data", encodeB64(data)) }.toString()
        val resp = transport.requestJson(
            "POST", "$PREFIX/keys/$keyId/sign", body,
            RequestOptions(idempotencyKey = idempotencyKey),
        )
        return decodeField(resp, "signature", "sign")
    }

    public fun verify(keyId: String, data: ByteArray, signature: ByteArray): Boolean {
        val body = buildJsonObject {
            put("data", encodeB64(data))
            put("signature", encodeB64(signature))
        }.toString()
        val resp = transport.requestJson("POST", "$PREFIX/keys/$keyId/verify", body)
        return resp.boolField("valid") == true
    }

    @JvmOverloads
    public fun wrap(keyId: String, plaintext: ByteArray, idempotencyKey: String? = null): ByteArray {
        val body = buildJsonObject { put("dataKey", encodeB64(plaintext)) }.toString()
        val resp = transport.requestJson(
            "POST", "$PREFIX/keys/$keyId/wrap", body,
            RequestOptions(idempotencyKey = idempotencyKey),
        )
        return decodeField(resp, "wrappedKey", "wrap")
    }

    @JvmOverloads
    public fun unwrap(keyId: String, ciphertext: ByteArray, idempotencyKey: String? = null): ByteArray {
        val body = buildJsonObject { put("wrappedKey", encodeB64(ciphertext)) }.toString()
        val resp = transport.requestJson(
            "POST", "$PREFIX/keys/$keyId/unwrap", body,
            RequestOptions(idempotencyKey = idempotencyKey),
        )
        return decodeField(resp, "dataKey", "unwrap")
    }

    private fun decodeField(resp: JsonObject, field: String, op: String): ByteArray {
        val b64 = resp.stringField(field)
            ?: throw QnsiApiException("kms.$op: response missing $field", 200)
        return decodeB64(b64)
            ?: throw QnsiApiException("kms.$op: $field is not valid base64", 200)
    }
}
