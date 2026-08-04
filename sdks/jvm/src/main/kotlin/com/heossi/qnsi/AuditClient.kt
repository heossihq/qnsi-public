package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

private const val PREFIX = "/proxy/audit/v1"

/** An audit event. `payload` is an arbitrary JSON object. */
@Serializable
public data class LogEventRequest @JvmOverloads constructor(
    public val eventType: String,
    public val payload: JsonObject,
    public val tags: List<String>? = null,
)

@Serializable
private data class EventsBatch(val events: List<LogEventRequest>)

/** Immutable, hash-chained audit log. Wraps audit-service `/audit/v1`. */
public class AuditClient internal constructor(private val transport: Internal) {
    @JvmOverloads
    public fun logEvent(req: LogEventRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/events",
            transport.json.encodeToString(LogEventRequest.serializer(), req),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    @JvmOverloads
    public fun ingestEvents(events: List<LogEventRequest>, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/events/batch",
            transport.json.encodeToString(EventsBatch.serializer(), EventsBatch(events)),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    @JvmOverloads
    public fun listEvents(query: Map<String, String?> = emptyMap()): JsonObject =
        transport.requestJson("GET", "$PREFIX/events", null, RequestOptions(query = query))
}
