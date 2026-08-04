import { performance } from "node:perf_hooks";

import { activateSdk, type SdkActivationConfig } from "@heossihq/qnsi-sdk-activation";

import type {
	VaultClientTelemetry,
	VaultClientTelemetryConfig,
	VaultClientTelemetryEvent,
} from "./observability.js";
import { createVaultClientTelemetry, isVaultClientTelemetry } from "./observability.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";
import { checkTierAccess, type PricingTier, TierError } from "./tier.js";
import { validateUUID } from "./validation.js";

export { TierError };

/**
 * @heossihq/qnsi-vault-sdk
 *
 * TypeScript SDK client for the QNSP vault-service API.
 * Provides a high-level interface for secret management with envelope encryption, versioning, and rotation.
 * All secrets are encrypted with tenant-specific PQC algorithms based on crypto policy.
 *
 * TIER REQUIREMENT: dev-pro or higher
 * Vault features are not available on free or dev-starter tiers.
 */

/**
 * Mapping from internal algorithm names to NIST/standards display names.
 * Covers all 87 runtime-supported PQC algorithms (24 KEMs + 63 signatures).
 * HQC's 3 variants are excluded (disabled in the liboqs build for CVE-2025-48946).
 * Canonical source: @heossihq/qnsi-cryptography pqc-standards.ts ALGORITHM_NIST_NAMES
 */
export const ALGORITHM_TO_NIST: Record<string, string> = {
	// FIPS 203 - ML-KEM
	"kyber-512": "ML-KEM-512",
	"kyber-768": "ML-KEM-768",
	"kyber-1024": "ML-KEM-1024",
	// FIPS 204 - ML-DSA
	"dilithium-2": "ML-DSA-44",
	"dilithium-3": "ML-DSA-65",
	"dilithium-5": "ML-DSA-87",
	// FIPS 205 - SLH-DSA (SHA-2 variants)
	"sphincs-sha2-128f-simple": "SLH-DSA-SHA2-128f",
	"sphincs-sha2-128s-simple": "SLH-DSA-SHA2-128s",
	"sphincs-sha2-192f-simple": "SLH-DSA-SHA2-192f",
	"sphincs-sha2-192s-simple": "SLH-DSA-SHA2-192s",
	"sphincs-sha2-256f-simple": "SLH-DSA-SHA2-256f",
	"sphincs-sha2-256s-simple": "SLH-DSA-SHA2-256s",
	// FIPS 205 - SLH-DSA (SHAKE variants)
	"sphincs-shake-128f-simple": "SLH-DSA-SHAKE-128f",
	"sphincs-shake-128s-simple": "SLH-DSA-SHAKE-128s",
	"sphincs-shake-192f-simple": "SLH-DSA-SHAKE-192f",
	"sphincs-shake-192s-simple": "SLH-DSA-SHAKE-192s",
	"sphincs-shake-256f-simple": "SLH-DSA-SHAKE-256f",
	"sphincs-shake-256s-simple": "SLH-DSA-SHAKE-256s",
	// FN-DSA (FIPS 206 draft)
	"falcon-512": "FN-DSA-512",
	"falcon-1024": "FN-DSA-1024",
	// HQC (NIST selected March 2025)
	// BIKE (NIST Round 4)
	"bike-l1": "BIKE-L1",
	"bike-l3": "BIKE-L3",
	"bike-l5": "BIKE-L5",
	// Classic McEliece (ISO standard)
	"mceliece-348864": "Classic-McEliece-348864",
	"mceliece-460896": "Classic-McEliece-460896",
	"mceliece-6688128": "Classic-McEliece-6688128",
	"mceliece-6960119": "Classic-McEliece-6960119",
	"mceliece-8192128": "Classic-McEliece-8192128",
	// FrodoKEM (ISO standard)
	"frodokem-640-aes": "FrodoKEM-640-AES",
	"frodokem-640-shake": "FrodoKEM-640-SHAKE",
	"frodokem-976-aes": "FrodoKEM-976-AES",
	"frodokem-976-shake": "FrodoKEM-976-SHAKE",
	"frodokem-1344-aes": "FrodoKEM-1344-AES",
	"frodokem-1344-shake": "FrodoKEM-1344-SHAKE",
	// NTRU (lattice-based, re-added in liboqs 0.15)
	"ntru-hps-2048-509": "NTRU-HPS-2048-509",
	"ntru-hps-2048-677": "NTRU-HPS-2048-677",
	"ntru-hps-4096-821": "NTRU-HPS-4096-821",
	"ntru-hps-4096-1229": "NTRU-HPS-4096-1229",
	"ntru-hrss-701": "NTRU-HRSS-701",
	"ntru-hrss-1373": "NTRU-HRSS-1373",
	// NTRU-Prime
	sntrup761: "sntrup761",
	// MAYO (NIST Additional Signatures Round 2)
	"mayo-1": "MAYO-1",
	"mayo-2": "MAYO-2",
	"mayo-3": "MAYO-3",
	"mayo-5": "MAYO-5",
	// CROSS (NIST Additional Signatures Round 2)
	"cross-rsdp-128-balanced": "CROSS-RSDP-128-balanced",
	"cross-rsdp-128-fast": "CROSS-RSDP-128-fast",
	"cross-rsdp-128-small": "CROSS-RSDP-128-small",
	"cross-rsdp-192-balanced": "CROSS-RSDP-192-balanced",
	"cross-rsdp-192-fast": "CROSS-RSDP-192-fast",
	"cross-rsdp-192-small": "CROSS-RSDP-192-small",
	"cross-rsdp-256-balanced": "CROSS-RSDP-256-balanced",
	"cross-rsdp-256-fast": "CROSS-RSDP-256-fast",
	"cross-rsdp-256-small": "CROSS-RSDP-256-small",
	"cross-rsdpg-128-balanced": "CROSS-RSDPG-128-balanced",
	"cross-rsdpg-128-fast": "CROSS-RSDPG-128-fast",
	"cross-rsdpg-128-small": "CROSS-RSDPG-128-small",
	"cross-rsdpg-192-balanced": "CROSS-RSDPG-192-balanced",
	"cross-rsdpg-192-fast": "CROSS-RSDPG-192-fast",
	"cross-rsdpg-192-small": "CROSS-RSDPG-192-small",
	"cross-rsdpg-256-balanced": "CROSS-RSDPG-256-balanced",
	"cross-rsdpg-256-fast": "CROSS-RSDPG-256-fast",
	"cross-rsdpg-256-small": "CROSS-RSDPG-256-small",
	// UOV (NIST Additional Signatures Round 2)
	"ov-Is": "UOV-Is",
	"ov-Ip": "UOV-Ip",
	"ov-III": "UOV-III",
	"ov-V": "UOV-V",
	"ov-Is-pkc": "UOV-Is-pkc",
	"ov-Ip-pkc": "UOV-Ip-pkc",
	"ov-III-pkc": "UOV-III-pkc",
	"ov-V-pkc": "UOV-V-pkc",
	"ov-Is-pkc-skc": "UOV-Is-pkc-skc",
	"ov-Ip-pkc-skc": "UOV-Ip-pkc-skc",
	"ov-III-pkc-skc": "UOV-III-pkc-skc",
	"ov-V-pkc-skc": "UOV-V-pkc-skc",
	// SNOVA (NIST Additional Signatures Round 2, liboqs 0.14+)
	"snova-24-5-4": "SNOVA-24-5-4",
	"snova-24-5-4-shake": "SNOVA-24-5-4-SHAKE",
	"snova-24-5-4-esk": "SNOVA-24-5-4-ESK",
	"snova-24-5-4-shake-esk": "SNOVA-24-5-4-SHAKE-ESK",
	"snova-25-8-3": "SNOVA-25-8-3",
	"snova-37-17-2": "SNOVA-37-17-2",
	"snova-37-8-4": "SNOVA-37-8-4",
	"snova-24-5-5": "SNOVA-24-5-5",
	"snova-56-25-2": "SNOVA-56-25-2",
	"snova-49-11-3": "SNOVA-49-11-3",
	"snova-60-10-4": "SNOVA-60-10-4",
	"snova-29-6-5": "SNOVA-29-6-5",
};

/**
 * Convert internal algorithm name to NIST standardized name.
 */
export function toNistAlgorithmName(algorithm: string): string {
	return ALGORITHM_TO_NIST[algorithm] ?? algorithm;
}

/** Default QNSP cloud API base URL. Get a free API key at https://cloud.qnsi.heossi.com/signup */
export const DEFAULT_BASE_URL = "https://api.qnsi.heossi.com";

export interface VaultClientConfig {
	readonly baseUrl?: string;
	readonly apiKey: string;
	readonly tier?: PricingTier;
	readonly timeoutMs?: number;
	readonly telemetry?: VaultClientTelemetry | VaultClientTelemetryConfig;
	readonly maxRetries?: number;
	readonly retryDelayMs?: number;
}

type InternalVaultClientConfig = {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly timeoutMs: number;
	readonly maxRetries: number;
	readonly retryDelayMs: number;
};

export interface RotationPolicy {
	/** When false the secret is never auto-rotated (static / not opted in). */
	readonly enabled: boolean;
	readonly intervalSeconds: number;
	readonly expiresAt: number | null;
}

export interface RotationPolicyInput {
	readonly enabled?: boolean;
	readonly intervalSeconds?: number;
	readonly expiresAt?: number;
}

export interface SecretEnvelope {
	readonly encrypted: string;
	readonly algorithm: string;
	readonly keyId?: string;
}

export interface VaultSecretPqcMetadata {
	readonly provider: string;
	readonly algorithm: string;
	readonly algorithmNist?: string;
	readonly keyId: string;
}

export interface Secret {
	readonly id: string;
	readonly name: string;
	readonly tenantId: string;
	readonly version: number;
	readonly metadata: Record<string, unknown>;
	readonly rotationPolicy: RotationPolicy;
	readonly checksum: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly versionCreatedAt: string;
	readonly envelope: SecretEnvelope;
	readonly pqc?: VaultSecretPqcMetadata;
}

export interface CreateSecretRequest {
	readonly tenantId?: string;
	readonly name: string;
	readonly payload: string; // Base64-encoded payload
	readonly metadata?: Record<string, unknown>;
	readonly rotationPolicy?: RotationPolicyInput;
}

export interface RotateSecretRequest {
	readonly tenantId: string;
	readonly newPayload?: string; // Base64-encoded payload
	readonly metadata?: Record<string, unknown>;
	readonly rotationPolicy?: RotationPolicyInput;
}

interface RequestOptions {
	readonly body?: unknown;
	readonly headers?: Record<string, string>;
	readonly signal?: AbortSignal;
	readonly operation?: string;
	readonly telemetryRoute?: string;
	readonly telemetryTarget?: string;
}

// ============================================================================
// Dynamic Secrets Types
// ============================================================================

export type DynamicSecretType = "database" | "api_key" | "cloud_credentials" | "ssh_key";

export type DynamicSecretBackendType =
	| "postgresql"
	| "mysql"
	| "mongodb"
	| "redis"
	| "aws_iam"
	| "gcp_sa"
	| "azure_sp";

export interface DynamicSecretBackend {
	readonly type: DynamicSecretBackendType;
	readonly connectionString?: string;
	readonly host?: string;
	readonly port?: number;
	readonly adminUsername?: string;
	readonly adminPassword?: string;
	readonly database?: string;
	readonly region?: string;
	readonly roleArn?: string;
}

export interface DynamicSecretTemplate {
	readonly usernameTemplate?: string;
	readonly creationStatements?: readonly string[];
	readonly revocationStatements?: readonly string[];
	readonly rotationStatements?: readonly string[];
}

export interface CreateDynamicSecretConfigRequest {
	readonly name: string;
	readonly secretType: DynamicSecretType;
	readonly backend: DynamicSecretBackend;
	readonly defaultTtlSeconds?: number;
	readonly maxTtlSeconds?: number;
	readonly template?: DynamicSecretTemplate;
	readonly tenantId?: string;
}

export interface DynamicSecretConfig {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly secretType: DynamicSecretType;
	readonly backendType?: DynamicSecretBackendType;
	readonly defaultTtlSeconds: number;
	readonly maxTtlSeconds: number;
	readonly enabled: boolean;
	readonly createdAt: string;
}

export interface ListDynamicSecretConfigsResponse {
	readonly configs: readonly DynamicSecretConfig[];
}

export interface RequestCredentialsRequest {
	readonly ttlSeconds?: number;
	readonly metadata?: Record<string, unknown>;
	readonly tenantId?: string;
}

export interface DynamicCredentials {
	readonly leaseId: string;
	readonly credentials: {
		readonly username: string;
		readonly password: string;
	};
	readonly expiresAt: string;
	readonly ttlSeconds: number;
	readonly renewable: boolean;
}

export interface DynamicSecretLease {
	readonly id: string;
	readonly username: string;
	readonly expiresAt: string;
	readonly metadata?: Record<string, unknown>;
	readonly createdAt: string;
}

export interface ListLeasesResponse {
	readonly leases: readonly DynamicSecretLease[];
}

export interface RenewLeaseRequest {
	readonly ttlSeconds?: number;
}

export interface RenewLeaseResponse {
	readonly leaseId: string;
	readonly expiresAt: string;
	readonly ttlSeconds: number;
}

export interface DynamicSecretStats {
	readonly totalConfigs: number;
	readonly enabledConfigs: number;
	readonly secretTypes: number;
	readonly activeLeases: number;
	readonly revokedLeases: number;
	readonly expiredLeases: number;
}

// ============================================================================
// Secret Leakage Detection Types
// ============================================================================

export type LeakageSource =
	| "github"
	| "gitlab"
	| "bitbucket"
	| "pastebin"
	| "dark_web"
	| "public_cloud"
	| "internal_scan"
	| "threat_feed"
	| "manual_report";

export type LeakageSeverity = "critical" | "high" | "medium" | "low" | "info";

export type LeakageStatus =
	| "detected"
	| "investigating"
	| "confirmed"
	| "false_positive"
	| "remediated"
	| "ignored";

export type ThreatFeedProvider =
	| "have_i_been_pwned"
	| "spycloud"
	| "recorded_future"
	| "flashpoint"
	| "intel471"
	| "custom";

export type LeakageSecretType =
	| "api_key"
	| "password"
	| "certificate"
	| "ssh_key"
	| "token"
	| "connection_string";

export type LeakageAutoRemediationAction =
	| "rotate_secret"
	| "revoke_leases"
	| "disable_secret"
	| "notify_owner"
	| "create_incident";

export interface LeakageThreatFeed {
	readonly provider: ThreatFeedProvider;
	readonly apiKeyRef?: string;
	readonly customEndpoint?: string;
	readonly enabled?: boolean;
}

export interface LeakageScanTargets {
	readonly secretTypes: readonly LeakageSecretType[];
	readonly secretNames?: readonly string[];
	readonly secretTags?: Record<string, string>;
}

export interface LeakageAlerting {
	readonly enabled?: boolean;
	readonly minSeverity?: LeakageSeverity;
	readonly webhookUrl?: string;
	readonly emailRecipients?: readonly string[];
	readonly slackChannel?: string;
}

export interface LeakageAutoRemediation {
	readonly enabled?: boolean;
	readonly actions?: readonly LeakageAutoRemediationAction[];
	readonly requireApproval?: boolean;
}

export interface LeakageScanSchedule {
	readonly intervalMinutes?: number;
	readonly lastScanAt?: string;
}

export interface CreateLeakagePolicyRequest {
	readonly name: string;
	readonly description?: string;
	readonly enabled?: boolean;
	readonly scanTargets: LeakageScanTargets;
	readonly scanSources: readonly LeakageSource[];
	readonly threatFeeds?: readonly LeakageThreatFeed[];
	readonly alerting: LeakageAlerting;
	readonly autoRemediation?: LeakageAutoRemediation;
	readonly scanSchedule: LeakageScanSchedule;
	readonly tenantId?: string;
}

export interface LeakagePolicy {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly description?: string;
	readonly enabled: boolean;
	readonly scanTargets: LeakageScanTargets;
	readonly scanSources: readonly LeakageSource[];
	readonly threatFeeds?: readonly LeakageThreatFeed[];
	readonly alerting: LeakageAlerting;
	readonly autoRemediation?: LeakageAutoRemediation;
	readonly scanSchedule: LeakageScanSchedule;
	readonly createdAt: string;
	readonly updatedAt?: string;
}

export interface ListLeakagePoliciesResponse {
	readonly policies: readonly LeakagePolicy[];
}

export interface LeakageEvidence {
	readonly url?: string;
	readonly snippet?: string;
	readonly hash?: string;
	readonly metadata?: Record<string, unknown>;
}

export interface LeakageThreatFeedMatch {
	readonly provider: ThreatFeedProvider;
	readonly matchId: string;
	readonly confidence: number;
	readonly breachName?: string;
	readonly breachDate?: string;
}

export interface ReportLeakageIncidentRequest {
	readonly secretId: string;
	readonly source: LeakageSource;
	readonly severity: LeakageSeverity;
	readonly detectedAt: string;
	readonly evidence: LeakageEvidence;
	readonly threatFeedMatch?: LeakageThreatFeedMatch;
	readonly notes?: string;
	readonly tenantId?: string;
}

export interface LeakageRemediationAction {
	readonly action: string;
	readonly performedAt: string;
	readonly performedBy: string;
	readonly result: "success" | "failure" | "pending";
}

export interface LeakageIncident {
	readonly id: string;
	readonly tenantId: string;
	readonly secretId: string;
	readonly source: LeakageSource;
	readonly severity: LeakageSeverity;
	readonly status: LeakageStatus;
	readonly detectedAt: string;
	readonly evidence?: LeakageEvidence;
	readonly threatFeedMatch?: LeakageThreatFeedMatch;
	readonly assignee?: string;
	readonly notes?: string;
	readonly remediationActions?: readonly LeakageRemediationAction[];
	readonly createdAt: string;
	readonly updatedAt?: string;
}

export interface ListLeakageIncidentsOptions {
	readonly status?: LeakageStatus;
	readonly severity?: LeakageSeverity;
	readonly secretId?: string;
	readonly limit?: number;
	readonly offset?: number;
	readonly tenantId?: string;
}

export interface ListLeakageIncidentsResponse {
	readonly incidents: readonly LeakageIncident[];
}

export interface UpdateLeakageIncidentStatusRequest {
	readonly status?: LeakageStatus;
	readonly assignee?: string;
	readonly notes?: string;
	readonly remediationActions?: readonly LeakageRemediationAction[];
	readonly tenantId?: string;
}

export interface TriggerLeakageScanRequest {
	readonly secretIds?: readonly string[];
	readonly sources?: readonly LeakageSource[];
	readonly threatFeeds?: readonly ThreatFeedProvider[];
	readonly force?: boolean;
	readonly tenantId?: string;
}

export interface TriggerLeakageScanResponse {
	readonly scanId: string;
	readonly status: string;
	readonly startedAt: string;
	readonly message: string;
}

export interface LeakageStats {
	readonly incidents: {
		readonly total: number;
		readonly byStatus: {
			readonly detected: number;
			readonly investigating: number;
			readonly confirmed: number;
			readonly remediated: number;
			readonly falsePositive: number;
		};
		readonly bySeverity: {
			readonly critical: number;
			readonly high: number;
			readonly medium: number;
			readonly low: number;
		};
	};
	readonly policies: {
		readonly total: number;
		readonly enabled: number;
	};
	readonly scans: {
		readonly total: number;
		readonly completed: number;
		readonly lastScanAt: string | null;
	};
}

// ============================================================================
// Versioned Secrets Types
// ============================================================================

export type SecretVersionState = "active" | "deprecated" | "archived" | "destroyed";

export interface VersionRotationPolicy {
	readonly enabled?: boolean;
	readonly intervalDays?: number;
	readonly notifyBeforeDays?: number;
}

export interface VersionRetentionPolicy {
	readonly maxVersions?: number;
	readonly retentionDays?: number;
	readonly destroyOnArchive?: boolean;
	readonly autoArchiveAfterDays?: number;
}

export interface CreateSecretVersionRequest {
	readonly secretId: string;
	readonly value: string;
	readonly metadata?: Record<string, unknown>;
	readonly rotationPolicy?: VersionRotationPolicy;
	readonly retentionPolicy?: VersionRetentionPolicy;
	readonly changeReason?: string;
	readonly approvedBy?: string;
	readonly tenantId?: string;
}

export interface SecretVersion {
	readonly id: string;
	readonly secretId: string;
	readonly version: number;
	readonly state: SecretVersionState;
	readonly metadata?: Record<string, unknown>;
	readonly rotationPolicy?: VersionRotationPolicy;
	readonly retentionPolicy?: VersionRetentionPolicy;
	readonly changeReason?: string;
	readonly approvedBy?: string;
	readonly createdAt: string;
	readonly updatedAt?: string;
}

export interface CreateSecretVersionResponse {
	readonly versionId: string;
	readonly secretId: string;
	readonly version: number;
	readonly state: SecretVersionState;
	readonly createdAt: string;
}

export interface ListSecretVersionsOptions {
	readonly limit?: number;
	readonly offset?: number;
	readonly state?: SecretVersionState;
	readonly fromDate?: string;
	readonly toDate?: string;
	readonly tenantId?: string;
}

export interface ListSecretVersionsResponse {
	readonly secretId: string;
	readonly versions: readonly SecretVersion[];
	readonly pagination: {
		readonly total: number;
		readonly limit: number;
		readonly offset: number;
		readonly hasMore: boolean;
	};
}

export interface RollbackSecretRequest {
	readonly targetVersion: number;
	readonly createNewVersion?: boolean;
	readonly reason?: string;
	readonly approvedBy?: string;
	readonly tenantId?: string;
}

export interface RollbackSecretResponse {
	readonly secretId: string;
	readonly rolledBackToVersion: number;
	readonly newVersion?: number;
	readonly newVersionId?: string;
	readonly previousActiveVersion?: number;
	readonly createdAt?: string;
	readonly updatedAt?: string;
}

export interface CompareVersionsRequest {
	readonly version1: number;
	readonly version2: number;
	readonly includeValues?: boolean;
	readonly tenantId?: string;
}

export interface VersionComparison {
	readonly version: number;
	readonly state: SecretVersionState;
	readonly createdAt: string;
}

export interface CompareVersionsResponse {
	readonly secretId: string;
	readonly comparison: {
		readonly version1: VersionComparison;
		readonly version2: VersionComparison;
		readonly metadataDiff: Record<string, { old: unknown; new: unknown }>;
		readonly stateChanged: boolean;
		readonly valuesMatch?: boolean;
	};
}

export interface SetRetentionPolicyRequest {
	readonly maxVersions?: number;
	readonly retentionDays?: number;
	readonly destroyOnArchive?: boolean;
	readonly autoArchiveAfterDays?: number;
	readonly tenantId?: string;
}

export interface SetRetentionPolicyResponse {
	readonly secretId: string;
	readonly retentionPolicy: VersionRetentionPolicy;
	readonly updatedAt: string;
}

export interface TransitionVersionStateRequest {
	readonly state: SecretVersionState;
	readonly reason?: string;
	readonly destroyData?: boolean;
	readonly tenantId?: string;
}

export interface TransitionVersionStateResponse {
	readonly secretId: string;
	readonly version: number;
	readonly previousState: SecretVersionState;
	readonly newState: SecretVersionState;
	readonly updatedAt: string;
}

export interface VersionedSecretsStats {
	readonly secrets: {
		readonly total: number;
	};
	readonly versions: {
		readonly total: number;
		readonly active: number;
		readonly deprecated: number;
		readonly archived: number;
		readonly destroyed: number;
		readonly averagePerSecret: string;
	};
	readonly audit: {
		readonly totalEntries: number;
		readonly rollbacks: number;
		readonly stateChanges: number;
	};
}

export class VaultClient {
	private readonly config: InternalVaultClientConfig;
	private readonly telemetry: VaultClientTelemetry | null;
	private readonly targetService: string;
	private activationPromise: Promise<void> | null = null;
	private readonly activationConfig: SdkActivationConfig;
	private resolvedTenantId: string | null = null;

	private async ensureActivated(): Promise<void> {
		if (!this.activationPromise) {
			this.activationPromise = activateSdk(this.activationConfig).then((response) => {
				this.resolvedTenantId = response.tenantId;
			});
		}
		return this.activationPromise;
	}

	constructor(config: VaultClientConfig) {
		// Check tier access - vault requires dev-pro or higher
		if (config.tier) {
			checkTierAccess("vault", config.tier);
		}

		if (!config.apiKey || config.apiKey.trim().length === 0) {
			throw new Error(
				"QNSP Vault SDK: apiKey is required. " +
					"Get your free API key at https://cloud.qnsi.heossi.com/signup - " +
					"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
					"Docs: https://docs.qnsi.heossi.com/sdk/vault-sdk",
			);
		}

		const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");

		// Enforce HTTPS in production (allow HTTP for localhost in development and
		// for internal service-mesh hostnames - e.g. *.internal - which are on a
		// private VPC network and do not require TLS termination at the transport layer).
		if (!baseUrl.startsWith("https://")) {
			const isLocalhost =
				baseUrl.startsWith("http://localhost") || baseUrl.startsWith("http://127.0.0.1");
			let isInternalService = false;
			try {
				const parsed = new URL(baseUrl);
				isInternalService =
					parsed.protocol === "http:" &&
					(parsed.hostname.endsWith(".internal") ||
						parsed.hostname === "localhost" ||
						parsed.hostname === "127.0.0.1");
			} catch {
				// ignore; invalid URL will be caught later by fetch
			}
			const isDevelopment =
				process.env["NODE_ENV"] === "development" || process.env["NODE_ENV"] === "test";
			if ((!isLocalhost || !isDevelopment) && !isInternalService) {
				throw new Error(
					"baseUrl must use HTTPS in production. HTTP is only allowed for localhost in development.",
				);
			}
		}

		this.config = {
			baseUrl,
			apiKey: config.apiKey,
			timeoutMs: config.timeoutMs ?? 30_000,
			maxRetries: config.maxRetries ?? 3,
			retryDelayMs: config.retryDelayMs ?? 1_000,
		};

		this.telemetry = config.telemetry
			? isVaultClientTelemetry(config.telemetry)
				? config.telemetry
				: createVaultClientTelemetry(config.telemetry)
			: null;

		try {
			this.targetService = new URL(this.config.baseUrl).host;
		} catch {
			this.targetService = "vault-service";
		}

		this.activationConfig = {
			apiKey: config.apiKey,
			sdkId: "vault-sdk",
			sdkVersion: SDK_PACKAGE_VERSION,
			platformUrl: baseUrl,
		};
	}

	private async request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
		return this.requestWithRetry<T>(method, path, options, 0);
	}

	private async requestWithRetry<T>(
		method: string,
		path: string,
		options: RequestOptions | undefined,
		attempt: number,
	): Promise<T> {
		const url = `${this.config.baseUrl}${path}`;
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...options?.headers,
		};

		headers["Authorization"] = `Bearer ${this.config.apiKey}`;

		// Auto-inject tenant ID from activation response
		if (this.resolvedTenantId) {
			headers["x-qnsp-tenant-id"] = this.resolvedTenantId;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
		const signal = options?.signal ?? controller.signal;
		const route = options?.telemetryRoute ?? new URL(path, this.config.baseUrl).pathname;
		const target = options?.telemetryTarget ?? this.targetService;
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const init: RequestInit = {
				method,
				headers,
				signal,
			};

			if (options?.body !== undefined) {
				init.body = JSON.stringify(options.body);
			}

			const response = await fetch(url, init);

			clearTimeout(timeoutId);
			httpStatus = response.status;

			// Handle rate limiting (429) with retry logic
			if (response.status === 429) {
				if (attempt < this.config.maxRetries) {
					const retryAfterHeader = response.headers.get("Retry-After");
					let delayMs = this.config.retryDelayMs;

					if (retryAfterHeader) {
						const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
						if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
							delayMs = retryAfterSeconds * 1_000;
						}
					} else {
						// Exponential backoff: 2^attempt * baseDelay, capped at 30 seconds
						delayMs = Math.min(2 ** attempt * this.config.retryDelayMs, 30_000);
					}

					await new Promise((resolve) => setTimeout(resolve, delayMs));
					return this.requestWithRetry<T>(method, path, options, attempt + 1);
				}

				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(
					`Vault API error: Rate limit exceeded after ${this.config.maxRetries} retries`,
				);
			}

			if (!response.ok) {
				status = "error";
				// Sanitize error message to prevent information disclosure
				// Don't include full response text in error to avoid leaking sensitive data
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Vault API error: ${response.status} ${response.statusText}`);
			}

			if (response.status === 204) {
				return undefined as T;
			}

			return (await response.json()) as T;
		} catch (error) {
			clearTimeout(timeoutId);
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			if (error instanceof Error && error.name === "AbortError") {
				errorMessage = `timeout after ${this.config.timeoutMs}ms`;
				throw new Error(`Request timeout after ${this.config.timeoutMs}ms`);
			}
			throw error;
		} finally {
			const durationMs = performance.now() - start;
			const event: VaultClientTelemetryEvent = {
				operation: options?.operation ?? `${method} ${route}`,
				method,
				route,
				target,
				status,
				durationMs,
				...(typeof httpStatus === "number" ? { httpStatus } : {}),
				...(status === "error" && errorMessage ? { error: errorMessage } : {}),
			};
			this.recordTelemetryEvent(event);
		}
	}

	private recordTelemetryEvent(event: VaultClientTelemetryEvent): void {
		if (!this.telemetry) {
			return;
		}
		this.telemetry.record(event);
	}

	/**
	 * Create a new secret.
	 * The payload must be base64-encoded.
	 * Returns the created secret with version 1.
	 */
	async createSecret(request: CreateSecretRequest): Promise<Secret> {
		// Validate explicit tenantId immediately if provided (before activation)
		if (request.tenantId !== undefined) {
			validateUUID(request.tenantId, "tenantId");
		}
		await this.ensureActivated();
		const effectiveTenantId = request.tenantId ?? this.resolvedTenantId;
		if (!effectiveTenantId) {
			throw new Error(
				"QNSP Vault SDK: tenantId could not be resolved. Ensure your API key is valid.",
			);
		}

		return this.request<Secret>("POST", "/vault/v1/secrets", {
			body: {
				tenantId: effectiveTenantId,
				name: request.name,
				payload: request.payload,
				...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
				...(request.rotationPolicy !== undefined ? { rotationPolicy: request.rotationPolicy } : {}),
			},
			operation: "createSecret",
		});
	}

	/**
	 * Get the latest version of a secret.
	 * Returns the secret metadata, envelope, and version information.
	 * Note: The plaintext payload is not returned for security reasons.
	 */
	async getSecret(id: string, options?: { readonly leaseToken?: string }): Promise<Secret> {
		validateUUID(id, "id");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.leaseToken) {
			params.set("leaseToken", options.leaseToken);
		}
		const queryString = params.toString();
		const path = queryString ? `/vault/v1/secrets/${id}?${queryString}` : `/vault/v1/secrets/${id}`;

		const headers: Record<string, string> = {};
		if (options?.leaseToken) {
			headers["x-lease-token"] = options.leaseToken;
		}

		return this.request<Secret>("GET", path, {
			headers,
			operation: "getSecret",
		});
	}

	/**
	 * Get a specific version of a secret.
	 * Returns the secret metadata, envelope, and version information for the specified version.
	 * Note: The plaintext payload is not returned for security reasons.
	 */
	async getSecretVersion(id: string, version: number): Promise<Secret> {
		validateUUID(id, "id");
		await this.ensureActivated();

		return this.request<Secret>("GET", `/vault/v1/secrets/${id}/versions/${version}`, {
			operation: "getSecretVersion",
		});
	}

	/**
	 * Rotate a secret to create a new version.
	 * Optionally provide a new payload (base64-encoded), updated metadata, or rotation policy.
	 * Returns the new secret version.
	 */
	async rotateSecret(id: string, request: RotateSecretRequest): Promise<Secret> {
		validateUUID(id, "id");
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<Secret>("POST", `/vault/v1/secrets/${id}/rotate`, {
			body: {
				tenantId: request.tenantId,
				...(request.newPayload !== undefined ? { newPayload: request.newPayload } : {}),
				...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
				...(request.rotationPolicy !== undefined ? { rotationPolicy: request.rotationPolicy } : {}),
			},
			operation: "rotateSecret",
		});
	}

	/**
	 * Delete a secret (soft delete).
	 * Requires the tenantId to verify ownership.
	 */
	async deleteSecret(id: string, tenantId: string): Promise<void> {
		validateUUID(id, "id");
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<void>(
			"DELETE",
			`/vault/v1/secrets/${id}?tenantId=${encodeURIComponent(tenantId)}`,
			{
				operation: "deleteSecret",
			},
		);
	}

	// ============================================================================
	// Dynamic Secrets
	// ============================================================================

	/**
	 * Create a dynamic secret configuration for on-demand credential generation.
	 * Supports database credentials, API keys, cloud credentials, and SSH keys.
	 */
	async createDynamicSecretConfig(
		config: CreateDynamicSecretConfigRequest,
	): Promise<DynamicSecretConfig> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (config.tenantId) {
			params.set("tenantId", config.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/dynamic-secrets/configs?${queryString}`
			: "/vault/v1/dynamic-secrets/configs";

		return this.request<DynamicSecretConfig>("POST", path, {
			body: {
				name: config.name,
				secretType: config.secretType,
				backend: config.backend,
				...(config.defaultTtlSeconds !== undefined
					? { defaultTtlSeconds: config.defaultTtlSeconds }
					: {}),
				...(config.maxTtlSeconds !== undefined ? { maxTtlSeconds: config.maxTtlSeconds } : {}),
				...(config.template !== undefined ? { template: config.template } : {}),
			},
			operation: "createDynamicSecretConfig",
		});
	}

	/**
	 * List all dynamic secret configurations for the tenant.
	 */
	async listDynamicSecretConfigs(options?: {
		readonly secretType?: DynamicSecretType;
		readonly tenantId?: string;
	}): Promise<ListDynamicSecretConfigsResponse> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		if (options?.secretType) {
			params.set("secretType", options.secretType);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/dynamic-secrets/configs?${queryString}`
			: "/vault/v1/dynamic-secrets/configs";

		return this.request<ListDynamicSecretConfigsResponse>("GET", path, {
			operation: "listDynamicSecretConfigs",
		});
	}

	/**
	 * Request credentials from a dynamic secret configuration.
	 * Returns ephemeral credentials with a lease that can be renewed or revoked.
	 */
	async requestCredentials(
		configId: string,
		request?: RequestCredentialsRequest,
	): Promise<DynamicCredentials> {
		validateUUID(configId, "configId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (request?.tenantId) {
			params.set("tenantId", request.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/dynamic-secrets/configs/${configId}/credentials?${queryString}`
			: `/vault/v1/dynamic-secrets/configs/${configId}/credentials`;

		return this.request<DynamicCredentials>("POST", path, {
			body: {
				...(request?.ttlSeconds !== undefined ? { ttlSeconds: request.ttlSeconds } : {}),
				...(request?.metadata !== undefined ? { metadata: request.metadata } : {}),
			},
			operation: "requestCredentials",
		});
	}

	/**
	 * List active leases for a dynamic secret configuration.
	 */
	async listLeases(
		configId: string,
		options?: { readonly tenantId?: string },
	): Promise<ListLeasesResponse> {
		validateUUID(configId, "configId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/dynamic-secrets/configs/${configId}/leases?${queryString}`
			: `/vault/v1/dynamic-secrets/configs/${configId}/leases`;

		return this.request<ListLeasesResponse>("GET", path, {
			operation: "listLeases",
		});
	}

	/**
	 * Renew a credential lease to extend its expiration time.
	 */
	async renewLease(leaseId: string, request?: RenewLeaseRequest): Promise<RenewLeaseResponse> {
		validateUUID(leaseId, "leaseId");
		await this.ensureActivated();

		return this.request<RenewLeaseResponse>(
			"POST",
			`/vault/v1/dynamic-secrets/leases/${leaseId}/renew`,
			{
				body: {
					...(request?.ttlSeconds !== undefined ? { ttlSeconds: request.ttlSeconds } : {}),
				},
				operation: "renewLease",
			},
		);
	}

	/**
	 * Revoke a credential lease immediately.
	 * The associated credentials will be invalidated.
	 */
	async revokeLease(leaseId: string): Promise<void> {
		validateUUID(leaseId, "leaseId");
		await this.ensureActivated();

		return this.request<void>("POST", `/vault/v1/dynamic-secrets/leases/${leaseId}/revoke`, {
			operation: "revokeLease",
		});
	}

	/**
	 * Get statistics about dynamic secrets for the tenant.
	 */
	async getDynamicSecretStats(options?: {
		readonly tenantId?: string;
	}): Promise<DynamicSecretStats> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/dynamic-secrets/stats?${queryString}`
			: "/vault/v1/dynamic-secrets/stats";

		return this.request<DynamicSecretStats>("GET", path, {
			operation: "getDynamicSecretStats",
		});
	}

	// ============================================================================
	// Secret Leakage Detection
	// ============================================================================

	/**
	 * Create a leakage detection policy for monitoring secret exposure.
	 * Integrates with threat feeds and supports automated remediation.
	 */
	async createLeakagePolicy(policy: CreateLeakagePolicyRequest): Promise<LeakagePolicy> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (policy.tenantId) {
			params.set("tenantId", policy.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/leakage-detection/policies?${queryString}`
			: "/vault/v1/leakage-detection/policies";

		return this.request<LeakagePolicy>("POST", path, {
			body: {
				name: policy.name,
				...(policy.description !== undefined ? { description: policy.description } : {}),
				...(policy.enabled !== undefined ? { enabled: policy.enabled } : {}),
				scanTargets: policy.scanTargets,
				scanSources: policy.scanSources,
				...(policy.threatFeeds !== undefined ? { threatFeeds: policy.threatFeeds } : {}),
				alerting: policy.alerting,
				...(policy.autoRemediation !== undefined
					? { autoRemediation: policy.autoRemediation }
					: {}),
				scanSchedule: policy.scanSchedule,
			},
			operation: "createLeakagePolicy",
		});
	}

	/**
	 * List all leakage detection policies for the tenant.
	 */
	async listLeakagePolicies(options?: {
		readonly enabled?: boolean;
		readonly tenantId?: string;
	}): Promise<ListLeakagePoliciesResponse> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		if (options?.enabled !== undefined) {
			params.set("enabled", String(options.enabled));
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/leakage-detection/policies?${queryString}`
			: "/vault/v1/leakage-detection/policies";

		return this.request<ListLeakagePoliciesResponse>("GET", path, {
			operation: "listLeakagePolicies",
		});
	}

	/**
	 * Report a secret leakage incident manually or from external sources.
	 */
	async reportLeakageIncident(incident: ReportLeakageIncidentRequest): Promise<LeakageIncident> {
		validateUUID(incident.secretId, "secretId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (incident.tenantId) {
			params.set("tenantId", incident.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/leakage-detection/incidents?${queryString}`
			: "/vault/v1/leakage-detection/incidents";

		return this.request<LeakageIncident>("POST", path, {
			body: {
				secretId: incident.secretId,
				source: incident.source,
				severity: incident.severity,
				detectedAt: incident.detectedAt,
				evidence: incident.evidence,
				...(incident.threatFeedMatch !== undefined
					? { threatFeedMatch: incident.threatFeedMatch }
					: {}),
				...(incident.notes !== undefined ? { notes: incident.notes } : {}),
			},
			operation: "reportLeakageIncident",
		});
	}

	/**
	 * List leakage incidents with optional filtering.
	 */
	async listLeakageIncidents(
		options?: ListLeakageIncidentsOptions,
	): Promise<ListLeakageIncidentsResponse> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		if (options?.status) {
			params.set("status", options.status);
		}
		if (options?.severity) {
			params.set("severity", options.severity);
		}
		if (options?.secretId) {
			params.set("secretId", options.secretId);
		}
		if (options?.limit !== undefined) {
			params.set("limit", String(options.limit));
		}
		if (options?.offset !== undefined) {
			params.set("offset", String(options.offset));
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/leakage-detection/incidents?${queryString}`
			: "/vault/v1/leakage-detection/incidents";

		return this.request<ListLeakageIncidentsResponse>("GET", path, {
			operation: "listLeakageIncidents",
		});
	}

	/**
	 * Update a leakage incident status, assignee, notes, or add remediation actions.
	 */
	async updateIncidentStatus(
		incidentId: string,
		update: UpdateLeakageIncidentStatusRequest,
	): Promise<LeakageIncident> {
		validateUUID(incidentId, "incidentId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (update.tenantId) {
			params.set("tenantId", update.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/leakage-detection/incidents/${incidentId}?${queryString}`
			: `/vault/v1/leakage-detection/incidents/${incidentId}`;

		return this.request<LeakageIncident>("PATCH", path, {
			body: {
				...(update.status !== undefined ? { status: update.status } : {}),
				...(update.assignee !== undefined ? { assignee: update.assignee } : {}),
				...(update.notes !== undefined ? { notes: update.notes } : {}),
				...(update.remediationActions !== undefined
					? { remediationActions: update.remediationActions }
					: {}),
			},
			operation: "updateIncidentStatus",
		});
	}

	/**
	 * Trigger a manual leakage detection scan.
	 */
	async triggerLeakageScan(
		request?: TriggerLeakageScanRequest,
	): Promise<TriggerLeakageScanResponse> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (request?.tenantId) {
			params.set("tenantId", request.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/leakage-detection/scan?${queryString}`
			: "/vault/v1/leakage-detection/scan";

		return this.request<TriggerLeakageScanResponse>("POST", path, {
			body: {
				...(request?.secretIds !== undefined ? { secretIds: request.secretIds } : {}),
				...(request?.sources !== undefined ? { sources: request.sources } : {}),
				...(request?.threatFeeds !== undefined ? { threatFeeds: request.threatFeeds } : {}),
				...(request?.force !== undefined ? { force: request.force } : {}),
			},
			operation: "triggerLeakageScan",
		});
	}

	/**
	 * Get leakage detection statistics for the tenant.
	 */
	async getLeakageStats(options?: { readonly tenantId?: string }): Promise<LeakageStats> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/leakage-detection/stats?${queryString}`
			: "/vault/v1/leakage-detection/stats";

		return this.request<LeakageStats>("GET", path, {
			operation: "getLeakageStats",
		});
	}

	// ============================================================================
	// Versioned Secrets
	// ============================================================================

	/**
	 * Create a new version of a secret.
	 * The previous active version will be deprecated.
	 */
	async createSecretVersion(
		request: CreateSecretVersionRequest,
	): Promise<CreateSecretVersionResponse> {
		validateUUID(request.secretId, "secretId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (request.tenantId) {
			params.set("tenantId", request.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/versioned-secrets?${queryString}`
			: "/vault/v1/versioned-secrets";

		return this.request<CreateSecretVersionResponse>("POST", path, {
			body: {
				secretId: request.secretId,
				value: request.value,
				...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
				...(request.rotationPolicy !== undefined ? { rotationPolicy: request.rotationPolicy } : {}),
				...(request.retentionPolicy !== undefined
					? { retentionPolicy: request.retentionPolicy }
					: {}),
				...(request.changeReason !== undefined ? { changeReason: request.changeReason } : {}),
				...(request.approvedBy !== undefined ? { approvedBy: request.approvedBy } : {}),
			},
			operation: "createSecretVersion",
		});
	}

	/**
	 * List all versions of a secret with pagination and filtering.
	 */
	async listSecretVersions(
		secretId: string,
		options?: ListSecretVersionsOptions,
	): Promise<ListSecretVersionsResponse> {
		validateUUID(secretId, "secretId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		if (options?.limit !== undefined) {
			params.set("limit", String(options.limit));
		}
		if (options?.offset !== undefined) {
			params.set("offset", String(options.offset));
		}
		if (options?.state) {
			params.set("state", options.state);
		}
		if (options?.fromDate) {
			params.set("fromDate", options.fromDate);
		}
		if (options?.toDate) {
			params.set("toDate", options.toDate);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/versioned-secrets/${secretId}/history?${queryString}`
			: `/vault/v1/versioned-secrets/${secretId}/history`;

		return this.request<ListSecretVersionsResponse>("GET", path, {
			operation: "listSecretVersions",
		});
	}

	/**
	 * Get a specific version of a secret.
	 * Returns 410 Gone if the version has been destroyed.
	 */
	async getSecretVersionDetails(
		secretId: string,
		version: number,
		options?: { readonly tenantId?: string },
	): Promise<SecretVersion> {
		validateUUID(secretId, "secretId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/versioned-secrets/${secretId}/versions/${version}?${queryString}`
			: `/vault/v1/versioned-secrets/${secretId}/versions/${version}`;

		return this.request<SecretVersion>("GET", path, {
			operation: "getSecretVersionDetails",
		});
	}

	/**
	 * Rollback a secret to a previous version.
	 * Can optionally create a new version or reactivate the target version.
	 */
	async rollbackSecret(
		secretId: string,
		request: RollbackSecretRequest,
	): Promise<RollbackSecretResponse> {
		validateUUID(secretId, "secretId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (request.tenantId) {
			params.set("tenantId", request.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/versioned-secrets/${secretId}/rollback?${queryString}`
			: `/vault/v1/versioned-secrets/${secretId}/rollback`;

		return this.request<RollbackSecretResponse>("POST", path, {
			body: {
				targetVersion: request.targetVersion,
				...(request.createNewVersion !== undefined
					? { createNewVersion: request.createNewVersion }
					: {}),
				...(request.reason !== undefined ? { reason: request.reason } : {}),
				...(request.approvedBy !== undefined ? { approvedBy: request.approvedBy } : {}),
			},
			operation: "rollbackSecret",
		});
	}

	/**
	 * Compare two versions of a secret to see metadata differences.
	 */
	async compareVersions(
		secretId: string,
		request: CompareVersionsRequest,
	): Promise<CompareVersionsResponse> {
		validateUUID(secretId, "secretId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (request.tenantId) {
			params.set("tenantId", request.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/versioned-secrets/${secretId}/compare?${queryString}`
			: `/vault/v1/versioned-secrets/${secretId}/compare`;

		return this.request<CompareVersionsResponse>("POST", path, {
			body: {
				version1: request.version1,
				version2: request.version2,
				...(request.includeValues !== undefined ? { includeValues: request.includeValues } : {}),
			},
			operation: "compareVersions",
		});
	}

	/**
	 * Set a retention policy for all versions of a secret.
	 * Controls how many versions are kept and when old versions are archived/destroyed.
	 */
	async setRetentionPolicy(
		secretId: string,
		policy: SetRetentionPolicyRequest,
	): Promise<SetRetentionPolicyResponse> {
		validateUUID(secretId, "secretId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (policy.tenantId) {
			params.set("tenantId", policy.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/versioned-secrets/${secretId}/retention-policy?${queryString}`
			: `/vault/v1/versioned-secrets/${secretId}/retention-policy`;

		return this.request<SetRetentionPolicyResponse>("PUT", path, {
			body: {
				...(policy.maxVersions !== undefined ? { maxVersions: policy.maxVersions } : {}),
				...(policy.retentionDays !== undefined ? { retentionDays: policy.retentionDays } : {}),
				...(policy.destroyOnArchive !== undefined
					? { destroyOnArchive: policy.destroyOnArchive }
					: {}),
				...(policy.autoArchiveAfterDays !== undefined
					? { autoArchiveAfterDays: policy.autoArchiveAfterDays }
					: {}),
			},
			operation: "setRetentionPolicy",
		});
	}

	/**
	 * Transition a secret version to a new state (deprecated, archived, destroyed).
	 */
	async transitionVersionState(
		secretId: string,
		version: number,
		request: TransitionVersionStateRequest,
	): Promise<TransitionVersionStateResponse> {
		validateUUID(secretId, "secretId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (request.tenantId) {
			params.set("tenantId", request.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/versioned-secrets/${secretId}/versions/${version}/state?${queryString}`
			: `/vault/v1/versioned-secrets/${secretId}/versions/${version}/state`;

		return this.request<TransitionVersionStateResponse>("PATCH", path, {
			body: {
				state: request.state,
				...(request.reason !== undefined ? { reason: request.reason } : {}),
				...(request.destroyData !== undefined ? { destroyData: request.destroyData } : {}),
			},
			operation: "transitionVersionState",
		});
	}

	/**
	 * Get statistics about versioned secrets for the tenant.
	 */
	async getVersionedSecretsStats(options?: {
		readonly tenantId?: string;
	}): Promise<VersionedSecretsStats> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/vault/v1/versioned-secrets/stats?${queryString}`
			: "/vault/v1/versioned-secrets/stats";

		return this.request<VersionedSecretsStats>("GET", path, {
			operation: "getVersionedSecretsStats",
		});
	}
}

export * from "./observability.js";
export * from "./validation.js";
