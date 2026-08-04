/**
 * QNSP Tenant - tenant CRUD, crypto-policy management, current-health,
 * current-quotas. Wraps `apps/tenant-service` (`/tenant/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";

const PATH_PREFIX = "/proxy/tenant/v1";

export interface TenantSignature {
	readonly provider: string;
	readonly algorithm: string;
	readonly value: string;
	readonly publicKey: string;
}

export interface TenantSecurityEnvelope {
	readonly controlPlaneTokenSha256: string | null;
	readonly pqcSignatures: readonly TenantSignature[];
	readonly hardwareProvider: string | null;
	readonly attestationStatus: string | null;
	readonly attestationProof: string | null;
}

export interface CreateTenantRequest {
	readonly name: string;
	readonly slug: string;
	readonly plan?: string;
	readonly region?: string;
	readonly complianceTags?: readonly string[];
	readonly hsmMode?: "none" | "supported" | "required";
	readonly metadata?: Record<string, unknown>;
	readonly domains?: readonly {
		readonly domain: string;
		readonly verified?: boolean;
	}[];
	readonly security: TenantSecurityEnvelope;
	readonly signature?: TenantSignature;
}

export interface UpdateTenantRequest {
	readonly name?: string;
	readonly plan?: string;
	readonly status?: "active" | "suspended" | "pending" | "deleted";
	readonly complianceTags?: readonly string[];
	readonly hsmMode?: "none" | "supported" | "required";
	readonly metadata?: Record<string, unknown>;
	readonly security: TenantSecurityEnvelope;
	readonly signature?: TenantSignature;
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
		body: UpdateTenantRequest,
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
		return this.internal.request("GET", `${PATH_PREFIX}/health/current`, undefined, {
			query: { tenantId },
		});
	}

	getCurrentQuotas(tenantId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/quotas/current`, undefined, {
			query: { tenantId },
		});
	}
}
