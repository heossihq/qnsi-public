package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.net.URLEncoder

private const val PREFIX = "/proxy/vault/v1"

private fun vaultSegment(value: String): String {
    require(value.isNotEmpty() && value != "." && value != "..") { "Invalid Vault resource identifier" }
    return URLEncoder.encode(value, "UTF-8").replace("+", "%20")
}

@Serializable
public data class DynamicSecretConfigRequest @JvmOverloads constructor(
    public val name: String,
    public val engineType: String,
    public val connectionRef: String,
    public val secretType: String? = null,
    public val roleTemplate: JsonObject? = null,
    public val defaultTtlSeconds: Int? = null,
    public val maxTtlSeconds: Int? = null,
    public val tenantId: String? = null,
)

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
        transport.requestJson("GET", "$PREFIX/secrets/${vaultSegment(secretId)}", null)

    public fun getSecretVersion(secretId: String, version: Int): JsonObject {
        require(version > 0) { "Secret version must be positive" }
        return transport.requestJson("GET", "$PREFIX/secrets/${vaultSegment(secretId)}/versions/$version", null)
    }

    @JvmOverloads
    public fun rotateSecret(
        secretId: String,
        payloadB64: String,
        algorithm: String? = null,
        idempotencyKey: String? = null,
    ): JsonObject {
        val encoded = vaultSegment(secretId)
        // reaudit 2026-06-13 #42: backend rotateSecretSchema expects { newPayload, metadata? }.
        val body = buildJsonObject {
            put("newPayload", payloadB64)
            if (algorithm != null) put("metadata", buildJsonObject { put("algorithm", algorithm) })
        }.toString()
        return transport.requestJson(
            "POST", "$PREFIX/secrets/$encoded/rotate", body,
            RequestOptions(idempotencyKey = idempotencyKey),
        )
    }

    public fun deleteSecret(secretId: String): JsonObject =
        transport.requestJson("DELETE", "$PREFIX/secrets/${vaultSegment(secretId)}", null)

    public fun listSecretVersions(secretId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/secrets/${vaultSegment(secretId)}/versions", null)

    /** Registration catalog, not independent provider-account assurance. */
    public fun listDynamicSecretEngines(): JsonObject =
        transport.requestJson("GET", "$PREFIX/dynamic-secrets/engines", null)

    /** Requires an approved connection reference, never inline administrator credentials. */
    @JvmOverloads
    public fun createDynamicSecretConfig(request: DynamicSecretConfigRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson("POST", "$PREFIX/dynamic-secrets/configs", transport.json.encodeToString(DynamicSecretConfigRequest.serializer(), request), RequestOptions(idempotencyKey = idempotencyKey))

    @JvmOverloads
    public fun listDynamicSecretConfigs(engineType: String? = null, secretType: String? = null): JsonObject =
        transport.requestJson("GET", "$PREFIX/dynamic-secrets/configs", null, RequestOptions(query = mapOf("engineType" to engineType, "secretType" to secretType)))

    /** Preserves engine-specific credentials rather than forcing username/password fields. */
    @JvmOverloads
    public fun requestCredentials(configId: String, ttlSeconds: Int? = null, metadata: JsonObject? = null, idempotencyKey: String? = null): JsonObject {
        val encoded = vaultSegment(configId)
        val body = buildJsonObject {
            if (ttlSeconds != null) put("ttlSeconds", ttlSeconds)
            if (metadata != null) put("metadata", metadata)
        }.toString()
        return transport.requestJson("POST", "$PREFIX/dynamic-secrets/configs/$encoded/credentials", body, RequestOptions(idempotencyKey = idempotencyKey))
    }

    @JvmOverloads
    public fun listLeases(configId: String, includeAllStatuses: Boolean? = null): JsonObject =
        transport.requestJson("GET", "$PREFIX/dynamic-secrets/configs/${vaultSegment(configId)}/leases", null, RequestOptions(query = mapOf("includeAllStatuses" to includeAllStatuses?.toString())))

    @JvmOverloads
    public fun renewLease(leaseId: String, ttlSeconds: Int? = null): JsonObject {
        val encoded = vaultSegment(leaseId)
        val body = buildJsonObject { if (ttlSeconds != null) put("ttlSeconds", ttlSeconds) }.toString()
        return transport.requestJson("POST", "$PREFIX/dynamic-secrets/leases/$encoded/renew", body)
    }

    /** Retains the revoking queue acknowledgement, not completed provider revocation. */
    public fun revokeLease(leaseId: String): JsonObject =
        transport.requestJson("POST", "$PREFIX/dynamic-secrets/leases/${vaultSegment(leaseId)}/revoke", null)

    public fun getDynamicSecretStats(): JsonObject =
        transport.requestJson("GET", "$PREFIX/dynamic-secrets/stats", null)
}
