package com.heossi.qnsi.internal

import com.heossi.qnsi.QnsiApiException
import com.heossi.qnsi.QnsiNetworkException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.net.URLEncoder
import java.time.Duration
import java.util.concurrent.TimeUnit

internal val JSON_MEDIA_TYPE: MediaType = "application/json".toMediaType()

internal val EMPTY_JSON_OBJECT: JsonObject = JsonObject(emptyMap())

/** Shared serializer config: tolerant of unknown/added server fields. */
internal val SHARED_JSON: Json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = false
    explicitNulls = false
    isLenient = true
}

/** Optional per-request overrides. Java-friendly via [@JvmOverloads]. */
public class RequestOptions @JvmOverloads constructor(
    public val idempotencyKey: String? = null,
    public val query: Map<String, String?> = emptyMap(),
)

/**
 * Shared HTTP plumbing + activation cache. Internal - consumers reach this only
 * through [com.heossi.qnsi.QnsiClient]. Each service sub-client (Phase 2) takes
 * an [Internal] instance and calls [execute].
 *
 * Behaviour mirrors the npm/Go/Rust SDKs:
 *  - lazy activation handshake before the first request, cached until expiry;
 *  - a 401 invalidates the activation cache and retries the request exactly once;
 *  - a single total per-call timeout (OkHttp `callTimeout`).
 */
internal class Internal(
    val apiKey: String,
    baseUrlRaw: String,
    timeoutMs: Long,
) {
    val baseUrl: String = baseUrlRaw.trimEnd('/')
    val json: Json = SHARED_JSON

    private val client: OkHttpClient = OkHttpClient.Builder()
        .callTimeout(Duration.ofMillis(timeoutMs))
        .connectTimeout(timeoutMs, TimeUnit.MILLISECONDS)
        .readTimeout(timeoutMs, TimeUnit.MILLISECONDS)
        .build()

    private val activation = Activation(client, json, baseUrl)

    private val lock = Any()

    @Volatile
    private var cached: ActivationResponse? = null

    @Volatile
    private var cachedAtMs: Long = 0L

    /** Force the activation handshake to run now (and cache the result). */
    fun ensureActivated(): ActivationResponse {
        val snapshot = cached
        if (snapshot != null && !isExpired(snapshot, cachedAtMs)) return snapshot
        synchronized(lock) {
            val current = cached
            if (current != null && !isExpired(current, cachedAtMs)) return current
            val fresh = activation.activate(apiKey, SDK_VERSION)
            cached = fresh
            cachedAtMs = System.currentTimeMillis()
            return fresh
        }
    }

    /** Drop the cached activation; the next request re-handshakes. */
    fun invalidateActivation() {
        synchronized(lock) {
            cached = null
            cachedAtMs = 0L
        }
    }

    /**
     * Execute an authenticated request against the edge gateway. Returns the raw
     * response body (`""` for 204 / empty). Throws [QnsiApiException] on non-2xx
     * and [QnsiNetworkException] on transport failure.
     *
     * @param path path under the base URL including the service prefix
     *             (e.g. `"/vault/v1/secrets"`).
     */
    fun execute(method: String, path: String, bodyJson: String?, options: RequestOptions): String {
        val act = ensureActivated()
        // Backend write schemas (kms/vault/...) REQUIRE tenantId (uuid) in the body and scope the
        // request to it. Inject the activated tenant centrally (mirrors the @heossihq/qnsp npm SDK)
        // so every write carries it - without this, createKey/sign/verify/createSecret/rotate all
        // 400 'Invalid request body'. Caller-supplied tenantId wins. GET endpoints
        // (e.g. /crypto/v1/assets/stats, /readiness, GET /kms/v1/keys/:id) read tenantId
        // from the QUERY string and 400 without it, so also inject it into the query
        // (mirrors the npm SDK's withTenantIdQuery).
        var effectiveBody = injectTenantId(bodyJson, act.tenantId)
        var effectiveOptions = injectTenantIdQuery(options, act.tenantId)
        var response = send(method, path, effectiveBody, effectiveOptions)
        if (response.code == 401) {
            response.close()
            invalidateActivation()
            val reAct = ensureActivated()
            effectiveBody = injectTenantId(bodyJson, reAct.tenantId)
            effectiveOptions = injectTenantIdQuery(options, reAct.tenantId)
            response = send(method, path, effectiveBody, effectiveOptions)
        }
        response.use {
            val text = it.body?.string().orEmpty()
            if (!it.isSuccessful) throw parseApiError(json, it.code, text)
            if (it.code == 204) return ""
            return text
        }
    }

    /** Inject the activated tenantId into a JSON-object body when absent (caller-supplied wins). */
    private fun injectTenantId(bodyJson: String?, tenantId: String): String? {
        if (bodyJson == null || tenantId.isEmpty()) return bodyJson
        val element = try {
            json.parseToJsonElement(bodyJson)
        } catch (e: Exception) {
            return bodyJson
        }
        if (element !is JsonObject || element.containsKey("tenantId")) return bodyJson
        return JsonObject(element + ("tenantId" to JsonPrimitive(tenantId))).toString()
    }

    /** Inject the activated tenantId into the query string when absent (caller-supplied wins). */
    private fun injectTenantIdQuery(options: RequestOptions, tenantId: String): RequestOptions {
        if (tenantId.isEmpty() || options.query.containsKey("tenantId")) return options
        return RequestOptions(
            idempotencyKey = options.idempotencyKey,
            query = options.query + ("tenantId" to tenantId),
        )
    }

    /** Like [execute] but parses the body into a [JsonObject] (empty for 204 / empty / non-object). */
    fun requestJson(
        method: String,
        path: String,
        bodyJson: String?,
        options: RequestOptions = RequestOptions(),
    ): JsonObject {
        val text = execute(method, path, bodyJson, options)
        if (text.isEmpty()) return EMPTY_JSON_OBJECT
        return (json.parseToJsonElement(text) as? JsonObject) ?: EMPTY_JSON_OBJECT
    }

    /**
     * Execute a request WITHOUT the SDK activation handshake, using an explicit
     * authorization scheme. Used by the auth flows: login/refresh send no auth (creds
     * in the body, against `/edge/auth endpoints`); post-login ops (revoke/mfa/risk, against
     * bare `/auth/...`) send the user's session JWT as Bearer plus the `x-qnsp-tenant-id`
     * header - the API key does not represent a user session, so those ops need the JWT.
     */
    fun executeSession(
        method: String,
        path: String,
        bodyJson: String?,
        options: RequestOptions,
        bearer: String?,
        tenantId: String?,
    ): String {
        send(method, path, bodyJson, options, bearer, tenantId).use {
            val text = it.body?.string().orEmpty()
            if (!it.isSuccessful) throw parseApiError(json, it.code, text)
            if (it.code == 204) return ""
            return text
        }
    }

    fun requestJsonSession(
        method: String,
        path: String,
        bodyJson: String?,
        bearer: String?,
        tenantId: String?,
        options: RequestOptions = RequestOptions(),
    ): JsonObject {
        val text = executeSession(method, path, bodyJson, options, bearer, tenantId)
        if (text.isEmpty()) return EMPTY_JSON_OBJECT
        return (json.parseToJsonElement(text) as? JsonObject) ?: EMPTY_JSON_OBJECT
    }

    private fun send(
        method: String,
        path: String,
        bodyJson: String?,
        options: RequestOptions,
        bearer: String? = apiKey,
        tenantId: String? = null,
    ): Response {
        val url = buildUrl(baseUrl, path, options.query)
        val upper = method.uppercase()
        val requestBody = when {
            bodyJson != null -> bodyJson.toRequestBody(JSON_MEDIA_TYPE)
            requiresBody(upper) -> ByteArray(0).toRequestBody(null)
            else -> null
        }
        val builder = Request.Builder()
            .url(url)
            .header("accept", "application/json")
            .method(upper, requestBody)
        if (bearer != null) builder.header("authorization", "Bearer $bearer")
        if (tenantId != null) builder.header("x-qnsp-tenant-id", tenantId)
        options.idempotencyKey?.let { builder.header("idempotency-key", it) }
        return try {
            client.newCall(builder.build()).execute()
        } catch (e: IOException) {
            throw QnsiNetworkException(method, url, e)
        }
    }

    /**
     * Expiry is computed from the server's `expiresInSeconds`, refreshing
     * [EXPIRY_BUFFER_MS] early. (The TS SDK has a latent bug here - it reads a
     * non-existent `expiresAt` field and always falls back to a 5-minute
     * default; this port honours the server's actual TTL.)
     */
    private fun isExpired(resp: ActivationResponse, cachedAt: Long): Boolean {
        val expiresAtMs = cachedAt + resp.expiresInSeconds.toLong() * 1000L
        return expiresAtMs - System.currentTimeMillis() <= EXPIRY_BUFFER_MS
    }

    internal companion object {
        const val SDK_VERSION: String = "0.2.0"
        private const val EXPIRY_BUFFER_MS: Long = 60_000L

        private fun requiresBody(upperMethod: String): Boolean =
            upperMethod == "POST" || upperMethod == "PUT" || upperMethod == "PATCH"

        private fun buildUrl(base: String, path: String, query: Map<String, String?>): String {
            val sb = StringBuilder(base).append(path)
            val params = query.entries.filter { it.value != null }
            if (params.isNotEmpty()) {
                val encoded = params.joinToString("&") { (k, v) ->
                    "${enc(k)}=${enc(v!!)}"
                }
                sb.append(if (path.contains("?")) "&" else "?").append(encoded)
            }
            return sb.toString()
        }

        private fun enc(s: String): String = URLEncoder.encode(s, Charsets.UTF_8.name())
    }
}

/** Parse a non-2xx body into a [QnsiApiException], extracting `code`/`message`/`error`. */
internal fun parseApiError(json: Json, status: Int, raw: String): QnsiApiException {
    var code: String? = null
    var message = "HTTP $status"
    val parsed = try {
        json.parseToJsonElement(raw)
    } catch (_: Exception) {
        null
    }
    if (parsed is JsonObject) {
        (parsed["code"] as? JsonPrimitive)?.contentOrNull?.let { code = it }
        val msg = (parsed["message"] as? JsonPrimitive)?.contentOrNull
            ?: (parsed["error"] as? JsonPrimitive)?.contentOrNull
        if (msg != null) message = msg
    } else if (raw.isNotEmpty()) {
        message = raw
    }
    return QnsiApiException(message, status, code, raw.ifEmpty { null })
}
