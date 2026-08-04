/**
 * Enterprise Error Tracking and Monitoring
 *
 * Provides centralized error logging, monitoring, and alerting
 * for the QNSP platform with structured error data.
 */

import { randomInt } from "node:crypto";
import { normalizeError, type QNSPError, WarningError } from "@heossihq/qnsi-shared-kernel/errors";

export interface ErrorContext {
	readonly service: string;
	readonly version?: string;
	readonly environment: string;
	readonly tenantId?: string;
	readonly userId?: string;
	readonly requestId?: string;
	readonly traceId?: string;
}

export interface ErrorMetrics {
	readonly code: string;
	readonly category: string;
	readonly severity: string;
	readonly service: string;
	readonly timestamp: string;
	readonly count: number;
	readonly context?: Record<string, unknown>;
}

export interface ErrorTrackingConfig {
	readonly enabled: boolean;
	readonly environment: string;
	readonly service: string;
	readonly version?: string;
	readonly sampleRate?: number;
	readonly maxErrorsPerMinute?: number;
}

export class ErrorTracker {
	private readonly config: Required<ErrorTrackingConfig>;
	private errorCounts = new Map<string, number>();
	private lastReset = Date.now();
	private errorBuffer: ErrorMetrics[] = [];
	private readonly maxBufferSize = 1000;

	constructor(config: ErrorTrackingConfig) {
		this.config = {
			enabled: config.enabled ?? true,
			environment: config.environment,
			service: config.service,
			version: config.version ?? "unknown",
			sampleRate: config.sampleRate ?? 1.0,
			maxErrorsPerMinute: config.maxErrorsPerMinute ?? 100,
		};
	}

	/**
	 * Track an error with context and metrics
	 */
	trackError(error: unknown, context?: Partial<ErrorContext>): void {
		if (!this.config.enabled) {
			return;
		}

		// Sample errors to reduce noise
		const sampleRate = Math.min(1, Math.max(0, this.config.sampleRate));
		const bucketMax = 1_000_000;
		const threshold = Math.floor(sampleRate * bucketMax);
		if (threshold <= 0) {
			return;
		}
		if (threshold < bucketMax && randomInt(0, bucketMax) >= threshold) {
			return;
		}

		const normalizedError = normalizeError(error);
		const fullContext: ErrorContext = {
			service: this.config.service,
			version: this.config.version,
			environment: this.config.environment,
			...context,
		};

		// Rate limiting
		if (this.isRateLimited(normalizedError.code)) {
			return;
		}

		const metrics: ErrorMetrics = {
			code: normalizedError.code,
			category: normalizedError.category,
			severity: normalizedError.severity,
			service: fullContext.service,
			timestamp: new Date().toISOString(),
			count: 1,
			context: {
				...fullContext,
				...normalizedError.context,
				message: normalizedError.message,
				stack: normalizedError.stack,
			},
		};

		this.addToBuffer(metrics);
		this.incrementCount(normalizedError.code);
		this.logError(normalizedError, fullContext);
	}

	/**
	 * Track a warning (lower severity than error)
	 */
	trackWarning(message: string, context?: Partial<ErrorContext>): void {
		if (!this.config.enabled) {
			return;
		}

		this.trackError(
			new WarningError(message, context as Record<string, unknown> | undefined),
			context,
		);
	}

	/**
	 * Get error statistics for the current period
	 */
	getErrorStats(): {
		totalErrors: number;
		errorsByCode: Record<string, number>;
		errorsByCategory: Record<string, number>;
		errorsBySeverity: Record<string, number>;
	} {
		const errorsByCode: Record<string, number> = {};
		const errorsByCategory: Record<string, number> = {};
		const errorsBySeverity: Record<string, number> = {};

		for (const [code, count] of this.errorCounts) {
			errorsByCode[code] = count;
		}

		for (const metrics of this.errorBuffer) {
			errorsByCategory[metrics.category] = (errorsByCategory[metrics.category] || 0) + 1;
			errorsBySeverity[metrics.severity] = (errorsBySeverity[metrics.severity] || 0) + 1;
		}

		return {
			totalErrors: this.errorCounts.size,
			errorsByCode,
			errorsByCategory,
			errorsBySeverity,
		};
	}

	/**
	 * Flush error buffer for external processing
	 */
	flushBuffer(): ErrorMetrics[] {
		const errors = [...this.errorBuffer];
		this.errorBuffer = [];
		return errors;
	}

	/**
	 * Check if error tracking is rate limited
	 */
	private isRateLimited(errorCode: string): boolean {
		const now = Date.now();
		const oneMinute = 60 * 1000;

		// Reset counter every minute
		if (now - this.lastReset > oneMinute) {
			this.errorCounts.clear();
			this.lastReset = now;
		}

		const currentCount = this.errorCounts.get(errorCode) || 0;
		return currentCount >= this.config.maxErrorsPerMinute;
	}

	/**
	 * Add error to buffer for processing
	 */
	private addToBuffer(metrics: ErrorMetrics): void {
		this.errorBuffer.push(metrics);

		// Keep buffer size manageable
		if (this.errorBuffer.length > this.maxBufferSize) {
			this.errorBuffer = this.errorBuffer.slice(-this.maxBufferSize);
		}
	}

	/**
	 * Increment error count for rate limiting
	 */
	private incrementCount(errorCode: string): void {
		const current = this.errorCounts.get(errorCode) || 0;
		this.errorCounts.set(errorCode, current + 1);
	}

	/**
	 * Log error with appropriate level based on severity
	 */
	private logError(error: QNSPError, context: ErrorContext): void {
		const logLevel = this.getLogLevel(error);
		const logData = {
			error: error.toSerializable(),
			context,
			timestamp: new Date().toISOString(),
		};

		switch (logLevel) {
			case "error":
				console.error("[ERROR]", JSON.stringify(logData, null, 2));
				break;
			case "warn":
				console.warn("[WARN]", JSON.stringify(logData, null, 2));
				break;
			case "info":
				console.info("[INFO]", JSON.stringify(logData, null, 2));
				break;
			default:
				console.log("[LOG]", JSON.stringify(logData, null, 2));
		}
	}

	/**
	 * Determine log level based on error severity
	 */
	private getLogLevel(error: QNSPError): "error" | "warn" | "info" | "debug" {
		if (error.category === "SECURITY" || error.severity === "CRITICAL") {
			return "error";
		}

		if (error.severity === "HIGH" || error.category === "SYSTEM") {
			return "error";
		}

		if (error.isWarning?.() || error.category === "USER" || error.category === "VALIDATION") {
			return "warn";
		}

		return "info";
	}
}

/**
 * Global error tracker instance
 */
let globalErrorTracker: ErrorTracker | null = null;

/**
 * Initialize global error tracking
 */
export function initializeErrorTracking(config: ErrorTrackingConfig): void {
	globalErrorTracker = new ErrorTracker(config);
}

/**
 * Get the global error tracker instance
 */
export function getErrorTracker(): ErrorTracker {
	if (!globalErrorTracker) {
		throw new Error("Error tracking not initialized. Call initializeErrorTracking() first.");
	}
	return globalErrorTracker;
}

/**
 * Convenience function to track errors globally
 */
export function trackError(error: unknown, context?: Partial<ErrorContext>): void {
	if (globalErrorTracker) {
		globalErrorTracker.trackError(error, context);
	}
}

/**
 * Convenience function to track warnings globally
 */
export function trackWarning(message: string, context?: Partial<ErrorContext>): void {
	if (globalErrorTracker) {
		globalErrorTracker.trackWarning(message, context);
	}
}

/**
 * Express/HTTP middleware for error tracking
 */
export function errorTrackingMiddleware(getServiceName: () => string, getRequestId?: () => string) {
	type RequestLike = {
		tenantId?: string;
		userId?: string;
	};
	return (error: unknown, req: RequestLike, _res: unknown, next: (err?: unknown) => unknown) => {
		const requestId = getRequestId?.();
		const context: Partial<ErrorContext> = {
			service: getServiceName(),
			...(requestId !== undefined ? { requestId } : {}),
			...(req.tenantId !== undefined ? { tenantId: req.tenantId } : {}),
			...(req.userId !== undefined ? { userId: req.userId } : {}),
		};

		trackError(error, context);
		next(error);
	};
}

/**
 * Async function wrapper with automatic error tracking
 */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
	fn: T,
	context?: Partial<ErrorContext>,
): T {
	return (async (...args: Parameters<T>) => {
		try {
			return await fn(...args);
		} catch (error) {
			trackError(error, context);
			throw error;
		}
	}) as T;
}
