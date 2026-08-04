/**
 * `@heossihq/qnsi/browser` - browser-compatible PQC encryption subpath.
 *
 * Client-side encryption (CSE), digital signatures, and key management
 * using NIST FIPS 203/204/205 standards via @noble/post-quantum.
 *
 * No native dependencies. No `node:` imports. Works in browsers, Deno,
 * Bun, and Node.js. Folded in from the former standalone
 * `@heossihq/qnsi-browser` package (2026-05-16) so there is one install.
 *
 * Supported algorithms:
 * - ML-KEM (FIPS 203): kyber-512, kyber-768, kyber-1024 - key encapsulation
 * - ML-DSA (FIPS 204): dilithium-2, dilithium-3, dilithium-5 - digital signatures
 * - SLH-DSA (FIPS 205): 12 parameter sets - hash-based signatures
 *
 * @example
 * ```ts
 * import {
 *   initializePqcProvider,
 *   encryptBeforeUpload,
 *   decryptAfterDownload,
 * } from "@heossihq/qnsi/browser";
 *
 * await initializePqcProvider();
 * const { publicKey, privateKey } = await generateEncryptionKeyPair("kyber-768");
 * const envelope = await encryptBeforeUpload(plaintext, publicKey, "kyber-768");
 * const decrypted = await decryptAfterDownload(envelope, privateKey);
 * ```
 *
 * @module
 */

// SDK activation types (folded-in copy - was @heossihq/qnsi-sdk-activation,
// now the @heossihq/qnsi/activation subpath / internal ../_activation).
export type {
	SdkActivationConfig,
	SdkActivationLimits,
	SdkActivationResponse,
	SdkIdentifier,
} from "../_activation/index.js";
export { SdkActivationError_ } from "../_activation/index.js";
// Client-side encryption (CSE) helpers
export {
	type CseEnvelope,
	decryptAfterDownload,
	deserializeCseEnvelope,
	encryptBeforeUpload,
	serializeCseEnvelope,
} from "./encrypt.js";
// Re-export core types for convenience
export type { PqcAlgorithm, PqcKeyPair, PqcProvider } from "./pqc-types.js";
// Provider setup and auto-detection
export {
	detectRuntime,
	getActiveProvider,
	getLastActivation,
	getSupportedAlgorithms,
	type InitializePqcProviderOptions,
	initializePqcProvider,
	isProviderInitialized,
	NOBLE_SUPPORTED_ALGORITHMS,
	type RuntimeEnvironment,
	resetProvider,
} from "./provider-setup.js";
// Digital signature helpers
export {
	generateEncryptionKeyPair,
	generateSigningKeyPair,
	type SignedEnvelope,
	signData,
	verifySignature,
} from "./sign.js";
// Telemetry hooks (opt-in, no PII)
export {
	type BrowserSdkTelemetryConfig,
	type BrowserSdkTelemetryEvent,
	configureTelemetry,
	flushTelemetry,
	getTelemetryConfig,
	isTelemetryEnabled,
	recordTelemetryEvent,
	resetTelemetry,
} from "./telemetry.js";
