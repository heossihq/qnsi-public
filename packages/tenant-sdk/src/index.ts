import { performance } from "node:perf_hooks";

import { activateSdk, type SdkActivationConfig } from "@heossihq/qnsi-sdk-activation";

import type {
	TenantClientTelemetry,
	TenantClientTelemetryConfig,
	TenantClientTelemetryEvent,
} from "./observability.js";
import { createTenantClientTelemetry, isTenantClientTelemetry } from "./observability.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";
import { validateUUID } from "./validation.js";

/**
 * @heossihq/qnsi-tenant-sdk
 *
 * TypeScript SDK client for the QNSP tenant-service API.
 * Provides a high-level interface for tenant lifecycle and subscription management.
 */

/** Default QNSP cloud API base URL. Get a free API key at https://cloud.qnsi.heossi.com/signup */
export const DEFAULT_BASE_URL = "https://api.qnsi.heossi.com";

export interface TenantClientConfig {
	readonly baseUrl?: string;
	readonly apiKey: string;
	readonly timeoutMs?: number;
	readonly telemetry?: TenantClientTelemetry | TenantClientTelemetryConfig;
	readonly maxRetries?: number;
	readonly retryDelayMs?: number;
}

type InternalTenantClientConfig = {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly timeoutMs: number;
	readonly maxRetries: number;
	readonly retryDelayMs: number;
};

export type TenantStatus = "active" | "suspended" | "pending" | "deleted";

export type HsmMode = "none" | "supported" | "required";

/**
 * Crypto policy tier determines which PQC algorithms are allowed.
 * Maps to tenant_crypto_policies.policy_tier in tenant-service.
 */
export type CryptoPolicyTier = "default" | "strict" | "maximum" | "government";

/**
 * Crypto policy v1 uses profiles + tiers (evidence-first model).
 */
export type QnspTier =
	| "TIER0_LEGACY"
	| "TIER1_APPROVED"
	| "TIER2_HIGH_ASSURANCE"
	| "TIER3_DIVERSITY"
	| "TIER4_EXPERIMENTAL";

export type TenantType =
	| "FREE_FOREVER"
	| "DEV_STARTER"
	| "DEV_PRO"
	| "DEV_ELITE"
	| "BUSINESS_TEAM"
	| "BUSINESS_ADVANCED"
	| "BUSINESS_ELITE"
	| "ENTERPRISE_STANDARD"
	| "ENTERPRISE_PRO"
	| "ENTERPRISE_ELITE"
	| "PUBLIC_SECTOR";

export type CryptoProfileId =
	| "gov-high-assurance"
	| "defense-long-life-data"
	| "financial-hybrid-pqc"
	| "research-eval";

export type TenantCryptoPolicyV1Action = "CREATE" | "UPDATE" | "ROLLBACK";

export interface CryptoPolicyV1 {
	readonly version: "v1";
	readonly tenantType: TenantType;
	readonly profile: CryptoProfileId;
	readonly enabledTiers: readonly QnspTier[];
	readonly tier0Expiry?: string;
	readonly tier4Acknowledgement?: {
		readonly nonCompliant: true;
		readonly noProductionSecrets: true;
		readonly approvedBy: string;
		readonly approvedAt: string;
	};
	readonly overrides?: {
		readonly allowFalcon?: boolean;
	};
	readonly requirements: {
		readonly fipsAligned: boolean;
		readonly evidenceRequired: boolean;
		readonly cryptoAgilityMetadataRequired: boolean;
		readonly statefulLifecycleGuards: boolean;
		readonly downgradeDetection: boolean;
	};
}

export interface TenantCryptoPolicyV1Record {
	readonly id: string;
	readonly tenantId: string;
	readonly version: "v1";
	readonly policy: CryptoPolicyV1;
	readonly policyHash: string;
	readonly etag: string;
	readonly createdAt: string;
	readonly createdByPrincipal: string;
	readonly createdByIp: string | null;
	readonly updatedAt: string;
	readonly updatedByPrincipal: string;
	readonly updatedByIp: string | null;
}

export interface TenantCryptoPolicyV1HistoryRecord {
	readonly id: string;
	readonly tenantId: string;
	readonly version: "v1";
	readonly policy: CryptoPolicyV1;
	readonly policyHash: string;
	readonly action: TenantCryptoPolicyV1Action;
	readonly reason: string | null;
	readonly changedAt: string;
	readonly changedByPrincipal: string;
	readonly changedByIp: string | null;
}

export interface TenantCryptoPolicyV1HistoryResponse {
	readonly tenantId: string;
	readonly items: readonly TenantCryptoPolicyV1HistoryRecord[];
}

/**
 * Tenant crypto policy configuration.
 */
export interface TenantCryptoPolicy {
	readonly tenantId: string;
	readonly policyTier: CryptoPolicyTier;
	readonly customAllowedKemAlgorithms: readonly string[] | null;
	readonly customAllowedSignatureAlgorithms: readonly string[] | null;
	readonly customAllowedSymmetricAlgorithms?: readonly string[] | null;
	readonly customForbiddenAlgorithms?: readonly string[] | null;
	readonly requireHsmForRootKeys: boolean;
	readonly maxKeyAgeDays: number;
	readonly enforcementMode?: "audit" | "enforce";
	/**
	 * Declarative entropy-source contract. See https://qnsi.heossi.com/trust/entropy.
	 * Defaults: "csprng" (OpenSSL SP 800-90A DRBG) for default + strict tiers,
	 * "hsm-byo" (customer FIPS 140-3 L3 HSM DRBG) for maximum + government tiers.
	 * "qrng-mixin" available as a sales-assisted BYOH add-on.
	 */
	readonly cryptoEntropySource?: "csprng" | "hsm-byo" | "qrng-mixin";
	readonly createdAt: string;
	readonly updatedAt: string;
}

/**
 * Input for creating or updating a tenant crypto policy.
 */
export interface TenantCryptoPolicyInput {
	readonly policyTier: CryptoPolicyTier;
	readonly customAllowedKemAlgorithms?: readonly string[] | null;
	readonly customAllowedSignatureAlgorithms?: readonly string[] | null;
	readonly requireHsmForRootKeys?: boolean;
	readonly maxKeyAgeDays?: number;
	readonly cryptoEntropySource?: "csprng" | "hsm-byo" | "qrng-mixin";
}

/**
 * Algorithm configuration per crypto policy tier.
 */
export interface TierAlgorithmConfig {
	readonly kemAlgorithms: readonly string[];
	readonly signatureAlgorithms: readonly string[];
	readonly defaultKemAlgorithm: string;
	readonly defaultSignatureAlgorithm: string;
}

/**
 * Default algorithms per crypto policy tier.
 * These match the definitions in packages/security/src/crypto-policy.ts
 * and determine which algorithms appear in the portal's Generate Key dropdown.
 *
 * default: All supported PQC algorithms (NIST-finalized + candidates via liboqs)
 * strict: NIST-finalized/selected at higher security levels
 * maximum: Highest-security NIST-finalized only
 * government: FIPS-finalized only (no draft standards)
 */
export const CRYPTO_POLICY_ALGORITHMS: Record<CryptoPolicyTier, TierAlgorithmConfig> = {
	default: {
		kemAlgorithms: [
			// FIPS 203 - ML-KEM (NIST finalized)
			"kyber-512",
			"kyber-768",
			"kyber-1024",
			// HQC intentionally omitted (disabled upstream; CVE-2025-48946).
			// BIKE (NIST Round 4 candidate)
			"bike-l1",
			"bike-l3",
			"bike-l5",
			// Classic McEliece (ISO standard)
			"mceliece-348864",
			"mceliece-460896",
			"mceliece-6688128",
			"mceliece-6960119",
			"mceliece-8192128",
			// FrodoKEM (ISO standard)
			"frodokem-640-aes",
			"frodokem-640-shake",
			"frodokem-976-aes",
			"frodokem-976-shake",
			"frodokem-1344-aes",
			"frodokem-1344-shake",
			// NTRU (lattice-based)
			"ntru-hps-2048-509",
			"ntru-hps-2048-677",
			"ntru-hps-4096-821",
			"ntru-hps-4096-1229",
			"ntru-hrss-701",
			"ntru-hrss-1373",
			// NTRU-Prime
			"sntrup761",
		],
		signatureAlgorithms: [
			// FIPS 204 - ML-DSA (NIST finalized)
			"dilithium-2",
			"dilithium-3",
			"dilithium-5",
			// FIPS 205 - SLH-DSA (NIST finalized, SHA-2 variants)
			"sphincs-sha2-128f-simple",
			"sphincs-sha2-128s-simple",
			"sphincs-sha2-192f-simple",
			"sphincs-sha2-192s-simple",
			"sphincs-sha2-256f-simple",
			"sphincs-sha2-256s-simple",
			// FIPS 205 - SLH-DSA (NIST finalized, SHAKE variants)
			"sphincs-shake-128f-simple",
			"sphincs-shake-128s-simple",
			"sphincs-shake-192f-simple",
			"sphincs-shake-192s-simple",
			"sphincs-shake-256f-simple",
			"sphincs-shake-256s-simple",
			// FN-DSA / Falcon (FIPS 206 draft)
			"falcon-512",
			"falcon-1024",
			// MAYO (NIST Additional Signatures Round 2)
			"mayo-1",
			"mayo-2",
			"mayo-3",
			"mayo-5",
			// CROSS (NIST Additional Signatures Round 2)
			"cross-rsdp-128-balanced",
			"cross-rsdp-128-fast",
			"cross-rsdp-128-small",
			"cross-rsdp-192-balanced",
			"cross-rsdp-192-fast",
			"cross-rsdp-192-small",
			"cross-rsdp-256-balanced",
			"cross-rsdp-256-fast",
			"cross-rsdp-256-small",
			"cross-rsdpg-128-balanced",
			"cross-rsdpg-128-fast",
			"cross-rsdpg-128-small",
			"cross-rsdpg-192-balanced",
			"cross-rsdpg-192-fast",
			"cross-rsdpg-192-small",
			"cross-rsdpg-256-balanced",
			"cross-rsdpg-256-fast",
			"cross-rsdpg-256-small",
			// UOV (NIST Additional Signatures Round 2)
			"ov-Is",
			"ov-Ip",
			"ov-III",
			"ov-V",
			"ov-Is-pkc",
			"ov-Ip-pkc",
			"ov-III-pkc",
			"ov-V-pkc",
			"ov-Is-pkc-skc",
			"ov-Ip-pkc-skc",
			"ov-III-pkc-skc",
			"ov-V-pkc-skc",
			// SNOVA (NIST Additional Signatures Round 2)
			"snova-24-5-4",
			"snova-24-5-4-shake",
			"snova-24-5-4-esk",
			"snova-24-5-4-shake-esk",
			"snova-25-8-3",
			"snova-37-17-2",
			"snova-37-8-4",
			"snova-24-5-5",
			"snova-56-25-2",
			"snova-49-11-3",
			"snova-60-10-4",
			"snova-29-6-5",
		],
		defaultKemAlgorithm: "kyber-768",
		defaultSignatureAlgorithm: "dilithium-3",
	},
	strict: {
		kemAlgorithms: ["kyber-768", "kyber-1024"],
		signatureAlgorithms: [
			"dilithium-3",
			"dilithium-5",
			"falcon-1024",
			"sphincs-sha2-256f-simple",
			"sphincs-sha2-256s-simple",
			"sphincs-shake-256f-simple",
			"sphincs-shake-256s-simple",
		],
		defaultKemAlgorithm: "kyber-768",
		defaultSignatureAlgorithm: "dilithium-3",
	},
	maximum: {
		kemAlgorithms: ["kyber-1024"],
		signatureAlgorithms: [
			"dilithium-5",
			"falcon-1024",
			"sphincs-sha2-256f-simple",
			"sphincs-shake-256f-simple",
		],
		defaultKemAlgorithm: "kyber-1024",
		defaultSignatureAlgorithm: "dilithium-5",
	},
	government: {
		kemAlgorithms: ["kyber-1024"],
		signatureAlgorithms: ["dilithium-5", "sphincs-sha2-256f-simple", "sphincs-shake-256f-simple"],
		defaultKemAlgorithm: "kyber-1024",
		defaultSignatureAlgorithm: "dilithium-5",
	},
};

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
	// HQC intentionally omitted (disabled upstream; CVE-2025-48946).
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
export function toNistAlgorithmName(internal: string): string {
	return ALGORITHM_TO_NIST[internal] ?? internal;
}

/**
 * Get algorithm config for a crypto policy tier.
 */
export function getAlgorithmConfigForTier(tier: CryptoPolicyTier): TierAlgorithmConfig {
	return CRYPTO_POLICY_ALGORITHMS[tier];
}

export interface TenantSecurityEnvelope {
	readonly controlPlaneTokenSha256: string | null;
	readonly pqcSignatures: readonly {
		readonly provider: string;
		readonly algorithm: string;
		readonly value: string;
		readonly publicKey: string;
	}[];
	readonly hardwareProvider: string | null;
	readonly attestationStatus: string | null;
	readonly attestationProof: string | null;
}

export interface TenantSignature {
	readonly provider: string;
	readonly algorithm: string;
	readonly value: string;
	readonly publicKey: string;
}

export interface TenantDomain {
	readonly id: string;
	readonly domain: string;
	readonly verified: boolean;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface Tenant {
	readonly id: string;
	readonly name: string;
	readonly slug: string;
	readonly status: TenantStatus;
	readonly plan: string;
	readonly region: string;
	readonly complianceTags: readonly string[];
	readonly hsmMode: HsmMode;
	readonly metadata: Record<string, unknown>;
	readonly security: TenantSecurityEnvelope;
	readonly domains: readonly TenantDomain[];
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface CreateTenantRequest {
	readonly name: string;
	readonly slug: string;
	readonly plan?: string;
	readonly region?: string;
	readonly complianceTags?: readonly string[];
	readonly hsmMode?: HsmMode;
	readonly metadata?: Record<string, unknown>;
	readonly domains?: readonly {
		readonly domain: string;
		readonly verified?: boolean;
	}[];
	readonly security: TenantSecurityEnvelope;
	readonly signature?: TenantSignature;
}

export interface UpdateTenantRequest {
	readonly plan?: string;
	readonly status?: TenantStatus;
	readonly complianceTags?: readonly string[];
	readonly hsmMode?: HsmMode;
	readonly metadata?: Record<string, unknown>;
	readonly security: TenantSecurityEnvelope;
	readonly signature?: TenantSignature;
}

export interface ListTenantsResponse {
	readonly items: readonly Tenant[];
	readonly nextCursor: string | null;
}

interface RequestOptions {
	readonly body?: unknown;
	readonly headers?: Record<string, string>;
	readonly signal?: AbortSignal;
	readonly operation?: string;
	readonly telemetryRoute?: string;
	readonly telemetryTarget?: string;
}

/**
 * Health Dashboard Types
 */

export type TenantHealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";
export type HealthAlertSeverity = "info" | "warning" | "critical";
export type HealthAlertStatus = "active" | "acknowledged" | "resolved";

export interface TenantHealthSnapshot {
	readonly tenantId: string;
	readonly timestamp: string;
	readonly status: TenantHealthStatus;
	readonly metrics: {
		readonly apiLatencyP50Ms: number;
		readonly apiLatencyP99Ms: number;
		readonly errorRate: number;
		readonly requestsPerSecond: number;
		readonly activeConnections: number;
		readonly storageUsedBytes: number;
		readonly quotaUtilization: Record<string, number>;
	};
	readonly services: readonly {
		readonly service: string;
		readonly status: TenantHealthStatus;
		readonly latencyMs: number;
		readonly errorRate: number;
	}[];
}

export interface RecordHealthSnapshotRequest {
	readonly tenantId: string;
	readonly metrics: {
		readonly apiLatencyP50Ms?: number;
		readonly apiLatencyP99Ms?: number;
		readonly errorRate?: number;
		readonly requestsPerSecond?: number;
		readonly activeConnections?: number;
		readonly storageUsedBytes?: number;
	};
}

export interface GetHealthTrendsRequest {
	readonly tenantId: string;
	readonly since?: string;
	readonly until?: string;
	readonly granularity?: "minute" | "hour" | "day";
}

export interface HealthTrends {
	readonly tenantId: string;
	readonly period: {
		readonly start: string;
		readonly end: string;
	};
	readonly dataPoints: readonly {
		readonly timestamp: string;
		readonly status: TenantHealthStatus;
		readonly apiLatencyP50Ms: number;
		readonly apiLatencyP99Ms: number;
		readonly errorRate: number;
		readonly requestsPerSecond: number;
	}[];
	readonly summary: {
		readonly avgLatencyMs: number;
		readonly avgErrorRate: number;
		readonly uptimePercent: number;
		readonly incidentCount: number;
	};
}

export interface TenantHealthAlert {
	readonly id: string;
	readonly tenantId: string;
	readonly severity: HealthAlertSeverity;
	readonly status: HealthAlertStatus;
	readonly title: string;
	readonly description: string;
	readonly metric?: string;
	readonly threshold?: number;
	readonly currentValue?: number;
	readonly createdAt: string;
	readonly acknowledgedAt?: string;
	readonly acknowledgedBy?: string;
	readonly resolvedAt?: string;
}

export interface CreateHealthAlertRequest {
	readonly tenantId: string;
	readonly severity: HealthAlertSeverity;
	readonly title: string;
	readonly description: string;
	readonly metric?: string;
	readonly threshold?: number;
	readonly currentValue?: number;
}

export interface AcknowledgeHealthAlertRequest {
	readonly alertId: string;
	readonly acknowledgedBy: string;
	readonly note?: string;
}

/**
 * Quota Forecasting Types
 */

export interface QuotaDefinition {
	readonly name: string;
	readonly limit: number;
	readonly unit: string;
	readonly period?: "hour" | "day" | "month";
}

export interface RecordQuotaUsageRequest {
	readonly tenantId: string;
	readonly quotaName: string;
	readonly usage: number;
	readonly timestamp?: string;
}

export interface CurrentQuotas {
	readonly tenantId: string;
	readonly quotas: readonly {
		readonly name: string;
		readonly limit: number;
		readonly used: number;
		readonly remaining: number;
		readonly utilizationPercent: number;
		readonly unit: string;
		readonly period?: "hour" | "day" | "month";
		readonly resetsAt?: string;
	}[];
}

export interface QuotaForecastRequest {
	readonly tenantId: string;
	readonly quotaName?: string;
	readonly horizonDays?: number;
}

export interface QuotaForecast {
	readonly tenantId: string;
	readonly generatedAt: string;
	readonly forecasts: readonly {
		readonly quotaName: string;
		readonly currentUsage: number;
		readonly limit: number;
		readonly predictions: readonly {
			readonly date: string;
			readonly predictedUsage: number;
			readonly confidenceLow: number;
			readonly confidenceHigh: number;
			readonly exceedsLimit: boolean;
		}[];
		readonly estimatedExhaustionDate?: string;
	}[];
}

export interface QuotaSuggestion {
	readonly quotaName: string;
	readonly currentLimit: number;
	readonly suggestedLimit: number;
	readonly reason: string;
	readonly confidence: number;
	readonly basedOn: {
		readonly avgUsage: number;
		readonly peakUsage: number;
		readonly growthRate: number;
	};
}

export interface QuotaSuggestionsResponse {
	readonly tenantId: string;
	readonly suggestions: readonly QuotaSuggestion[];
}

/**
 * Onboarding Types
 */

export type OnboardingStepStatus = "pending" | "in_progress" | "completed" | "skipped" | "failed";

export interface OnboardingStep {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly order: number;
	readonly required: boolean;
	readonly estimatedMinutes?: number;
	readonly dependencies?: readonly string[];
}

export interface WorkflowTemplate {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly steps: readonly OnboardingStep[];
	readonly estimatedTotalMinutes: number;
	readonly isDefault: boolean;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface CreateWorkflowTemplateRequest {
	readonly name: string;
	readonly description?: string;
	readonly steps: readonly Omit<OnboardingStep, "id">[];
	readonly isDefault?: boolean;
}

/**
 * An onboarding workflow instance, matching the tenant-service response from
 * POST /tenant/v1/onboarding/workflows and GET /tenant/v1/onboarding/workflows/:workflowId.
 */
export interface OnboardingInstance {
	readonly id: string;
	readonly tenantId: string;
	readonly newTenantId: string | null;
	readonly templateId: string | null;
	readonly tenantName: string;
	readonly tenantSlug: string;
	readonly plan: string;
	readonly region: string | null;
	readonly ownerEmail: string;
	readonly ownerName: string | null;
	readonly metadata: Record<string, unknown> | null;
	readonly status: string;
	readonly priority: string;
	readonly progress: {
		readonly completedSteps: number;
		readonly totalSteps: number;
		readonly percentComplete: number;
	};
	readonly steps: readonly {
		readonly id: string;
		readonly stepType: string;
		readonly name: string;
		readonly order: number;
		readonly status: string;
		readonly startedAt?: string | null;
		readonly completedAt?: string | null;
		readonly errorMessage?: string | null;
	}[];
	readonly startedAt?: string | null;
	readonly completedAt?: string | null;
	readonly createdAt: string;
}

/**
 * Request body for {@link TenantSdk.startOnboarding}, matching the tenant-service
 * workflow-trigger schema (provisions a new tenant).
 */
export interface StartOnboardingRequest {
	readonly tenantName: string;
	readonly tenantSlug: string;
	readonly ownerEmail: string;
	readonly plan?: string;
	readonly region?: string;
	readonly ownerName?: string;
	readonly templateId?: string;
	readonly metadata?: Record<string, unknown>;
	readonly priority?: "low" | "normal" | "high";
}

export interface OnboardingStats {
	readonly period: {
		readonly start: string;
		readonly end: string;
	};
	readonly totalStarted: number;
	readonly totalCompleted: number;
	readonly totalAbandoned: number;
	readonly completionRate: number;
	readonly avgCompletionTimeMinutes: number;
	readonly stepBreakdown: readonly {
		readonly stepName: string;
		readonly completionRate: number;
		readonly avgTimeMinutes: number;
		readonly dropOffRate: number;
	}[];
}

/**
 * Isolation Audit Types
 */

export type IsolationLevel = "strict" | "standard" | "relaxed";
export type IsolationPolicyStatus = "active" | "paused" | "disabled";

export interface TenantIsolationPolicy {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly description?: string;
	readonly level: IsolationLevel;
	readonly status: IsolationPolicyStatus;
	readonly rules: readonly {
		readonly resource: string;
		readonly constraint: string;
		readonly action: "deny" | "audit" | "allow";
	}[];
	readonly enforcementMode: "audit" | "enforce";
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface CreateIsolationPolicyRequest {
	readonly tenantId: string;
	readonly name: string;
	readonly description?: string;
	readonly level: IsolationLevel;
	readonly rules?: readonly {
		readonly resource: string;
		readonly constraint: string;
		readonly action: "deny" | "audit" | "allow";
	}[];
	readonly enforcementMode?: "audit" | "enforce";
}

export interface IsolationAuditResult {
	readonly runId: string;
	readonly tenantId: string;
	readonly status: "running" | "completed" | "failed";
	readonly startedAt: string;
	readonly completedAt?: string;
	readonly summary: {
		readonly totalChecks: number;
		readonly passedChecks: number;
		readonly failedChecks: number;
		readonly warningChecks: number;
	};
	readonly findings: readonly IsolationFinding[];
}

export interface IsolationFinding {
	readonly id: string;
	readonly severity: "info" | "warning" | "critical";
	readonly category: string;
	readonly title: string;
	readonly description: string;
	readonly resource?: string;
	readonly evidence?: Record<string, unknown>;
	readonly recommendation?: string;
	readonly detectedAt: string;
}

export interface RunIsolationAuditRequest {
	readonly tenantId: string;
	readonly policyIds?: readonly string[];
	readonly categories?: readonly string[];
	readonly depth?: "quick" | "standard" | "deep";
}

export interface GetIsolationFindingsRequest {
	readonly tenantId: string;
	readonly runId?: string;
	readonly severity?: "info" | "warning" | "critical";
	readonly category?: string;
	readonly limit?: number;
	readonly cursor?: string;
}

export interface IsolationFindingsResponse {
	readonly items: readonly IsolationFinding[];
	readonly nextCursor: string | null;
}

export class TenantClient {
	private readonly config: InternalTenantClientConfig;
	private readonly telemetry: TenantClientTelemetry | null;
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
		await this.activationPromise;
	}

	constructor(config: TenantClientConfig) {
		if (!config.apiKey || config.apiKey.trim().length === 0) {
			throw new Error(
				"QNSP Tenant SDK: apiKey is required. " +
					"Get your free API key at https://cloud.qnsi.heossi.com/signup - " +
					"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
					"Docs: https://docs.qnsi.heossi.com/sdk/tenant-sdk",
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
			? isTenantClientTelemetry(config.telemetry)
				? config.telemetry
				: createTenantClientTelemetry(config.telemetry)
			: null;

		try {
			this.targetService = new URL(this.config.baseUrl).host;
		} catch {
			this.targetService = "tenant-service";
		}

		this.activationConfig = {
			apiKey: config.apiKey,
			sdkId: "tenant-sdk",
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
					`Tenant API error: Rate limit exceeded after ${this.config.maxRetries} retries`,
				);
			}

			if (!response.ok) {
				status = "error";
				// Sanitize error message to prevent information disclosure
				// Don't include full response text in error to avoid leaking sensitive data
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Tenant API error: ${response.status} ${response.statusText}`);
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
			const event: TenantClientTelemetryEvent = {
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

	private recordTelemetryEvent(event: TenantClientTelemetryEvent): void {
		if (!this.telemetry) {
			return;
		}
		this.telemetry.record(event);
	}

	/**
	 * Create a new tenant.
	 * Requires PQC-signed security envelope and optional signature.
	 */
	async createTenant(request: CreateTenantRequest): Promise<Tenant> {
		await this.ensureActivated();
		// Validation is handled by the service, but we validate format here for early feedback
		return this.request<Tenant>("POST", "/tenant/v1/tenants", {
			body: {
				name: request.name,
				slug: request.slug,
				...(request.plan !== undefined ? { plan: request.plan } : {}),
				...(request.region !== undefined ? { region: request.region } : {}),
				...(request.complianceTags !== undefined ? { complianceTags: request.complianceTags } : {}),
				...(request.hsmMode !== undefined ? { hsmMode: request.hsmMode } : {}),
				...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
				...(request.domains !== undefined ? { domains: request.domains } : {}),
				security: request.security,
				...(request.signature !== undefined ? { signature: request.signature } : {}),
			},
			operation: "createTenant",
		});
	}

	/**
	 * Update a tenant's plan, status, compliance tags, or metadata.
	 * Requires PQC-signed security envelope and optional signature.
	 */
	async updateTenant(id: string, request: UpdateTenantRequest): Promise<Tenant> {
		validateUUID(id, "id");
		await this.ensureActivated();

		return this.request<Tenant>("PATCH", `/tenant/v1/tenants/${id}`, {
			body: {
				...(request.plan !== undefined ? { plan: request.plan } : {}),
				...(request.status !== undefined ? { status: request.status } : {}),
				...(request.complianceTags !== undefined ? { complianceTags: request.complianceTags } : {}),
				...(request.hsmMode !== undefined ? { hsmMode: request.hsmMode } : {}),
				...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
				security: request.security,
				...(request.signature !== undefined ? { signature: request.signature } : {}),
			},
			operation: "updateTenant",
		});
	}

	/**
	 * Get a tenant by ID.
	 * Returns the tenant with domains and security envelope.
	 */
	async getTenant(id: string): Promise<Tenant> {
		validateUUID(id, "id");
		await this.ensureActivated();

		return this.request<Tenant>("GET", `/tenant/v1/tenants/${id}`, {
			operation: "getTenant",
		});
	}

	/**
	 * List tenants with cursor-based pagination.
	 * Returns a list of tenants and an optional next cursor for pagination.
	 */
	async listTenants(options?: {
		readonly limit?: number;
		readonly cursor?: string;
	}): Promise<ListTenantsResponse> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (options?.limit !== undefined) {
			params.set("limit", String(options.limit));
		}
		if (options?.cursor !== undefined) {
			params.set("cursor", options.cursor);
		}
		const queryString = params.toString();
		const path = queryString ? `/tenant/v1/tenants?${queryString}` : "/tenant/v1/tenants";

		return this.request<ListTenantsResponse>("GET", path, {
			operation: "listTenants",
		});
	}

	/**
	 * Get the crypto policy for a tenant.
	 * Returns the tenant's crypto policy configuration including allowed algorithms.
	 * If no policy exists, a default policy is created and returned.
	 */
	async getTenantCryptoPolicy(tenantId: string): Promise<TenantCryptoPolicy> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<TenantCryptoPolicy>("GET", `/tenant/v1/tenants/${tenantId}/crypto-policy`, {
			operation: "getTenantCryptoPolicy",
		});
	}

	/**
	 * Get the v1 crypto policy for a tenant (profiles + tiers model).
	 * If no policy exists, a default policy is created and returned.
	 */
	async getTenantCryptoPolicyV1(tenantId: string): Promise<TenantCryptoPolicyV1Record> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<TenantCryptoPolicyV1Record>(
			"GET",
			`/tenant/v1/tenants/${tenantId}/crypto-policy-v1`,
			{
				operation: "getTenantCryptoPolicyV1",
			},
		);
	}

	/**
	 * List v1 crypto policy history entries.
	 */
	async listTenantCryptoPolicyV1History(
		tenantId: string,
		options?: { readonly limit?: number },
	): Promise<TenantCryptoPolicyV1HistoryResponse> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (options?.limit !== undefined) {
			params.set("limit", String(options.limit));
		}
		const query = params.toString();
		const path = query
			? `/tenant/v1/tenants/${tenantId}/crypto-policy-v1/history?${query}`
			: `/tenant/v1/tenants/${tenantId}/crypto-policy-v1/history`;

		return this.request<TenantCryptoPolicyV1HistoryResponse>("GET", path, {
			operation: "listTenantCryptoPolicyV1History",
		});
	}

	/**
	 * Create or update the crypto policy for a tenant.
	 * Sets the policy tier and optional custom algorithm restrictions.
	 */
	async upsertTenantCryptoPolicy(
		tenantId: string,
		policy: TenantCryptoPolicyInput,
	): Promise<TenantCryptoPolicy> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<TenantCryptoPolicy>("PUT", `/tenant/v1/tenants/${tenantId}/crypto-policy`, {
			body: {
				policyTier: policy.policyTier,
				...(policy.customAllowedKemAlgorithms !== undefined
					? { customAllowedKemAlgorithms: policy.customAllowedKemAlgorithms }
					: {}),
				...(policy.customAllowedSignatureAlgorithms !== undefined
					? { customAllowedSignatureAlgorithms: policy.customAllowedSignatureAlgorithms }
					: {}),
				...(policy.requireHsmForRootKeys !== undefined
					? { requireHsmForRootKeys: policy.requireHsmForRootKeys }
					: {}),
				...(policy.maxKeyAgeDays !== undefined ? { maxKeyAgeDays: policy.maxKeyAgeDays } : {}),
			},
			operation: "upsertTenantCryptoPolicy",
		});
	}

	/**
	 * Update the v1 crypto policy for a tenant (requires If-Match with current ETag).
	 */
	async updateTenantCryptoPolicyV1(
		tenantId: string,
		policy: CryptoPolicyV1,
		etag: string,
	): Promise<TenantCryptoPolicyV1Record> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();
		if (!etag) {
			throw new Error("etag is required for updateTenantCryptoPolicyV1");
		}

		return this.request<TenantCryptoPolicyV1Record>(
			"PUT",
			`/tenant/v1/tenants/${tenantId}/crypto-policy-v1`,
			{
				body: { policy },
				headers: {
					"If-Match": etag,
				},
				operation: "updateTenantCryptoPolicyV1",
			},
		);
	}

	/**
	 * Enable Tier0 legacy algorithms (time-bounded) for a tenant.
	 */
	async enableTier0Legacy(
		tenantId: string,
		input: { readonly expiry: string },
		etag: string,
	): Promise<TenantCryptoPolicyV1Record> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();
		if (!etag) {
			throw new Error("etag is required for enableTier0Legacy");
		}

		return this.request<TenantCryptoPolicyV1Record>(
			"POST",
			`/tenant/v1/tenants/${tenantId}/crypto-policy-v1/tier0/enable`,
			{
				body: { expiry: input.expiry },
				headers: {
					"If-Match": etag,
				},
				operation: "enableTier0Legacy",
			},
		);
	}

	/**
	 * Disable Tier0 legacy algorithms for a tenant.
	 */
	async disableTier0Legacy(tenantId: string, etag: string): Promise<TenantCryptoPolicyV1Record> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();
		if (!etag) {
			throw new Error("etag is required for disableTier0Legacy");
		}

		return this.request<TenantCryptoPolicyV1Record>(
			"POST",
			`/tenant/v1/tenants/${tenantId}/crypto-policy-v1/tier0/disable`,
			{
				body: {},
				headers: {
					"If-Match": etag,
				},
				operation: "disableTier0Legacy",
			},
		);
	}

	/**
	 * Enable Tier4 experimental algorithms with acknowledgement.
	 */
	async enableTier4Experimental(
		tenantId: string,
		input: { readonly approvedBy: string },
		etag: string,
	): Promise<TenantCryptoPolicyV1Record> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();
		if (!etag) {
			throw new Error("etag is required for enableTier4Experimental");
		}

		return this.request<TenantCryptoPolicyV1Record>(
			"POST",
			`/tenant/v1/tenants/${tenantId}/crypto-policy-v1/tier4/enable`,
			{
				body: { approvedBy: input.approvedBy },
				headers: {
					"If-Match": etag,
				},
				operation: "enableTier4Experimental",
			},
		);
	}

	/**
	 * Roll back the v1 crypto policy to a previous history record or policy hash.
	 */
	async rollbackTenantCryptoPolicyV1(
		tenantId: string,
		input: { readonly historyId?: string; readonly policyHash?: string },
		etag: string,
	): Promise<TenantCryptoPolicyV1Record> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();
		if (!etag) {
			throw new Error("etag is required for rollbackTenantCryptoPolicyV1");
		}
		if (!input.historyId && !input.policyHash) {
			throw new Error("historyId or policyHash is required for rollbackTenantCryptoPolicyV1");
		}

		return this.request<TenantCryptoPolicyV1Record>(
			"POST",
			`/tenant/v1/tenants/${tenantId}/crypto-policy-v1/rollback`,
			{
				body: {
					...(input.historyId ? { historyId: input.historyId } : {}),
					...(input.policyHash ? { policyHash: input.policyHash } : {}),
				},
				headers: {
					"If-Match": etag,
				},
				operation: "rollbackTenantCryptoPolicyV1",
			},
		);
	}

	/**
	 * Get the allowed KEM algorithms for a tenant based on their crypto policy.
	 * Convenience method that fetches the policy and returns the allowed algorithms.
	 */
	async getAllowedKemAlgorithms(tenantId: string): Promise<readonly string[]> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();
		const policy = await this.getTenantCryptoPolicy(tenantId);
		if (policy.customAllowedKemAlgorithms && policy.customAllowedKemAlgorithms.length > 0) {
			return policy.customAllowedKemAlgorithms;
		}
		return CRYPTO_POLICY_ALGORITHMS[policy.policyTier].kemAlgorithms;
	}

	/**
	 * Get the allowed signature algorithms for a tenant based on their crypto policy.
	 * Convenience method that fetches the policy and returns the allowed algorithms.
	 */
	async getAllowedSignatureAlgorithms(tenantId: string): Promise<readonly string[]> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();
		const policy = await this.getTenantCryptoPolicy(tenantId);
		if (
			policy.customAllowedSignatureAlgorithms &&
			policy.customAllowedSignatureAlgorithms.length > 0
		) {
			return policy.customAllowedSignatureAlgorithms;
		}
		return CRYPTO_POLICY_ALGORITHMS[policy.policyTier].signatureAlgorithms;
	}

	/**
	 * Get the default KEM algorithm for a tenant based on their crypto policy tier.
	 */
	async getDefaultKemAlgorithm(tenantId: string): Promise<string> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();
		const policy = await this.getTenantCryptoPolicy(tenantId);
		return CRYPTO_POLICY_ALGORITHMS[policy.policyTier].defaultKemAlgorithm;
	}

	/**
	 * Get the default signature algorithm for a tenant based on their crypto policy tier.
	 */
	async getDefaultSignatureAlgorithm(tenantId: string): Promise<string> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();
		const policy = await this.getTenantCryptoPolicy(tenantId);
		return CRYPTO_POLICY_ALGORITHMS[policy.policyTier].defaultSignatureAlgorithm;
	}

	/**
	 * Record a health snapshot for a tenant.
	 */
	async recordHealthSnapshot(request: RecordHealthSnapshotRequest): Promise<TenantHealthSnapshot> {
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<TenantHealthSnapshot>(
			"POST",
			`/tenant/v1/tenants/${request.tenantId}/health/snapshots`,
			{
				body: { metrics: request.metrics },
				operation: "recordHealthSnapshot",
			},
		);
	}

	/**
	 * Get the current health status for a tenant.
	 */
	async getCurrentHealth(tenantId: string): Promise<TenantHealthSnapshot> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<TenantHealthSnapshot>("GET", `/tenant/v1/tenants/${tenantId}/health`, {
			operation: "getCurrentHealth",
		});
	}

	/**
	 * Get health trends for a tenant over time.
	 */
	async getHealthTrends(request: GetHealthTrendsRequest): Promise<HealthTrends> {
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (request.since !== undefined) params.set("since", request.since);
		if (request.until !== undefined) params.set("until", request.until);
		if (request.granularity !== undefined) params.set("granularity", request.granularity);

		const queryString = params.toString();
		const path = queryString
			? `/tenant/v1/tenants/${request.tenantId}/health/trends?${queryString}`
			: `/tenant/v1/tenants/${request.tenantId}/health/trends`;

		return this.request<HealthTrends>("GET", path, {
			operation: "getHealthTrends",
		});
	}

	/**
	 * Create a health alert for a tenant.
	 */
	async createHealthAlert(request: CreateHealthAlertRequest): Promise<TenantHealthAlert> {
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<TenantHealthAlert>(
			"POST",
			`/tenant/v1/tenants/${request.tenantId}/health/alerts`,
			{
				body: {
					severity: request.severity,
					title: request.title,
					description: request.description,
					...(request.metric !== undefined ? { metric: request.metric } : {}),
					...(request.threshold !== undefined ? { threshold: request.threshold } : {}),
					...(request.currentValue !== undefined ? { currentValue: request.currentValue } : {}),
				},
				operation: "createHealthAlert",
			},
		);
	}

	/**
	 * Acknowledge a health alert.
	 */
	async acknowledgeAlert(request: AcknowledgeHealthAlertRequest): Promise<TenantHealthAlert> {
		validateUUID(request.alertId, "alertId");
		await this.ensureActivated();

		return this.request<TenantHealthAlert>(
			"POST",
			`/tenant/v1/health/alerts/${request.alertId}/acknowledge`,
			{
				body: {
					acknowledgedBy: request.acknowledgedBy,
					...(request.note !== undefined ? { note: request.note } : {}),
				},
				operation: "acknowledgeAlert",
			},
		);
	}

	/**
	 * Record quota usage for a tenant.
	 */
	async recordQuotaUsage(request: RecordQuotaUsageRequest): Promise<void> {
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<void>("POST", `/tenant/v1/tenants/${request.tenantId}/quotas/usage`, {
			body: {
				quotaName: request.quotaName,
				usage: request.usage,
				...(request.timestamp !== undefined ? { timestamp: request.timestamp } : {}),
			},
			operation: "recordQuotaUsage",
		});
	}

	/**
	 * Get current quota usage for a tenant.
	 */
	async getCurrentQuotas(tenantId: string): Promise<CurrentQuotas> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<CurrentQuotas>("GET", `/tenant/v1/tenants/${tenantId}/quotas`, {
			operation: "getCurrentQuotas",
		});
	}

	/**
	 * Get quota forecast for a tenant.
	 */
	async getForecast(request: QuotaForecastRequest): Promise<QuotaForecast> {
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (request.quotaName !== undefined) params.set("quotaName", request.quotaName);
		if (request.horizonDays !== undefined) params.set("horizonDays", String(request.horizonDays));

		const queryString = params.toString();
		const path = queryString
			? `/tenant/v1/tenants/${request.tenantId}/quotas/forecast?${queryString}`
			: `/tenant/v1/tenants/${request.tenantId}/quotas/forecast`;

		return this.request<QuotaForecast>("GET", path, {
			operation: "getForecast",
		});
	}

	/**
	 * Get quota suggestions based on usage patterns.
	 */
	async getQuotaSuggestions(tenantId: string): Promise<QuotaSuggestionsResponse> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<QuotaSuggestionsResponse>(
			"GET",
			`/tenant/v1/tenants/${tenantId}/quotas/suggestions`,
			{
				operation: "getQuotaSuggestions",
			},
		);
	}

	/**
	 * Create an onboarding workflow template.
	 */
	async createWorkflowTemplate(request: CreateWorkflowTemplateRequest): Promise<WorkflowTemplate> {
		await this.ensureActivated();

		return this.request<WorkflowTemplate>("POST", "/tenant/v1/onboarding/templates", {
			body: request,
			operation: "createWorkflowTemplate",
		});
	}

	/**
	 * Trigger an onboarding workflow (provisions a new tenant). Maps to the real backend route
	 * POST /tenant/v1/onboarding/workflows; the calling tenant is resolved from the activated
	 * API key (sweep 2026-06-13 F1 - the prior `/tenants/:id/onboarding/start` path did not exist).
	 */
	async startOnboarding(request: StartOnboardingRequest): Promise<OnboardingInstance> {
		await this.ensureActivated();

		return this.request<OnboardingInstance>("POST", "/tenant/v1/onboarding/workflows", {
			body: {
				tenantName: request.tenantName,
				tenantSlug: request.tenantSlug,
				ownerEmail: request.ownerEmail,
				...(request.plan !== undefined ? { plan: request.plan } : {}),
				...(request.region !== undefined ? { region: request.region } : {}),
				...(request.ownerName !== undefined ? { ownerName: request.ownerName } : {}),
				...(request.templateId !== undefined ? { templateId: request.templateId } : {}),
				...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
				...(request.priority !== undefined ? { priority: request.priority } : {}),
			},
			operation: "startOnboarding",
		});
	}

	/**
	 * Get an onboarding workflow's status by its workflow id. Maps to the real backend route
	 * GET /tenant/v1/onboarding/workflows/:workflowId (sweep 2026-06-13 F2 - the prior
	 * `/tenants/:id/onboarding/status` path did not exist; the backend is workflow-keyed).
	 */
	async getOnboardingStatus(workflowId: string): Promise<OnboardingInstance> {
		validateUUID(workflowId, "workflowId");
		await this.ensureActivated();

		return this.request<OnboardingInstance>(
			"GET",
			`/tenant/v1/onboarding/workflows/${encodeURIComponent(workflowId)}`,
			{
				operation: "getOnboardingStatus",
			},
		);
	}

	/**
	 * Get onboarding statistics.
	 */
	async getOnboardingStats(options?: {
		readonly since?: string;
		readonly until?: string;
	}): Promise<OnboardingStats> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.since !== undefined) params.set("since", options.since);
		if (options?.until !== undefined) params.set("until", options.until);

		const queryString = params.toString();
		const path = queryString
			? `/tenant/v1/onboarding/stats?${queryString}`
			: "/tenant/v1/onboarding/stats";

		return this.request<OnboardingStats>("GET", path, {
			operation: "getOnboardingStats",
		});
	}

	/**
	 * Create an isolation policy for a tenant.
	 */
	async createIsolationPolicy(
		request: CreateIsolationPolicyRequest,
	): Promise<TenantIsolationPolicy> {
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<TenantIsolationPolicy>(
			"POST",
			`/tenant/v1/tenants/${request.tenantId}/isolation/policies`,
			{
				body: {
					name: request.name,
					...(request.description !== undefined ? { description: request.description } : {}),
					level: request.level,
					...(request.rules !== undefined ? { rules: request.rules } : {}),
					...(request.enforcementMode !== undefined
						? { enforcementMode: request.enforcementMode }
						: {}),
				},
				operation: "createIsolationPolicy",
			},
		);
	}

	/**
	 * Run an isolation audit for a tenant.
	 */
	async runIsolationAudit(request: RunIsolationAuditRequest): Promise<IsolationAuditResult> {
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<IsolationAuditResult>(
			"POST",
			`/tenant/v1/tenants/${request.tenantId}/isolation/audit`,
			{
				body: {
					...(request.policyIds !== undefined ? { policyIds: request.policyIds } : {}),
					...(request.categories !== undefined ? { categories: request.categories } : {}),
					...(request.depth !== undefined ? { depth: request.depth } : {}),
				},
				operation: "runIsolationAudit",
			},
		);
	}

	/**
	 * Get isolation findings for a tenant.
	 */
	async getIsolationFindings(
		request: GetIsolationFindingsRequest,
	): Promise<IsolationFindingsResponse> {
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (request.runId !== undefined) params.set("runId", request.runId);
		if (request.severity !== undefined) params.set("severity", request.severity);
		if (request.category !== undefined) params.set("category", request.category);
		if (request.limit !== undefined) params.set("limit", String(request.limit));
		if (request.cursor !== undefined) params.set("cursor", request.cursor);

		const queryString = params.toString();
		const path = queryString
			? `/tenant/v1/tenants/${request.tenantId}/isolation/findings?${queryString}`
			: `/tenant/v1/tenants/${request.tenantId}/isolation/findings`;

		return this.request<IsolationFindingsResponse>("GET", path, {
			operation: "getIsolationFindings",
		});
	}
}

export * from "./observability.js";
export * from "./validation.js";
