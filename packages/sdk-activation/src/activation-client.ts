/**
 * SDK Activation Client
 *
 * Handles activation handshake with the QNSP billing-service.
 * Browser-compatible — uses global fetch, no node: imports.
 *
 * Every SDK must call `activateSdk()` before performing operations.
 * The activation validates the API key against the QNSP backend,
 * returns tier limits, and issues a short-lived activation token.
 *
 * Activation tokens are cached in-memory and auto-refreshed before expiry.
 *
 * @module
 */

import {
	type SdkActivationError,
	SdkActivationErrorSchema,
	type SdkActivationLimits,
	type SdkActivationRequest,
	type SdkActivationResponse,
	SdkActivationResponseSchema,
	type SdkIdentifier,
} from "./types.js";

const ACTIVATION_PATH = "/billing/v1/sdk/activate";
const DEFAULT_PLATFORM_URL = "https://api.qnsi.heossi.com";
const ACTIVATION_TIMEOUT_MS = 15_000;
const REFRESH_BUFFER_SECONDS = 300; // Refresh 5 minutes before expiry

/**
 * Typed error for SDK activation failures.
 */
export class SdkActivationError_ extends Error {
	readonly code: SdkActivationError["code"];
	readonly statusCode: number;

	constructor(code: SdkActivationError["code"], message: string, statusCode: number) {
		super(message);
		this.name = "SdkActivationError";
		this.code = code;
		this.statusCode = statusCode;
	}
}

/**
 * Cached activation state.
 */
interface ActivationState {
	readonly response: SdkActivationResponse;
	readonly expiresAt: number; // Unix timestamp in ms
}

/**
 * Configuration for SDK activation.
 */
export interface SdkActivationConfig {
	/** QNSP API key (required — get one at https://cloud.qnsi.heossi.com/auth?mode=signup) */
	readonly apiKey: string;
	/** SDK package identifier */
	readonly sdkId: SdkIdentifier;
	/** SDK version string */
	readonly sdkVersion: string;
	/** Override platform URL (defaults to https://api.qnsi.heossi.com) */
	readonly platformUrl?: string | undefined;
	/** Override activation timeout in ms (defaults to 15000) */
	readonly timeoutMs?: number | undefined;
	/** Custom fetch implementation (for testing or non-standard runtimes) */
	readonly fetchImpl?: (typeof globalThis)["fetch"] | undefined;
}

/** In-memory activation cache keyed by `${platformUrl}:${apiKeyPrefix}:${sdkId}` */
const activationCache = new Map<string, ActivationState>();

function cacheKey(config: SdkActivationConfig): string {
	const url = config.platformUrl ?? DEFAULT_PLATFORM_URL;
	// Use first 8 chars of API key for cache key (avoid storing full key in memory map keys)
	const keyPrefix = config.apiKey.slice(0, 8);
	return `${url}:${keyPrefix}:${config.sdkId}`;
}

function detectRuntime(): "browser" | "node" | "edge" {
	if (typeof globalThis.process !== "undefined" && globalThis.process.versions?.node) {
		return "node";
	}
	if ("window" in globalThis && "document" in globalThis) {
		return "browser";
	}
	return "edge";
}

/**
 * Activate an SDK against the QNSP platform.
 *
 * This must be called before any SDK operations. It validates the API key,
 * returns the tenant's tier and limits, and caches the activation token.
 *
 * Cached activations are returned immediately if still valid.
 * Tokens are auto-refreshed 5 minutes before expiry.
 *
 * @throws {SdkActivationError_} if the API key is invalid, account is suspended, or service is unavailable
 */
export async function activateSdk(config: SdkActivationConfig): Promise<SdkActivationResponse> {
	if (!config.apiKey || config.apiKey.trim().length === 0) {
		throw new SdkActivationError_(
			"INVALID_API_KEY",
			`QNSP ${config.sdkId}: apiKey is required. ` +
				"Get your free API key at https://cloud.qnsi.heossi.com/auth?mode=signup — " +
				"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
				`Docs: https://docs.qnsi.heossi.com/sdk/${config.sdkId}`,
			401,
		);
	}

	const key = cacheKey(config);
	const cached = activationCache.get(key);
	const now = Date.now();

	// Return cached activation if still valid (with refresh buffer)
	if (cached && cached.expiresAt - REFRESH_BUFFER_SECONDS * 1000 > now) {
		return cached.response;
	}

	const platformUrl = (config.platformUrl ?? DEFAULT_PLATFORM_URL).replace(/\/$/, "");
	const timeoutMs = config.timeoutMs ?? ACTIVATION_TIMEOUT_MS;
	const fetchFn = config.fetchImpl ?? globalThis.fetch;

	const body: SdkActivationRequest = {
		sdkId: config.sdkId,
		sdkVersion: config.sdkVersion,
		runtime: detectRuntime(),
	};

	let response: Response;
	try {
		response = await fetchFn(`${platformUrl}${ACTIVATION_PATH}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${config.apiKey}`,
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (cause) {
		throw new SdkActivationError_(
			"SERVICE_UNAVAILABLE",
			`QNSP ${config.sdkId}: Failed to reach QNSP platform for activation. ` +
				`Ensure network connectivity to ${platformUrl}. ` +
				`Error: ${cause instanceof Error ? cause.message : String(cause)}`,
			503,
		);
	}

	if (!response.ok) {
		let errorBody: SdkActivationError | undefined;
		try {
			const json: unknown = await response.json();
			const parsed = SdkActivationErrorSchema.safeParse(json);
			if (parsed.success) {
				errorBody = parsed.data;
			}
		} catch {
			// Ignore JSON parse errors — use status code
		}

		if (errorBody) {
			throw new SdkActivationError_(errorBody.code, errorBody.error, response.status);
		}

		if (response.status === 401) {
			throw new SdkActivationError_(
				"INVALID_API_KEY",
				`QNSP ${config.sdkId}: Invalid API key. ` +
					"Get your API key at https://cloud.qnsi.heossi.com/api-keys",
				401,
			);
		}

		if (response.status === 429) {
			throw new SdkActivationError_(
				"RATE_LIMITED",
				`QNSP ${config.sdkId}: Activation rate limited. Please retry after a short delay.`,
				429,
			);
		}

		throw new SdkActivationError_(
			"SERVICE_UNAVAILABLE",
			`QNSP ${config.sdkId}: Activation failed with HTTP ${response.status}`,
			response.status,
		);
	}

	const json: unknown = await response.json();
	const parsed = SdkActivationResponseSchema.safeParse(json);
	if (!parsed.success) {
		throw new SdkActivationError_(
			"SERVICE_UNAVAILABLE",
			`QNSP ${config.sdkId}: Invalid activation response from platform`,
			502,
		);
	}

	const activation = parsed.data;

	// Cache the activation
	activationCache.set(key, {
		response: activation,
		expiresAt: now + activation.expiresInSeconds * 1000,
	});

	return activation;
}

/**
 * Get the cached activation for an SDK, or null if not activated.
 */
export function getCachedActivation(config: SdkActivationConfig): SdkActivationResponse | null {
	const key = cacheKey(config);
	const cached = activationCache.get(key);
	if (!cached) return null;
	if (cached.expiresAt < Date.now()) {
		activationCache.delete(key);
		return null;
	}
	return cached.response;
}

/**
 * Get the tier limits from a cached activation.
 */
export function getActivationLimits(config: SdkActivationConfig): SdkActivationLimits | null {
	const activation = getCachedActivation(config);
	return activation?.limits ?? null;
}

/**
 * Clear all cached activations. Primarily for testing.
 */
export function clearActivationCache(): void {
	activationCache.clear();
}
