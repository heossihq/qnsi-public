/**
 * AI Intelligence Service Client
 *
 * Provides access to QNSP's AI-powered platform enhancements:
 * - Self-Healing Infrastructure
 * - Anomaly Detection
 * - Predictive Scaling
 * - Smart Rate Limiting
 * - Compliance Auditing
 * - Intelligent Caching
 * - Natural Language API
 * - Error Resolution
 */

export interface AiIntelligenceClientOptions {
	readonly baseUrl: string;
	readonly token: string;
	readonly fetchImpl?: typeof fetch;
}

export interface AiIntelligenceDashboard {
	health: {
		status: string;
		modules: Record<string, boolean>;
	};
	anomalies: {
		active: number;
		history: number;
	};
	scaling: {
		recommendations: number;
	};
	cache: {
		totalEntries: number;
		avgHitRate: number;
	};
	errors: {
		patterns: number;
		recentEvents: number;
	};
	compliance: {
		score: number;
		violations: number;
	};
}

export interface Anomaly {
	id: string;
	type: string;
	severity: "low" | "medium" | "high" | "critical";
	service: string;
	metric: string;
	value: number;
	threshold: number;
	detectedAt: string;
	resolvedAt?: string;
}

export interface ScalingRecommendation {
	service: string;
	currentCapacity: number;
	recommendedCapacity: number;
	reason: string;
	confidence: number;
	predictedAt: string;
}

export interface RateLimitInfo {
	tenantId: string;
	tier: string;
	requestsPerMinute: number;
	requestsPerHour: number;
	burstLimit: number;
	currentUtilization: number;
}

export interface ComplianceViolation {
	id: string;
	category: string;
	severity: "low" | "medium" | "high" | "critical";
	description: string;
	resource: string;
	detectedAt: string;
	resolvedAt?: string;
}

export interface ComplianceReport {
	score: number;
	totalChecks: number;
	passedChecks: number;
	violations: ComplianceViolation[];
	lastAuditAt: string;
}

export interface CacheStats {
	totalEntries: number;
	hitRate: number;
	missRate: number;
	evictionRate: number;
	avgTtl: number;
}

export interface NlpQueryResult {
	intent: string;
	confidence: number;
	apiCalls: Array<{
		service: string;
		method: string;
		endpoint: string;
		params: Record<string, unknown>;
	}>;
}

export interface ErrorPattern {
	id: string;
	pattern: string;
	occurrences: number;
	services: string[];
	suggestedFix?: string;
	autoFixable: boolean;
}

export class AiIntelligenceClient {
	private readonly baseUrl: URL;
	private readonly token: string;
	private readonly fetchImpl: typeof fetch;

	constructor(options: AiIntelligenceClientOptions) {
		this.baseUrl = new URL(options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`);
		this.token = options.token;
		this.fetchImpl = options.fetchImpl ?? fetch;
	}

	/**
	 * Get the full AI Intelligence dashboard summary
	 */
	async getDashboard(): Promise<AiIntelligenceDashboard> {
		return this.request<AiIntelligenceDashboard>("ai/v1/dashboard");
	}

	/**
	 * Get service health status
	 */
	async getHealthStatus(): Promise<{
		status: string;
		services: Record<string, { healthy: boolean; lastCheck: string }>;
	}> {
		return this.request("ai/v1/health-status");
	}

	/**
	 * Get active anomalies
	 */
	async getAnomalies(): Promise<{ anomalies: Anomaly[] }> {
		return this.request("ai/v1/anomalies");
	}

	/**
	 * Ingest metrics for anomaly detection
	 */
	async ingestMetrics(
		metrics: Array<{ service: string; metric: string; value: number; timestamp?: string }>,
	): Promise<{ ingested: number }> {
		return this.request("ai/v1/metrics/ingest", {
			method: "POST",
			body: JSON.stringify({ metrics }),
		});
	}

	/**
	 * Get scaling recommendations
	 */
	async getScalingRecommendations(): Promise<{ recommendations: ScalingRecommendation[] }> {
		return this.request("ai/v1/scaling/recommendations");
	}

	/**
	 * Get rate limit info for a tenant
	 */
	async getRateLimit(tenantId: string): Promise<RateLimitInfo> {
		return this.request(`ai/v1/rate-limits/${tenantId}`);
	}

	/**
	 * Record a rate limit request
	 */
	async recordRateLimitRequest(
		tenantId: string,
		endpoint: string,
	): Promise<{ allowed: boolean; remaining: number }> {
		return this.request("ai/v1/rate-limits/record", {
			method: "POST",
			body: JSON.stringify({ tenantId, endpoint }),
		});
	}

	/**
	 * Get compliance violations
	 */
	async getComplianceViolations(): Promise<{ violations: ComplianceViolation[] }> {
		return this.request("ai/v1/compliance/violations");
	}

	/**
	 * Run a full compliance audit
	 */
	async runComplianceAudit(): Promise<ComplianceReport> {
		return this.request("ai/v1/compliance/audit", { method: "POST" });
	}

	/**
	 * Get cache statistics
	 */
	async getCacheStats(): Promise<CacheStats> {
		return this.request("ai/v1/cache/stats");
	}

	/**
	 * Record a cache access for ML training
	 */
	async recordCacheAccess(key: string, hit: boolean): Promise<{ recorded: boolean }> {
		return this.request("ai/v1/cache/access", {
			method: "POST",
			body: JSON.stringify({ key, hit }),
		});
	}

	/**
	 * Parse a natural language query into API calls
	 */
	async parseNlpQuery(query: string): Promise<NlpQueryResult> {
		return this.request("ai/v1/nlp/query", {
			method: "POST",
			body: JSON.stringify({ query }),
		});
	}

	/**
	 * Get supported NLP intents
	 */
	async getNlpIntents(): Promise<{ intents: string[] }> {
		return this.request("ai/v1/nlp/intents");
	}

	/**
	 * Analyze an error message
	 */
	async analyzeError(
		error: string,
		context?: Record<string, unknown>,
	): Promise<{ pattern?: ErrorPattern; suggestedFix?: string }> {
		return this.request("ai/v1/errors/analyze", {
			method: "POST",
			body: JSON.stringify({ error, context }),
		});
	}

	/**
	 * Get detected error patterns
	 */
	async getErrorPatterns(): Promise<{ patterns: ErrorPattern[] }> {
		return this.request("ai/v1/errors/patterns");
	}

	/**
	 * Record an error event for pattern detection
	 */
	async recordErrorEvent(event: {
		service: string;
		error: string;
		stack?: string;
		context?: Record<string, unknown>;
	}): Promise<{ recorded: boolean; patternId?: string }> {
		return this.request("ai/v1/errors/record", {
			method: "POST",
			body: JSON.stringify(event),
		});
	}

	private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
		const url = new URL(path, this.baseUrl);
		// No caller supplies extra headers; the fixed set is the whole contract.
		const headers = new Headers({
			Authorization: `Bearer ${this.token}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		});

		const response = await this.fetchImpl(url, {
			...init,
			method: init.method ?? "GET",
			headers,
		});

		if (!response.ok) {
			const message = await safeReadError(response);
			throw new AiIntelligenceError(
				`Request to ${url.pathname} failed with status ${response.status}: ${response.statusText}${message ? ` - ${message}` : ""}`,
				response.status,
			);
		}

		if (response.status === 204) {
			return undefined as T;
		}

		return (await response.json()) as T;
	}
}

export class AiIntelligenceError extends Error {
	public readonly statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.name = "AiIntelligenceError";
		this.statusCode = statusCode;
	}
}

async function safeReadError(response: Response): Promise<string | null> {
	try {
		const payload = (await response.json()) as { error?: { message?: string }; message?: string };
		if (payload && typeof payload === "object") {
			if (payload.error && typeof payload.error.message === "string") {
				return payload.error.message;
			}
			if (typeof payload.message === "string") {
				return payload.message;
			}
		}
		return null;
	} catch {
		return null;
	}
}
