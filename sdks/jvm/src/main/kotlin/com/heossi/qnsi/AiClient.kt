package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

private const val PREFIX = "/proxy/ai/v1"

/** Register a model in the registry. */
@Serializable
public data class RegisterModelRequest @JvmOverloads constructor(
    public val name: String,
    public val version: String,
    public val provider: String,
    public val capabilities: List<String>? = null,
    public val metadata: JsonObject? = null,
)

/** Submit an AI workload. `type` is one of `"training"`, `"fine-tune"`, `"inference-batch"`. */
@Serializable
public data class SubmitWorkloadRequest @JvmOverloads constructor(
    public val modelId: String,
    public val type: String,
    public val inputRefs: List<String>? = null,
    public val outputBucket: String? = null,
    public val enclaveType: String? = null,
    public val metadata: JsonObject? = null,
)

/** A synchronous inference request. `input` is the model-specific payload. */
@Serializable
public data class InferenceRequest @JvmOverloads constructor(
    public val modelId: String,
    public val input: JsonObject,
    public val stream: Boolean? = null,
    public val metadata: JsonObject? = null,
)

/** Register an artifact (model weights, dataset, etc.) referencing a stored object. */
@Serializable
public data class RegisterArtifactRequest @JvmOverloads constructor(
    public val name: String,
    public val hash: String,
    public val storageId: String,
    public val type: String? = null,
    public val metadata: JsonObject? = null,
)

/** AI orchestration: model registry, workloads, inference, artifacts. Wraps ai-orchestrator `/ai/v1`. */
public class AiClient internal constructor(private val transport: Internal) {
    // ── Model registry ──────────────────────────────────────────────

    @JvmOverloads
    public fun registerModel(req: RegisterModelRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/models",
            transport.json.encodeToString(RegisterModelRequest.serializer(), req),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    @JvmOverloads
    public fun listModels(query: Map<String, String?> = emptyMap()): JsonObject =
        transport.requestJson("GET", "$PREFIX/models", null, RequestOptions(query = query))

    public fun getModel(modelId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/models/$modelId", null)

    @JvmOverloads
    public fun updateModel(modelId: String, body: JsonObject, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "PATCH", "$PREFIX/models/$modelId", body.toString(),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    @JvmOverloads
    public fun activateModel(modelId: String, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/models/$modelId/activate", null,
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    @JvmOverloads
    public fun deployModel(body: JsonObject, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/models/deploy", body.toString(),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    // ── Workloads ───────────────────────────────────────────────────

    @JvmOverloads
    public fun submitWorkload(req: SubmitWorkloadRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/workloads",
            transport.json.encodeToString(SubmitWorkloadRequest.serializer(), req),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    public fun getWorkload(workloadId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/workloads/$workloadId", null)

    @JvmOverloads
    public fun listWorkloads(query: Map<String, String?> = emptyMap()): JsonObject =
        transport.requestJson("GET", "$PREFIX/workloads", null, RequestOptions(query = query))

    @JvmOverloads
    public fun cancelWorkload(workloadId: String, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/workloads/$workloadId/cancel", null,
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    // ── Inference ────────────────────────────────────────────────────

    @JvmOverloads
    public fun invokeInference(req: InferenceRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/inference",
            transport.json.encodeToString(InferenceRequest.serializer(), req),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    // ── Artifacts ────────────────────────────────────────────────────

    @JvmOverloads
    public fun registerArtifact(req: RegisterArtifactRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/artifacts",
            transport.json.encodeToString(RegisterArtifactRequest.serializer(), req),
            RequestOptions(idempotencyKey = idempotencyKey),
        )
}
