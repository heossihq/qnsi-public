/**
 * QNSI Crypto-Inventory (CBOM) - asset catalogue, discovery runs,
 * deprecation policies, PQC migration readiness. Wraps
 * `apps/crypto-inventory-service` (`/crypto/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";

const PATH_PREFIX = "/proxy/crypto/v1";

export interface DiscoverAssetsRequest {
	readonly source?: string;
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

	/** Backend authorization remains authoritative for an explicit tenant. */
	getAssetStats(tenantId?: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/assets/stats`, undefined, {
			query: { tenantId },
		});
	}

	discoverAssets(req: DiscoverAssetsRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/assets/discover`, req, opts);
	}

	/**
	 * Basic readiness summary (`/readiness`). For the scored PQC-migration
	 * attestation prefer {@link getPqcReadinessScore}.
	 */
	getReadinessScore(tenantId?: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/readiness`, undefined, {
			query: { tenantId },
		});
	}

	/**
	 * PQC migration-readiness score for the tenant (0-100 with category
	 * breakdown) - the score behind a "PQC-ready" attestation.
	 */
	getPqcReadinessScore() {
		return this.internal.request("GET", `${PATH_PREFIX}/pqc-readiness/score`);
	}

	/** Actionable PQC-migration recommendations for the tenant. */
	getPqcReadinessRecommendations() {
		return this.internal.request("GET", `${PATH_PREFIX}/pqc-readiness/recommendations`);
	}

	/**
	 * Aggregated Cryptographic Bill of Materials (CycloneDX 1.5) for the tenant -
	 * the machine-verifiable inventory behind the conformance/attestation claim.
	 */
	getCbom(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/cbom`, undefined, { query });
	}

	/** List discovery runs for the tenant. */
	listDiscoveryRuns(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/discovery/runs`, undefined, { query });
	}

	/**
	 * Import a batch of cryptographic assets (scan output / inventory upload)
	 * into the tenant's CBOM.
	 */
	importAssets(body: Record<string, unknown>, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/assets/import`, body, opts);
	}
}
