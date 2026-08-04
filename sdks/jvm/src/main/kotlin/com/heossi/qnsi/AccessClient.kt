package com.heossi.qnsi

import com.heossi.qnsi.internal.Internal
import com.heossi.qnsi.internal.RequestOptions
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

private const val PREFIX = "/proxy/access/v1"

/** Create an RBAC role with a permission set. */
@Serializable
public data class CreateRoleRequest @JvmOverloads constructor(
    public val name: String,
    public val permissions: List<String>,
    public val description: String? = null,
)

/** Assign a role to a subject, optionally scoped. */
@Serializable
public data class AssignRoleRequest @JvmOverloads constructor(
    public val roleId: String,
    public val subjectId: String,
    public val scope: String? = null,
)

/** Check whether a subject holds a permission, optionally within a scope. */
@Serializable
public data class CheckPermissionRequest @JvmOverloads constructor(
    public val subjectId: String,
    public val permission: String,
    public val scope: String? = null,
)

/** RBAC: roles, permissions, role assignments. Wraps access-control-service `/access/v1`. */
public class AccessClient internal constructor(private val transport: Internal) {
    @JvmOverloads
    public fun createRole(req: CreateRoleRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/roles",
            transport.json.encodeToString(CreateRoleRequest.serializer(), req),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    public fun getRole(roleId: String): JsonObject =
        transport.requestJson("GET", "$PREFIX/roles/$roleId", null)

    @JvmOverloads
    public fun listRoles(query: Map<String, String?> = emptyMap()): JsonObject =
        transport.requestJson("GET", "$PREFIX/roles", null, RequestOptions(query = query))

    public fun deleteRole(roleId: String) {
        transport.execute("DELETE", "$PREFIX/roles/$roleId", null, RequestOptions())
    }

    @JvmOverloads
    public fun assignRole(req: AssignRoleRequest, idempotencyKey: String? = null): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/role-assignments",
            transport.json.encodeToString(AssignRoleRequest.serializer(), req),
            RequestOptions(idempotencyKey = idempotencyKey),
        )

    public fun revokeRoleAssignment(assignmentId: String) {
        transport.execute("DELETE", "$PREFIX/role-assignments/$assignmentId", null, RequestOptions())
    }

    public fun checkPermission(req: CheckPermissionRequest): JsonObject =
        transport.requestJson(
            "POST", "$PREFIX/check",
            transport.json.encodeToString(CheckPermissionRequest.serializer(), req),
        )
}
