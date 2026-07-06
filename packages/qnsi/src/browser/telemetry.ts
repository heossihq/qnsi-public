/**
 * Browser SDK Telemetry
 *
 * Lightweight, privacy-respecting telemetry for the @heossi/qnsi-browser.
 * Tracks usage patterns (algorithm choices, operation counts, errors) without
 * collecting PII or cryptographic material.
 *
 * Telemetry is opt-in: callers must explicitly configure a handler via
 * `configureTelemetry()`. No data is sent anywhere by default.
 *
 * @module
 */

import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";

/**
 * A single telemetry event emitted by the browser-sdk.
 */
export interface BrowserSdkTelemetryEvent {
	/** Operation type: "encrypt", "decrypt", "sign", "verify", "keygen", "init" */
	readonly operation: string;
	/** PQC algorithm used (e.g., "kyber-768", "dilithium-3") */
	readonly algorithm: string;
	/** Duration of the operation in milliseconds */
	readonly durationMs: number;
	/** Whether the operation succeeded */
	readonly success: boolean;
	/** Error message if the operation failed (no stack traces) */
	readonly error?: string;
	/** Runtime environment: "browser", "node", "edge" */
	readonly runtime: string;
	/** ISO 8601 timestamp */
	readonly timestamp: string;
	/** SDK version */
	readonly sdkVersion: string;
}

/**
 * Configuration for browser-sdk telemetry.
 */
export interface BrowserSdkTelemetryConfig {
	/**
	 * Whether telemetry is enabled. Defaults to false.
	 * When false, no events are recorded or emitted.
	 */
	readonly enabled: boolean;

	/**
	 * Custom handler invoked for each telemetry event.
	 * Use this to send events to your analytics backend, log them, or batch them.
	 *
	 * The handler receives a single event and should not throw.
	 * If the handler throws, the error is silently ignored to avoid
	 * disrupting cryptographic operations.
	 */
	readonly onEvent: (event: BrowserSdkTelemetryEvent) => void;

	/**
	 * Optional flush handler invoked when `flushTelemetry()` is called.
	 * Use this to send any batched events to your backend.
	 */
	readonly onFlush?: () => void | Promise<void>;
}

let telemetryConfig: BrowserSdkTelemetryConfig | null = null;

/**
 * Configure telemetry for the browser-sdk.
 *
 * @example
 * ```ts
 * configureTelemetry({
 *   enabled: true,
 *   onEvent: (event) => {
 *     // Send to your analytics endpoint
 *     navigator.sendBeacon("/analytics", JSON.stringify(event));
 *   },
 * });
 * ```
 */
export function configureTelemetry(config: BrowserSdkTelemetryConfig): void {
	telemetryConfig = config;
}

/**
 * Get the current telemetry configuration.
 * Returns null if telemetry has not been configured.
 */
export function getTelemetryConfig(): BrowserSdkTelemetryConfig | null {
	return telemetryConfig;
}

/**
 * Check if telemetry is currently enabled.
 */
export function isTelemetryEnabled(): boolean {
	return telemetryConfig?.enabled ?? false;
}

/**
 * Record a telemetry event. No-op if telemetry is not configured or disabled.
 *
 * This function never throws — errors in the telemetry handler are silently
 * swallowed to avoid disrupting cryptographic operations.
 */
export function recordTelemetryEvent(
	operation: string,
	algorithm: string,
	durationMs: number,
	success: boolean,
	runtime: string,
	error?: string,
): void {
	if (!telemetryConfig?.enabled) {
		return;
	}

	const event: BrowserSdkTelemetryEvent = {
		operation,
		algorithm,
		durationMs,
		success,
		runtime,
		timestamp: new Date().toISOString(),
		sdkVersion: SDK_PACKAGE_VERSION,
		...(error !== undefined ? { error } : {}),
	};

	try {
		telemetryConfig.onEvent(event);
	} catch {
		// Silently ignore telemetry handler errors
	}
}

/**
 * Flush any batched telemetry events. No-op if telemetry is not configured,
 * disabled, or no flush handler is set.
 */
export async function flushTelemetry(): Promise<void> {
	if (!telemetryConfig?.enabled || !telemetryConfig.onFlush) {
		return;
	}

	try {
		await telemetryConfig.onFlush();
	} catch {
		// Silently ignore flush errors
	}
}

/**
 * Reset telemetry configuration. Primarily for testing.
 */
export function resetTelemetry(): void {
	telemetryConfig = null;
}
