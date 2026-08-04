package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

private const val PREFIX = "/proxy/vault/v1"

/** Create a PQC-encrypted secret. `payloadB64` is the base64-encoded plaintext. */
@Serializable
public data class CreateSecretRequest @JvmOverloads constructor(
    public val name: String,
    public val payloadB64: String,
    public val algorithm: String? = null,
    public val metadata: JsonObject? = null,
)

/** PQC-encrypted secret storage with versioning + rotation. Wraps vault-service `/vault/v1`. */
public class VaultClient internal constructor(private val transport: Internal) {
    @JvmOverloads
    public fun createSecret(req: CreateSecretRequest, idempotencyKey: String? = null): JsonObject {
        // reaudit 2026-06-13 #41: backend createSecretSchema expects { name, payload, metadata }
        // (tenantId auto-injected). Map payloadB64 -> payload and fold algorithm into metadata.
        val metaMap = (req.metadata ?: JsonObject(emptyMap())).toMutableMap()
        if (req.algorithm != null) metaMap["algorithm"] = JsonPrimitive(req.algorithm)
        val body = buildJsonObject {
            put("name", req.name)
            put("payload", req.payloadB64)
            put("metadata", JsonObject(metaMap))
        }.toString()
        return transport.requestJson(
            "POST", "$PREFIX/secrets", body,
            RequestOptions(idempotencyKey = idempotencyKey),
        )
    }

    public fun getSecret(secretId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/secrets/$secretId", null)

    public fun getSecretVersion(secretId: String, version: Int): JsonObject =
        transport.requestJson("GET", "$PREFIX/secrets/$secretId/versions/$version", null)

    @JvmOverloads
    public fun rotateSecret(
        secretId: String,
        payloadB64: String,
        algorithm: String? = null,
        idempotencyKey: String? = null,
    ): JsonObject {
        // reaudit 2026-06-13 #42: backend rotateSecretSchema expects { newPayload, metadata? }.
        val body = buildJsonObject {
            put("newPayload", payloadB64)
            if (algorithm != null) put("metadata", buildJsonObject { put("algorithm", algorithm) })
        }.toString()
        return transport.requestJson(
            "POST", "$PREFIX/secrets/$secretId/rotate", body,
            RequestOptions(idempotencyKey = idempotencyKey),
        )
    }

    public fun deleteSecret(secretId: String): JsonObject =
        transport.requestJson("DELETE", "$PREFIX/secrets/$secretId", null)

    public fun listSecretVersions(secretId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/secrets/$secretId/versions", null)
}
