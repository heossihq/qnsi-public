import Foundation

/// Error taxonomy for every failure raised by the QNSI Swift SDK.
///
/// Mirrors the `@heossihq/qnsp` (npm), `qnsp` (PyPI), Go/Rust, and `com.heossi:qnsi`
/// (JVM) SDKs: network errors (no HTTP response), auth/activation errors, API errors
/// (non-2xx), webhook verification errors, and device-PQC errors.
public enum QnsiError: Error, CustomStringConvertible, Sendable {
    /// Network / connectivity failure raised before any HTTP response was received.
    case network(method: String, url: String, underlying: String)

    /// API-key / activation failure (missing key, invalid key, suspended account,
    /// rate limited).
    case auth(message: String, code: String?)

    /// A non-2xx response from the QNSI API. `body` is the raw response payload, if any.
    case api(message: String, statusCode: Int, code: String?, body: String?)

    /// Webhook signature verification or parsing failure.
    case webhook(message: String)

    /// Device PQC is unavailable or an operation failed. The SDK fails CLOSED:
    /// there is no silent classical fallback anywhere on this path.
    case devicePqc(message: String)

    public var description: String {
        switch self {
        case .network(let method, let url, let underlying):
            return "qnsp: network error calling \(method) \(url): \(underlying)"
        case .auth(let message, let code):
            let suffix = code.map { " (\($0))" } ?? ""
            return "qnsp: auth error\(suffix): \(message)"
        case .api(let message, let statusCode, let code, _):
            let suffix = code.map { " \($0)" } ?? ""
            return "qnsp: api error \(statusCode)\(suffix): \(message)"
        case .webhook(let message):
            return "qnsp: webhook error: \(message)"
        case .devicePqc(let message):
            return "qnsp: device pqc error: \(message)"
        }
    }

    /// The HTTP status code for `.api` errors, else nil.
    public var statusCode: Int? {
        if case .api(_, let status, _, _) = self { return status }
        return nil
    }
}
