/**
 * QNSP Crypto-Inventory (CBOM) — asset catalogue, discovery runs,
 * deprecation policies, PQC migration readiness. Wraps
 * `apps/crypto-inventory-service` (`/crypto/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";

const PATH_PREFIX = "/proxy/crypto/v1";

export interface DiscoverAssetsRequest {
	readonly targets?: readonly string[];
	readonly modes?: readonly string[];
	readonly options?: Record<string, unknown>;
}

export class CryptoInventoryClient {
	constructor(private readonly internal: Internal) {}

	listAssets(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/assets`, undefined, { query });
	}

	getAsset(assetId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/assets/${assetId}`);
	}

	getAssetStats(tenantId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/assets/stats/${tenantId}`);
	}

	discoverAssets(req: DiscoverAssetsRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/discovery/runs`, req, opts);
	}

	getReadinessScore(tenantId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/readiness/${tenantId}`);
	}
}
