/**
 * PQC digital signature helpers for browser-side operations.
 *
 * Supports:
 * - ML-DSA (FIPS 204): dilithium-2, dilithium-3, dilithium-5
 * - SLH-DSA (FIPS 205): all 12 parameter sets (SHA-2 and SHAKE variants)
 *
 * No node: imports. Works in browsers, Deno, Bun, and Node.js 20+.
 *
 * @module
 */

import type { PqcAlgorithm } from "./pqc-types.js";
import { getActiveProvider } from "./provider-setup.js";

/** Signature algorithms supported by the noble provider. */
const SIG_ALGORITHMS = new Set<string>([
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
 * Signed data envelope containing the signature and metadata.
 */
export interface SignedEnvelope {
	/** PQC algorithm used for signing. */
	readonly algorithm: PqcAlgorithm;
	/** The digital signature bytes. */
	readonly signature: Uint8Array;
	/** The original data that was signed. */
	readonly data: Uint8Array;
}

/**
 * Sign data using a PQC signature algorithm.
 *
 * @param data - Data to sign
 * @param privateKey - Signer's PQC private key
 * @param algorithm - Signature algorithm (ML-DSA or SLH-DSA)
 * @returns Signed envelope containing signature + original data
 */
export async function signData(
	data: Uint8Array,
	privateKey: Uint8Array,
	algorithm: PqcAlgorithm,
): Promise<SignedEnvelope> {
	if (!SIG_ALGORITHMS.has(algorithm)) {
		throw new Error(
			`Algorithm '${algorithm}' is not a supported signature algorithm. ` +
				`Supported: ${[...SIG_ALGORITHMS].join(", ")}`,
		);
	}

	if (data.length === 0) {
		throw new Error("Data must not be empty");
	}

	if (privateKey.length === 0) {
		throw new Error("Private key must not be empty");
	}

	const provider = getActiveProvider();

	const { signature } = await provider.sign({
		algorithm,
		data,
		privateKey,
	});

	return {
		algorithm,
		signature: new Uint8Array(signature),
		data: new Uint8Array(data),
	};
}

/**
 * Verify a PQC digital signature.
 *
 * @param data - Original data that was signed
 * @param signature - The signature to verify
 * @param publicKey - Signer's PQC public key
 * @param algorithm - Signature algorithm used
 * @returns true if the signature is valid, false otherwise
 */
export async function verifySignature(
	data: Uint8Array,
	signature: Uint8Array,
	publicKey: Uint8Array,
	algorithm: PqcAlgorithm,
): Promise<boolean> {
	if (!SIG_ALGORITHMS.has(algorithm)) {
		throw new Error(
			`Algorithm '${algorithm}' is not a supported signature algorithm. ` +
				`Supported: ${[...SIG_ALGORITHMS].join(", ")}`,
		);
	}

	if (data.length === 0) {
		throw new Error("Data must not be empty");
	}

	if (signature.length === 0) {
		throw new Error("Signature must not be empty");
	}

	if (publicKey.length === 0) {
		throw new Error("Public key must not be empty");
	}

	const provider = getActiveProvider();

	return provider.verify({
		algorithm,
		data,
		signature,
		publicKey,
	});
}

/**
 * Generate a PQC key pair for signing operations.
 *
 * @param algorithm - Signature algorithm (ML-DSA or SLH-DSA)
 * @returns Key pair with public and private keys
 */
export async function generateSigningKeyPair(algorithm: PqcAlgorithm): Promise<{
	readonly publicKey: Uint8Array;
	readonly privateKey: Uint8Array;
	readonly algorithm: PqcAlgorithm;
}> {
	if (!SIG_ALGORITHMS.has(algorithm)) {
		throw new Error(
			`Algorithm '${algorithm}' is not a supported signature algorithm. ` +
				`Supported: ${[...SIG_ALGORITHMS].join(", ")}`,
		);
	}

	const provider = getActiveProvider();
	const { keyPair } = await provider.generateKeyPair({ algorithm });
	return keyPair;
}

/**
 * Generate a PQC key pair for KEM (encryption) operations.
 *
 * @param algorithm - KEM algorithm (kyber-512, kyber-768, kyber-1024)
 * @returns Key pair with public and private keys
 */
export async function generateEncryptionKeyPair(algorithm: PqcAlgorithm): Promise<{
	readonly publicKey: Uint8Array;
	readonly privateKey: Uint8Array;
	readonly algorithm: PqcAlgorithm;
}> {
	const KEM_ALGORITHMS = new Set<string>(["kyber-512", "kyber-768", "kyber-1024"]);
	if (!KEM_ALGORITHMS.has(algorithm)) {
		throw new Error(
			`Algorithm '${algorithm}' is not a supported KEM algorithm. ` +
				`Supported: ${[...KEM_ALGORITHMS].join(", ")}`,
		);
	}

	const provider = getActiveProvider();
	const { keyPair } = await provider.generateKeyPair({ algorithm });
	return keyPair;
}
