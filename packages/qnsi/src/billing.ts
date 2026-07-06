/**
 * QNSP Billing — entitlement queries, usage meters, invoice listing,
 * credit balance. Wraps `apps/billing-service` (`/billing/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";

const PATH_PREFIX = "/proxy/billing/v1";

export interface IngestMeterRequest {
	readonly meterId: string;
	readonly quantity: number;
	readonly occurredAt?: string;
	readonly metadata?: Record<string, unknown>;
}

export class BillingClient {
	constructor(private readonly internal: Internal) {}

	async getEntitlements() {
		// reaudit 2026-06-13 #30: the bare /entitlements path does not exist on billing-service.
		// The resolved entitlements live at /billing/v1/entitlements/resolved/:tenantId.
		const tenantId = await this.internal.resolveTenantId();
		return this.internal.request("GET", `${PATH_PREFIX}/entitlements/resolved/${tenantId}`);
	}

	ingestMeter(req: IngestMeterRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/meters`, req, opts);
	}

	ingestMeters(
		meters: readonly IngestMeterRequest[],
		opts?: Pick<RequestOptions, "idempotencyKey">,
	) {
		return this.internal.request("POST", `${PATH_PREFIX}/meters/batch`, { meters }, opts);
	}

	listInvoices(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/invoices`, undefined, { query });
	}

	getInvoice(invoiceId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/invoices/${invoiceId}`);
	}

	getCreditBalance(tenantId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/credits/balance/${tenantId}`);
	}
}
