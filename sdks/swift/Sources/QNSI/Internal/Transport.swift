import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// SDK identifier baked into the billing-service activation enum.
///
/// MUST exist (alongside the `"swift"` runtime) in ALL of:
///   - packages/sdk-activation/src/types.ts          (canonical enum)
///   - packages/qnsi/src/_activation/types.ts        (inlined mirror)
///   - apps/billing-service/src/routes/sdk-activation-schemas.ts (billing mirror)
/// and billing-service must be deployed with `qnsi-swift`/`swift` accepted BEFORE
/// this SDK is published, otherwise activation returns a Zod schema rejection even
/// though the deploy "succeeds".
let sdkId = "qnsi-swift"
let sdkRuntime = "swift"
let sdkVersion = "0.1.0"
let activationPath = "/billing/v1/sdk/activate"

/// Tier limits returned by the activation endpoint (camelCase wire fields).
public struct ActivationLimits: Sendable, Equatable {
    public let storageGB: Double
    public let apiCalls: Double
    public let enclavesEnabled: Bool
    public let aiTrainingEnabled: Bool
    public let aiInferenceEnabled: Bool
    public let sseEnabled: Bool
    public let vaultEnabled: Bool

    init(json: JSONValue?) {
        storageGB = json?["storageGB"]?.numberValue ?? 0
        apiCalls = json?["apiCalls"]?.numberValue ?? 0
        enclavesEnabled = json?["enclavesEnabled"]?.boolValue ?? false
        aiTrainingEnabled = json?["aiTrainingEnabled"]?.boolValue ?? false
        aiInferenceEnabled = json?["aiInferenceEnabled"]?.boolValue ?? false
        sseEnabled = json?["sseEnabled"]?.boolValue ?? false
        vaultEnabled = json?["vaultEnabled"]?.boolValue ?? false
    }
}

/// Successful activation response from `POST /billing/v1/sdk/activate`.
public struct ActivationState: Sendable, Equatable {
    public let tenantId: String
    public let tier: String
    public let limits: ActivationLimits
    let expiresInSeconds: Double
    let fetchedAt: Date

    init(json: JSONValue, fetchedAt: Date) {
        tenantId = json["tenantId"]?.stringValue ?? ""
        tier = json["tier"]?.stringValue ?? ""
        limits = ActivationLimits(json: json["limits"])
        expiresInSeconds = json["expiresInSeconds"]?.numberValue ?? 3600
        self.fetchedAt = fetchedAt
    }

    /// Expiry honours the server's `expiresInSeconds`, refreshing 60s early
    /// (same policy as the JVM SDK; the TS SDK's 5-minute fallback bug is not ported).
    func isExpired(now: Date) -> Bool {
        let expiresAt = fetchedAt.addingTimeInterval(expiresInSeconds)
        return expiresAt.timeIntervalSince(now) <= 60
    }
}

/// Optional per-request overrides.
public struct RequestOptions: Sendable {
    public var idempotencyKey: String?
    public var query: [String: String?]

    public init(idempotencyKey: String? = nil, query: [String: String?] = [:]) {
        self.idempotencyKey = idempotencyKey
        self.query = query
    }
}

/// Shared HTTP plumbing + activation cache. Internal: consumers reach this only
/// through `QnsiClient`. Behaviour mirrors the npm/Go/Rust/JVM SDKs:
///  - lazy activation handshake before the first request, cached until expiry;
///  - a 401 invalidates the activation cache and retries the request exactly once;
///  - a single total per-call timeout.
actor Transport {
    let apiKey: String
    let baseUrl: String
    private let session: URLSession
    private var cached: ActivationState?
    private var inflightActivation: Task<ActivationState, Error>?

    init(apiKey: String, baseUrl: String, timeout: TimeInterval, configuration: URLSessionConfiguration = .ephemeral) {
        self.apiKey = apiKey
        self.baseUrl = baseUrl.hasSuffix("/") ? String(baseUrl.dropLast()) : baseUrl
        configuration.timeoutIntervalForRequest = timeout
        configuration.timeoutIntervalForResource = timeout
        self.session = URLSession(configuration: configuration)
    }

    // MARK: Activation

    /// Force the activation handshake to run now (and cache the result).
    /// Concurrent callers share a single in-flight handshake.
    func ensureActivated() async throws -> ActivationState {
        if let current = cached, !current.isExpired(now: Date()) {
            return current
        }
        if let inflight = inflightActivation {
            return try await inflight.value
        }
        let task = Task<ActivationState, Error> {
            try await activate()
        }
        inflightActivation = task
        defer { inflightActivation = nil }
        let fresh = try await task.value
        cached = fresh
        return fresh
    }

    /// Drop the cached activation; the next request re-handshakes.
    func invalidateActivation() {
        cached = nil
    }

    private func activate() async throws -> ActivationState {
        let url = baseUrl + activationPath
        let payload: JSONValue = .object([
            "sdkId": .string(sdkId),
            "sdkVersion": .string(sdkVersion),
            "runtime": .string(sdkRuntime),
        ])
        let (data, response) = try await send(
            method: "POST", urlString: url, body: try payload.serialized(),
            bearer: apiKey, tenantId: nil, idempotencyKey: nil
        )
        let body = JSONValue.parse(data)
        switch response.statusCode {
        case 200...299:
            guard let body, body["tenantId"]?.stringValue != nil else {
                throw QnsiError.api(
                    message: "invalid activation response from platform",
                    statusCode: response.statusCode, code: nil, body: text(data)
                )
            }
            return ActivationState(json: body, fetchedAt: Date())
        case 401:
            throw QnsiError.auth(
                message: body?["error"]?.stringValue ?? "invalid API key",
                code: body?["code"]?.stringValue ?? "INVALID_API_KEY"
            )
        case 429:
            throw QnsiError.auth(message: "activation rate limited; retry shortly", code: "RATE_LIMITED")
        default:
            throw QnsiError.api(
                message: body?["error"]?.stringValue ?? "activation failed (HTTP \(response.statusCode))",
                statusCode: response.statusCode,
                code: body?["code"]?.stringValue,
                body: text(data)
            )
        }
    }

    // MARK: Authenticated requests (API key + tenant injection)

    /// Execute an authenticated request against the edge gateway and parse the JSON
    /// object response (empty object for 204 / empty / non-object bodies).
    ///
    /// Backend write schemas (kms/vault/...) REQUIRE `tenantId` (uuid) in the body and
    /// GET endpoints read it from the query string; the activated tenant is injected
    /// centrally into both (caller-supplied values win), mirroring the npm and JVM SDKs.
    func requestJson(
        _ method: String,
        _ path: String,
        body: JSONValue? = nil,
        options: RequestOptions = RequestOptions()
    ) async throws -> JSONValue {
        let data = try await execute(method, path, body: body, options: options)
        guard !data.isEmpty, let parsed = JSONValue.parse(data), parsed.objectValue != nil else {
            return .object([:])
        }
        return parsed
    }

    func execute(
        _ method: String,
        _ path: String,
        body: JSONValue?,
        options: RequestOptions
    ) async throws -> Data {
        let act = try await ensureActivated()
        var (data, response) = try await sendActivated(method, path, body: body, options: options, activation: act)
        if response.statusCode == 401 {
            invalidateActivation()
            let reAct = try await ensureActivated()
            (data, response) = try await sendActivated(method, path, body: body, options: options, activation: reAct)
        }
        guard (200...299).contains(response.statusCode) else {
            throw Transport.parseApiError(status: response.statusCode, data: data)
        }
        if response.statusCode == 204 { return Data() }
        return data
    }

    private func sendActivated(
        _ method: String,
        _ path: String,
        body: JSONValue?,
        options: RequestOptions,
        activation: ActivationState
    ) async throws -> (Data, HTTPURLResponse) {
        let effectiveBody = Transport.injectTenantId(body: body, tenantId: activation.tenantId)
        let effectiveQuery = Transport.injectTenantIdQuery(query: options.query, tenantId: activation.tenantId)
        let url = Transport.buildUrl(base: baseUrl, path: path, query: effectiveQuery)
        let bodyData: Data?
        if let effectiveBody {
            bodyData = try effectiveBody.serialized()
        } else if ["POST", "PUT", "PATCH"].contains(method.uppercased()) {
            bodyData = Data()
        } else {
            bodyData = nil
        }
        return try await send(
            method: method, urlString: url, body: bodyData,
            bearer: apiKey, tenantId: nil, idempotencyKey: options.idempotencyKey
        )
    }

    // MARK: Session-authenticated requests (auth flows)

    /// Execute a request WITHOUT the SDK activation handshake, using an explicit
    /// authorization scheme. Used by the auth flows: login/refresh send no auth
    /// (credentials in the body); post-login ops send the user's session JWT as
    /// Bearer plus the `x-qnsp-tenant-id` header.
    func requestJsonSession(
        _ method: String,
        _ path: String,
        body: JSONValue? = nil,
        bearer: String?,
        tenantId: String?,
        options: RequestOptions = RequestOptions()
    ) async throws -> JSONValue {
        let url = Transport.buildUrl(base: baseUrl, path: path, query: options.query)
        let bodyData: Data?
        if let body {
            bodyData = try body.serialized()
        } else if ["POST", "PUT", "PATCH"].contains(method.uppercased()) {
            bodyData = Data()
        } else {
            bodyData = nil
        }
        let (data, response) = try await send(
            method: method, urlString: url, body: bodyData,
            bearer: bearer, tenantId: tenantId, idempotencyKey: options.idempotencyKey
        )
        guard (200...299).contains(response.statusCode) else {
            throw Transport.parseApiError(status: response.statusCode, data: data)
        }
        guard !data.isEmpty, let parsed = JSONValue.parse(data), parsed.objectValue != nil else {
            return .object([:])
        }
        return parsed
    }

    // MARK: Wire

    private func send(
        method: String,
        urlString: String,
        body: Data?,
        bearer: String?,
        tenantId: String?,
        idempotencyKey: String?
    ) async throws -> (Data, HTTPURLResponse) {
        guard let url = URL(string: urlString) else {
            throw QnsiError.network(method: method, url: urlString, underlying: "invalid URL")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method.uppercased()
        request.setValue("application/json", forHTTPHeaderField: "accept")
        // The edge WAF rejects requests without a User-Agent; identify the SDK explicitly.
        request.setValue("\(sdkId)/\(sdkVersion)", forHTTPHeaderField: "user-agent")
        if let bearer {
            request.setValue("Bearer \(bearer)", forHTTPHeaderField: "authorization")
        }
        if let tenantId {
            request.setValue(tenantId, forHTTPHeaderField: "x-qnsp-tenant-id")
        }
        if let idempotencyKey {
            request.setValue(idempotencyKey, forHTTPHeaderField: "idempotency-key")
        }
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "content-type")
        }
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw QnsiError.network(method: method, url: urlString, underlying: "non-HTTP response")
            }
            return (data, http)
        } catch let error as QnsiError {
            throw error
        } catch {
            throw QnsiError.network(method: method, url: urlString, underlying: String(describing: error))
        }
    }

    // MARK: Helpers (nonisolated, pure)

    /// Inject the activated tenantId into a JSON-object body when absent (caller-supplied wins).
    static func injectTenantId(body: JSONValue?, tenantId: String) -> JSONValue? {
        guard let body, !tenantId.isEmpty, var object = body.objectValue else { return body }
        if object["tenantId"] != nil { return body }
        object["tenantId"] = .string(tenantId)
        return .object(object)
    }

    /// Inject the activated tenantId into the query string when absent (caller-supplied wins).
    static func injectTenantIdQuery(query: [String: String?], tenantId: String) -> [String: String?] {
        guard !tenantId.isEmpty, query["tenantId"] == nil else { return query }
        var merged = query
        merged["tenantId"] = tenantId
        return merged
    }

    static func buildUrl(base: String, path: String, query: [String: String?]) -> String {
        var url = base + path
        let params = query.compactMapValues { $0 }.sorted { $0.key < $1.key }
        if !params.isEmpty {
            let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
            let encoded = params.map { key, value in
                let k = key.addingPercentEncoding(withAllowedCharacters: allowed) ?? key
                let v = value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
                return "\(k)=\(v)"
            }.joined(separator: "&")
            url += (path.contains("?") ? "&" : "?") + encoded
        }
        return url
    }

    /// Parse a non-2xx body into a `QnsiError.api`, extracting `code`/`message`/`error`.
    static func parseApiError(status: Int, data: Data) -> QnsiError {
        let raw = text(data)
        var code: String?
        var message = "HTTP \(status)"
        if let parsed = JSONValue.parse(data), parsed.objectValue != nil {
            code = parsed["code"]?.stringValue
            if let msg = parsed["message"]?.stringValue ?? parsed["error"]?.stringValue {
                message = msg
            }
        } else if let raw, !raw.isEmpty {
            message = raw
        }
        return .api(message: message, statusCode: status, code: code, body: raw?.isEmpty == true ? nil : raw)
    }
}

private func text(_ data: Data) -> String? {
    String(data: data, encoding: .utf8)
}

// MARK: Base64 helpers shared by clients

func encodeB64(_ bytes: Data) -> String {
    bytes.base64EncodedString()
}

func decodeB64(_ b64: String) -> Data? {
    Data(base64Encoded: b64)
}
