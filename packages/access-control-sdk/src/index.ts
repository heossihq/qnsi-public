import { performance } from "node:perf_hooks";

import { activateSdk, type SdkActivationConfig } from "@heossi/qnsi-sdk-activation";

import type {
	AccessControlClientTelemetry,
	AccessControlClientTelemetryConfig,
	AccessControlClientTelemetryEvent,
} from "./observability.js";
import {
	createAccessControlClientTelemetry,
	isAccessControlClientTelemetry,
} from "./observability.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";
import { validateUUID } from "./validation.js";

/**
 * @heossi/qnsi-access-control-sdk
 *
 * TypeScript SDK client for the QNSP access-control-service API.
 * Provides a high-level interface for policy management and capability token operations.
 * All capability tokens are signed with tenant-specific PQC algorithms based on crypto policy.
 */

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

/** Default QNSP cloud API base URL. Get a free API key at https://cloud.qnsi.heossi.com/signup */
export const DEFAULT_BASE_URL = "https://api.qnsi.heossi.com";

export interface AccessControlClientConfig {
	readonly baseUrl?: string;
	readonly apiKey: string;
	readonly timeoutMs?: number;
	readonly maxRetries?: number;
	readonly retryDelayMs?: number;
	readonly telemetry?: AccessControlClientTelemetry | AccessControlClientTelemetryConfig;
}

type InternalAccessControlClientConfig = {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly timeoutMs: number;
	readonly maxRetries: number;
	readonly retryDelayMs: number;
};

export interface PolicyStatement {
	readonly effect: "allow" | "deny";
	readonly actions: readonly string[];
	readonly resources: readonly string[];
	readonly conditions?: Record<string, unknown>;
}

export type PolicyCategory = "general" | "zero_trust";

export type PolicyEnforcementLevel = "enforced" | "template";

export interface CreatePolicyRequest {
	readonly tenantId: string;
	readonly name: string;
	readonly description?: string;
	readonly category?: PolicyCategory;
	readonly enforcementLevel?: PolicyEnforcementLevel;
	readonly version?: number;
	readonly statement: PolicyStatement;
}

export interface AccessPolicy {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly description?: string | null;
	readonly category: PolicyCategory;
	readonly enforcementLevel: PolicyEnforcementLevel;
	readonly version: number;
	readonly statement: PolicyStatement;
	readonly statementHash: string;
	readonly signature: {
		readonly algorithm: string;
		readonly provider: string;
		readonly value: string;
		readonly publicKey: string;
	};
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface ListPoliciesResult {
	readonly items: readonly AccessPolicy[];
	readonly nextCursor: string | null;
}

export interface IssueCapabilityRequest {
	readonly tenantId: string;
	readonly policyId: string;
	readonly subject: {
		readonly type: string;
		readonly id: string;
	};
	readonly issuedBy: string;
	readonly ttlSeconds?: number;
	readonly security?: {
		readonly controlPlaneTokenSha256?: string | null;
		readonly pqcSignatures?: readonly {
			readonly provider: string;
			readonly algorithm: string;
		}[];
		readonly hardwareProvider?: string | null;
		readonly attestationStatus?: string | null;
		readonly attestationProof?: string | null;
	};
}

export interface IssueCapabilityResponse {
	readonly token: string;
	readonly payload: {
		readonly tokenId: string;
		readonly tenantId: string;
		readonly policyId: string;
		readonly policyVersion: number;
		readonly subject: {
			readonly type: string;
			readonly id: string;
		};
		readonly issuedAt: string;
		readonly expiresAt: string;
		readonly statementHash: string;
		readonly security: {
			readonly controlPlaneTokenSha256: string | null;
			readonly pqcSignatures: readonly {
				readonly provider: string;
				readonly algorithm: string;
			}[];
			readonly hardwareProvider: string | null;
			readonly attestationStatus: string | null;
			readonly attestationProof: string | null;
		};
		readonly signature: {
			readonly algorithm: string;
			readonly provider: string;
			readonly value: string;
			readonly publicKey: string;
		};
	};
}

export interface IntrospectCapabilityRequest {
	readonly token: string;
}

export interface IntrospectCapabilityResponse {
	readonly active: boolean;
	readonly payload?: {
		readonly tokenId: string;
		readonly tenantId: string;
		readonly policyId: string;
		readonly policyVersion: number;
		readonly subject: {
			readonly type: string;
			readonly id: string;
		};
		readonly issuedAt: string;
		readonly expiresAt: string;
		readonly statementHash: string;
		readonly security: {
			readonly controlPlaneTokenSha256: string | null;
			readonly pqcSignatures: readonly {
				readonly provider: string;
				readonly algorithm: string;
			}[];
			readonly hardwareProvider: string | null;
			readonly attestationStatus: string | null;
			readonly attestationProof: string | null;
		};
		readonly signature: {
			readonly algorithm: string;
			readonly provider: string;
			readonly value: string;
			readonly publicKey: string;
		};
	};
	readonly reason?: string;
}

export interface RevokeCapabilityRequest {
	readonly tokenId: string;
	readonly revokedBy: string;
	readonly reason?: string;
}

export interface RevokeCapabilityResponse {
	readonly tokenId: string;
	readonly revoked: boolean;
	readonly revokedAt: string;
	readonly revokedBy: string;
	readonly reason?: string | null;
}

/**
 * Policy Simulation Types
 */

export interface SimulationSubject {
	readonly type: "user" | "service" | "group";
	readonly id: string;
	readonly attributes?: Record<string, unknown>;
}

export interface SimulationResource {
	readonly type: string;
	readonly id: string;
	readonly attributes?: Record<string, unknown>;
}

export interface SimulationContext {
	readonly ipAddress?: string;
	readonly timestamp?: string;
	readonly environment?: string;
	readonly customAttributes?: Record<string, unknown>;
}

export interface ProposedPolicy {
	readonly id?: string;
	readonly name: string;
	readonly effect: "allow" | "deny";
	readonly actions: readonly string[];
	readonly resources: readonly string[];
	readonly conditions?: Record<string, unknown>;
}

export interface SimulateAccessInput {
	readonly subject: SimulationSubject;
	readonly resource: SimulationResource;
	readonly action: string;
	readonly context?: SimulationContext;
	readonly proposedPolicies?: readonly ProposedPolicy[];
}

export interface MatchedPolicy {
	readonly policyId: string;
	readonly policyName: string;
	readonly effect: string;
	readonly matchReason: string;
	readonly isProposed: boolean;
}

export interface SimulateAccessResult {
	readonly decision: "allow" | "deny" | "no_match";
	readonly decisionReason: string;
	readonly matchedPolicies: readonly MatchedPolicy[];
	readonly totalPoliciesEvaluated: number;
	readonly proposedPoliciesIncluded: number;
}

export interface BatchSimulateRequest {
	readonly requests: readonly SimulateAccessInput[];
	readonly policySetId?: string;
}

export interface BatchSimulationResultItem {
	readonly request: SimulateAccessInput;
	readonly decision: "allow" | "deny" | "no_match";
	readonly matchedPoliciesCount: number;
}

export interface BatchSimulateResult {
	readonly results: readonly BatchSimulationResultItem[];
	readonly summary: {
		readonly totalRequests: number;
		readonly allowed: number;
		readonly denied: number;
		readonly noMatch: number;
	};
}

export interface PolicyChangeType {
	readonly type: "add" | "modify" | "remove";
	readonly policyId?: string;
	readonly policy?: {
		readonly name: string;
		readonly effect: "allow" | "deny";
		readonly actions: readonly string[];
		readonly resources: readonly string[];
		readonly conditions?: Record<string, unknown>;
	};
}

export interface ImpactAnalysisScope {
	readonly subjectTypes?: readonly string[];
	readonly resourceTypes?: readonly string[];
	readonly sampleSize?: number;
}

export interface AnalyzeImpactInput {
	readonly proposedChange: PolicyChangeType;
	readonly scope?: ImpactAnalysisScope;
}

export interface AffectedCapability {
	readonly capabilityId: string;
	readonly subjectType: string;
	readonly subjectId: string;
	readonly currentEffect: string;
	readonly proposedEffect: string | null;
	readonly impactType: "revoked" | "modified" | "unchanged" | "new_grant";
}

export interface ImpactAnalysisResult {
	readonly analysisId: string;
	readonly proposedChange: PolicyChangeType;
	readonly impact: {
		readonly totalAffected: number;
		readonly byType: {
			readonly revoked: number;
			readonly modified: number;
		};
		readonly affectedCapabilities: readonly AffectedCapability[];
	};
	readonly riskAssessment: {
		readonly level: "low" | "medium" | "high";
		readonly recommendation: string;
	};
}

export interface SimulationHistoryItem {
	readonly id: string;
	readonly subject: SimulationSubject;
	readonly resource: SimulationResource;
	readonly action: string;
	readonly decision: "allow" | "deny" | "no_match";
	readonly matchedPoliciesCount: number;
	readonly proposedCount: number;
	readonly createdAt: string;
}

export interface SimulationHistoryResult {
	readonly simulations: readonly SimulationHistoryItem[];
}

/**
 * Just-In-Time (JIT) Access Types
 */

export type JitUrgency = "low" | "medium" | "high" | "critical";

export type JitRequestStatus =
	| "pending_approval"
	| "approved"
	| "auto_approved"
	| "denied"
	| "expired"
	| "revoked";

export interface RequestJitAccessInput {
	readonly resourceType: string;
	readonly resourceId: string;
	readonly permissions: readonly string[];
	readonly justification: string;
	readonly durationMinutes?: number;
	readonly ticketId?: string;
	readonly urgency?: JitUrgency;
}

export interface JitAccessRequestResult {
	readonly id: string;
	readonly status: JitRequestStatus;
	readonly resourceType: string;
	readonly resourceId: string;
	readonly permissions: readonly string[];
	readonly durationMinutes: number;
	readonly approvedAt: string | null;
	readonly expiresAt: string | null;
	readonly policyApplied: string | null;
}

export interface JitRequest {
	readonly id: string;
	readonly requesterId: string;
	readonly resourceType: string;
	readonly resourceId: string;
	readonly permissions: readonly string[];
	readonly justification: string;
	readonly durationMinutes: number;
	readonly ticketId: string | null;
	readonly urgency: JitUrgency;
	readonly status: JitRequestStatus;
	readonly approvedAt: string | null;
	readonly expiresAt: string | null;
	readonly createdAt: string;
}

export interface ListJitRequestsResult {
	readonly requests: readonly JitRequest[];
}

export interface ProcessJitRequestInput {
	readonly decision: "approve" | "deny";
	readonly comment?: string;
	readonly modifiedDuration?: number;
	readonly modifiedPermissions?: readonly string[];
}

export interface ProcessJitRequestResult {
	readonly id: string;
	readonly status: "approved" | "denied";
	readonly processedBy: string;
	readonly processedAt: string;
	readonly expiresAt: string | null;
	readonly finalPermissions: readonly string[];
	readonly finalDurationMinutes: number;
}

export interface JitGrant {
	readonly id: string;
	readonly requestId: string;
	readonly resourceType: string;
	readonly resourceId: string;
	readonly permissions: readonly string[];
	readonly grantedAt: string;
	readonly expiresAt: string;
	readonly remainingMinutes: number;
}

export interface UserJitGrantsResult {
	readonly activeGrants: readonly JitGrant[];
}

export interface CheckJitAccessResult {
	readonly hasAccess: boolean;
	readonly grantId?: string;
	readonly expiresAt?: string;
	readonly remainingMinutes?: number;
}

export interface RevokeJitGrantResult {
	readonly id: string;
	readonly status: "revoked";
	readonly revokedAt: string;
	readonly revokedBy: string;
	readonly reason: string;
}

export interface JitAutoApproveConditions {
	readonly maxDurationMinutes?: number;
	readonly allowedPermissions?: readonly string[];
	readonly requiredTicketSystem?: boolean;
}

export interface CreateJitPolicyInput {
	readonly name: string;
	readonly resourcePattern: string;
	readonly maxDurationMinutes?: number;
	readonly requireApproval?: boolean;
	readonly approvers?: readonly string[];
	readonly autoApproveConditions?: JitAutoApproveConditions;
	readonly notifyOnGrant?: boolean;
	readonly notifyOnExpiry?: boolean;
}

export interface JitPolicy {
	readonly id: string;
	readonly name: string;
	readonly resourcePattern: string;
	readonly maxDurationMinutes: number;
	readonly requireApproval: boolean;
	readonly approvers: readonly string[];
	readonly autoApproveConditions: JitAutoApproveConditions;
	readonly enabled: boolean;
	readonly createdAt: string;
}

export interface ListJitPoliciesResult {
	readonly policies: readonly JitPolicy[];
}

export interface JitStats {
	readonly last30Days: {
		readonly requestsByStatus: Record<string, number>;
		readonly totalRequests: number;
		readonly approvalRate: number;
	};
	readonly activeGrants: number;
	readonly averageDurationMinutes: number;
}

/**
 * Cross-Tenant Analysis Types
 */

export interface CrossTenantTimeRange {
	readonly start?: string;
	readonly end?: string;
	readonly lastHours?: number;
}

export interface CrossTenantOverviewQuery {
	readonly tenantIds?: readonly string[];
	readonly timeRange?: CrossTenantTimeRange;
	readonly includeMetrics?: boolean;
}

export interface TenantMetrics {
	readonly policyCount: number;
	readonly categoryCount: number;
	readonly denyPolicies: number;
	readonly allowPolicies: number;
	readonly totalCapabilities: number;
	readonly activeCapabilities: number;
	readonly revokedCapabilities: number;
}

export interface CrossTenantOverviewResult {
	readonly tenantCount: number;
	readonly tenants: Record<string, TenantMetrics>;
	readonly aggregates: {
		readonly totalPolicies: number;
		readonly totalCapabilities: number;
		readonly totalActiveCapabilities: number;
	};
}

export type PolicyCompareBy = "effect" | "actions" | "resources" | "category";

export interface ComparePoliciesInput {
	readonly tenantIds: readonly string[];
	readonly compareBy?: PolicyCompareBy;
}

export interface PolicyComparisonItem {
	readonly policyName: string;
	readonly presentIn: readonly string[];
	readonly missingFrom: readonly string[];
	readonly differences: readonly {
		readonly tenantId: string;
		readonly value: unknown;
	}[];
}

export interface ComparePoliciesResult {
	readonly tenantIds: readonly string[];
	readonly compareBy: PolicyCompareBy;
	readonly totalUniquePolicies: number;
	readonly comparison: readonly PolicyComparisonItem[];
	readonly summary: {
		readonly fullyShared: number;
		readonly partiallyShared: number;
		readonly unique: number;
	};
}

export type AnomalyType =
	| "unusual_access_time"
	| "cross_tenant_violation"
	| "privilege_escalation"
	| "dormant_account_access"
	| "high_frequency_access";

export type AnomalySeverity = "low" | "medium" | "high" | "critical";

export interface QueryAnomaliesInput {
	readonly anomalyTypes?: readonly AnomalyType[];
	readonly minSeverity?: AnomalySeverity;
	readonly limit?: number;
}

export interface AccessAnomaly {
	readonly id: string;
	readonly tenantId: string;
	readonly anomalyType: AnomalyType;
	readonly severity: AnomalySeverity;
	readonly subjectType: string;
	readonly subjectId: string;
	readonly resourceType: string | null;
	readonly resourceId: string | null;
	readonly description: string;
	readonly context: Record<string, unknown>;
	readonly detectedAt: string;
	readonly acknowledged: boolean;
}

export interface QueryAnomaliesResult {
	readonly anomalies: readonly AccessAnomaly[];
	readonly statistics: {
		readonly total: number;
		readonly bySeverity: Record<string, number>;
		readonly byType: Record<string, number>;
		readonly byTenant: Record<string, number>;
		readonly unacknowledged: number;
	};
}

export interface CrossTenantGraphNode {
	readonly id: string;
	readonly type: string;
}

export interface CrossTenantGraphEdge {
	readonly source: string;
	readonly sourceType: string;
	readonly target: string;
	readonly targetType: string;
	readonly capabilityCount: number;
	readonly policyIds: readonly string[];
}

export interface CrossTenantGraphResult {
	readonly nodes: readonly CrossTenantGraphNode[];
	readonly edges: readonly CrossTenantGraphEdge[];
	readonly statistics: {
		readonly totalNodes: number;
		readonly totalEdges: number;
		readonly tenantCount: number;
		readonly subjectCount: number;
	};
}

export interface IsolationViolation {
	readonly capabilityTenant: string;
	readonly policyTenant: string;
	readonly subjectType: string;
	readonly subjectId: string;
	readonly count: number;
	readonly severity: string;
	readonly recommendation: string;
}

export interface SharedPolicyInfo {
	readonly policyName: string;
	readonly tenants: readonly string[];
	readonly note: string;
}

export interface IsolationAuditResult {
	readonly isolationStatus: "healthy" | "violations_found";
	readonly crossTenantViolations: readonly IsolationViolation[];
	readonly sharedPolicyNames: readonly SharedPolicyInfo[];
	readonly recommendations: readonly string[];
	readonly auditedAt: string;
}

interface RequestOptions {
	readonly body?: unknown;
	readonly headers?: Record<string, string>;
	readonly signal?: AbortSignal;
	readonly operation?: string;
	readonly telemetryRoute?: string;
	readonly telemetryTarget?: string;
}

export class AccessControlClient {
	private readonly config: InternalAccessControlClientConfig;
	private readonly telemetry: AccessControlClientTelemetry | null;
	private readonly targetService: string;
	private activationPromise: Promise<void> | null = null;
	private readonly activationConfig: SdkActivationConfig | null;
	private resolvedTenantId: string | null = null;

	private async ensureActivated(): Promise<void> {
		if (!this.activationConfig) return;
		if (!this.activationPromise) {
			this.activationPromise = activateSdk(this.activationConfig).then((response) => {
				this.resolvedTenantId = response.tenantId;
			});
		}
		return this.activationPromise;
	}

	private static isPrivateIpv4(hostname: string): boolean {
		const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
		if (!m) return false;
		const parts = m.slice(1).map((x) => Number(x));
		if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
		const [a, b] = parts;
		if (a == null || b == null) return false;
		// RFC1918 ranges
		if (a === 10) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		return false;
	}

	private static isInternalServiceHostname(hostname: string): boolean {
		const normalized = hostname.toLowerCase();
		if (normalized === "localhost" || normalized === "127.0.0.1") return true;
		if (normalized.endsWith(".internal")) return true;
		if (AccessControlClient.isPrivateIpv4(normalized)) return true;
		return false;
	}

	constructor(config: AccessControlClientConfig) {
		if (!config.apiKey || config.apiKey.trim().length === 0) {
			throw new Error(
				"QNSP Access Control SDK: apiKey is required. " +
					"Get your free API key at https://cloud.qnsi.heossi.com/signup — " +
					"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
					"Docs: https://docs.qnsi.heossi.com/sdk/access-control-sdk",
			);
		}

		const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");

		// Enforce HTTPS in production (allow HTTP only for localhost in development)
		if (!baseUrl.startsWith("https://")) {
			const isLocalhost =
				baseUrl.startsWith("http://localhost") || baseUrl.startsWith("http://127.0.0.1");
			let isInternalService = false;
			try {
				const parsed = new URL(baseUrl);
				isInternalService =
					parsed.protocol === "http:" &&
					AccessControlClient.isInternalServiceHostname(parsed.hostname);
			} catch {
				// ignore; invalid URL will be handled later by fetch/URL parsing.
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
			? isAccessControlClientTelemetry(config.telemetry)
				? config.telemetry
				: createAccessControlClientTelemetry(config.telemetry)
			: null;

		try {
			this.targetService = new URL(this.config.baseUrl).host;
		} catch {
			this.targetService = "access-control-service";
		}

		// Skip activation for internal service-to-service calls
		let isInternal = false;
		try {
			const parsed = new URL(this.config.baseUrl);
			isInternal = AccessControlClient.isInternalServiceHostname(parsed.hostname);
		} catch {
			// ignore
		}
		this.activationConfig = isInternal
			? null
			: {
					apiKey: config.apiKey,
					sdkId: "access-control-sdk",
					sdkVersion: SDK_PACKAGE_VERSION,
					platformUrl: this.config.baseUrl,
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

			if (!response.ok) {
				status = "error";

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

					httpStatus = response.status;
					errorMessage = `HTTP ${response.status}`;
					throw new Error(
						`Access Control API error: Rate limit exceeded after ${this.config.maxRetries} retries`,
					);
				}

				const errorText = await response.text().catch(() => "Unknown error");
				errorMessage = errorText;
				throw new Error(`Access Control API error: ${response.status} ${response.statusText}`);
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
			const event: AccessControlClientTelemetryEvent = {
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

	private recordTelemetryEvent(event: AccessControlClientTelemetryEvent): void {
		if (!this.telemetry) {
			return;
		}
		this.telemetry.record(event);
	}

	/**
	 * Create a new access policy.
	 */
	async createPolicy(request: CreatePolicyRequest): Promise<AccessPolicy> {
		await this.ensureActivated();
		validateUUID(request.tenantId, "tenantId");

		return this.request<AccessPolicy>("POST", "/access/v1/policies", {
			body: {
				tenantId: request.tenantId,
				name: request.name,
				...(request.description !== undefined ? { description: request.description } : {}),
				...(request.category !== undefined ? { category: request.category } : {}),
				...(request.enforcementLevel !== undefined
					? { enforcementLevel: request.enforcementLevel }
					: {}),
				...(request.version !== undefined ? { version: request.version } : {}),
				statement: request.statement,
			},
			operation: "createPolicy",
		});
	}

	/**
	 * Get a policy by ID.
	 */
	async getPolicy(policyId: string): Promise<AccessPolicy> {
		await this.ensureActivated();
		validateUUID(policyId, "policyId");

		return this.request<AccessPolicy>("GET", `/access/v1/policies/${policyId}`, {
			operation: "getPolicy",
			telemetryRoute: "/access/v1/policies/:policyId",
		});
	}

	/**
	 * List policies for a tenant.
	 */
	async listPolicies(
		tenantId: string,
		options?: {
			readonly limit?: number;
			readonly cursor?: string;
		},
	): Promise<ListPoliciesResult> {
		await this.ensureActivated();
		validateUUID(tenantId, "tenantId");

		const params = new URLSearchParams();
		if (options?.limit !== undefined) {
			params.set("limit", String(options.limit));
		}
		if (options?.cursor !== undefined) {
			params.set("cursor", options.cursor);
		}

		return this.request<ListPoliciesResult>(
			"GET",
			`/access/v1/tenants/${tenantId}/policies?${params}`,
			{
				operation: "listPolicies",
				telemetryRoute: "/access/v1/tenants/:tenantId/policies",
			},
		);
	}

	/**
	 * Issue a capability token based on a policy.
	 */
	async issueCapability(request: IssueCapabilityRequest): Promise<IssueCapabilityResponse> {
		await this.ensureActivated();
		validateUUID(request.tenantId, "tenantId");
		validateUUID(request.policyId, "policyId");

		return this.request<IssueCapabilityResponse>("POST", "/access/v1/capabilities", {
			body: {
				tenantId: request.tenantId,
				policyId: request.policyId,
				subject: request.subject,
				issuedBy: request.issuedBy,
				...(request.ttlSeconds !== undefined ? { ttlSeconds: request.ttlSeconds } : {}),
				...(request.security !== undefined ? { security: request.security } : {}),
			},
			operation: "issueCapability",
		});
	}

	/**
	 * Introspect a capability token to check if it's active and get its payload.
	 */
	async introspectCapability(
		request: IntrospectCapabilityRequest,
	): Promise<IntrospectCapabilityResponse> {
		await this.ensureActivated();
		return this.request<IntrospectCapabilityResponse>(
			"POST",
			"/access/v1/capabilities/introspect",
			{
				body: {
					token: request.token,
				},
				operation: "introspectCapability",
			},
		);
	}

	/**
	 * Revoke a capability token.
	 */
	async revokeCapability(request: RevokeCapabilityRequest): Promise<RevokeCapabilityResponse> {
		await this.ensureActivated();
		validateUUID(request.tokenId, "tokenId");

		return this.request<RevokeCapabilityResponse>(
			"POST",
			`/access/v1/capabilities/${request.tokenId}/revoke`,
			{
				body: {
					revokedBy: request.revokedBy,
					...(request.reason !== undefined ? { reason: request.reason } : {}),
				},
				operation: "revokeCapability",
				telemetryRoute: "/access/v1/capabilities/:tokenId/revoke",
			},
		);
	}

	/**
	 * Simulate an access request against current and/or proposed policies.
	 * Returns the decision, matched policies, and reasoning.
	 */
	async simulateAccess(
		input: SimulateAccessInput,
		options?: { readonly tenantId?: string },
	): Promise<SimulateAccessResult> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}

		const queryString = params.toString();
		const path = `/access/v1/simulate${queryString ? `?${queryString}` : ""}`;

		return this.request<SimulateAccessResult>("POST", path, {
			body: {
				subject: input.subject,
				resource: input.resource,
				action: input.action,
				...(input.context !== undefined ? { context: input.context } : {}),
				...(input.proposedPolicies !== undefined
					? { proposedPolicies: input.proposedPolicies }
					: {}),
			},
			operation: "simulateAccess",
			telemetryRoute: "/access/v1/simulate",
		});
	}

	/**
	 * Batch simulate multiple access requests for efficiency.
	 * Evaluates up to 100 requests in a single call.
	 */
	async batchSimulate(
		requests: readonly SimulateAccessInput[],
		options?: { readonly tenantId?: string; readonly policySetId?: string },
	): Promise<BatchSimulateResult> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}

		const queryString = params.toString();
		const path = `/access/v1/simulate/batch${queryString ? `?${queryString}` : ""}`;

		return this.request<BatchSimulateResult>("POST", path, {
			body: {
				requests,
				...(options?.policySetId !== undefined ? { policySetId: options.policySetId } : {}),
			},
			operation: "batchSimulate",
			telemetryRoute: "/access/v1/simulate/batch",
		});
	}

	/**
	 * Analyze the impact of a proposed policy change.
	 * Returns affected capabilities and risk assessment.
	 */
	async analyzeImpact(
		input: AnalyzeImpactInput,
		options?: { readonly tenantId?: string },
	): Promise<ImpactAnalysisResult> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}

		const queryString = params.toString();
		const path = `/access/v1/simulate/impact${queryString ? `?${queryString}` : ""}`;

		return this.request<ImpactAnalysisResult>("POST", path, {
			body: {
				proposedChange: input.proposedChange,
				...(input.scope !== undefined ? { scope: input.scope } : {}),
			},
			operation: "analyzeImpact",
			telemetryRoute: "/access/v1/simulate/impact",
		});
	}

	/**
	 * Get the history of policy simulations for audit and review.
	 */
	async getSimulationHistory(options?: {
		readonly tenantId?: string;
		readonly limit?: number;
	}): Promise<SimulationHistoryResult> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		if (options?.limit !== undefined) {
			params.set("limit", String(options.limit));
		}

		const queryString = params.toString();
		const path = `/access/v1/simulate/history${queryString ? `?${queryString}` : ""}`;

		return this.request<SimulationHistoryResult>("GET", path, {
			operation: "getSimulationHistory",
			telemetryRoute: "/access/v1/simulate/history",
		});
	}

	/**
	 * Request Just-In-Time elevated access to a resource.
	 */
	async requestJitAccess(
		input: RequestJitAccessInput,
		options?: { readonly tenantId?: string },
	): Promise<JitAccessRequestResult> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}

		const queryString = params.toString();
		const path = `/access/v1/jit/requests${queryString ? `?${queryString}` : ""}`;

		return this.request<JitAccessRequestResult>("POST", path, {
			body: {
				resourceType: input.resourceType,
				resourceId: input.resourceId,
				permissions: input.permissions,
				justification: input.justification,
				...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
				...(input.ticketId !== undefined ? { ticketId: input.ticketId } : {}),
				...(input.urgency !== undefined ? { urgency: input.urgency } : {}),
			},
			operation: "requestJitAccess",
			telemetryRoute: "/access/v1/jit/requests",
		});
	}

	/**
	 * List JIT access requests, optionally filtered by status.
	 */
	async listJitRequests(options?: {
		readonly tenantId?: string;
		readonly status?: JitRequestStatus;
		readonly limit?: number;
	}): Promise<ListJitRequestsResult> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		if (options?.status) {
			params.set("status", options.status);
		}
		if (options?.limit !== undefined) {
			params.set("limit", String(options.limit));
		}

		const queryString = params.toString();
		const path = `/access/v1/jit/requests${queryString ? `?${queryString}` : ""}`;

		return this.request<ListJitRequestsResult>("GET", path, {
			operation: "listJitRequests",
			telemetryRoute: "/access/v1/jit/requests",
		});
	}

	/**
	 * Process a JIT access request (approve or deny).
	 */
	async processJitRequest(
		requestId: string,
		input: ProcessJitRequestInput,
		options?: { readonly tenantId?: string },
	): Promise<ProcessJitRequestResult> {
		await this.ensureActivated();
		validateUUID(requestId, "requestId");

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}

		const queryString = params.toString();
		const path = `/access/v1/jit/requests/${requestId}/process${queryString ? `?${queryString}` : ""}`;

		return this.request<ProcessJitRequestResult>("POST", path, {
			body: {
				decision: input.decision,
				...(input.comment !== undefined ? { comment: input.comment } : {}),
				...(input.modifiedDuration !== undefined
					? { modifiedDuration: input.modifiedDuration }
					: {}),
				...(input.modifiedPermissions !== undefined
					? { modifiedPermissions: input.modifiedPermissions }
					: {}),
			},
			operation: "processJitRequest",
			telemetryRoute: "/access/v1/jit/requests/:requestId/process",
		});
	}

	/**
	 * Get active JIT grants for a specific user.
	 */
	async getUserJitGrants(
		userId: string,
		options?: { readonly tenantId?: string },
	): Promise<UserJitGrantsResult> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}

		const queryString = params.toString();
		const path = `/access/v1/jit/grants/user/${encodeURIComponent(userId)}${queryString ? `?${queryString}` : ""}`;

		return this.request<UserJitGrantsResult>("GET", path, {
			operation: "getUserJitGrants",
			telemetryRoute: "/access/v1/jit/grants/user/:userId",
		});
	}

	/**
	 * Check if a user has JIT access to a specific resource and permission.
	 */
	async checkJitAccess(
		userId: string,
		resourceType: string,
		resourceId: string,
		permission: string,
		options?: { readonly tenantId?: string },
	): Promise<CheckJitAccessResult> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}

		const queryString = params.toString();
		const path = `/access/v1/jit/check${queryString ? `?${queryString}` : ""}`;

		return this.request<CheckJitAccessResult>("POST", path, {
			body: {
				userId,
				resourceType,
				resourceId,
				permission,
			},
			operation: "checkJitAccess",
			telemetryRoute: "/access/v1/jit/check",
		});
	}

	/**
	 * Revoke an active JIT grant.
	 */
	async revokeJitGrant(
		grantId: string,
		reason: string,
		options?: { readonly tenantId?: string },
	): Promise<RevokeJitGrantResult> {
		await this.ensureActivated();
		validateUUID(grantId, "grantId");

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}

		const queryString = params.toString();
		const path = `/access/v1/jit/grants/${grantId}/revoke${queryString ? `?${queryString}` : ""}`;

		return this.request<RevokeJitGrantResult>("POST", path, {
			body: { reason },
			operation: "revokeJitGrant",
			telemetryRoute: "/access/v1/jit/grants/:grantId/revoke",
		});
	}

	/**
	 * Create a JIT access policy.
	 */
	async createJitPolicy(
		input: CreateJitPolicyInput,
		options?: { readonly tenantId?: string },
	): Promise<{ readonly id: string; readonly name: string }> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}

		const queryString = params.toString();
		const path = `/access/v1/jit/policies${queryString ? `?${queryString}` : ""}`;

		return this.request<{ readonly id: string; readonly name: string }>("POST", path, {
			body: {
				name: input.name,
				resourcePattern: input.resourcePattern,
				...(input.maxDurationMinutes !== undefined
					? { maxDurationMinutes: input.maxDurationMinutes }
					: {}),
				...(input.requireApproval !== undefined ? { requireApproval: input.requireApproval } : {}),
				...(input.approvers !== undefined ? { approvers: input.approvers } : {}),
				...(input.autoApproveConditions !== undefined
					? { autoApproveConditions: input.autoApproveConditions }
					: {}),
				...(input.notifyOnGrant !== undefined ? { notifyOnGrant: input.notifyOnGrant } : {}),
				...(input.notifyOnExpiry !== undefined ? { notifyOnExpiry: input.notifyOnExpiry } : {}),
			},
			operation: "createJitPolicy",
			telemetryRoute: "/access/v1/jit/policies",
		});
	}

	/**
	 * List JIT access policies.
	 */
	async listJitPolicies(options?: { readonly tenantId?: string }): Promise<ListJitPoliciesResult> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}

		const queryString = params.toString();
		const path = `/access/v1/jit/policies${queryString ? `?${queryString}` : ""}`;

		return this.request<ListJitPoliciesResult>("GET", path, {
			operation: "listJitPolicies",
			telemetryRoute: "/access/v1/jit/policies",
		});
	}

	/**
	 * Get JIT access statistics for the last 30 days.
	 */
	async getJitStats(options?: { readonly tenantId?: string }): Promise<JitStats> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}

		const queryString = params.toString();
		const path = `/access/v1/jit/stats${queryString ? `?${queryString}` : ""}`;

		return this.request<JitStats>("GET", path, {
			operation: "getJitStats",
			telemetryRoute: "/access/v1/jit/stats",
		});
	}

	/**
	 * Get cross-tenant access overview (platform admin).
	 */
	async getCrossTenantOverview(
		query?: CrossTenantOverviewQuery,
	): Promise<CrossTenantOverviewResult> {
		await this.ensureActivated();

		return this.request<CrossTenantOverviewResult>("POST", "/access/v1/cross-tenant/overview", {
			body: {
				...(query?.tenantIds !== undefined ? { tenantIds: query.tenantIds } : {}),
				...(query?.timeRange !== undefined ? { timeRange: query.timeRange } : {}),
				...(query?.includeMetrics !== undefined ? { includeMetrics: query.includeMetrics } : {}),
			},
			operation: "getCrossTenantOverview",
			telemetryRoute: "/access/v1/cross-tenant/overview",
		});
	}

	/**
	 * Compare policies across multiple tenants.
	 */
	async comparePolicies(
		tenantIds: readonly string[],
		compareBy?: PolicyCompareBy,
	): Promise<ComparePoliciesResult> {
		await this.ensureActivated();

		if (tenantIds.length < 2 || tenantIds.length > 10) {
			throw new Error("comparePolicies requires 2-10 tenant IDs");
		}

		return this.request<ComparePoliciesResult>("POST", "/access/v1/cross-tenant/compare", {
			body: {
				tenantIds,
				...(compareBy !== undefined ? { compareBy } : {}),
			},
			operation: "comparePolicies",
			telemetryRoute: "/access/v1/cross-tenant/compare",
		});
	}

	/**
	 * Query access anomalies across tenants.
	 */
	async queryAnomalies(query?: QueryAnomaliesInput): Promise<QueryAnomaliesResult> {
		await this.ensureActivated();

		return this.request<QueryAnomaliesResult>("POST", "/access/v1/cross-tenant/anomalies", {
			body: {
				...(query?.anomalyTypes !== undefined ? { anomalyTypes: query.anomalyTypes } : {}),
				...(query?.minSeverity !== undefined ? { minSeverity: query.minSeverity } : {}),
				...(query?.limit !== undefined ? { limit: query.limit } : {}),
			},
			operation: "queryAnomalies",
			telemetryRoute: "/access/v1/cross-tenant/anomalies",
		});
	}

	/**
	 * Get the cross-tenant access graph showing relationships between subjects and tenants.
	 */
	async getCrossTenantGraph(options?: {
		readonly depth?: number;
		readonly includeExpired?: boolean;
	}): Promise<CrossTenantGraphResult> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.depth !== undefined) {
			params.set("depth", String(options.depth));
		}
		if (options?.includeExpired !== undefined) {
			params.set("includeExpired", String(options.includeExpired));
		}

		const queryString = params.toString();
		const path = `/access/v1/cross-tenant/graph${queryString ? `?${queryString}` : ""}`;

		return this.request<CrossTenantGraphResult>("GET", path, {
			operation: "getCrossTenantGraph",
			telemetryRoute: "/access/v1/cross-tenant/graph",
		});
	}

	/**
	 * Run a tenant isolation audit to detect cross-tenant access violations.
	 */
	async runIsolationAudit(tenantId?: string): Promise<IsolationAuditResult> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (tenantId) {
			params.set("tenantId", tenantId);
		}

		const queryString = params.toString();
		const path = `/access/v1/cross-tenant/isolation-audit${queryString ? `?${queryString}` : ""}`;

		return this.request<IsolationAuditResult>("GET", path, {
			operation: "runIsolationAudit",
			telemetryRoute: "/access/v1/cross-tenant/isolation-audit",
		});
	}
}

export * from "./observability.js";
export * from "./validation.js";
