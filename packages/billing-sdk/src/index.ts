import { performance } from "node:perf_hooks";

import { activateSdk, type SdkActivationConfig } from "@heossihq/qnsi-sdk-activation";

import type {
	BillingClientTelemetry,
	BillingClientTelemetryConfig,
	BillingClientTelemetryEvent,
} from "./observability.js";
import { createBillingClientTelemetry, isBillingClientTelemetry } from "./observability.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";
import { validateUUID } from "./validation.js";

/**
 * @heossihq/qnsi-billing-sdk
 *
 * TypeScript SDK client for the QNSP billing-service API.
 * Provides a high-level interface for usage meter ingestion and invoice management.
 */

/** Default QNSP cloud API base URL. Get a free API key at https://cloud.qnsi.heossi.com/signup */
export const DEFAULT_BASE_URL = "https://api.qnsi.heossi.com";

export interface BillingClientConfig {
	readonly baseUrl?: string;
	readonly apiKey: string;
	readonly timeoutMs?: number;
	readonly telemetry?: BillingClientTelemetry | BillingClientTelemetryConfig;
	readonly maxRetries?: number;
	readonly retryDelayMs?: number;
}

type InternalBillingClientConfig = {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly timeoutMs: number;
	readonly maxRetries: number;
	readonly retryDelayMs: number;
};

export interface BillingSecurityEnvelope {
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

export interface SecuritySignature {
	readonly provider: string;
	readonly algorithm: string;
	readonly value: string;
	readonly publicKey: string;
}

export interface Meter {
	readonly tenantId: string;
	readonly source: string;
	readonly meterType: string;
	readonly quantity: number;
	readonly unit: string;
	readonly currency?: "USD" | "EUR" | "GBP";
	readonly recordedAt: string;
	readonly metadata?: Record<string, unknown>;
	readonly security: BillingSecurityEnvelope;
	readonly signature?: SecuritySignature;
}

export interface InvoiceLineItem {
	readonly description: string;
	readonly quantity: number;
	readonly unitPriceCents: number;
	readonly totalCents: number;
	readonly meterType?: string | null;
}

export interface Invoice {
	readonly id: string;
	readonly tenantId: string;
	readonly periodStart: string;
	readonly periodEnd: string;
	readonly currency: string;
	readonly subtotalCents: number;
	readonly taxCents: number;
	readonly totalCents: number;
	readonly status: string;
	readonly lineItems: readonly InvoiceLineItem[];
	readonly security: BillingSecurityEnvelope;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface IngestMetersRequest {
	readonly meters: readonly Meter[];
}

export interface IngestMetersResponse {
	readonly accepted: number;
}

export interface CreateInvoiceRequest {
	readonly tenantId: string;
	readonly periodStart: string;
	readonly periodEnd: string;
	readonly lineItems: readonly InvoiceLineItem[];
	readonly currency?: "USD" | "EUR" | "GBP";
	readonly taxesCents?: number;
	readonly metadata?: Record<string, unknown>;
	readonly security: BillingSecurityEnvelope;
	readonly signature?: SecuritySignature;
}

export interface ListInvoicesResponse {
	readonly items: readonly Invoice[];
	readonly nextCursor: string | null;
}

/**
 * Revenue Analytics Types
 */

export interface RevenueByTenantRequest {
	readonly since?: string;
	readonly until?: string;
	readonly limit?: number;
	readonly cursor?: string;
	readonly sortBy?: "revenue" | "tenantName";
	readonly sortOrder?: "asc" | "desc";
}

export interface TenantRevenue {
	readonly tenantId: string;
	readonly tenantName: string;
	readonly totalRevenueCents: number;
	readonly currency: string;
	readonly invoiceCount: number;
	readonly avgInvoiceAmountCents: number;
	readonly growthPercent: number;
}

export interface RevenueByTenantResponse {
	readonly items: readonly TenantRevenue[];
	readonly nextCursor: string | null;
	readonly summary: {
		readonly totalRevenueCents: number;
		readonly tenantCount: number;
	};
}

export interface RevenueByServiceRequest {
	readonly since?: string;
	readonly until?: string;
	readonly tenantId?: string;
}

export interface ServiceRevenue {
	readonly service: string;
	readonly totalRevenueCents: number;
	readonly meterCount: number;
	readonly avgUnitPriceCents: number;
	readonly percentOfTotal: number;
}

export interface RevenueByServiceResponse {
	readonly items: readonly ServiceRevenue[];
	readonly totalRevenueCents: number;
}

export interface RevenueSummaryRequest {
	readonly since?: string;
	readonly until?: string;
	readonly groupBy?: "day" | "week" | "month" | "quarter";
}

export interface RevenueSummary {
	readonly period: {
		readonly start: string;
		readonly end: string;
	};
	readonly totalRevenueCents: number;
	readonly paidRevenueCents: number;
	readonly pendingRevenueCents: number;
	readonly overdueRevenueCents: number;
	readonly invoiceCount: number;
	readonly paidInvoiceCount: number;
	readonly avgInvoiceAmountCents: number;
	readonly growthPercent: number;
	readonly timeSeries: readonly {
		readonly period: string;
		readonly revenueCents: number;
		readonly invoiceCount: number;
	}[];
}

export interface MRRMetricsRequest {
	readonly since?: string;
	readonly until?: string;
}

export interface MRRMetrics {
	readonly period: {
		readonly start: string;
		readonly end: string;
	};
	readonly currentMrrCents: number;
	readonly previousMrrCents: number;
	readonly newMrrCents: number;
	readonly expansionMrrCents: number;
	readonly contractionMrrCents: number;
	readonly churnedMrrCents: number;
	readonly netMrrChangeCents: number;
	readonly growthRate: number;
	readonly annualizedRevenueCents: number;
}

/**
 * Usage Forecasting Types
 */

export interface UsageForecastRequest {
	readonly tenantId?: string;
	readonly meterType?: string;
	readonly horizonDays?: number;
}

export interface UsageForecast {
	readonly tenantId?: string;
	readonly meterType?: string;
	readonly generatedAt: string;
	readonly horizon: {
		readonly start: string;
		readonly end: string;
	};
	readonly predictions: readonly {
		readonly date: string;
		readonly predictedValue: number;
		readonly confidenceLow: number;
		readonly confidenceHigh: number;
	}[];
	readonly accuracy: {
		readonly mape: number;
		readonly rmse: number;
	};
}

export interface BillingForecastRequest {
	readonly tenantId?: string;
	readonly horizonMonths?: number;
}

export interface BillingForecast {
	readonly tenantId?: string;
	readonly generatedAt: string;
	readonly horizon: {
		readonly start: string;
		readonly end: string;
	};
	readonly predictions: readonly {
		readonly month: string;
		readonly predictedAmountCents: number;
		readonly confidenceLow: number;
		readonly confidenceHigh: number;
		readonly breakdown: readonly {
			readonly meterType: string;
			readonly amountCents: number;
		}[];
	}[];
}

export interface CapacityForecastRequest {
	readonly meterType?: string;
	readonly horizonDays?: number;
	readonly thresholdPercent?: number;
}

export interface CapacityForecast {
	readonly meterType?: string;
	readonly generatedAt: string;
	readonly currentUsage: number;
	readonly currentCapacity: number;
	readonly utilizationPercent: number;
	readonly predictions: readonly {
		readonly date: string;
		readonly predictedUsage: number;
		readonly predictedUtilization: number;
		readonly exceedsThreshold: boolean;
	}[];
	readonly recommendations: readonly {
		readonly type: "scale_up" | "optimize" | "no_action";
		readonly urgency: "low" | "medium" | "high";
		readonly description: string;
		readonly estimatedDate?: string;
	}[];
}

/**
 * Dunning Types
 */

export type DunningStage = "reminder" | "warning" | "final_notice" | "suspension" | "termination";
export type DunningStatus = "pending" | "in_progress" | "resolved" | "escalated";

export interface DunningSchedule {
	readonly id: string;
	readonly name: string;
	readonly stages: readonly {
		readonly stage: DunningStage;
		readonly daysAfterDue: number;
		readonly actions: readonly string[];
		readonly emailTemplate?: string;
	}[];
	readonly isDefault: boolean;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface ConfigureDunningRequest {
	readonly name: string;
	readonly stages: readonly {
		readonly stage: DunningStage;
		readonly daysAfterDue: number;
		readonly actions: readonly string[];
		readonly emailTemplate?: string;
	}[];
	readonly isDefault?: boolean;
}

export interface FailedPayment {
	readonly id: string;
	readonly tenantId: string;
	readonly invoiceId: string;
	readonly amountCents: number;
	readonly currency: string;
	readonly failureReason: string;
	readonly failureCode?: string;
	readonly attemptCount: number;
	readonly lastAttemptAt: string;
	readonly nextRetryAt?: string;
	readonly status: DunningStatus;
	readonly currentStage: DunningStage;
	readonly createdAt: string;
}

export interface RetryPaymentRequest {
	readonly paymentId: string;
	readonly forceRetry?: boolean;
}

export interface RetryPaymentResponse {
	readonly paymentId: string;
	readonly success: boolean;
	readonly transactionId?: string;
	readonly failureReason?: string;
	readonly nextRetryAt?: string;
}

export interface ResolveDunningRequest {
	readonly paymentId: string;
	readonly resolution: "paid" | "waived" | "written_off";
	readonly note?: string;
}

export interface DunningStatusResponse {
	readonly tenantId: string;
	readonly status: DunningStatus;
	readonly currentStage?: DunningStage;
	readonly failedPayments: readonly FailedPayment[];
	readonly totalOutstandingCents: number;
	readonly oldestOverdueDays: number;
}

export interface DunningMetricsRequest {
	readonly since?: string;
	readonly until?: string;
}

export interface DunningMetrics {
	readonly period: {
		readonly start: string;
		readonly end: string;
	};
	readonly totalFailedPayments: number;
	readonly recoveredPayments: number;
	readonly recoveryRate: number;
	readonly totalRecoveredCents: number;
	readonly totalWrittenOffCents: number;
	readonly avgRecoveryDays: number;
	readonly byStage: readonly {
		readonly stage: DunningStage;
		readonly count: number;
		readonly amountCents: number;
	}[];
}

/**
 * Credits Types
 */

export type CreditType = "promotional" | "refund" | "loyalty" | "compensation" | "manual";
export type CreditStatus = "active" | "exhausted" | "expired" | "cancelled";

export interface Credit {
	readonly id: string;
	readonly tenantId: string;
	readonly type: CreditType;
	readonly amountCents: number;
	readonly remainingCents: number;
	readonly currency: string;
	readonly description: string;
	readonly status: CreditStatus;
	readonly expiresAt?: string;
	readonly createdAt: string;
	readonly createdBy: string;
}

export interface CreateCreditRequest {
	readonly tenantId: string;
	readonly type: CreditType;
	readonly amountCents: number;
	readonly currency?: string;
	readonly description: string;
	readonly expiresAt?: string;
}

export interface CreditBalance {
	readonly tenantId: string;
	readonly totalAvailableCents: number;
	readonly currency: string;
	readonly credits: readonly {
		readonly id: string;
		readonly type: CreditType;
		readonly remainingCents: number;
		readonly expiresAt?: string;
	}[];
	readonly expiringWithin30Days: number;
}

export interface ApplyCreditRequest {
	readonly tenantId: string;
	readonly invoiceId: string;
	readonly amountCents: number;
	readonly creditIds?: readonly string[];
}

export interface ApplyCreditResponse {
	readonly invoiceId: string;
	readonly appliedAmountCents: number;
	readonly creditsUsed: readonly {
		readonly creditId: string;
		readonly amountCents: number;
	}[];
	readonly remainingInvoiceAmountCents: number;
}

export interface Promotion {
	readonly id: string;
	readonly code: string;
	readonly name: string;
	readonly description?: string;
	readonly creditAmountCents: number;
	readonly currency: string;
	readonly maxRedemptions?: number;
	readonly currentRedemptions: number;
	readonly validFrom: string;
	readonly validUntil?: string;
	readonly eligibility?: {
		readonly newTenantsOnly?: boolean;
		readonly minPlan?: string;
		readonly regions?: readonly string[];
	};
	readonly status: "active" | "paused" | "expired" | "exhausted";
	readonly createdAt: string;
}

export interface CreatePromotionRequest {
	readonly code: string;
	readonly name: string;
	readonly description?: string;
	readonly creditAmountCents: number;
	readonly currency?: string;
	readonly maxRedemptions?: number;
	readonly validFrom?: string;
	readonly validUntil?: string;
	readonly eligibility?: {
		readonly newTenantsOnly?: boolean;
		readonly minPlan?: string;
		readonly regions?: readonly string[];
	};
}

export interface RedeemPromotionRequest {
	readonly tenantId: string;
	readonly promotionCode: string;
}

export interface RedeemPromotionResponse {
	readonly success: boolean;
	readonly credit?: Credit;
	readonly failureReason?: string;
}

export interface CreditTransaction {
	readonly id: string;
	readonly tenantId: string;
	readonly creditId: string;
	readonly type: "credit" | "debit" | "expiration" | "cancellation";
	readonly amountCents: number;
	readonly balanceAfterCents: number;
	readonly invoiceId?: string;
	readonly description: string;
	readonly createdAt: string;
}

export interface CreditHistoryRequest {
	readonly tenantId: string;
	readonly since?: string;
	readonly until?: string;
	readonly limit?: number;
	readonly cursor?: string;
}

export interface CreditHistoryResponse {
	readonly items: readonly CreditTransaction[];
	readonly nextCursor: string | null;
}

interface RequestOptions {
	readonly body?: unknown;
	readonly headers?: Record<string, string>;
	readonly signal?: AbortSignal;
	/** Required: every public method names its operation for telemetry. */
	readonly operation: string;
	readonly telemetryRoute?: string;
	readonly telemetryTarget?: string;
}

export class BillingClient {
	private readonly config: InternalBillingClientConfig;
	private readonly telemetry: BillingClientTelemetry | null;
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

	constructor(config: BillingClientConfig) {
		if (!config.apiKey || config.apiKey.trim().length === 0) {
			throw new Error(
				"QNSP Billing SDK: apiKey is required. " +
					"Get your free API key at https://cloud.qnsi.heossi.com/signup - " +
					"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
					"Docs: https://docs.qnsi.heossi.com/sdk/billing-sdk",
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
			? isBillingClientTelemetry(config.telemetry)
				? config.telemetry
				: createBillingClientTelemetry(config.telemetry)
			: null;

		try {
			this.targetService = new URL(this.config.baseUrl).host;
		} catch {
			this.targetService = "billing-service";
		}

		this.activationConfig = {
			apiKey: config.apiKey,
			sdkId: "billing-sdk",
			sdkVersion: SDK_PACKAGE_VERSION,
			platformUrl: baseUrl,
		};
	}

	private async request<T>(method: string, path: string, options: RequestOptions): Promise<T> {
		return this.requestWithRetry<T>(method, path, options, 0);
	}

	private async requestWithRetry<T>(
		method: string,
		path: string,
		options: RequestOptions,
		attempt: number,
	): Promise<T> {
		const url = `${this.config.baseUrl}${path}`;
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...options.headers,
		};

		headers["Authorization"] = `Bearer ${this.config.apiKey}`;

		// Auto-inject tenant ID from activation response. Every public method
		// awaits ensureActivated() before requesting, and activation always
		// carries a tenantId, so this is set unconditionally.
		headers["x-qnsp-tenant-id"] = this.resolvedTenantId as string;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
		const signal = options.signal ?? controller.signal;
		const route = options.telemetryRoute ?? new URL(path, this.config.baseUrl).pathname;
		const target = options.telemetryTarget ?? this.targetService;
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

			if (options.body !== undefined) {
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
					`Billing API error: Rate limit exceeded after ${this.config.maxRetries} retries`,
				);
			}

			if (!response.ok) {
				status = "error";
				// Sanitize error message to prevent information disclosure
				// Don't include full response text in error to avoid leaking sensitive data
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Billing API error: ${response.status} ${response.statusText}`);
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
			const event: BillingClientTelemetryEvent = {
				operation: options.operation,
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

	private recordTelemetryEvent(event: BillingClientTelemetryEvent): void {
		if (!this.telemetry) {
			return;
		}
		this.telemetry.record(event);
	}

	/**
	 * Ingest usage meters (batch).
	 * Accepts multiple meters in a single request.
	 * Returns the number of accepted meters.
	 */
	async ingestMeters(request: IngestMetersRequest): Promise<IngestMetersResponse> {
		// Validate tenantId in each meter
		for (const meter of request.meters) {
			validateUUID(meter.tenantId, "meter.tenantId");
		}
		await this.ensureActivated();

		return this.request<IngestMetersResponse>("POST", "/billing/v1/meters", {
			body: {
				meters: request.meters,
			},
			operation: "ingestMeters",
		});
	}

	/**
	 * Create an invoice from line items.
	 * Requires PQC-signed security envelope and optional signature.
	 */
	async createInvoice(request: CreateInvoiceRequest): Promise<Invoice> {
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<Invoice>("POST", "/billing/v1/invoices", {
			body: {
				tenantId: request.tenantId,
				periodStart: request.periodStart,
				periodEnd: request.periodEnd,
				lineItems: request.lineItems,
				...(request.currency !== undefined ? { currency: request.currency } : {}),
				...(request.taxesCents !== undefined ? { taxesCents: request.taxesCents } : {}),
				...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
				security: request.security,
				...(request.signature !== undefined ? { signature: request.signature } : {}),
			},
			operation: "createInvoice",
		});
	}

	/**
	 * List invoices for a tenant with cursor-based pagination.
	 * Returns a list of invoices and an optional next cursor for pagination.
	 */
	async listInvoices(
		tenantId: string,
		options?: {
			readonly limit?: number;
			readonly cursor?: string;
		},
	): Promise<ListInvoicesResponse> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();

		const params = new URLSearchParams({
			tenantId,
		});
		if (options?.limit !== undefined) {
			params.set("limit", String(options.limit));
		}
		if (options?.cursor !== undefined) {
			params.set("cursor", options.cursor);
		}

		return this.request<ListInvoicesResponse>("GET", `/billing/v1/invoices?${params}`, {
			operation: "listInvoices",
		});
	}

	/**
	 * Get revenue breakdown by tenant.
	 */
	async getRevenueByTenant(request?: RevenueByTenantRequest): Promise<RevenueByTenantResponse> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.since !== undefined) params.set("since", request.since);
		if (request?.until !== undefined) params.set("until", request.until);
		if (request?.limit !== undefined) params.set("limit", String(request.limit));
		if (request?.cursor !== undefined) params.set("cursor", request.cursor);
		if (request?.sortBy !== undefined) params.set("sortBy", request.sortBy);
		if (request?.sortOrder !== undefined) params.set("sortOrder", request.sortOrder);

		const queryString = params.toString();
		const path = queryString
			? `/billing/v1/revenue/by-tenant?${queryString}`
			: "/billing/v1/revenue/by-tenant";

		return this.request<RevenueByTenantResponse>("GET", path, {
			operation: "getRevenueByTenant",
		});
	}

	/**
	 * Get revenue breakdown by service.
	 */
	async getRevenueByService(request?: RevenueByServiceRequest): Promise<RevenueByServiceResponse> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.since !== undefined) params.set("since", request.since);
		if (request?.until !== undefined) params.set("until", request.until);
		if (request?.tenantId !== undefined) {
			validateUUID(request.tenantId, "tenantId");
			params.set("tenantId", request.tenantId);
		}

		const queryString = params.toString();
		const path = queryString
			? `/billing/v1/revenue/by-service?${queryString}`
			: "/billing/v1/revenue/by-service";

		return this.request<RevenueByServiceResponse>("GET", path, {
			operation: "getRevenueByService",
		});
	}

	/**
	 * Get revenue summary with time series data.
	 */
	async getRevenueSummary(request?: RevenueSummaryRequest): Promise<RevenueSummary> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.since !== undefined) params.set("since", request.since);
		if (request?.until !== undefined) params.set("until", request.until);
		if (request?.groupBy !== undefined) params.set("groupBy", request.groupBy);

		const queryString = params.toString();
		const path = queryString
			? `/billing/v1/revenue/summary?${queryString}`
			: "/billing/v1/revenue/summary";

		return this.request<RevenueSummary>("GET", path, {
			operation: "getRevenueSummary",
		});
	}

	/**
	 * Get Monthly Recurring Revenue (MRR) metrics.
	 */
	async getMRRMetrics(request?: MRRMetricsRequest): Promise<MRRMetrics> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.since !== undefined) params.set("since", request.since);
		if (request?.until !== undefined) params.set("until", request.until);

		const queryString = params.toString();
		const path = queryString ? `/billing/v1/revenue/mrr?${queryString}` : "/billing/v1/revenue/mrr";

		return this.request<MRRMetrics>("GET", path, {
			operation: "getMRRMetrics",
		});
	}

	/**
	 * Get usage forecast for a tenant or meter type.
	 */
	async getUsageForecast(request?: UsageForecastRequest): Promise<UsageForecast> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.tenantId !== undefined) {
			validateUUID(request.tenantId, "tenantId");
			params.set("tenantId", request.tenantId);
		}
		if (request?.meterType !== undefined) params.set("meterType", request.meterType);
		if (request?.horizonDays !== undefined) params.set("horizonDays", String(request.horizonDays));

		const queryString = params.toString();
		const path = queryString
			? `/billing/v1/forecast/usage?${queryString}`
			: "/billing/v1/forecast/usage";

		return this.request<UsageForecast>("GET", path, {
			operation: "getUsageForecast",
		});
	}

	/**
	 * Get billing forecast for a tenant.
	 */
	async getBillingForecast(request?: BillingForecastRequest): Promise<BillingForecast> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.tenantId !== undefined) {
			validateUUID(request.tenantId, "tenantId");
			params.set("tenantId", request.tenantId);
		}
		if (request?.horizonMonths !== undefined)
			params.set("horizonMonths", String(request.horizonMonths));

		const queryString = params.toString();
		const path = queryString
			? `/billing/v1/forecast/billing?${queryString}`
			: "/billing/v1/forecast/billing";

		return this.request<BillingForecast>("GET", path, {
			operation: "getBillingForecast",
		});
	}

	/**
	 * Get capacity forecast and recommendations.
	 */
	async getCapacityForecast(request?: CapacityForecastRequest): Promise<CapacityForecast> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.meterType !== undefined) params.set("meterType", request.meterType);
		if (request?.horizonDays !== undefined) params.set("horizonDays", String(request.horizonDays));
		if (request?.thresholdPercent !== undefined)
			params.set("thresholdPercent", String(request.thresholdPercent));

		const queryString = params.toString();
		const path = queryString
			? `/billing/v1/forecast/capacity?${queryString}`
			: "/billing/v1/forecast/capacity";

		return this.request<CapacityForecast>("GET", path, {
			operation: "getCapacityForecast",
		});
	}

	/**
	 * Configure dunning schedule for payment recovery.
	 */
	async configureDunning(request: ConfigureDunningRequest): Promise<DunningSchedule> {
		await this.ensureActivated();

		return this.request<DunningSchedule>("POST", "/billing/v1/dunning/schedules", {
			body: request,
			operation: "configureDunning",
		});
	}

	/**
	 * Retry a failed payment.
	 */
	async retryPayment(request: RetryPaymentRequest): Promise<RetryPaymentResponse> {
		validateUUID(request.paymentId, "paymentId");
		await this.ensureActivated();

		return this.request<RetryPaymentResponse>(
			"POST",
			`/billing/v1/dunning/payments/${request.paymentId}/retry`,
			{
				body: { forceRetry: request.forceRetry ?? false },
				operation: "retryPayment",
			},
		);
	}

	/**
	 * Resolve a dunning case.
	 */
	async resolveDunning(request: ResolveDunningRequest): Promise<FailedPayment> {
		validateUUID(request.paymentId, "paymentId");
		await this.ensureActivated();

		return this.request<FailedPayment>(
			"POST",
			`/billing/v1/dunning/payments/${request.paymentId}/resolve`,
			{
				body: {
					resolution: request.resolution,
					...(request.note !== undefined ? { note: request.note } : {}),
				},
				operation: "resolveDunning",
			},
		);
	}

	/**
	 * Get dunning status for a tenant.
	 */
	async getDunningStatus(tenantId: string): Promise<DunningStatusResponse> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<DunningStatusResponse>(
			"GET",
			`/billing/v1/dunning/status?tenantId=${tenantId}`,
			{
				operation: "getDunningStatus",
			},
		);
	}

	/**
	 * Get dunning metrics for recovery performance.
	 */
	async getDunningMetrics(request?: DunningMetricsRequest): Promise<DunningMetrics> {
		await this.ensureActivated();
		const params = new URLSearchParams();

		if (request?.since !== undefined) params.set("since", request.since);
		if (request?.until !== undefined) params.set("until", request.until);

		const queryString = params.toString();
		const path = queryString
			? `/billing/v1/dunning/metrics?${queryString}`
			: "/billing/v1/dunning/metrics";

		return this.request<DunningMetrics>("GET", path, {
			operation: "getDunningMetrics",
		});
	}

	/**
	 * Create a credit for a tenant.
	 */
	async createCredit(request: CreateCreditRequest): Promise<Credit> {
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<Credit>("POST", "/billing/v1/credits", {
			body: request,
			operation: "createCredit",
		});
	}

	/**
	 * Get credit balance for a tenant.
	 */
	async getCreditBalance(tenantId: string): Promise<CreditBalance> {
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<CreditBalance>("GET", `/billing/v1/credits/balance?tenantId=${tenantId}`, {
			operation: "getCreditBalance",
		});
	}

	/**
	 * Apply credit to an invoice.
	 */
	async applyCredit(request: ApplyCreditRequest): Promise<ApplyCreditResponse> {
		validateUUID(request.tenantId, "tenantId");
		validateUUID(request.invoiceId, "invoiceId");
		await this.ensureActivated();

		return this.request<ApplyCreditResponse>("POST", "/billing/v1/credits/apply", {
			body: request,
			operation: "applyCredit",
		});
	}

	/**
	 * Create a promotional offer.
	 */
	async createPromotion(request: CreatePromotionRequest): Promise<Promotion> {
		await this.ensureActivated();

		return this.request<Promotion>("POST", "/billing/v1/credits/promotions", {
			body: request,
			operation: "createPromotion",
		});
	}

	/**
	 * Redeem a promotion code.
	 */
	async redeemPromotion(request: RedeemPromotionRequest): Promise<RedeemPromotionResponse> {
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<RedeemPromotionResponse>("POST", "/billing/v1/credits/redeem", {
			body: request,
			operation: "redeemPromotion",
		});
	}

	/**
	 * Get credit transaction history for a tenant.
	 */
	async getCreditHistory(request: CreditHistoryRequest): Promise<CreditHistoryResponse> {
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		const params = new URLSearchParams({ tenantId: request.tenantId });
		if (request.since !== undefined) params.set("since", request.since);
		if (request.until !== undefined) params.set("until", request.until);
		if (request.limit !== undefined) params.set("limit", String(request.limit));
		if (request.cursor !== undefined) params.set("cursor", request.cursor);

		return this.request<CreditHistoryResponse>("GET", `/billing/v1/credits/history?${params}`, {
			operation: "getCreditHistory",
		});
	}
}

export * from "./observability.js";
export * from "./validation.js";
