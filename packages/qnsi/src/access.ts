/**
 * QNSP Access-Control - RBAC: roles, permissions, role assignments.
 * Wraps `apps/access-control-service` (`/access/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";

const PATH_PREFIX = "/proxy/access/v1";

export interface CreateRoleRequest {
	readonly name: string;
	readonly permissions: readonly string[];
	readonly description?: string;
}

export interface AssignRoleRequest {
	readonly roleId: string;
	readonly subjectId: string;
	readonly scope?: string;
}

export interface CheckPermissionRequest {
	readonly subjectId: string;
	readonly permission: string;
	readonly scope?: string;
}

export class AccessClient {
	constructor(private readonly internal: Internal) {}

	createRole(req: CreateRoleRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/roles`, req, opts);
	}

	getRole(roleId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/roles/${roleId}`);
	}

	listRoles(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/roles`, undefined, { query });
	}

	async deleteRole(roleId: string): Promise<void> {
		await this.internal.request("DELETE", `${PATH_PREFIX}/roles/${roleId}`);
	}

	assignRole(req: AssignRoleRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/role-assignments`, req, opts);
	}

	async revokeRoleAssignment(assignmentId: string): Promise<void> {
		await this.internal.request("DELETE", `${PATH_PREFIX}/role-assignments/${assignmentId}`);
	}

	checkPermission(req: CheckPermissionRequest) {
		return this.internal.request("POST", `${PATH_PREFIX}/check`, req);
	}
}
