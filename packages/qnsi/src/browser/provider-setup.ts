/**
 * Provider auto-detection and registration for browser-sdk.
 *
 * In browser environments, uses a noble-backed provider (pure JS, 18 FIPS algorithms).
 * In Node.js environments, uses the same noble-backed provider for deterministic behavior.
 *
 * @module
 */

import { activateSdk, type SdkActivationResponse } from "../_activation/index.js";
import {
	createNobleProvider,
	createNobleProviderFactory,
	NOBLE_SUPPORTED_ALGORITHMS,
} from "./noble-provider.js";
import type { PqcAlgorithm, PqcProvider } from "./pqc-types.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";

/** Runtime environment detection result. */
export type RuntimeEnvironment = "browser" | "node" | "edge";

/** Options for initializing the PQC provider. */
export interface InitializePqcProviderOptions {
	/** QNSP API key — required. Get one at https://cloud.qnsi.heossi.com/signup */
	readonly apiKey: string;
	/** Optional subset of algorithms to enable. Defaults to all noble-supported. */
	readonly algorithms?: readonly PqcAlgorithm[] | undefined;
	/** Override platform URL (defaults to https://api.qnsi.heossi.com) */
	readonly platformUrl?: string | undefined;
}

/**
 * Detect the current runtime environment.
 *
 * - "browser": window/document available (standard browser)
 * - "edge": no window but no process.versions.node (Cloudflare Workers, Deno Deploy, Vercel Edge)
 * - "node": process.versions.node available (Node.js, Bun with node compat)
 */
export function detectRuntime(): RuntimeEnvironment {
	if (typeof globalThis.process !== "undefined" && globalThis.process.versions?.node) {
		return "node";
	}
	// Use string-based property check to avoid needing DOM lib types
	if ("window" in globalThis && "document" in globalThis) {
		return "browser";
	}
	return "edge";
}

let initialized = false;
let activeProvider: PqcProvider | null = null;
let lastActivation: SdkActivationResponse | null = null;

/**
 * Initialize the PQC provider for the current runtime.
 *
 * Requires a valid QNSP API key. The SDK activates against the QNSP platform
 * to validate the key and retrieve tier limits before enabling PQC operations.
 *
 * In browser/edge: always uses noble (pure JS, no native deps).
 * In Node.js: uses noble for deterministic behavior.
 *
 * @param options - Configuration including apiKey (required) and optional algorithm subset.
 * @returns The initialized PqcProvider instance.
 * @throws {SdkActivationError_} if the API key is invalid or activation fails.
 */
export async function initializePqcProvider(
	options: InitializePqcProviderOptions,
): Promise<PqcProvider> {
	if (activeProvider) {
		return activeProvider;
	}

	// Activate SDK against QNSP platform — validates API key, returns tier limits
	const activation = await activateSdk({
		apiKey: options.apiKey,
		sdkId: "browser-sdk",
		sdkVersion: SDK_PACKAGE_VERSION,
		platformUrl: options.platformUrl,
	});
	lastActivation = activation;

	const provider = createNobleProvider(
		options.algorithms ? { algorithms: options.algorithms } : undefined,
	);
	activeProvider = provider;
	initialized = true;
	return provider;
}

/**
 * Get the last SDK activation response (tier, limits, token).
 * Returns null if not yet activated.
 */
export function getLastActivation(): SdkActivationResponse | null {
	return lastActivation;
}

/**
 * Get the currently active PQC provider.
 * Throws if initializePqcProvider() has not been called.
 */
export function getActiveProvider(): PqcProvider {
	if (!activeProvider) {
		throw new Error("PQC provider not initialized. Call initializePqcProvider() first.");
	}
	return activeProvider;
}

/**
 * Check if the PQC provider has been initialized.
 */
export function isProviderInitialized(): boolean {
	return initialized;
}

/**
 * Reset the provider state. Primarily for testing.
 */
export function resetProvider(): void {
	activeProvider = null;
	initialized = false;
}

/**
 * Get the list of algorithms supported in the current environment.
 * In browser/edge: noble's 18 FIPS algorithms.
 * In Node.js: noble's 18 FIPS algorithms.
 */
export function getSupportedAlgorithms(): readonly PqcAlgorithm[] {
	return NOBLE_SUPPORTED_ALGORITHMS;
}

export { createNobleProviderFactory, NOBLE_SUPPORTED_ALGORITHMS };
