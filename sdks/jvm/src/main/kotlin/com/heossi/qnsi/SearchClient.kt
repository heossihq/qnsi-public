package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

private const val PREFIX = "/proxy/search/v1"

/** Create a vector index. `metric` is one of `"cosine"`, `"l2"`, `"dot"`. */
@Serializable
public data class CreateIndexRequest @JvmOverloads constructor(
    public val name: String,
    public val dimensions: Int,
    public val metric: String? = null,
    public val algorithm: String? = null,
    public val metadata: JsonObject? = null,
)

/** A vector to upsert into an index. */
@Serializable
public data class Vector @JvmOverloads constructor(
    public val id: String,
    public val values: List<Double>,
    public val metadata: JsonObject? = null,
)

/** A nearest-neighbour query. */
@Serializable
public data class QueryRequest @JvmOverloads constructor(
    public val vector: List<Double>,
    public val topK: Int,
    public val filter: JsonObject? = null,
)

@Serializable
private data class VectorsBatch(val vectors: List<Vector>)

/** Encrypted vector search with SSE-X. Wraps search-service `/search/v1`. */
public class SearchClient internal constructor(private val transport: Internal) {
    @JvmOverloads
    public fun createIndex(req: CreateIndexRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/indexes",
            transport.json.encodeToString(CreateIndexRequest.serializer(), req),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    public fun listIndexes(): JsonObject =
        transport.requestJson("GET", "$PREFIX/indexes", null)

    public fun deleteIndex(indexName: String) {
        transport.execute("DELETE", "$PREFIX/indexes/$indexName", null, RequestOptions())
    }

    @JvmOverloads
    public fun upsertVectors(indexName: String, vectors: List<Vector>, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/indexes/$indexName/vectors",
            transport.json.encodeToString(VectorsBatch.serializer(), VectorsBatch(vectors)),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    public fun query(indexName: String, req: QueryRequest): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/indexes/$indexName/query",
            transport.json.encodeToString(QueryRequest.serializer(), req),
        )
}
