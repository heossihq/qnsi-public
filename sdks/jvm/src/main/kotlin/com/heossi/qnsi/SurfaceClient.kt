package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.Json
import java.net.URLEncoder

/** Manifest-declared operation; not verified live availability or authorization. */
@Serializable
public data class QnsiOperation(
    public val id: String,
    public val service: String,
    public val method: String,
    public val manifestPath: String,
    public val path: String,
    public val pathParameters: List<String>,
    public val description: String,
)

public class SurfaceClient internal constructor(private val transport: Internal) {
    public companion object {
        @JvmStatic
        public fun operations(): List<QnsiOperation> {
            val stream = SurfaceClient::class.java.getResourceAsStream("/surface-operations.json")
                ?: throw QnsiApiException("Missing bundled operation catalog", 0)
            return stream.bufferedReader(Charsets.UTF_8).use { Json.decodeFromString(it.readText()) }
        }
    }

    /** Uses shared activation, tenant binding and retry; backend policy remains authoritative. */
    @JvmOverloads
    public fun callOperation(operationId: String, pathParameters: Map<String, String> = emptyMap(), body: JsonElement? = null, options: RequestOptions = RequestOptions()): JsonElement {
        val operation = operations().firstOrNull { it.id == operationId }
            ?: throw IllegalArgumentException("Unknown operation ID")
        require(pathParameters.keys == operation.pathParameters.toSet() && pathParameters.values.all { it.isNotEmpty() && it != "." && it != ".." }) { "Required path parameters: ${operation.pathParameters}" }
        var path = operation.path
        pathParameters.toList().sortedByDescending { it.first.length }.forEach { (name, value) ->
            path = path.replace(":$name", URLEncoder.encode(value, "UTF-8").replace("+", "%20"))
        }
        val response = transport.execute(operation.method, path, body?.toString(), options)
        if (response.isEmpty()) return JsonObject(emptyMap())
        return Json.parseToJsonElement(response)
    }
}
