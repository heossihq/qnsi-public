package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import com.heossi.qnsi.internal.decodeB64
import com.heossi.qnsi.internal.encodeB64
import com.heossi.qnsi.internal.stringField
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

private const val PREFIX = "/proxy/storage/v1"

/** Object payload + optional content-type / SSE algorithm / metadata for [StorageClient.putObject]. */
public data class PutObjectInput @JvmOverloads constructor(
    public val data: ByteArray,
    public val contentType: String? = null,
    public val sseAlgorithm: String? = null,
    public val metadata: JsonObject? = null,
)

/** Decrypted object payload plus the descriptor JSON returned by the service. */
public data class StorageObject(
    public val data: ByteArray,
    public val descriptor: JsonObject,
)

/** PQC-encrypted object storage with SSE-X. Wraps storage-service `/storage/storage/v1`. */
public class StorageClient internal constructor(private val transport: Internal) {
    @JvmOverloads
    public fun putObject(
        bucket: String,
        key: String,
        input: PutObjectInput,
        idempotencyKey: String? = null,
    ): JsonObject {
        val body = buildJsonObject {
            put("dataB64", encodeB64(input.data))
            input.contentType?.let { put("contentType", it) }
            input.sseAlgorithm?.let { put("sseAlgorithm", it) }
            input.metadata?.let { put("metadata", it) }
        }.toString()
        return transport.requestJson(
            "PUT", "$PREFIX/buckets/$bucket/objects/$key", body,
            RequestOptions(idempotencyKey = idempotencyKey),
        )
    }

    /** Fetch and decrypt an object. Throws [QnsiApiException] if the descriptor omits `dataB64`. */
    public fun getObject(bucket: String, key: String): StorageObject {
        val resp = transport.requestJson("GET", "$PREFIX/buckets/$bucket/objects/$key", null)
        val b64 = resp.stringField("dataB64")
            ?: throw QnsiApiException("storage.getObject: response missing dataB64", 200)
        val bytes = decodeB64(b64)
            ?: throw QnsiApiException("storage.getObject: dataB64 is not valid base64", 200)
        return StorageObject(bytes, resp)
    }

    public fun deleteObject(bucket: String, key: String) {
        transport.execute("DELETE", "$PREFIX/buckets/$bucket/objects/$key", null, RequestOptions())
    }

    @JvmOverloads
    public fun listObjects(bucket: String, query: Map<String, String?> = emptyMap()): JsonObject =
        transport.requestJson("GET", "$PREFIX/buckets/$bucket/objects", null, RequestOptions(query = query))

    public fun listBuckets(): JsonObject =
        transport.requestJson("GET", "$PREFIX/buckets", null)
}
