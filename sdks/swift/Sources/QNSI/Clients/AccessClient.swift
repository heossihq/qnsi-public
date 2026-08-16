import Foundation

private let prefix = "/proxy/access/v1"

/// RBAC: roles, permissions, role assignments. Wraps access-control-service `/access/v1`.
public struct AccessClient: Sendable {
    let transport: Transport

    /// Create an RBAC role with a permission set.
    public func createRole(
        name: String,
        permissions: [String],
        description: String? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = [
            "name": .string(name),
            "permissions": .array(permissions.map { .string($0) }),
        ]
        if let description { object["description"] = .string(description) }
        return try await transport.requestJson(
            "POST", "\(prefix)/roles", body: .object(object),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func getRole(roleId: String) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/roles/\(roleId)")
    }

    public func listRoles(query: [String: String?] = [:]) async throws -> JSONValue {
        try await transport.requestJson("GET", "\(prefix)/roles", options: RequestOptions(query: query))
    }

    public func deleteRole(roleId: String) async throws {
        _ = try await transport.execute("DELETE", "\(prefix)/roles/\(roleId)", body: nil, options: RequestOptions())
    }

    /// Assign a role to a subject, optionally scoped.
    public func assignRole(
        roleId: String,
        subjectId: String,
        scope: String? = nil,
        idempotencyKey: String? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = [
            "roleId": .string(roleId),
            "subjectId": .string(subjectId),
        ]
        if let scope { object["scope"] = .string(scope) }
        return try await transport.requestJson(
            "POST", "\(prefix)/role-assignments", body: .object(object),
            options: RequestOptions(idempotencyKey: idempotencyKey)
        )
    }

    public func revokeRoleAssignment(assignmentId: String) async throws {
        _ = try await transport.execute(
            "DELETE", "\(prefix)/role-assignments/\(assignmentId)", body: nil, options: RequestOptions()
        )
    }

    /// Check whether a subject holds a permission, optionally within a scope.
    public func checkPermission(
        subjectId: String,
        permission: String,
        scope: String? = nil
    ) async throws -> JSONValue {
        var object: [String: JSONValue] = [
            "subjectId": .string(subjectId),
            "permission": .string(permission),
        ]
        if let scope { object["scope"] = .string(scope) }
        return try await transport.requestJson("POST", "\(prefix)/check", body: .object(object))
    }
}
