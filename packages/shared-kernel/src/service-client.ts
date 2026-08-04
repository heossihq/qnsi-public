/**
 * Service Client with Circuit Breaker Support
 * Wraps fetch calls with circuit breakers to prevent cascading failures
 */

import type { CircuitBreaker } from "@heossihq/qnsi-resilience";
import {
	CircuitBreaker as CircuitBreakerImpl,
	CircuitBreakerOpenError,
} from "@heossihq/qnsi-resilience";

export type CircuitBreakerAuditEventType = "circuit_breaker.opened";

export type CircuitBreakerAuditEventPayload = {
	readonly eventType: CircuitBreakerAuditEventType;
	readonly tenantId: string;
	readonly resourceType: "service";
	readonly resourceId: string;
	readonly action: "circuit_breaker:state_change";
	readonly outcome: "success";
	readonly severity: "high";
	readonly details: {
		readonly serviceName: string;
		readonly state: string;
		readonly timestamp: string;
	};
};

export type AuditClient = {
	emit: (payload: CircuitBreakerAuditEventPayload) => Promise<void>;
};

export interface ServiceClientOptions {
	readonly baseUrl: string;
	readonly timeout?: number;
	readonly circuitBreaker?: CircuitBreaker;
	readonly defaultHeaders?: Record<string, string>;
	/** Optional audit client for circuit breaker state transition events. */
	readonly auditClient?: AuditClient;
	/** Service name for audit events. */
	readonly serviceName?: string;
	/** Tenant ID for audit events (use "system" for platform-level clients). */
	readonly tenantId?: string;
}

export interface ServiceClientRequestOptions extends RequestInit {
	readonly path: string;
	readonly timeout?: number;
}

export class ServiceClientError extends Error {
	constructor(
		message: string,
		readonly statusCode?: number,
		readonly code?: string,
	) {
		super(message);
		this.name = "ServiceClientError";
	}
}

/**
 * Service client with circuit breaker protection
 */
export class ServiceClient {
	private readonly baseUrl: string;
	private readonly timeout: number;
	private readonly circuitBreaker: CircuitBreaker;
	private readonly defaultHeaders: Record<string, string>;
	private readonly auditClient: AuditClient | null;
	private readonly serviceName: string;
	private readonly tenantId: string;

	constructor(options: ServiceClientOptions) {
		this.baseUrl = options.baseUrl;
		this.timeout = options.timeout ?? 30_000;
		this.defaultHeaders = options.defaultHeaders ?? {};
		this.auditClient = options.auditClient ?? null;
		this.serviceName = options.serviceName ?? "service-client";
		this.tenantId = options.tenantId ?? "system";

		const auditClient = this.auditClient;
		const serviceName = this.serviceName;
		const tenantId = this.tenantId;

		this.circuitBreaker =
			options.circuitBreaker ??
			new CircuitBreakerImpl({
				failureThreshold: 5,
				timeout: 60_000,
				halfOpenMaxCalls: 3,
				onStateChange: (state) => {
					if (state === "open" && auditClient) {
						void auditClient.emit({
							eventType: "circuit_breaker.opened",
							tenantId,
							resourceType: "service",
							resourceId: serviceName,
							action: "circuit_breaker:state_change",
							outcome: "success",
							severity: "high",
							details: { serviceName, state, timestamp: new Date().toISOString() },
						});
					}
				},
			});
	}

	/**
	 * Make a request with circuit breaker protection
	 */
	async request<T = unknown>(options: ServiceClientRequestOptions): Promise<T> {
		const { path, timeout = this.timeout, ...fetchOptions } = options;

		const url = new URL(path, this.baseUrl);

		const headers = {
			...this.defaultHeaders,
			...(fetchOptions.headers as Record<string, string>),
		};

		try {
			return await this.circuitBreaker.execute(async () => {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeout);

				try {
					const response = await fetch(url, {
						...fetchOptions,
						headers,
						signal: controller.signal,
					});

					clearTimeout(timeoutId);

					if (!response.ok) {
						await response.text().catch(() => "");
						throw new ServiceClientError(
							`Request failed: ${response.statusText}`,
							response.status,
							`HTTP_${response.status}`,
						);
					}

					// Try to parse as JSON, fallback to text
					const contentType = response.headers.get("content-type");
					if (contentType?.includes("application/json")) {
						return (await response.json()) as T;
					}

					return (await response.text()) as T;
				} catch (error) {
					clearTimeout(timeoutId);

					if (error instanceof CircuitBreakerOpenError) {
						throw new ServiceClientError(
							"Service temporarily unavailable (circuit breaker open)",
							503,
							"CIRCUIT_BREAKER_OPEN",
						);
					}

					if (error instanceof ServiceClientError) {
						throw error;
					}

					if (error instanceof Error && error.name === "AbortError") {
						throw new ServiceClientError("Request timeout", 504, "TIMEOUT");
					}

					throw new ServiceClientError(
						error instanceof Error ? error.message : "Unknown error",
						500,
						"UNKNOWN_ERROR",
					);
				}
			});
		} catch (error) {
			if (error instanceof CircuitBreakerOpenError) {
				throw new ServiceClientError(
					"Service temporarily unavailable (circuit breaker open)",
					503,
					"CIRCUIT_BREAKER_OPEN",
				);
			}
			throw error;
		}
	}

	/**
	 * GET request
	 */
	async get<T = unknown>(
		path: string,
		options?: Omit<ServiceClientRequestOptions, "path" | "method">,
	): Promise<T> {
		return this.request<T>({
			...options,
			path,
			method: "GET",
		});
	}

	/**
	 * POST request
	 */
	async post<T = unknown>(
		path: string,
		body?: unknown,
		options?: Omit<ServiceClientRequestOptions, "path" | "method" | "body">,
	): Promise<T> {
		const requestOptions: ServiceClientRequestOptions = {
			...options,
			path,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...((options?.headers as Record<string, string>) ?? {}),
			},
		};

		if (body !== undefined) {
			requestOptions.body = JSON.stringify(body);
		}

		return this.request<T>(requestOptions);
	}

	/**
	 * PUT request
	 */
	async put<T = unknown>(
		path: string,
		body?: unknown,
		options?: Omit<ServiceClientRequestOptions, "path" | "method" | "body">,
	): Promise<T> {
		const requestOptions: ServiceClientRequestOptions = {
			...options,
			path,
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				...((options?.headers as Record<string, string>) ?? {}),
			},
		};

		if (body !== undefined) {
			requestOptions.body = JSON.stringify(body);
		}

		return this.request<T>(requestOptions);
	}

	/**
	 * DELETE request
	 */
	async delete<T = unknown>(
		path: string,
		options?: Omit<ServiceClientRequestOptions, "path" | "method">,
	): Promise<T> {
		return this.request<T>({
			...options,
			path,
			method: "DELETE",
		});
	}

	/**
	 * Get circuit breaker state
	 */
	getCircuitBreakerState(): "closed" | "open" | "half-open" {
		return this.circuitBreaker.getState();
	}
}
