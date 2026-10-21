package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

private const val PREFIX = "/proxy/crypto/v1"

/** Select a discovery source. Legacy targets/modes/options are not consumed by this backend route. */
@Serializable
public data class DiscoverAssetsRequest @JvmOverloads constructor(
    public val targets: List<String>? = null,
    public val modes: List<String>? = null,
    public val options: JsonObject? = null,
)

/** Cryptographic asset inventory / CBOM. Wraps crypto-inventory-service `/crypto/v1`. */
public class CryptoInventoryClient internal constructor(private val transport: Internal) {
    @JvmOverloads
    public fun listAssets(query: Map<String, String?> = emptyMap()): JsonObject =
        transport.requestJson("GET", "$PREFIX/assets", null, RequestOptions(query = query))

    public fun getAsset(assetId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/assets/$assetId", null)

    public fun getAssetStats(tenantId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/assets/stats", null, RequestOptions(query = mapOf("tenantId" to tenantId)))

    @JvmOverloads
    public fun discoverAssets(req: DiscoverAssetsRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/assets/discover",
            transport.json.encodeToString(DiscoverAssetsRequest.serializer(), req),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    /** Select a mounted discovery source without changing historical request constructor/copy signatures. */
    @JvmOverloads
    public fun discoverAssetsFromSource(source: String, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/assets/discover", JsonObject(mapOf("source" to JsonPrimitive(source))).toString(),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    public fun getReadinessScore(tenantId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/readiness", null, RequestOptions(query = mapOf("tenantId" to tenantId)))
}
