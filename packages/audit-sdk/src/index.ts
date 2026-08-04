import { performance } from "node:perf_hooks";

import { activateSdk, type SdkActivationConfig } from "@heossihq/qnsi-sdk-activation";

import type {
	AuditClientTelemetry,
	AuditClientTelemetryConfig,
	AuditClientTelemetryEvent,
} from "./observability.js";
import { createAuditClientTelemetry, isAuditClientTelemetry } from "./observability.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";
import { validateUUID } from "./validation.js";

/**
 * @heossihq/qnsi-audit-sdk
 *
 * TypeScript SDK client for the QNSP audit-service API.
 * Provides a high-level interface for querying audit logs and compliance reporting.
 * All audit events are signed with tenant-specific PQC algorithms based on crypto policy.
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

export interface AuditClientConfig {
	readonly baseUrl?: string;
	readonly apiKey: string;
	readonly timeoutMs?: number;
	readonly maxRetries?: number;
	readonly retryDelayMs?: number;
	readonly telemetry?: AuditClientTelemetry | AuditClientTelemetryConfig;
}

type InternalAuditClientConfig = {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly timeoutMs: number;
	readonly maxRetries: number;
	readonly retryDelayMs: number;
};

export interface AuditEvent {
	readonly id: string;
	readonly tenantId?: string | null;
	readonly sourceService: string;
	readonly topic: string;
	readonly version: string;
	readonly payload: Record<string, unknown>;
	readonly metadata?: Record<string, unknown>;
	readonly security?: {
		readonly controlPlaneTokenSha256?: string;
		readonly pqcSignatures?: readonly {
			readonly provider: string;
			readonly algorithm: string;
			readonly value: string;
			readonly publicKey: string;
		}[];
		readonly hardwareProvider?: string | null;
		readonly attestationStatus?: string | null;
		readonly attestationProof?: string | null;
	};
	readonly signature: {
		readonly algorithm: string;
		readonly provider: string;
		readonly value: string;
		readonly publicKey: string;
	};
	readonly eventHash: string;
	readonly chainHash: string;
	readonly previousChainHash?: string | null;
	readonly commitmentSignature: {
		readonly algorithm: string;
		readonly provider: string;
		readonly value: string;
		readonly publicKey: string;
	};
	readonly receivedAt: string;
}

export interface IngestEventsRequest {
	readonly events: readonly AuditEvent[];
}

export interface IngestEventsResponse {
	readonly accepted: number;
	readonly received: number;
}

export interface ListEventsRequest {
	readonly tenantId?: string;
	readonly sourceService?: string;
	readonly topic?: string;
	readonly since?: string;
	readonly limit?: number;
	readonly cursor?: string;
}

export interface ListEventsResult {
	readonly items: readonly AuditEvent[];
	readonly nextCursor: string | null;
}

/**
 * Real-Time Streaming Types
 */

export type StreamingSubscriptionStatus = "active" | "paused" | "error" | "disconnected";

export interface StreamingSubscriptionFilter {
	readonly tenantIds?: readonly string[];
	readonly sourceServices?: readonly string[];
	readonly topics?: readonly string[];
	readonly severities?: readonly string[];
}

export interface StreamingSubscription {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly filters: StreamingSubscriptionFilter;
	readonly webhookUrl?: string;
	readonly websocketEnabled: boolean;
	readonly status: StreamingSubscriptionStatus;
	readonly batchSize: number;
	readonly batchIntervalMs: number;
	readonly retryPolicy: {
		readonly maxRetries: number;
		readonly backoffMs: number;
		readonly maxBackoffMs: number;
	};
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly lastDeliveredAt?: string;
	readonly deliveredCount: number;
	readonly errorCount: number;
}

export interface CreateSubscriptionRequest {
	readonly name: string;
	readonly description?: string;
	readonly filters: StreamingSubscriptionFilter;
	readonly webhookUrl?: string;
	readonly websocketEnabled?: boolean;
	readonly batchSize?: number;
	readonly batchIntervalMs?: number;
	readonly retryPolicy?: {
		readonly maxRetries?: number;
		readonly backoffMs?: number;
		readonly maxBackoffMs?: number;
	};
}

export interface UpdateSubscriptionRequest {
	readonly name?: string;
	readonly description?: string;
	readonly filters?: StreamingSubscriptionFilter;
	readonly webhookUrl?: string;
	readonly websocketEnabled?: boolean;
	readonly status?: StreamingSubscriptionStatus;
	readonly batchSize?: number;
	readonly batchIntervalMs?: number;
	readonly retryPolicy?: {
		readonly maxRetries?: number;
		readonly backoffMs?: number;
		readonly maxBackoffMs?: number;
	};
}

export interface ListSubscriptionsRequest {
	readonly status?: StreamingSubscriptionStatus;
	readonly limit?: number;
	readonly cursor?: string;
}

export interface ListSubscriptionsResult {
	readonly items: readonly StreamingSubscription[];
	readonly nextCursor: string | null;
}

export interface StreamingMetrics {
	readonly subscriptionId: string;
	readonly period: {
		readonly start: string;
		readonly end: string;
	};
	readonly eventsDelivered: number;
	readonly eventsDropped: number;
	readonly deliveryLatencyP50Ms: number;
	readonly deliveryLatencyP95Ms: number;
	readonly deliveryLatencyP99Ms: number;
	readonly webhookSuccessRate: number;
	readonly websocketConnectionsActive: number;
	readonly bytesTransferred: number;
	readonly errorsByType: Record<string, number>;
}

export interface GetStreamingMetricsRequest {
	readonly subscriptionId?: string;
	readonly since?: string;
	readonly until?: string;
}

/**
 * Retention Types
 */

export type RetentionPolicyStatus = "active" | "paused" | "disabled";
export type RetentionAction = "archive" | "delete" | "compress";

export interface RetentionPolicyRule {
	readonly name: string;
	readonly description?: string;
	readonly filters: {
		readonly tenantIds?: readonly string[];
		readonly sourceServices?: readonly string[];
		readonly topics?: readonly string[];
		readonly olderThanDays: number;
	};
	readonly action: RetentionAction;
	readonly archiveDestination?: string;
}

export interface RetentionPolicy {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly status: RetentionPolicyStatus;
	readonly rules: readonly RetentionPolicyRule[];
	readonly schedule: {
		readonly cronExpression: string;
		readonly timezone: string;
	};
	readonly lastExecutedAt?: string;
	readonly nextExecutionAt?: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface CreateRetentionPolicyRequest {
	readonly name: string;
	readonly description?: string;
	readonly rules: readonly RetentionPolicyRule[];
	readonly schedule: {
		readonly cronExpression: string;
		readonly timezone?: string;
	};
}

export interface UpdateRetentionPolicyRequest {
	readonly name?: string;
	readonly description?: string;
	readonly status?: RetentionPolicyStatus;
	readonly rules?: readonly RetentionPolicyRule[];
	readonly schedule?: {
		readonly cronExpression?: string;
		readonly timezone?: string;
	};
}

export interface ListRetentionPoliciesRequest {
	readonly status?: RetentionPolicyStatus;
	readonly limit?: number;
	readonly cursor?: string;
}

export interface ListRetentionPoliciesResult {
	readonly items: readonly RetentionPolicy[];
	readonly nextCursor: string | null;
}

export interface RetentionCleanupPreview {
	readonly policyId: string;
	readonly estimatedEventsAffected: number;
	readonly estimatedBytesAffected: number;
	readonly ruleBreakdown: readonly {
		readonly ruleName: string;
		readonly eventsAffected: number;
		readonly bytesAffected: number;
	}[];
	readonly dryRun: true;
}

export interface RetentionCleanupResult {
	readonly executionId: string;
	readonly policyId: string;
	readonly status: "running" | "completed" | "failed";
	readonly eventsProcessed: number;
	readonly eventsArchived: number;
	readonly eventsDeleted: number;
	readonly eventsCompressed: number;
	readonly bytesReclaimed: number;
	readonly startedAt: string;
	readonly completedAt?: string;
	readonly errors: readonly string[];
}

export interface ExecuteCleanupRequest {
	readonly policyId: string;
	readonly dryRun?: boolean;
}

export interface PreviewCleanupRequest {
	readonly policyId: string;
}

export interface RetentionMetrics {
	readonly period: {
		readonly start: string;
		readonly end: string;
	};
	readonly totalEventsArchived: number;
	readonly totalEventsDeleted: number;
	readonly totalEventsCompressed: number;
	readonly totalBytesReclaimed: number;
	readonly executionCount: number;
	readonly successRate: number;
	readonly avgExecutionTimeMs: number;
	readonly policyMetrics: readonly {
		readonly policyId: string;
		readonly policyName: string;
		readonly eventsProcessed: number;
		readonly bytesReclaimed: number;
	}[];
}

export interface GetRetentionMetricsRequest {
	readonly since?: string;
	readonly until?: string;
}

interface RequestOptions {
	readonly body?: unknown;
	readonly headers?: Record<string, string>;
	readonly signal?: AbortSignal;
	readonly operation?: string;
	readonly telemetryRoute?: string;
	readonly telemetryTarget?: string;
}

export class AuditClient {
	private readonly config: InternalAuditClientConfig;
	private readonly telemetry: AuditClientTelemetry | null;
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
		if (a === 10) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		return false;
	}

	private static isInternalServiceHostname(hostname: string): boolean {
		const normalized = hostname.toLowerCase();
		if (normalized === "localhost" || normalized === "127.0.0.1") return true;
		if (normalized.endsWith(".internal")) return true;
		if (AuditClient.isPrivateIpv4(normalized)) return true;
		return false;
	}

	constructor(config: AuditClientConfig) {
		if (!config.apiKey || config.apiKey.trim().length === 0) {
			throw new Error(
				"QNSP Audit SDK: apiKey is required. " +
					"Get your free API key at https://cloud.qnsi.heossi.com/signup - " +
					"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
					"Docs: https://docs.qnsi.heossi.com/sdk/audit-sdk",
			);
		}

		const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).trim().replace(/\/$/, "");

		// Enforce HTTPS in production (allow HTTP only for localhost in development)
		if (!baseUrl.startsWith("https://")) {
			const isLocalhost =
				baseUrl.startsWith("http://localhost") || baseUrl.startsWith("http://127.0.0.1");
			let isInternalService = false;
			try {
				const parsed = new URL(baseUrl);
				isInternalService =
					parsed.protocol === "http:" && AuditClient.isInternalServiceHostname(parsed.hostname);
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
			? isAuditClientTelemetry(config.telemetry)
				? config.telemetry
				: createAuditClientTelemetry(config.telemetry)
			: null;

		try {
			this.targetService = new URL(this.config.baseUrl).host;
		} catch {
			this.targetService = "audit-service";
		}

		// Skip activation for internal service-to-service calls
		let isInternal = false;
		try {
			const parsed = new URL(this.config.baseUrl);
			isInternal = AuditClient.isInternalServiceHostname(parsed.hostname);
		} catch {
			// ignore
		}
		this.activationConfig = isInternal
			? null
			: {
					apiKey: config.apiKey,
					sdkId: "audit-sdk",
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
					`Audit API error: Rate limit exceeded after ${this.config.maxRetries} retries`,
				);
			}

			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Audit API error: ${response.status} ${response.statusText}`);
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
			const event: AuditClientTelemetryEvent = {
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

	private recordTelemetryEvent(event: AuditClientTelemetryEvent): void {
		if (!this.telemetry) {
			return;
		}
		this.telemetry.record(event);
	}

	/**
	 * Ingest audit events (1-100 events per batch).
	 */
	async ingestEvents(request: IngestEventsRequest): Promise<IngestEventsResponse> {
		await this.ensureActivated();
		if (request.events.length === 0 || request.events.length > 100) {
			throw new Error("Events batch must contain between 1 and 100 events");
		}

		return this.request<IngestEventsResponse>("POST", "/audit/v1/events", {
			body: request.events,
			operation: "ingestEvents",
		});
	}

	/**
	 * List audit events with filtering and pagination.
	 */
	async listEvents(request?: ListEventsRequest): Promise<ListEventsResult> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.tenantId !== undefined) {
			validateUUID(request.tenantId, "tenantId");
			params.set("tenantId", request.tenantId);
		}
		if (request?.sourceService !== undefined) {
			params.set("sourceService", request.sourceService);
		}
		if (request?.topic !== undefined) {
			params.set("topic", request.topic);
		}
		if (request?.since !== undefined) {
			params.set("since", request.since);
		}
		if (request?.limit !== undefined) {
			params.set("limit", String(request.limit));
		}
		if (request?.cursor !== undefined) {
			params.set("cursor", request.cursor);
		}

		const queryString = params.toString();
		const path = queryString ? `/audit/v1/events?${queryString}` : "/audit/v1/events";

		return this.request<ListEventsResult>("GET", path, {
			operation: "listEvents",
		});
	}

	/**
	 * Create a real-time streaming subscription for audit events.
	 */
	async createSubscription(request: CreateSubscriptionRequest): Promise<StreamingSubscription> {
		await this.ensureActivated();

		return this.request<StreamingSubscription>("POST", "/audit/v1/streaming/subscriptions", {
			body: request,
			operation: "createSubscription",
		});
	}

	/**
	 * List streaming subscriptions with optional filtering.
	 */
	async listSubscriptions(request?: ListSubscriptionsRequest): Promise<ListSubscriptionsResult> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.status !== undefined) {
			params.set("status", request.status);
		}
		if (request?.limit !== undefined) {
			params.set("limit", String(request.limit));
		}
		if (request?.cursor !== undefined) {
			params.set("cursor", request.cursor);
		}

		const queryString = params.toString();
		const path = queryString
			? `/audit/v1/streaming/subscriptions?${queryString}`
			: "/audit/v1/streaming/subscriptions";

		return this.request<ListSubscriptionsResult>("GET", path, {
			operation: "listSubscriptions",
		});
	}

	/**
	 * Update an existing streaming subscription.
	 */
	async updateSubscription(
		subscriptionId: string,
		request: UpdateSubscriptionRequest,
	): Promise<StreamingSubscription> {
		validateUUID(subscriptionId, "subscriptionId");
		await this.ensureActivated();

		return this.request<StreamingSubscription>(
			"PATCH",
			`/audit/v1/streaming/subscriptions/${subscriptionId}`,
			{
				body: request,
				operation: "updateSubscription",
			},
		);
	}

	/**
	 * Delete a streaming subscription.
	 */
	async deleteSubscription(subscriptionId: string): Promise<void> {
		validateUUID(subscriptionId, "subscriptionId");
		await this.ensureActivated();

		return this.request<void>("DELETE", `/audit/v1/streaming/subscriptions/${subscriptionId}`, {
			operation: "deleteSubscription",
		});
	}

	/**
	 * Get streaming metrics for subscriptions.
	 */
	async getStreamingMetrics(request?: GetStreamingMetricsRequest): Promise<StreamingMetrics> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.subscriptionId !== undefined) {
			validateUUID(request.subscriptionId, "subscriptionId");
			params.set("subscriptionId", request.subscriptionId);
		}
		if (request?.since !== undefined) {
			params.set("since", request.since);
		}
		if (request?.until !== undefined) {
			params.set("until", request.until);
		}

		const queryString = params.toString();
		const path = queryString
			? `/audit/v1/streaming/metrics?${queryString}`
			: "/audit/v1/streaming/metrics";

		return this.request<StreamingMetrics>("GET", path, {
			operation: "getStreamingMetrics",
		});
	}

	/**
	 * Create a retention policy for audit event lifecycle management.
	 */
	async createRetentionPolicy(request: CreateRetentionPolicyRequest): Promise<RetentionPolicy> {
		await this.ensureActivated();

		return this.request<RetentionPolicy>("POST", "/audit/v1/retention/policies", {
			body: request,
			operation: "createRetentionPolicy",
		});
	}

	/**
	 * List retention policies with optional filtering.
	 */
	async listRetentionPolicies(
		request?: ListRetentionPoliciesRequest,
	): Promise<ListRetentionPoliciesResult> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.status !== undefined) {
			params.set("status", request.status);
		}
		if (request?.limit !== undefined) {
			params.set("limit", String(request.limit));
		}
		if (request?.cursor !== undefined) {
			params.set("cursor", request.cursor);
		}

		const queryString = params.toString();
		const path = queryString
			? `/audit/v1/retention/policies?${queryString}`
			: "/audit/v1/retention/policies";

		return this.request<ListRetentionPoliciesResult>("GET", path, {
			operation: "listRetentionPolicies",
		});
	}

	/**
	 * Update an existing retention policy.
	 */
	async updateRetentionPolicy(
		policyId: string,
		request: UpdateRetentionPolicyRequest,
	): Promise<RetentionPolicy> {
		validateUUID(policyId, "policyId");
		await this.ensureActivated();

		return this.request<RetentionPolicy>("PATCH", `/audit/v1/retention/policies/${policyId}`, {
			body: request,
			operation: "updateRetentionPolicy",
		});
	}

	/**
	 * Delete a retention policy.
	 */
	async deleteRetentionPolicy(policyId: string): Promise<void> {
		validateUUID(policyId, "policyId");
		await this.ensureActivated();

		return this.request<void>("DELETE", `/audit/v1/retention/policies/${policyId}`, {
			operation: "deleteRetentionPolicy",
		});
	}

	/**
	 * Execute cleanup according to a retention policy.
	 */
	async executeCleanup(request: ExecuteCleanupRequest): Promise<RetentionCleanupResult> {
		validateUUID(request.policyId, "policyId");
		await this.ensureActivated();

		return this.request<RetentionCleanupResult>(
			"POST",
			`/audit/v1/retention/policies/${request.policyId}/execute`,
			{
				body: { dryRun: request.dryRun ?? false },
				operation: "executeCleanup",
			},
		);
	}

	/**
	 * Preview cleanup effects without executing (dry run).
	 */
	async previewCleanup(request: PreviewCleanupRequest): Promise<RetentionCleanupPreview> {
		validateUUID(request.policyId, "policyId");
		await this.ensureActivated();

		return this.request<RetentionCleanupPreview>(
			"POST",
			`/audit/v1/retention/policies/${request.policyId}/preview`,
			{
				body: {},
				operation: "previewCleanup",
			},
		);
	}

	/**
	 * Get retention metrics for monitoring cleanup operations.
	 */
	async getRetentionMetrics(request?: GetRetentionMetricsRequest): Promise<RetentionMetrics> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.since !== undefined) {
			params.set("since", request.since);
		}
		if (request?.until !== undefined) {
			params.set("until", request.until);
		}

		const queryString = params.toString();
		const path = queryString
			? `/audit/v1/retention/metrics?${queryString}`
			: "/audit/v1/retention/metrics";

		return this.request<RetentionMetrics>("GET", path, {
			operation: "getRetentionMetrics",
		});
	}
}

export * from "./observability.js";
export * from "./validation.js";
