package com.heossi.qnsi.internal

import com.heossi.qnsi.QnsiApiException
import com.heossi.qnsi.QnsiAuthException
import com.heossi.qnsi.QnsiNetworkException
import kotlinx.serialization.SerializationException
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

/**
 * SDK identifier baked into the billing-service activation enum.
 *
 * MUST exist (alongside the `"jvm"` runtime) in ALL of:
 *   - packages/sdk-activation/src/types.ts          (canonical enum)
 *   - packages/qnsi/src/_activation/types.ts        (inlined mirror)
 *   - apps/billing-service/src/routes/sdk-activation-schemas.ts (billing mirror)
 * and billing-service must be deployed with `qnsp-jvm`/`jvm` accepted BEFORE
 * this SDK is published - otherwise activation returns a Zod schema rejection
 * even though the deploy "succeeds". See .claude/rules/sdk-publish-checklist.md.
 * This is Phase 0 and is intentionally not yet applied.
 */
internal const val SDK_ID: String = "qnsp-jvm"
internal const val RUNTIME: String = "jvm"
internal const val ACTIVATION_PATH: String = "/billing/v1/sdk/activate"

/** Tier limits returned by the activation endpoint (camelCase wire fields). */
@Serializable
public data class ActivationLimits(
    val storageGB: Double = 0.0,
    val apiCalls: Double = 0.0,
    val enclavesEnabled: Boolean = false,
    val aiTrainingEnabled: Boolean = false,
    val aiInferenceEnabled: Boolean = false,
    val sseEnabled: Boolean = false,
    val vaultEnabled: Boolean = false,
)

/** Successful activation response from `POST /billing/v1/sdk/activate`. */
@Serializable
public data class ActivationResponse(
    val activated: Boolean = false,
    val tenantId: String = "",
    val tier: String = "",
    val limits: ActivationLimits = ActivationLimits(),
    val activationToken: String = "",
    val expiresInSeconds: Int = 3600,
    val activatedAt: String = "",
)

@Serializable
private data class ActivationRequestBody(
    val sdkId: String,
    val sdkVersion: String,
    val runtime: String,
)

@Serializable
private data class ActivationErrorBody(
    val activated: Boolean = false,
    val error: String = "",
    val code: String = "",
)

/** Performs the activation handshake. Caching/single-flight lives in [Internal]. */
internal class Activation(
    private val client: OkHttpClient,
    private val json: Json,
    private val baseUrl: String,
) {
    fun activate(apiKey: String, sdkVersion: String): ActivationResponse {
        val url = "$baseUrl$ACTIVATION_PATH"
        val payload = json.encodeToString(
            ActivationRequestBody.serializer(),
            ActivationRequestBody(sdkId = SDK_ID, sdkVersion = sdkVersion, runtime = RUNTIME),
        )
        val request = Request.Builder()
            .url(url)
            .header("authorization", "Bearer $apiKey")
            .header("accept", "application/json")
            .post(payload.toRequestBody(JSON_MEDIA_TYPE))
            .build()

        val response = try {
            client.newCall(request).execute()
        } catch (e: IOException) {
            throw QnsiNetworkException("POST", url, e)
        }

        response.use {
            val text = it.body?.string().orEmpty()
            return when {
                it.isSuccessful ->
                    try {
                        json.decodeFromString(ActivationResponse.serializer(), text)
                    } catch (_: SerializationException) {
                        throw QnsiApiException("invalid activation response from platform", it.code)
                    }

                it.code == 401 -> {
                    val err = parseError(text)
                    throw QnsiAuthException(
                        err?.error?.ifEmpty { null } ?: "invalid API key",
                        err?.code?.ifEmpty { null } ?: "INVALID_API_KEY",
                    )
                }

                it.code == 429 ->
                    throw QnsiAuthException("activation rate limited; retry shortly", "RATE_LIMITED")

                else -> {
                    val err = parseError(text)
                    throw QnsiApiException(
                        err?.error?.ifEmpty { null } ?: "activation failed (HTTP ${it.code})",
                        it.code,
                        err?.code?.ifEmpty { null },
                        text.ifEmpty { null },
                    )
                }
            }
        }
    }

    private fun parseError(text: String): ActivationErrorBody? =
        try {
            json.decodeFromString(ActivationErrorBody.serializer(), text)
        } catch (_: Exception) {
            null
        }
}
