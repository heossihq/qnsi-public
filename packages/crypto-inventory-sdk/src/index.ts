/**
 * @heossi/qnsi-crypto-inventory-sdk
 *
 * TypeScript SDK client for the QNSP crypto-inventory-service API.
 * Provides cryptographic asset discovery and inventory management.
 * Tracks PQC and classical crypto assets across the platform.
 */

import { performance } from "node:perf_hooks";

import { activateSdk, type SdkActivationConfig } from "@heossi/qnsi-sdk-activation";
import { z } from "zod";

import type { CryptoInventoryTelemetry, CryptoInventoryTelemetryConfig } from "./observability.js";
import { createCryptoInventoryTelemetry, isCryptoInventoryTelemetry } from "./observability.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";

/**
 * Mapping from internal algorithm names to NIST/standards display names.
 * Covers all 87 runtime-supported PQC algorithms (24 KEMs + 63 signatures).
 * HQC's 3 variants are excluded (disabled in the liboqs build for CVE-2025-48946).
 * Canonical source: @heossi/qnsi-cryptography pqc-standards.ts ALGORITHM_NIST_NAMES
 */
export const ALGORITHM_TO_NIST: Record<string, string> = {
	// FIPS 203 — ML-KEM
	"kyber-512": "ML-KEM-512",
	"kyber-768": "ML-KEM-768",
	"kyber-1024": "ML-KEM-1024",
	// FIPS 204 — ML-DSA
	"dilithium-2": "ML-DSA-44",
	"dilithium-3": "ML-DSA-65",
	"dilithium-5": "ML-DSA-87",
	// FIPS 205 — SLH-DSA (SHA-2 variants)
	"sphincs-sha2-128f-simple": "SLH-DSA-SHA2-128f",
	"sphincs-sha2-128s-simple": "SLH-DSA-SHA2-128s",
	"sphincs-sha2-192f-simple": "SLH-DSA-SHA2-192f",
	"sphincs-sha2-192s-simple": "SLH-DSA-SHA2-192s",
	"sphincs-sha2-256f-simple": "SLH-DSA-SHA2-256f",
	"sphincs-sha2-256s-simple": "SLH-DSA-SHA2-256s",
	// FIPS 205 — SLH-DSA (SHAKE variants)
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

export type AssetType = "certificate" | "key" | "secret";
export type AssetSource = "kms" | "vault" | "edge-gateway" | "external";

export type DiscoveryJobStatus = "queued" | "running" | "succeeded" | "failed";
export type DiscoveryJobTrigger = "manual" | "scheduled";

export interface CryptoAsset {
	readonly id: string;
	readonly tenantId: string;
	readonly assetType: AssetType;
	readonly source: AssetSource;
	readonly algorithm: string;
	readonly algorithmNist?: string;
	readonly isPqc: boolean;
	readonly keySize?: number;
	readonly expiresAt?: string | null;
	readonly rotationDue?: string | null;
	readonly metadata?: Record<string, unknown>;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface AssetStats {
	readonly totalAssets: number;
	readonly pqcAssets: number;
	readonly classicalAssets: number;
	readonly byType: Record<AssetType, number>;
	readonly bySource: Record<AssetSource, number>;
	readonly byAlgorithm: Record<string, number>;
	readonly expiringWithin30Days: number;
	readonly rotationOverdue: number;
}

export interface DiscoveryRun {
	readonly id: string;
	readonly tenantId: string;
	readonly source: AssetSource;
	readonly status: "running" | "completed" | "failed";
	readonly assetsDiscovered: number;
	readonly assetsUpdated: number;
	readonly startedAt: string;
	readonly completedAt: string | null;
	readonly errorMessage: string | null;
}

export interface DiscoveryJob {
	readonly id: string;
	readonly tenantId: string;
	readonly source: AssetSource;
	readonly runId: string;
	readonly triggeredBy: DiscoveryJobTrigger;
	readonly requestId: string | null;
	readonly status: DiscoveryJobStatus;
	readonly attempts: number;
	readonly lockedAt: string | null;
	readonly lockedBy: string | null;
	readonly errorMessage: string | null;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly completedAt: string | null;
}

const uuidSchema = z.string().uuid();
const discoveryJobStatusSchema = z.enum(["queued", "running", "succeeded", "failed"]);

export interface ListAssetsRequest {
	readonly tenantId: string;
	readonly assetType?: AssetType;
	readonly source?: AssetSource;
	readonly isPqc?: boolean;
	readonly algorithm?: string;
	readonly limit?: number;
	readonly offset?: number;
}

export interface ListAssetsResponse {
	readonly assets: readonly CryptoAsset[];
	readonly count: number;
}

export interface DiscoverAssetsRequest {
	readonly tenantId?: string;
	readonly source?: "kms" | "vault" | "edge-gateway";
}

/** Default QNSP cloud API base URL. Get a free API key at https://cloud.qnsi.heossi.com/signup */
export const DEFAULT_BASE_URL = "https://api.qnsi.heossi.com";

export interface CryptoInventoryClientConfig {
	readonly baseUrl?: string;
	readonly apiKey: string;
	readonly timeoutMs?: number;
	readonly maxRetries?: number;
	readonly retryDelayMs?: number;
	readonly telemetry?: CryptoInventoryTelemetry | CryptoInventoryTelemetryConfig;
}

export type DeprecationSeverity = "critical" | "high" | "medium" | "low";
export type DeprecationStatus = "active" | "deprecated" | "legacy" | "prohibited";
export type NotificationChannel = "email" | "webhook" | "slack" | "teams" | "pagerduty";

export interface DeprecationPolicy {
	readonly id: string;
	readonly algorithm: string;
	readonly status: DeprecationStatus;
	readonly severity: DeprecationSeverity;
	readonly deprecationDate: string | null;
	readonly sunsetDate: string | null;
	readonly replacementAlgorithm: string | null;
	readonly rationale: string | null;
	readonly complianceFrameworks: readonly string[];
	readonly notifyAffectedTenants: boolean;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface CreateDeprecationPolicyRequest {
	readonly tenantId?: string;
	readonly algorithm: string;
	readonly status: DeprecationStatus;
	readonly severity: DeprecationSeverity;
	readonly deprecationDate?: string;
	readonly sunsetDate?: string;
	readonly replacementAlgorithm?: string;
	readonly rationale?: string;
	readonly complianceFrameworks?: readonly string[];
	readonly notifyAffectedTenants?: boolean;
}

export interface UpdateDeprecationPolicyRequest {
	readonly status?: DeprecationStatus;
	readonly severity?: DeprecationSeverity;
	readonly deprecationDate?: string | null;
	readonly sunsetDate?: string | null;
	readonly replacementAlgorithm?: string | null;
	readonly rationale?: string | null;
	readonly complianceFrameworks?: readonly string[];
	readonly notifyAffectedTenants?: boolean;
}

export interface ListDeprecationPoliciesRequest {
	readonly tenantId?: string;
	readonly status?: DeprecationStatus;
	readonly severity?: DeprecationSeverity;
	readonly algorithm?: string;
	readonly limit?: number;
	readonly offset?: number;
}

export interface ListDeprecationPoliciesResponse {
	readonly policies: readonly DeprecationPolicy[];
	readonly total: number;
	readonly limit: number;
	readonly offset: number;
}

export interface AffectedAsset {
	readonly assetId: string;
	readonly assetName: string | null;
	readonly assetType: string;
	readonly source: string;
	readonly algorithm: string;
	readonly deprecationStatus: DeprecationStatus;
	readonly deprecationSeverity: DeprecationSeverity;
	readonly sunsetDate: string | null;
	readonly replacementAlgorithm: string | null;
	readonly acknowledged: boolean;
	readonly acknowledgmentNote: string | null;
	readonly plannedMigrationDate: string | null;
}

export interface GetAffectedAssetsRequest {
	readonly tenantId?: string;
	readonly severity?: DeprecationSeverity;
	readonly status?: DeprecationStatus;
	readonly acknowledged?: boolean;
	readonly algorithm?: string;
	readonly limit?: number;
	readonly offset?: number;
}

export interface GetAffectedAssetsResponse {
	readonly assets: readonly AffectedAsset[];
	readonly total: number;
	readonly limit: number;
	readonly offset: number;
}

export interface AcknowledgeDeprecationRequest {
	readonly tenantId?: string;
	readonly assetIds: readonly string[];
	readonly acknowledgmentNote?: string;
	readonly plannedMigrationDate?: string;
}

export interface AcknowledgeDeprecationResponse {
	readonly acknowledged: number;
	readonly total: number;
}

export interface DeprecationSummary {
	readonly tenantId: string;
	readonly totalAffectedAssets: number;
	readonly totalAcknowledged: number;
	readonly unacknowledgedCount: number;
	readonly bySeverity: Record<DeprecationSeverity, { total: number; acknowledged: number }>;
	readonly byStatus: Record<DeprecationStatus, number>;
	readonly upcomingSunsets: readonly {
		readonly algorithm: string;
		readonly sunsetDate: string;
		readonly affectedAssets: number;
	}[];
}

export type HardwareType =
	| "hsm"
	| "tpm"
	| "secure_enclave"
	| "smartcard"
	| "crypto_accelerator"
	| "key_storage_device";

export type HardwareStatus =
	| "active"
	| "standby"
	| "maintenance"
	| "degraded"
	| "offline"
	| "decommissioned";

export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export type ComplianceLevel =
	| "fips_140_2_l1"
	| "fips_140_2_l2"
	| "fips_140_2_l3"
	| "fips_140_2_l4"
	| "fips_140_3_l1"
	| "fips_140_3_l2"
	| "fips_140_3_l3"
	| "fips_140_3_l4"
	| "common_criteria"
	| "pci_hsm"
	| "none";

export interface HardwareDevice {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly hardwareType: HardwareType;
	readonly status: HardwareStatus;
	readonly vendor: string | null;
	readonly model: string | null;
	readonly serialNumber: string | null;
	readonly firmwareVersion: string | null;
	readonly location: string | null;
	readonly networkAddress: string | null;
	readonly complianceLevel: ComplianceLevel | null;
	readonly certificationExpiry: string | null;
	readonly maxKeyCapacity: number | null;
	readonly currentKeyCount: number | null;
	readonly supportedAlgorithms: readonly string[];
	readonly pqcCapable: boolean;
	readonly lastHealthCheck: string | null;
	readonly healthStatus: HealthStatus;
	readonly metadata: Record<string, unknown>;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface RegisterHardwareRequest {
	readonly tenantId?: string;
	readonly name: string;
	readonly hardwareType: HardwareType;
	readonly vendor?: string;
	readonly model?: string;
	readonly serialNumber?: string;
	readonly firmwareVersion?: string;
	readonly location?: string;
	readonly networkAddress?: string;
	readonly complianceLevel?: ComplianceLevel;
	readonly certificationExpiry?: string;
	readonly maxKeyCapacity?: number;
	readonly supportedAlgorithms?: readonly string[];
	readonly pqcCapable?: boolean;
	readonly metadata?: Record<string, unknown>;
}

export interface UpdateHardwareRequest {
	readonly name?: string;
	readonly status?: HardwareStatus;
	readonly firmwareVersion?: string;
	readonly location?: string | null;
	readonly networkAddress?: string | null;
	readonly complianceLevel?: ComplianceLevel;
	readonly certificationExpiry?: string | null;
	readonly maxKeyCapacity?: number;
	readonly supportedAlgorithms?: readonly string[];
	readonly pqcCapable?: boolean;
	readonly metadata?: Record<string, unknown>;
}

export interface ListHardwareRequest {
	readonly tenantId?: string;
	readonly hardwareType?: HardwareType;
	readonly status?: HardwareStatus;
	readonly healthStatus?: HealthStatus;
	readonly pqcCapable?: boolean;
	readonly complianceLevel?: ComplianceLevel;
	readonly location?: string;
	readonly limit?: number;
	readonly offset?: number;
}

export interface ListHardwareResponse {
	readonly devices: readonly HardwareDevice[];
	readonly total: number;
	readonly limit: number;
	readonly offset: number;
}

export interface RecordHealthCheckRequest {
	readonly healthStatus: HealthStatus;
	readonly responseTimeMs?: number;
	readonly keySlotUtilization?: number;
	readonly memoryUtilization?: number;
	readonly cpuUtilization?: number;
	readonly temperature?: number;
	readonly errorCount?: number;
	readonly lastErrorMessage?: string;
	readonly diagnosticsData?: Record<string, unknown>;
}

export interface HealthCheckRecord {
	readonly id: string;
	readonly hardwareId: string;
	readonly healthStatus: HealthStatus;
	readonly responseTimeMs: number | null;
	readonly keySlotUtilization: number | null;
	readonly memoryUtilization: number | null;
	readonly cpuUtilization: number | null;
	readonly temperature: number | null;
	readonly errorCount: number | null;
	readonly lastErrorMessage: string | null;
	readonly diagnosticsData: Record<string, unknown>;
	readonly checkedAt: string;
}

export interface GetHardwareHealthRequest {
	readonly tenantId?: string;
	readonly since?: string;
	readonly until?: string;
	readonly limit?: number;
}

export interface GetHardwareHealthResponse {
	readonly healthChecks: readonly HealthCheckRecord[];
}

export interface HardwareInventorySummary {
	readonly tenantId: string;
	readonly totalDevices: number;
	readonly activeDevices: number;
	readonly pqcReadyDevices: number;
	readonly byType: Record<HardwareType, { total: number; healthy: number; pqcCapable: number }>;
	readonly byStatus: Record<HardwareStatus, number>;
	readonly byHealth: Record<HealthStatus, number>;
	readonly keyCapacity: {
		readonly totalSlots: number;
		readonly usedSlots: number;
		readonly availableSlots: number;
		readonly utilizationPercent: number;
	};
	readonly expiringCertifications: readonly {
		readonly id: string;
		readonly name: string;
		readonly certificationExpiry: string;
		readonly complianceLevel: ComplianceLevel;
	}[];
}

export type ReadinessLevel = "exemplary" | "advanced" | "progressing" | "developing" | "initial";

export type ReadinessCategory =
	| "key_management"
	| "certificate_infrastructure"
	| "tls_configuration"
	| "code_signing"
	| "data_protection"
	| "hardware_security"
	| "policy_governance";

export interface CategoryFinding {
	readonly findingType: "strength" | "weakness" | "recommendation";
	readonly description: string;
	readonly impact: "high" | "medium" | "low";
	readonly affectedAssets?: number;
}

export interface CategoryScore {
	readonly category: ReadinessCategory;
	readonly score: number;
	readonly maxScore: number;
	readonly percentage: number;
	readonly level: ReadinessLevel;
	readonly findings: readonly CategoryFinding[];
}

export interface PqcReadinessScore {
	readonly tenantId: string;
	readonly overallScore: number;
	readonly maxScore: number;
	readonly percentage: number;
	readonly level: ReadinessLevel;
	readonly categoryScores: readonly CategoryScore[];
	readonly calculatedAt: string;
	readonly trendDirection: "improving" | "stable" | "declining" | "unknown";
	readonly trendPercentage: number | null;
}

export interface ScoreHistoryEntry {
	readonly score: number;
	readonly percentage: number;
	readonly level: ReadinessLevel;
	readonly calculatedAt: string;
}

export interface GetScoreHistoryRequest {
	readonly tenantId?: string;
	readonly since?: string;
	readonly until?: string;
	readonly limit?: number;
}

export interface GetScoreHistoryResponse {
	readonly history: readonly ScoreHistoryEntry[];
}

export interface ReadinessRecommendation {
	readonly priority: "critical" | "high" | "medium" | "low";
	readonly category: ReadinessCategory;
	readonly title: string;
	readonly description: string;
	readonly estimatedImpact: number;
	readonly affectedAssets: number | undefined;
}

export interface ReadinessRecommendations {
	readonly tenantId: string;
	readonly currentScore: number;
	readonly currentLevel: ReadinessLevel;
	readonly recommendations: readonly ReadinessRecommendation[];
	readonly totalRecommendations: number;
}

export interface ReadinessBenchmark {
	readonly tenantId: string;
	readonly yourScore: {
		readonly percentage: number;
		readonly level: ReadinessLevel;
	};
	readonly benchmark: {
		readonly totalOrganizations: number;
		readonly percentile25: number;
		readonly percentile50: number;
		readonly percentile75: number;
		readonly percentile90: number;
		readonly averageScore: number;
		readonly topScore: number;
	};
	readonly yourPercentile: number;
	readonly comparedToAverage: number;
}

type InternalConfig = {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly timeoutMs: number;
	readonly maxRetries: number;
	readonly retryDelayMs: number;
};

interface RequestOptions {
	readonly body?: unknown;
	readonly headers?: Record<string, string>;
	readonly signal?: AbortSignal;
	readonly operation?: string;
}

export class CryptoInventoryClient {
	private readonly config: InternalConfig;
	private readonly telemetry: CryptoInventoryTelemetry | null;
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

	constructor(config: CryptoInventoryClientConfig) {
		if (!config.apiKey || config.apiKey.trim().length === 0) {
			throw new Error(
				"QNSP Crypto Inventory SDK: apiKey is required. " +
					"Get your free API key at https://cloud.qnsi.heossi.com/signup — " +
					"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
					"Docs: https://docs.qnsi.heossi.com/sdk/crypto-inventory-sdk",
			);
		}

		const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");

		// Enforce HTTPS in production (allow HTTP for localhost in development and
		// for internal service-mesh hostnames — e.g. *.internal — which are on a
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
			? isCryptoInventoryTelemetry(config.telemetry)
				? config.telemetry
				: createCryptoInventoryTelemetry(config.telemetry)
			: null;

		try {
			this.targetService = new URL(this.config.baseUrl).host;
		} catch {
			this.targetService = "crypto-inventory-service";
		}

		this.activationConfig = {
			apiKey: config.apiKey,
			sdkId: "crypto-inventory-sdk",
			sdkVersion: SDK_PACKAGE_VERSION,
			platformUrl: this.config.baseUrl,
		};
	}

	private withTenantHeader(tenantId?: string): Record<string, string> {
		if (!tenantId) return {};
		uuidSchema.parse(tenantId);
		return { "x-qnsp-tenant": tenantId };
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
		const route = path.replace(/\?.*$/, "");
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
					`Crypto Inventory API error: Rate limit exceeded after ${this.config.maxRetries} retries`,
				);
			}

			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Crypto Inventory API error: ${response.status} ${response.statusText}`);
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
			if (this.telemetry) {
				const durationMs = performance.now() - start;
				this.telemetry.record({
					operation: options?.operation ?? `${method} ${route}`,
					method,
					route,
					target: this.targetService,
					status,
					durationMs,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	/**
	 * List cryptographic assets with optional filters.
	 */
	async listAssets(request: ListAssetsRequest): Promise<ListAssetsResponse> {
		await this.ensureActivated();
		uuidSchema.parse(request.tenantId);

		const params = new URLSearchParams({
			tenantId: request.tenantId,
		});

		if (request.assetType) params.set("assetType", request.assetType);
		if (request.source) params.set("source", request.source);
		if (request.isPqc !== undefined) params.set("isPqc", String(request.isPqc));
		if (request.algorithm) params.set("algorithm", request.algorithm);
		if (request.limit) params.set("limit", String(request.limit));
		if (request.offset) params.set("offset", String(request.offset));

		const result = await this.request<{ assets: CryptoAsset[]; count: number }>(
			"GET",
			`/crypto/v1/assets?${params}`,
			{ operation: "listAssets" },
		);

		// Enrich with NIST algorithm names
		return {
			...result,
			assets: result.assets.map((asset) => ({
				...asset,
				algorithmNist: toNistAlgorithmName(asset.algorithm),
			})),
		};
	}

	/**
	 * Get a specific asset by ID.
	 */
	async getAsset(assetId: string): Promise<CryptoAsset> {
		await this.ensureActivated();
		const result = await this.request<{ asset: CryptoAsset }>(
			"GET",
			`/crypto/v1/assets/${assetId}`,
			{ operation: "getAsset" },
		);

		return {
			...result.asset,
			algorithmNist: toNistAlgorithmName(result.asset.algorithm),
		};
	}

	/**
	 * Get asset statistics for a tenant.
	 */
	async getAssetStats(tenantId: string): Promise<AssetStats> {
		await this.ensureActivated();
		uuidSchema.parse(tenantId);
		const result = await this.request<{ stats: AssetStats }>(
			"GET",
			`/crypto/v1/assets/stats?tenantId=${tenantId}`,
			{ operation: "getAssetStats" },
		);

		return result.stats;
	}

	/**
	 * Trigger asset discovery across services.
	 */
	async discoverAssets(request?: DiscoverAssetsRequest): Promise<readonly DiscoveryRun[]> {
		if (request?.tenantId) {
			uuidSchema.parse(request.tenantId);
		}
		await this.ensureActivated();
		const result = await this.request<{ runs: DiscoveryRun[] }>(
			"POST",
			"/crypto/v1/assets/discover",
			{
				body: request ?? {},
				headers: this.withTenantHeader(request?.tenantId),
				operation: "discoverAssets",
			},
		);

		return result.runs;
	}

	/**
	 * List discovery jobs (async discovery orchestration).
	 */
	async listDiscoveryJobs(options: {
		readonly tenantId?: string;
		readonly status?: DiscoveryJobStatus;
		readonly limit?: number;
		readonly offset?: number;
	}): Promise<{ readonly jobs: readonly DiscoveryJob[]; readonly count: number }> {
		if (options.tenantId) {
			uuidSchema.parse(options.tenantId);
		}
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (options.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		if (options.status) {
			discoveryJobStatusSchema.parse(options.status);
			params.set("status", options.status);
		}
		if (options.limit !== undefined) {
			params.set("limit", String(options.limit));
		}
		if (options.offset !== undefined) {
			params.set("offset", String(options.offset));
		}

		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/discovery/jobs?${queryString}`
			: "/crypto/v1/discovery/jobs";

		const result = await this.request<{ jobs: DiscoveryJob[]; count: number }>("GET", path, {
			operation: "listDiscoveryJobs",
			headers: this.withTenantHeader(options.tenantId),
		});

		return { jobs: result.jobs, count: result.count };
	}

	/**
	 * Get a discovery job by id.
	 */
	async getDiscoveryJob(options: {
		readonly jobId: string;
		readonly tenantId?: string;
	}): Promise<DiscoveryJob> {
		await this.ensureActivated();
		uuidSchema.parse(options.jobId);
		const params = new URLSearchParams();
		if (options.tenantId) {
			uuidSchema.parse(options.tenantId);
			params.set("tenantId", options.tenantId);
		}
		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/discovery/jobs/${options.jobId}?${queryString}`
			: `/crypto/v1/discovery/jobs/${options.jobId}`;
		const result = await this.request<{ job: DiscoveryJob }>("GET", path, {
			operation: "getDiscoveryJob",
			headers: this.withTenantHeader(options.tenantId),
		});
		return result.job;
	}

	/**
	 * Get discovery run history.
	 */
	async getDiscoveryRuns(tenantId?: string, limit?: number): Promise<readonly DiscoveryRun[]> {
		if (tenantId) {
			uuidSchema.parse(tenantId);
		}
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (tenantId) {
			params.set("tenantId", tenantId);
		}
		if (limit) params.set("limit", String(limit));

		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/discovery/runs?${queryString}`
			: "/crypto/v1/discovery/runs";

		const result = await this.request<{ runs: DiscoveryRun[] }>("GET", path, {
			operation: "getDiscoveryRuns",
			headers: this.withTenantHeader(tenantId),
		});

		return result.runs;
	}

	/**
	 * Delete an asset from the inventory.
	 */
	async deleteAsset(assetId: string): Promise<void> {
		await this.ensureActivated();
		await this.request<{ success: boolean }>("DELETE", `/crypto/v1/assets/${assetId}`, {
			operation: "deleteAsset",
		});
	}

	/**
	 * Get PQC migration status for a tenant.
	 * Returns the percentage of assets that are PQC-enabled.
	 */
	async getPqcMigrationStatus(tenantId: string): Promise<{
		readonly totalAssets: number;
		readonly pqcAssets: number;
		readonly classicalAssets: number;
		readonly pqcPercentage: number;
		readonly migrationComplete: boolean;
	}> {
		await this.ensureActivated();
		uuidSchema.parse(tenantId);
		const stats = await this.getAssetStats(tenantId);
		const pqcPercentage = stats.totalAssets > 0 ? (stats.pqcAssets / stats.totalAssets) * 100 : 0;

		return {
			totalAssets: stats.totalAssets,
			pqcAssets: stats.pqcAssets,
			classicalAssets: stats.classicalAssets,
			pqcPercentage: Math.round(pqcPercentage * 100) / 100,
			migrationComplete: stats.classicalAssets === 0 && stats.totalAssets > 0,
		};
	}

	/**
	 * Create or update an algorithm deprecation policy.
	 */
	async createDeprecationPolicy(
		request: CreateDeprecationPolicyRequest,
	): Promise<DeprecationPolicy> {
		await this.ensureActivated();
		const result = await this.request<{ policy: DeprecationPolicy }>(
			"POST",
			"/crypto/v1/deprecation/policies",
			{
				body: request,
				headers: this.withTenantHeader(request.tenantId),
				operation: "createDeprecationPolicy",
			},
		);
		return result.policy;
	}

	/**
	 * List algorithm deprecation policies.
	 */
	async listDeprecationPolicies(
		options: ListDeprecationPoliciesRequest = {},
	): Promise<ListDeprecationPoliciesResponse> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (options.tenantId) {
			uuidSchema.parse(options.tenantId);
			params.set("tenantId", options.tenantId);
		}
		if (options.status) params.set("status", options.status);
		if (options.severity) params.set("severity", options.severity);
		if (options.algorithm) params.set("algorithm", options.algorithm);
		if (options.limit !== undefined) params.set("limit", String(options.limit));
		if (options.offset !== undefined) params.set("offset", String(options.offset));

		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/deprecation/policies?${queryString}`
			: "/crypto/v1/deprecation/policies";

		return this.request<ListDeprecationPoliciesResponse>("GET", path, {
			operation: "listDeprecationPolicies",
			headers: this.withTenantHeader(options.tenantId),
		});
	}

	/**
	 * Get a specific deprecation policy by ID.
	 */
	async getDeprecationPolicy(policyId: string, tenantId?: string): Promise<DeprecationPolicy> {
		await this.ensureActivated();
		uuidSchema.parse(policyId);
		const result = await this.request<{ policy: DeprecationPolicy }>(
			"GET",
			`/crypto/v1/deprecation/policies/${policyId}`,
			{
				operation: "getDeprecationPolicy",
				headers: this.withTenantHeader(tenantId),
			},
		);
		return result.policy;
	}

	/**
	 * Update an existing deprecation policy.
	 */
	async updateDeprecationPolicy(
		policyId: string,
		updates: UpdateDeprecationPolicyRequest,
		tenantId?: string,
	): Promise<DeprecationPolicy> {
		await this.ensureActivated();
		uuidSchema.parse(policyId);
		const result = await this.request<{ policy: DeprecationPolicy }>(
			"PATCH",
			`/crypto/v1/deprecation/policies/${policyId}`,
			{
				body: updates,
				headers: this.withTenantHeader(tenantId),
				operation: "updateDeprecationPolicy",
			},
		);
		return result.policy;
	}

	/**
	 * Delete a deprecation policy.
	 */
	async deleteDeprecationPolicy(policyId: string, tenantId?: string): Promise<void> {
		await this.ensureActivated();
		uuidSchema.parse(policyId);
		await this.request<void>("DELETE", `/crypto/v1/deprecation/policies/${policyId}`, {
			operation: "deleteDeprecationPolicy",
			headers: this.withTenantHeader(tenantId),
		});
	}

	/**
	 * Get assets affected by deprecation policies.
	 */
	async getAffectedAssets(
		options: GetAffectedAssetsRequest = {},
	): Promise<GetAffectedAssetsResponse> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (options.tenantId) {
			uuidSchema.parse(options.tenantId);
			params.set("tenantId", options.tenantId);
		}
		if (options.severity) params.set("severity", options.severity);
		if (options.status) params.set("status", options.status);
		if (options.acknowledged !== undefined)
			params.set("acknowledged", String(options.acknowledged));
		if (options.algorithm) params.set("algorithm", options.algorithm);
		if (options.limit !== undefined) params.set("limit", String(options.limit));
		if (options.offset !== undefined) params.set("offset", String(options.offset));

		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/deprecation/affected-assets?${queryString}`
			: "/crypto/v1/deprecation/affected-assets";

		return this.request<GetAffectedAssetsResponse>("GET", path, {
			operation: "getAffectedAssets",
			headers: this.withTenantHeader(options.tenantId),
		});
	}

	/**
	 * Acknowledge deprecation for specific assets.
	 */
	async acknowledgeDeprecation(
		request: AcknowledgeDeprecationRequest,
	): Promise<AcknowledgeDeprecationResponse> {
		await this.ensureActivated();
		return this.request<AcknowledgeDeprecationResponse>(
			"POST",
			"/crypto/v1/deprecation/acknowledge",
			{
				body: request,
				headers: this.withTenantHeader(request.tenantId),
				operation: "acknowledgeDeprecation",
			},
		);
	}

	/**
	 * Get deprecation summary for a tenant.
	 */
	async getDeprecationSummary(tenantId?: string): Promise<DeprecationSummary> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (tenantId) {
			uuidSchema.parse(tenantId);
			params.set("tenantId", tenantId);
		}

		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/deprecation/summary?${queryString}`
			: "/crypto/v1/deprecation/summary";

		return this.request<DeprecationSummary>("GET", path, {
			operation: "getDeprecationSummary",
			headers: this.withTenantHeader(tenantId),
		});
	}

	/**
	 * Register a new hardware security device.
	 */
	async registerHardware(request: RegisterHardwareRequest): Promise<HardwareDevice> {
		await this.ensureActivated();
		const result = await this.request<{ device: HardwareDevice }>("POST", "/crypto/v1/hardware", {
			body: request,
			headers: this.withTenantHeader(request.tenantId),
			operation: "registerHardware",
		});
		return result.device;
	}

	/**
	 * List hardware security devices.
	 */
	async listHardware(options: ListHardwareRequest = {}): Promise<ListHardwareResponse> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (options.tenantId) {
			uuidSchema.parse(options.tenantId);
			params.set("tenantId", options.tenantId);
		}
		if (options.hardwareType) params.set("hardwareType", options.hardwareType);
		if (options.status) params.set("status", options.status);
		if (options.healthStatus) params.set("healthStatus", options.healthStatus);
		if (options.pqcCapable !== undefined) params.set("pqcCapable", String(options.pqcCapable));
		if (options.complianceLevel) params.set("complianceLevel", options.complianceLevel);
		if (options.location) params.set("location", options.location);
		if (options.limit !== undefined) params.set("limit", String(options.limit));
		if (options.offset !== undefined) params.set("offset", String(options.offset));

		const queryString = params.toString();
		const path = queryString ? `/crypto/v1/hardware?${queryString}` : "/crypto/v1/hardware";

		return this.request<ListHardwareResponse>("GET", path, {
			operation: "listHardware",
			headers: this.withTenantHeader(options.tenantId),
		});
	}

	/**
	 * Get a specific hardware device by ID.
	 */
	async getHardware(hardwareId: string, tenantId?: string): Promise<HardwareDevice> {
		await this.ensureActivated();
		uuidSchema.parse(hardwareId);
		const result = await this.request<{ device: HardwareDevice }>(
			"GET",
			`/crypto/v1/hardware/${hardwareId}`,
			{
				operation: "getHardware",
				headers: this.withTenantHeader(tenantId),
			},
		);
		return result.device;
	}

	/**
	 * Update a hardware device.
	 */
	async updateHardware(
		hardwareId: string,
		updates: UpdateHardwareRequest,
		tenantId?: string,
	): Promise<HardwareDevice> {
		await this.ensureActivated();
		uuidSchema.parse(hardwareId);
		const result = await this.request<{ device: HardwareDevice }>(
			"PATCH",
			`/crypto/v1/hardware/${hardwareId}`,
			{
				body: updates,
				headers: this.withTenantHeader(tenantId),
				operation: "updateHardware",
			},
		);
		return result.device;
	}

	/**
	 * Delete a hardware device.
	 */
	async deleteHardware(hardwareId: string, tenantId?: string): Promise<void> {
		await this.ensureActivated();
		uuidSchema.parse(hardwareId);
		await this.request<void>("DELETE", `/crypto/v1/hardware/${hardwareId}`, {
			operation: "deleteHardware",
			headers: this.withTenantHeader(tenantId),
		});
	}

	/**
	 * Record a health check for a hardware device.
	 */
	async recordHealthCheck(
		hardwareId: string,
		healthCheck: RecordHealthCheckRequest,
		tenantId?: string,
	): Promise<HealthCheckRecord> {
		await this.ensureActivated();
		uuidSchema.parse(hardwareId);
		const result = await this.request<{ healthCheck: HealthCheckRecord }>(
			"POST",
			`/crypto/v1/hardware/${hardwareId}/health`,
			{
				body: healthCheck,
				headers: this.withTenantHeader(tenantId),
				operation: "recordHealthCheck",
			},
		);
		return result.healthCheck;
	}

	/**
	 * Get health check history for a hardware device.
	 */
	async getHardwareHealth(
		hardwareId: string,
		options: GetHardwareHealthRequest = {},
	): Promise<GetHardwareHealthResponse> {
		await this.ensureActivated();
		uuidSchema.parse(hardwareId);
		const params = new URLSearchParams();
		if (options.tenantId) {
			uuidSchema.parse(options.tenantId);
			params.set("tenantId", options.tenantId);
		}
		if (options.since) params.set("since", options.since);
		if (options.until) params.set("until", options.until);
		if (options.limit !== undefined) params.set("limit", String(options.limit));

		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/hardware/${hardwareId}/health?${queryString}`
			: `/crypto/v1/hardware/${hardwareId}/health`;

		return this.request<GetHardwareHealthResponse>("GET", path, {
			operation: "getHardwareHealth",
			headers: this.withTenantHeader(options.tenantId),
		});
	}

	/**
	 * Get hardware inventory summary.
	 */
	async getInventorySummary(tenantId?: string): Promise<HardwareInventorySummary> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (tenantId) {
			uuidSchema.parse(tenantId);
			params.set("tenantId", tenantId);
		}

		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/hardware/summary?${queryString}`
			: "/crypto/v1/hardware/summary";

		return this.request<HardwareInventorySummary>("GET", path, {
			operation: "getInventorySummary",
			headers: this.withTenantHeader(tenantId),
		});
	}

	/**
	 * Get PQC readiness score for a tenant.
	 */
	async getReadinessScore(tenantId?: string): Promise<PqcReadinessScore> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (tenantId) {
			uuidSchema.parse(tenantId);
			params.set("tenantId", tenantId);
		}

		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/pqc-readiness/score?${queryString}`
			: "/crypto/v1/pqc-readiness/score";

		const result = await this.request<{ score: PqcReadinessScore }>("GET", path, {
			operation: "getReadinessScore",
			headers: this.withTenantHeader(tenantId),
		});
		return result.score;
	}

	/**
	 * Get PQC readiness score for a specific category.
	 */
	async getCategoryScore(category: ReadinessCategory, tenantId?: string): Promise<CategoryScore> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (tenantId) {
			uuidSchema.parse(tenantId);
			params.set("tenantId", tenantId);
		}

		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/pqc-readiness/score/category/${category}?${queryString}`
			: `/crypto/v1/pqc-readiness/score/category/${category}`;

		const result = await this.request<{ categoryScore: CategoryScore }>("GET", path, {
			operation: "getCategoryScore",
			headers: this.withTenantHeader(tenantId),
		});
		return result.categoryScore;
	}

	/**
	 * Get PQC readiness score history.
	 */
	async getScoreHistory(options: GetScoreHistoryRequest = {}): Promise<GetScoreHistoryResponse> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (options.tenantId) {
			uuidSchema.parse(options.tenantId);
			params.set("tenantId", options.tenantId);
		}
		if (options.since) params.set("since", options.since);
		if (options.until) params.set("until", options.until);
		if (options.limit !== undefined) params.set("limit", String(options.limit));

		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/pqc-readiness/score/history?${queryString}`
			: "/crypto/v1/pqc-readiness/score/history";

		return this.request<GetScoreHistoryResponse>("GET", path, {
			operation: "getScoreHistory",
			headers: this.withTenantHeader(options.tenantId),
		});
	}

	/**
	 * Get PQC readiness recommendations.
	 */
	async getRecommendations(tenantId?: string): Promise<ReadinessRecommendations> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (tenantId) {
			uuidSchema.parse(tenantId);
			params.set("tenantId", tenantId);
		}

		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/pqc-readiness/recommendations?${queryString}`
			: "/crypto/v1/pqc-readiness/recommendations";

		return this.request<ReadinessRecommendations>("GET", path, {
			operation: "getRecommendations",
			headers: this.withTenantHeader(tenantId),
		});
	}

	/**
	 * Get PQC readiness benchmark comparison.
	 */
	async getBenchmark(tenantId?: string): Promise<ReadinessBenchmark> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (tenantId) {
			uuidSchema.parse(tenantId);
			params.set("tenantId", tenantId);
		}

		const queryString = params.toString();
		const path = queryString
			? `/crypto/v1/pqc-readiness/benchmark?${queryString}`
			: "/crypto/v1/pqc-readiness/benchmark";

		return this.request<ReadinessBenchmark>("GET", path, {
			operation: "getBenchmark",
			headers: this.withTenantHeader(tenantId),
		});
	}
}

export * from "./observability.js";
