import Foundation

/// Authentication: password login, JWT session refresh/revocation, MFA, and risk-based
/// auth, mapped to the real auth-service routes verified against production 2026-06-13.
///
/// Two routing conventions (mirrors the cloud portal and the JVM SDK):
///  - `login` / `refreshToken` hit `/edge/auth` endpoints with credentials/refresh-token
///    in the body and NO auth header (the session does not exist yet);
///  - `revoke` / `mfa*` / `*Risk*` are post-login operations on bare `/auth/...` and
///    require the session JWT (Bearer) plus the `x-qnsp-tenant-id` header. Call
///    `login` first; this client caches the resulting session and uses it automatically.
///
/// WebAuthn passkeys and SAML/OIDC federation are intentionally NOT exposed here:
/// the backend has no passkey routes, and federation is a SCIM/SAML-ACS provisioning
/// API rather than a per-call SDK surface.
public final class AuthClient: @unchecked Sendable {
    let transport: Transport

    /// Cached session (JWT + tenant) established by `login`, used by the post-login ops.
    public struct Session: Sendable, Equatable {
        public let accessToken: String
        public let refreshToken: String?
        public let tenantId: String
    }

    private let lock = NSLock()
    private var _session: Session?

    init(transport: Transport) {
        self.transport = transport
    }

    /// The current session, or nil until `login` succeeds.
    public func session() -> Session? {
        lock.lock()
        defer { lock.unlock() }
        return _session
    }

    private func setSession(_ session: Session?) {
        lock.lock()
        defer { lock.unlock() }
        _session = session
    }

    private func requireSession() throws -> Session {
        guard let s = session() else {
            throw QnsiError.auth(message: "Not logged in: call AuthClient.login(...) first", code: "NO_SESSION")
        }
        return s
    }

    /// Tokens come back either as a bare string or as an object `{ "token": "..." }`
    /// (the refresh token is the object form). Extract the string either way.
    private func tokenString(_ value: JSONValue?) -> String? {
        if let s = value?.stringValue { return s }
        return value?["token"]?.stringValue
    }

    /// Password login. Returns the raw response (accessToken/refreshToken/...) and caches
    /// the session so subsequent calls authenticate automatically. POST /edge/auth/login.
    @discardableResult
    public func login(email: String, password: String, tenantId: String) async throws -> JSONValue {
        let body: JSONValue = .object([
            "email": .string(email),
            "password": .string(password),
            "tenantId": .string(tenantId),
        ])
        let response = try await transport.requestJsonSession(
            "POST", "/edge/auth/login", body: body, bearer: nil, tenantId: nil
        )
        if let access = tokenString(response["accessToken"]) {
            setSession(Session(
                accessToken: access,
                refreshToken: tokenString(response["refreshToken"]),
                tenantId: tenantId
            ))
        }
        return response
    }

    /// Refresh the access token using a refresh token. POST /edge/auth/token/refresh.
    @discardableResult
    public func refreshToken(_ refreshToken: String) async throws -> JSONValue {
        let response = try await transport.requestJsonSession(
            "POST", "/edge/auth/token/refresh",
            body: .object(["refreshToken": .string(refreshToken)]),
            bearer: nil, tenantId: nil
        )
        if let access = tokenString(response["accessToken"]), let current = session() {
            setSession(Session(
                accessToken: access,
                refreshToken: tokenString(response["refreshToken"]) ?? current.refreshToken,
                tenantId: current.tenantId
            ))
        }
        return response
    }

    /// Revoke a refresh token (session). POST /auth/token/revoke (session-authenticated).
    public func revoke(refreshToken: String) async throws {
        let s = try requireSession()
        _ = try await transport.requestJsonSession(
            "POST", "/auth/token/revoke",
            body: .object(["token": .string(refreshToken)]),
            bearer: s.accessToken, tenantId: s.tenantId
        )
    }

    // MARK: MFA (session-authenticated)

    public func mfaChallenge(body: [String: JSONValue]) async throws -> JSONValue {
        try await sessionPost("/auth/mfa/challenge", body: body)
    }

    public func mfaVerify(body: [String: JSONValue]) async throws -> JSONValue {
        try await sessionPost("/auth/mfa/verify", body: body)
    }

    // MARK: Risk-based auth (session-authenticated)

    public func evaluateRisk(body: [String: JSONValue]) async throws -> JSONValue {
        try await sessionPost("/auth/risk/evaluate", body: body)
    }

    public func listRiskPolicies() async throws -> JSONValue {
        let s = try requireSession()
        return try await transport.requestJsonSession(
            "GET", "/auth/risk/policies", bearer: s.accessToken, tenantId: s.tenantId
        )
    }

    private func sessionPost(_ path: String, body: [String: JSONValue]) async throws -> JSONValue {
        let s = try requireSession()
        return try await transport.requestJsonSession(
            "POST", path, body: .object(body), bearer: s.accessToken, tenantId: s.tenantId
        )
    }
}
