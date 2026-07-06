/**
 * QNSP Tenant — tenant CRUD, crypto-policy management, current-health,
 * current-quotas. Wraps `apps/tenant-service` (`/tenant/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";

const PATH_PREFIX = "/proxy/tenant/v1";

export interface CreateTenantRequest {
	readonly name: string;
	readonly slug?: string;
	readonly tier?: string;
	readonly parentTenantId?: string;
	readonly metadata?: Record<string, unknown>;
}

export class TenantClient {
	constructor(private readonly internal: Internal) {}

	createTenant(req: CreateTenantRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/tenants`, req, opts);
	}

	getTenant(tenantId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/tenants/${tenantId}`);
	}

	updateTenant(
		tenantId: string,
		body: Record<string, unknown>,
		opts?: Pick<RequestOptions, "idempotencyKey">,
	) {
		return this.internal.request("PATCH", `${PATH_PREFIX}/tenants/${tenantId}`, body, opts);
	}

	listTenants(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/tenants`, undefined, { query });
	}

	getCryptoPolicy(tenantId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/tenants/${tenantId}/crypto-policy`);
	}

	upsertCryptoPolicy(
		tenantId: string,
		body: Record<string, unknown>,
		opts?: Pick<RequestOptions, "idempotencyKey">,
	) {
		return this.internal.request(
			"PUT",
			`${PATH_PREFIX}/tenants/${tenantId}/crypto-policy`,
			body,
			opts,
		);
	}

	getCurrentHealth(tenantId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/tenants/${tenantId}/health`);
	}

	getCurrentQuotas(tenantId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/tenants/${tenantId}/quotas`);
	}
}
