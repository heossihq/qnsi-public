package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

private const val PREFIX = "/proxy/tenant/v1"

/** Provision a tenant. */
@Serializable
public data class CreateTenantRequest @JvmOverloads constructor(
    public val name: String,
    public val slug: String? = null,
    public val tier: String? = null,
    public val parentTenantId: String? = null,
    public val metadata: JsonObject? = null,
)

/** Tenant CRUD, crypto-policy, current health/quotas. Wraps tenant-service `/tenant/v1`. */
public class TenantClient internal constructor(private val transport: Internal) {
    @JvmOverloads
    public fun createTenant(req: CreateTenantRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/tenants",
            transport.json.encodeToString(CreateTenantRequest.serializer(), req),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    public fun getTenant(tenantId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/tenants/$tenantId", null)

    @JvmOverloads
    public fun updateTenant(tenantId: String, body: JsonObject, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "PATCH", "$PREFIX/tenants/$tenantId", body.toString(),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    @JvmOverloads
    public fun listTenants(query: Map<String, String?> = emptyMap()): JsonObject =
        transport.requestJson("GET", "$PREFIX/tenants", null, RequestOptions(query = query))

    public fun getCryptoPolicy(tenantId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/tenants/$tenantId/crypto-policy", null)

    @JvmOverloads
    public fun upsertCryptoPolicy(tenantId: String, body: JsonObject, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "PUT", "$PREFIX/tenants/$tenantId/crypto-policy", body.toString(),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    public fun getCurrentHealth(tenantId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/tenants/$tenantId/health", null)

    public fun getCurrentQuotas(tenantId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/tenants/$tenantId/quotas", null)
}
