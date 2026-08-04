package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

private const val PREFIX = "/proxy/crypto/v1"

/** Kick off a discovery run over the given targets/modes. */
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
        transport.requestJson("GET", "$PREFIX/assets/stats", null)

    @JvmOverloads
    public fun discoverAssets(req: DiscoverAssetsRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/assets/discover",
            transport.json.encodeToString(DiscoverAssetsRequest.serializer(), req),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    public fun getReadinessScore(tenantId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/readiness", null)
}
