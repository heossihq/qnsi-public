/**
 * QNSP Billing - entitlement queries, usage meters, invoice listing,
 * credit balance. Wraps `apps/billing-service` (`/billing/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";

const PATH_PREFIX = "/proxy/billing/v1";

export interface BillingSignature {
	readonly provider: string;
	readonly algorithm: string;
	readonly value: string;
	readonly publicKey: string;
}

export interface BillingSecurityEnvelope {
	readonly controlPlaneTokenSha256: string | null;
	readonly pqcSignatures: readonly BillingSignature[];
	readonly hardwareProvider: string | null;
	readonly attestationStatus: string | null;
	readonly attestationProof: string | null;
}

export interface IngestMeterRequest {
	readonly source: string;
	readonly meterType: string;
	readonly quantity: number;
	readonly unit: string;
	readonly currency?: "USD";
	readonly recordedAt: string;
	readonly metadata?: Record<string, unknown>;
	readonly security: BillingSecurityEnvelope;
	readonly signature?: BillingSignature;
}

export interface ListInvoicesQuery {
	readonly limit?: number;
	readonly cursor?: string;
}

export class BillingClient {
	constructor(private readonly internal: Internal) {}

	async getEntitlements() {
		// reaudit 2026-06-13 #30: the bare /entitlements path does not exist on billing-service.
		// The resolved entitlements live at /billing/v1/entitlements/resolved/:tenantId.
		const tenantId = await this.internal.resolveTenantId();
		return this.internal.request("GET", `${PATH_PREFIX}/entitlements/resolved/${tenantId}`);
	}

	async ingestMeter(req: IngestMeterRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		const tenantId = await this.internal.resolveTenantId();
		return this.internal.request(
			"POST",
			`${PATH_PREFIX}/meters`,
			{ meters: [{ ...req, tenantId }] },
			opts,
		);
	}

	async ingestMeters(
		meters: readonly IngestMeterRequest[],
		opts?: Pick<RequestOptions, "idempotencyKey">,
	) {
		const tenantId = await this.internal.resolveTenantId();
		return this.internal.request(
			"POST",
			`${PATH_PREFIX}/meters`,
			{ meters: meters.map((meter) => ({ ...meter, tenantId })) },
			opts,
		);
	}

	async listInvoices(query?: ListInvoicesQuery) {
		const tenantId = await this.internal.resolveTenantId();
		return this.internal.request("GET", `${PATH_PREFIX}/invoices`, undefined, {
			query: { ...query, tenantId },
		});
	}

	async getInvoice(invoiceId: string) {
		const tenantId = await this.internal.resolveTenantId();
		return this.internal.request("GET", `${PATH_PREFIX}/invoices/${invoiceId}`, undefined, {
			query: { tenantId },
		});
	}

	getCreditBalance(tenantId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/credits/balance/${tenantId}`);
	}
}
