import Foundation

/// A JSON value returned by (or sent to) the QNSI API.
///
/// The QNSI backend responses are open JSON objects whose fields evolve server-side;
/// mirroring the JVM SDK's `JsonObject` approach, responses are surfaced as a typed
/// JSON tree rather than rigid Codable structs so added server fields never break
/// deserialization.
public enum JSONValue: Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    // MARK: Accessors

    /// The string content if this value is a string, else nil.
    public var stringValue: String? {
        if case .string(let s) = self { return s }
        return nil
    }

    /// The numeric content if this value is a number, else nil.
    public var numberValue: Double? {
        if case .number(let n) = self { return n }
        return nil
    }

    /// The boolean content if this value is a bool, else nil.
    public var boolValue: Bool? {
        if case .bool(let b) = self { return b }
        return nil
    }

    /// The object content if this value is an object, else nil.
    public var objectValue: [String: JSONValue]? {
        if case .object(let o) = self { return o }
        return nil
    }

    /// The array content if this value is an array, else nil.
    public var arrayValue: [JSONValue]? {
        if case .array(let a) = self { return a }
        return nil
    }

    /// Member lookup on an object value; nil for non-objects or missing keys.
    public subscript(key: String) -> JSONValue? {
        objectValue?[key]
    }

    // MARK: Foundation bridging

    /// Build from a `JSONSerialization` tree.
    static func from(any: Any) -> JSONValue {
        switch any {
        case is NSNull:
            return .null
        case let n as NSNumber:
            // NSNumber wraps both booleans and numbers; CFBoolean detection keeps
            // JSON `true`/`false` from surfacing as 1/0.
            if CFGetTypeID(n) == CFBooleanGetTypeID() {
                return .bool(n.boolValue)
            }
            return .number(n.doubleValue)
        case let s as String:
            return .string(s)
        case let a as [Any]:
            return .array(a.map { from(any: $0) })
        case let o as [String: Any]:
            return .object(o.mapValues { from(any: $0) })
        default:
            return .null
        }
    }

    /// Convert to a `JSONSerialization`-compatible tree.
    var anyValue: Any {
        switch self {
        case .null:
            return NSNull()
        case .bool(let b):
            return b
        case .number(let n):
            // Emit integral doubles as integers so backend Zod `int` fields accept them.
            if n.truncatingRemainder(dividingBy: 1) == 0,
               n >= Double(Int64.min), n <= Double(Int64.max) {
                return Int64(n)
            }
            return n
        case .string(let s):
            return s
        case .array(let a):
            return a.map(\.anyValue)
        case .object(let o):
            return o.mapValues(\.anyValue)
        }
    }

    /// Parse JSON text into a value; nil when the text is not valid JSON.
    public static func parse(_ data: Data) -> JSONValue? {
        guard let any = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) else {
            return nil
        }
        return from(any: any)
    }

    /// Serialize this value to JSON data.
    public func serialized() throws -> Data {
        try JSONSerialization.data(withJSONObject: anyValue, options: [.fragmentsAllowed, .sortedKeys])
    }
}
