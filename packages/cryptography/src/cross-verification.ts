/**
 * Cross-Verification Service
 *
 * Provides dual-provider verification for cryptographic operations.
 * Uses noble (pure JS, FIPS-only) as a secondary provider to cross-verify
 * results from liboqs (native C) for the 18 overlapping FIPS algorithms.
 *
 * Cross-verification is required for:
 * - Enterprise tiers: signature verification on critical operations
 * - Government tier: all signature and KEM operations must be dual-verified
 *
 * The 18 overlapping algorithms (noble ∩ liboqs):
 *   KEM: kyber-512, kyber-768, kyber-1024
 *   SIG: dilithium-2, dilithium-3, dilithium-5,
 *        sphincs-sha2-{128,192,256}{f,s}-simple,
 *        sphincs-shake-{128,192,256}{f,s}-simple
 *
 * @version 1.0.0
 * @lastUpdated 2026-03-12
 */

import type { PqcAlgorithm, PqcProvider } from "./provider.js";
import { getPqcProviderMetadata } from "./provider.js";
import {
	type CryptoOperationType,
	createProviderAttestation,
	type ProviderAttestation,
} from "./provider-attestation.js";

// =============================================================================
// CROSS-VERIFIABLE ALGORITHMS
// =============================================================================

/**
 * Algorithms supported by both liboqs and noble.
 * These are the only algorithms eligible for cross-verification.
 * Source: packages/cryptography/src/providers/noble.ts KEM_INSTANCES + SIG_INSTANCES
 */
const CROSS_VERIFIABLE_KEM_ALGORITHMS: ReadonlySet<string> = new Set([
	"kyber-512",
	"kyber-768",
	"kyber-1024",
]);

const CROSS_VERIFIABLE_SIGNATURE_ALGORITHMS: ReadonlySet<string> = new Set([
	"dilithium-2",
	"dilithium-3",
	"dilithium-5",
	"sphincs-sha2-128f-simple",
	"sphincs-sha2-128s-simple",
	"sphincs-sha2-192f-simple",
	"sphincs-sha2-192s-simple",
	"sphincs-sha2-256f-simple",
	"sphincs-sha2-256s-simple",
	"sphincs-shake-128f-simple",
	"sphincs-shake-128s-simple",
	"sphincs-shake-192f-simple",
	"sphincs-shake-192s-simple",
	"sphincs-shake-256f-simple",
	"sphincs-shake-256s-simple",
]);

/**
 * Check if an algorithm can be cross-verified (supported by both liboqs and noble).
 */
export function isCrossVerifiable(algorithm: string): boolean {
	return (
		CROSS_VERIFIABLE_KEM_ALGORITHMS.has(algorithm) ||
		CROSS_VERIFIABLE_SIGNATURE_ALGORITHMS.has(algorithm)
	);
}

/**
 * Check if an algorithm is a cross-verifiable KEM algorithm.
 */
export function isCrossVerifiableKem(algorithm: string): boolean {
	return CROSS_VERIFIABLE_KEM_ALGORITHMS.has(algorithm);
}

/**
 * Check if an algorithm is a cross-verifiable signature algorithm.
 */
export function isCrossVerifiableSignature(algorithm: string): boolean {
	return CROSS_VERIFIABLE_SIGNATURE_ALGORITHMS.has(algorithm);
}

/**
 * Get all cross-verifiable algorithms.
 */
export function getCrossVerifiableAlgorithms(): readonly string[] {
	return [...CROSS_VERIFIABLE_KEM_ALGORITHMS, ...CROSS_VERIFIABLE_SIGNATURE_ALGORITHMS];
}

// =============================================================================
// CROSS-VERIFICATION RESULT
// =============================================================================

export interface CrossVerificationResult {
	/** Whether the cross-verification passed */
	readonly verified: boolean;
	/** Primary provider name */
	readonly primaryProvider: string;
	/** Secondary (cross-verification) provider name */
	readonly secondaryProvider: string;
	/** Algorithm used */
	readonly algorithm: string;
	/** Operation that was cross-verified */
	readonly operation: CryptoOperationType;
	/** Attestation record for audit trail */
	readonly attestation: ProviderAttestation;
	/** Error message if verification failed */
	readonly error?: string | undefined;
}

// =============================================================================
// CROSS-VERIFICATION SERVICE
// =============================================================================

export interface CrossVerificationServiceOptions {
	/** Primary provider (typically liboqs) */
	readonly primaryProvider: PqcProvider;
	/** Primary provider name for attestation */
	readonly primaryProviderName: string;
	/** Secondary provider (typically noble) for cross-verification */
	readonly secondaryProvider: PqcProvider;
	/** Secondary provider name for attestation */
	readonly secondaryProviderName: string;
}

/**
 * Service that performs dual-provider cross-verification of cryptographic operations.
 *
 * For signature operations: signs with primary, verifies with secondary.
 * For KEM operations: cross-verification is limited to verify-only
 * (encapsulate/decapsulate use ephemeral randomness so outputs differ by design).
 */
export class CrossVerificationService {
	private readonly primary: PqcProvider;
	private readonly primaryName: string;
	private readonly secondary: PqcProvider;
	private readonly secondaryName: string;

	constructor(options: CrossVerificationServiceOptions) {
		this.primary = options.primaryProvider;
		this.primaryName = options.primaryProviderName;
		this.secondary = options.secondaryProvider;
		this.secondaryName = options.secondaryProviderName;
	}

	/**
	 * Cross-verify a signature: sign with primary provider, verify with secondary.
	 * This proves both providers agree on the signature's validity.
	 */
	async crossVerifySignature(params: {
		readonly algorithm: PqcAlgorithm;
		readonly data: Uint8Array;
		readonly privateKey: Uint8Array;
		readonly publicKey: Uint8Array;
	}): Promise<CrossVerificationResult> {
		if (!isCrossVerifiableSignature(params.algorithm)) {
			return this.buildNonVerifiableResult(params.algorithm, "sign");
		}

		try {
			// Sign with primary provider
			const { signature } = await this.primary.sign({
				algorithm: params.algorithm,
				data: params.data,
				privateKey: params.privateKey,
			});

			// Verify with secondary provider
			const secondaryValid = await this.secondary.verify({
				algorithm: params.algorithm,
				data: params.data,
				signature,
				publicKey: params.publicKey,
			});

			const result: "match" | "mismatch" = secondaryValid ? "match" : "mismatch";

			return {
				verified: secondaryValid,
				primaryProvider: this.primaryName,
				secondaryProvider: this.secondaryName,
				algorithm: params.algorithm,
				operation: "sign",
				attestation: createProviderAttestation({
					providerName: this.primaryName,
					providerMetadata: getPqcProviderMetadata(this.primaryName),
					algorithm: params.algorithm,
					operation: "sign",
					crossVerification: {
						providerName: this.secondaryName,
						result,
					},
				}),
				...(!secondaryValid
					? {
							error: `Cross-verification failed: ${this.secondaryName} rejected signature from ${this.primaryName}`,
						}
					: {}),
			};
		} catch (error) {
			return {
				verified: false,
				primaryProvider: this.primaryName,
				secondaryProvider: this.secondaryName,
				algorithm: params.algorithm,
				operation: "sign",
				attestation: createProviderAttestation({
					providerName: this.primaryName,
					providerMetadata: getPqcProviderMetadata(this.primaryName),
					algorithm: params.algorithm,
					operation: "sign",
					crossVerification: {
						providerName: this.secondaryName,
						result: "mismatch",
					},
				}),
				error: `Cross-verification error: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	/**
	 * Cross-verify a signature verification: verify the same signature with both providers.
	 * This proves both providers agree on whether a signature is valid.
	 */
	async crossVerifyVerification(params: {
		readonly algorithm: PqcAlgorithm;
		readonly data: Uint8Array;
		readonly signature: Uint8Array;
		readonly publicKey: Uint8Array;
	}): Promise<CrossVerificationResult> {
		if (!isCrossVerifiableSignature(params.algorithm)) {
			return this.buildNonVerifiableResult(params.algorithm, "verify");
		}

		try {
			const [primaryValid, secondaryValid] = await Promise.all([
				this.primary.verify({
					algorithm: params.algorithm,
					data: params.data,
					signature: params.signature,
					publicKey: params.publicKey,
				}),
				this.secondary.verify({
					algorithm: params.algorithm,
					data: params.data,
					signature: params.signature,
					publicKey: params.publicKey,
				}),
			]);

			const agree = primaryValid === secondaryValid;
			const result: "match" | "mismatch" = agree ? "match" : "mismatch";

			return {
				verified: agree,
				primaryProvider: this.primaryName,
				secondaryProvider: this.secondaryName,
				algorithm: params.algorithm,
				operation: "verify",
				attestation: createProviderAttestation({
					providerName: this.primaryName,
					providerMetadata: getPqcProviderMetadata(this.primaryName),
					algorithm: params.algorithm,
					operation: "verify",
					crossVerification: {
						providerName: this.secondaryName,
						result,
					},
				}),
				...(!agree
					? {
							error: `Cross-verification mismatch: ${this.primaryName}=${String(primaryValid)}, ${this.secondaryName}=${String(secondaryValid)}`,
						}
					: {}),
			};
		} catch (error) {
			return {
				verified: false,
				primaryProvider: this.primaryName,
				secondaryProvider: this.secondaryName,
				algorithm: params.algorithm,
				operation: "verify",
				attestation: createProviderAttestation({
					providerName: this.primaryName,
					providerMetadata: getPqcProviderMetadata(this.primaryName),
					algorithm: params.algorithm,
					operation: "verify",
					crossVerification: {
						providerName: this.secondaryName,
						result: "mismatch",
					},
				}),
				error: `Cross-verification error: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	/**
	 * Build a result for algorithms that cannot be cross-verified
	 * (not supported by the secondary provider).
	 */
	private buildNonVerifiableResult(
		algorithm: string,
		operation: CryptoOperationType,
	): CrossVerificationResult {
		return {
			verified: false,
			primaryProvider: this.primaryName,
			secondaryProvider: this.secondaryName,
			algorithm,
			operation,
			attestation: createProviderAttestation({
				providerName: this.primaryName,
				providerMetadata: getPqcProviderMetadata(this.primaryName),
				algorithm: algorithm as PqcAlgorithm,
				operation,
			}),
			error: `Algorithm '${algorithm}' is not supported by ${this.secondaryName} - cross-verification not possible`,
		};
	}
}
