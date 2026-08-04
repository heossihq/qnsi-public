package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put

/** Password login for a tenant. */
@Serializable
public data class LoginRequest(
    public val email: String,
    public val password: String,
    public val tenantId: String,
)

/**
 * Authentication: password login, JWT session refresh/revocation, MFA, and risk-based
 * auth - mapped to the real auth-service routes verified against production 2026-06-13.
 *
 * Two routing conventions (mirrors the cloud portal):
 *  - `login` / `refreshToken` hit `/edge/auth endpoints` with credentials/refresh-token in the
 *    body and NO auth header (the session does not exist yet);
 *  - `revoke` / `mfa*` / `*Risk*` are post-login operations on bare `/auth/...` and require
 *    the session JWT (Bearer) plus the `x-qnsp-tenant-id` header. Call [login] first; this
 *    client caches the resulting session and uses it automatically.
 *
 * NOTE: WebAuthn passkeys and SAML/OIDC federation are intentionally NOT exposed here -
 * the backend has no passkey routes, and federation is a SCIM/SAML-ACS provisioning API
 * (not a simple per-call SDK surface). They were removed rather than ship dead endpoints.
 */
public class AuthClient internal constructor(private val transport: Internal) {

    /** Cached session (JWT + tenant) established by [login], used by the post-login ops. */
    public data class Session(
        public val accessToken: String,
        public val refreshToken: String?,
        public val tenantId: String,
    )

    @Volatile
    private var session: Session? = null

    /** The current session, or null until [login] succeeds. */
    public fun session(): Session? = session

    private fun requireSession(): Session =
        session ?: throw IllegalStateException("Not logged in: call AuthClient.login(...) first")

    /**
     * Tokens come back either as a bare string or as an object `{ "token": "…" }`
     * (the refresh token is the object form). Extract the string either way.
     */
    private fun tokenString(el: JsonElement?): String? = when (el) {
        is JsonPrimitive -> el.contentOrNull
        is JsonObject -> (el["token"] as? JsonPrimitive)?.contentOrNull
        else -> null
    }

    /**
     * Password login. Returns the raw response (accessToken/refreshToken/…) and caches the
     * session so subsequent calls ([revoke], [mfaChallenge], [evaluateRisk], …) authenticate
     * automatically. POST /edge/auth/login.
     */
    public fun login(req: LoginRequest): JsonObject {
        val body = transport.requestJsonSession(
            "POST", "/edge/auth/login",
            transport.json.encodeToString(LoginRequest.serializer(), req),
            bearer = null, tenantId = null,
        )
        val access = tokenString(body["accessToken"])
        val refresh = tokenString(body["refreshToken"])
        if (access != null) {
            session = Session(accessToken = access, refreshToken = refresh, tenantId = req.tenantId)
        }
        return body
    }

    /** Refresh the access token using a refresh token. POST /edge/auth/token/refresh. */
    public fun refreshToken(refreshToken: String): JsonObject {
        val body = transport.requestJsonSession(
            "POST", "/edge/auth/token/refresh",
            buildJsonObject { put("refreshToken", refreshToken) }.toString(),
            bearer = null, tenantId = null,
        )
        val access = tokenString(body["accessToken"])
        val current = session
        if (access != null && current != null) {
            val newRefresh = tokenString(body["refreshToken"]) ?: current.refreshToken
            session = current.copy(accessToken = access, refreshToken = newRefresh)
        }
        return body
    }

    /** Revoke a refresh token (session). POST /auth/token/revoke (session-authenticated). */
    public fun revoke(refreshToken: String) {
        val s = requireSession()
        transport.executeSession(
            "POST", "/auth/token/revoke",
            buildJsonObject { put("token", refreshToken) }.toString(),
            RequestOptions(), bearer = s.accessToken, tenantId = s.tenantId,
        )
    }

    // ── MFA (session-authenticated) ──────────────────────────────────

    public fun mfaChallenge(body: JsonObject): JsonObject = sessionPost("/auth/mfa/challenge", body)

    public fun mfaVerify(body: JsonObject): JsonObject = sessionPost("/auth/mfa/verify", body)

    // ── Risk-based auth (session-authenticated) ──────────────────────

    public fun evaluateRisk(body: JsonObject): JsonObject = sessionPost("/auth/risk/evaluate", body)

    public fun listRiskPolicies(): JsonObject {
        val s = requireSession()
        return transport.requestJsonSession(
            "GET", "/auth/risk/policies", null, bearer = s.accessToken, tenantId = s.tenantId,
        )
    }

    private fun sessionPost(path: String, body: JsonObject): JsonObject {
        val s = requireSession()
        return transport.requestJsonSession(
            "POST", path, body.toString(), bearer = s.accessToken, tenantId = s.tenantId,
        )
    }
}
