/**
 * Top-level QNSI SDK entry point.
 *
 * One client owns one HTTP connection pool and one activation cache;
 * the eleven service sub-clients (`vault`, `kms`, `audit`, `auth`,
 * `tenant`, `access`, `billing`, `cryptoInventory`, `storage`,
 * `search`, `ai`) share both. Mirrors the Python / Go / Rust
 * SDK shape byte-for-byte.
 */

import type { SdkActivationResponse } from "./_activation/index.js";
import { Internal, type QnsiClientOptions } from "./_internal.js";
import { AccessClient } from "./access.js";
import { AiClient } from "./ai.js";
import { AuditClient } from "./audit.js";
import { AuthClient } from "./auth.js";
import { BillingClient } from "./billing.js";
import { CryptoInventoryClient } from "./crypto-inventory.js";
import {
	AccessControlSurfaceClient,
	AiOrchestratorSurfaceClient,
	AuditSurfaceClient,
	AuthSurfaceClient,
	BillingSurfaceClient,
	CryptoInventorySurfaceClient,
	KmsSurfaceClient,
	ObservabilitySurfaceClient,
	PlatformApiSurfaceClient,
	QuotaSurfaceClient,
	SearchSurfaceClient,
	SecurityMonitoringSurfaceClient,
	StorageSurfaceClient,
	TenantSurfaceClient,
	VaultSurfaceClient,
} from "./generated/index.js";
import { KmsClient } from "./kms.js";
import { SearchClient } from "./search.js";
import { StorageClient } from "./storage.js";
import { TenantClient } from "./tenant.js";
import { VaultClient } from "./vault.js";

export class QnsiClient {
	readonly vault: VaultClient;
	readonly kms: KmsClient;
	readonly audit: AuditClient;
	readonly auth: AuthClient;
	readonly tenant: TenantClient;
	readonly access: AccessClient;
	readonly billing: BillingClient;
	readonly cryptoInventory: CryptoInventoryClient;
	readonly storage: StorageClient;
	readonly search: SearchClient;
	readonly ai: AiClient;
	/**
	 * Full backend surface: typed clients generated from the service manifests
	 * (879 customer-facing routes). The edge gateway enforces authentication,
	 * tenant scoping, and billing entitlements per route.
	 */
	readonly surface: {
		accessControl: AccessControlSurfaceClient;
		aiOrchestrator: AiOrchestratorSurfaceClient;
		audit: AuditSurfaceClient;
		auth: AuthSurfaceClient;
		billing: BillingSurfaceClient;
		cryptoInventory: CryptoInventorySurfaceClient;
		kms: KmsSurfaceClient;
		observability: ObservabilitySurfaceClient;
		platformApi: PlatformApiSurfaceClient;
		quota: QuotaSurfaceClient;
		search: SearchSurfaceClient;
		securityMonitoring: SecurityMonitoringSurfaceClient;
		storage: StorageSurfaceClient;
		tenant: TenantSurfaceClient;
		vault: VaultSurfaceClient;
	};

	private readonly internal: Internal;

	constructor(options: QnsiClientOptions) {
		this.internal = new Internal(options);
		this.vault = new VaultClient(this.internal);
		this.kms = new KmsClient(this.internal);
		this.audit = new AuditClient(this.internal);
		this.auth = new AuthClient(this.internal);
		this.tenant = new TenantClient(this.internal);
		this.access = new AccessClient(this.internal);
		this.billing = new BillingClient(this.internal);
		this.cryptoInventory = new CryptoInventoryClient(this.internal);
		this.storage = new StorageClient(this.internal);
		this.search = new SearchClient(this.internal);
		this.ai = new AiClient(this.internal);
		this.surface = {
			accessControl: new AccessControlSurfaceClient(this.internal),
			aiOrchestrator: new AiOrchestratorSurfaceClient(this.internal),
			audit: new AuditSurfaceClient(this.internal),
			auth: new AuthSurfaceClient(this.internal),
			billing: new BillingSurfaceClient(this.internal),
			cryptoInventory: new CryptoInventorySurfaceClient(this.internal),
			kms: new KmsSurfaceClient(this.internal),
			observability: new ObservabilitySurfaceClient(this.internal),
			platformApi: new PlatformApiSurfaceClient(this.internal),
			quota: new QuotaSurfaceClient(this.internal),
			search: new SearchSurfaceClient(this.internal),
			securityMonitoring: new SecurityMonitoringSurfaceClient(this.internal),
			storage: new StorageSurfaceClient(this.internal),
			tenant: new TenantSurfaceClient(this.internal),
			vault: new VaultSurfaceClient(this.internal),
		};
	}

	/**
	 * Force the activation handshake to run now. Surfaces invalid-API-key
	 * errors at startup rather than on the first service call.
	 */
	async ensureActivated(): Promise<SdkActivationResponse> {
		return this.internal.ensureActivated();
	}

	/** Tenant ID resolved by activation. */
	async tenantId(): Promise<string> {
		const a = await this.internal.ensureActivated();
		return a.tenantId;
	}

	/** Plan tier resolved by activation. */
	async tier(): Promise<string> {
		const a = await this.internal.ensureActivated();
		return a.tier;
	}

	/** Tier limits dict from activation. */
	async limits(): Promise<Record<string, unknown>> {
		const a = await this.internal.ensureActivated();
		return a.limits as unknown as Record<string, unknown>;
	}

	/** Whether the tenant's plan enables a billing-side boolean feature. */
	async hasFeature(feature: string): Promise<boolean> {
		const limits = await this.limits();
		const v = limits[feature];
		return v === true;
	}
}

export type { QnsiClientOptions } from "./_internal.js";
