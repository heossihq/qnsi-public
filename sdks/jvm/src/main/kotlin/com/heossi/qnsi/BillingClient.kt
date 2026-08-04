package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

private const val PREFIX = "/proxy/billing/v1"

/** A usage-meter reading. `occurredAt` is an optional ISO-8601 timestamp. */
@Serializable
public data class IngestMeterRequest @JvmOverloads constructor(
    public val meterId: String,
    public val quantity: Double,
    public val occurredAt: String? = null,
    public val metadata: JsonObject? = null,
)

@Serializable
private data class MetersBatch(val meters: List<IngestMeterRequest>)

/** Entitlements, usage meters, invoices, credit balance. Wraps billing-service `/billing/v1`. */
public class BillingClient internal constructor(private val transport: Internal) {
    public fun getEntitlements(): JsonObject =
        transport.requestJson("GET", "$PREFIX/entitlements", null)

    @JvmOverloads
    public fun ingestMeter(req: IngestMeterRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/meters",
            transport.json.encodeToString(IngestMeterRequest.serializer(), req),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    @JvmOverloads
    public fun ingestMeters(meters: List<IngestMeterRequest>, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/meters/batch",
            transport.json.encodeToString(MetersBatch.serializer(), MetersBatch(meters)),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    @JvmOverloads
    public fun listInvoices(query: Map<String, String?> = emptyMap()): JsonObject =
        transport.requestJson("GET", "$PREFIX/invoices", null, RequestOptions(query = query))

    public fun getInvoice(invoiceId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/invoices/$invoiceId", null)

    public fun getCreditBalance(tenantId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/credits/balance/$tenantId", null)
}
