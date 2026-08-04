/**
 * Noble PQC Provider - browser-compatible PQC cryptographic operations.
 *
 * Implements the PqcProvider interface using @noble/post-quantum (pure JavaScript).
 * Supports all NIST FIPS finalized standards:
 *   - ML-KEM (FIPS 203): kyber-512, kyber-768, kyber-1024
 *   - ML-DSA (FIPS 204): dilithium-2, dilithium-3, dilithium-5
 *   - SLH-DSA (FIPS 205): all 12 parameter sets (SHA-2 and SHAKE variants)
 *
 * No native dependencies. No node: imports. Works in browsers, Deno, Bun, and Node.js.
 * Designed to be the browser-side counterpart to the liboqs provider (server-side).
 *
 * @module
 */

import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { sha3_256, sha3_512 } from "@noble/hashes/sha3.js";
import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import { ml_kem512, ml_kem768, ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import {
	slh_dsa_sha2_128f,
	slh_dsa_sha2_128s,
	slh_dsa_sha2_192f,
	slh_dsa_sha2_192s,
	slh_dsa_sha2_256f,
	slh_dsa_sha2_256s,
	slh_dsa_shake_128f,
	slh_dsa_shake_128s,
	slh_dsa_shake_192f,
	slh_dsa_shake_192s,
	slh_dsa_shake_256f,
	slh_dsa_shake_256s,
} from "@noble/post-quantum/slh-dsa.js";

import type {
	DecapsulateOptions,
	EncapsulateOptions,
	EncapsulationResult,
	GenerateKeyPairOptions,
	HashResult,
	PqcAlgorithm,
	PqcKeyPair,
	PqcProvider,
	SignatureResult,
	SignOptions,
	VerifyOptions,
} from "../provider.js";
import {
	type ExternalPqcProviderFactory,
	type ExternalPqcProviderInitOptions,
	registerExternalPqcProvider,
} from "./external.js";

/**
 * Noble KEM algorithm instances keyed by QNSP internal algorithm name.
 * Each value provides keygen, encapsulate, and decapsulate operations.
 */
interface NobleKemInstance {
	readonly keygen: (seed?: Uint8Array) => { publicKey: Uint8Array; secretKey: Uint8Array };
	readonly encapsulate: (
		publicKey: Uint8Array,
		msg?: Uint8Array,
	) => { cipherText: Uint8Array; sharedSecret: Uint8Array };
	readonly decapsulate: (cipherText: Uint8Array, secretKey: Uint8Array) => Uint8Array;
}

interface NobleSigInstance {
	readonly keygen: (seed?: Uint8Array) => { publicKey: Uint8Array; secretKey: Uint8Array };
	readonly sign: (message: Uint8Array, secretKey: Uint8Array) => Uint8Array;
	readonly verify: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) => boolean;
}

const KEM_INSTANCES: Readonly<Record<string, NobleKemInstance>> = {
	"kyber-512": ml_kem512,
	"kyber-768": ml_kem768,
	"kyber-1024": ml_kem1024,
};

const SIG_INSTANCES: Readonly<Record<string, NobleSigInstance>> = {
	"dilithium-2": ml_dsa44,
	"dilithium-3": ml_dsa65,
	"dilithium-5": ml_dsa87,
	"sphincs-sha2-128f-simple": slh_dsa_sha2_128f,
	"sphincs-sha2-128s-simple": slh_dsa_sha2_128s,
	"sphincs-sha2-192f-simple": slh_dsa_sha2_192f,
	"sphincs-sha2-192s-simple": slh_dsa_sha2_192s,
	"sphincs-sha2-256f-simple": slh_dsa_sha2_256f,
	"sphincs-sha2-256s-simple": slh_dsa_sha2_256s,
	"sphincs-shake-128f-simple": slh_dsa_shake_128f,
	"sphincs-shake-128s-simple": slh_dsa_shake_128s,
	"sphincs-shake-192f-simple": slh_dsa_shake_192f,
	"sphincs-shake-192s-simple": slh_dsa_shake_192s,
	"sphincs-shake-256f-simple": slh_dsa_shake_256f,
	"sphincs-shake-256s-simple": slh_dsa_shake_256s,
};

/**
 * All algorithms supported by the noble provider.
 * 3 KEM + 15 signature = 18 algorithms covering all NIST FIPS finalized standards.
 */
const NOBLE_SUPPORTED_ALGORITHMS: readonly PqcAlgorithm[] = [
	...Object.keys(KEM_INSTANCES),
	...Object.keys(SIG_INSTANCES),
] as PqcAlgorithm[];

/**
 * Hash function registry for the noble provider.
 * Uses @noble/hashes which is browser-compatible (no node: imports).
 */
const HASH_FUNCTIONS: Readonly<Record<string, (data: Uint8Array) => Uint8Array>> = {
	"sha-256": (data: Uint8Array) => sha256(data),
	sha256: (data: Uint8Array) => sha256(data),
	"sha-512": (data: Uint8Array) => sha512(data),
	sha512: (data: Uint8Array) => sha512(data),
	"sha3-256": (data: Uint8Array) => sha3_256(data),
	"sha3-512": (data: Uint8Array) => sha3_512(data),
};

const DEFAULT_HASH_ALGORITHM = "sha3-256";

function isKemAlgorithm(algorithm: string): algorithm is keyof typeof KEM_INSTANCES {
	return algorithm in KEM_INSTANCES;
}

function isSigAlgorithm(algorithm: string): algorithm is keyof typeof SIG_INSTANCES {
	return algorithm in SIG_INSTANCES;
}

function isSupportedAlgorithm(algorithm: string): boolean {
	return isKemAlgorithm(algorithm) || isSigAlgorithm(algorithm);
}

/**
 * Create a PqcProvider backed by @noble/post-quantum.
 *
 * This provider is browser-compatible (no node: imports, no native dependencies).
 * It supports all NIST FIPS finalized PQC standards:
 *   - ML-KEM (FIPS 203): key encapsulation
 *   - ML-DSA (FIPS 204): digital signatures
 *   - SLH-DSA (FIPS 205): hash-based signatures
 */
function createNobleProvider(allowed: ReadonlySet<PqcAlgorithm>): PqcProvider {
	const allowedAlgorithms = new Set(allowed);

	const ensureAllowed = (algorithm: PqcAlgorithm): void => {
		if (!allowedAlgorithms.has(algorithm)) {
			throw new Error(
				`Algorithm '${algorithm}' is not enabled for this noble provider. ` +
					`Enabled algorithms: ${[...allowedAlgorithms].join(", ")}`,
			);
		}
	};

	return {
		name: "noble",

		async generateKeyPair({
			algorithm,
			seed,
		}: GenerateKeyPairOptions): Promise<{ keyPair: PqcKeyPair }> {
			ensureAllowed(algorithm);

			if (isKemAlgorithm(algorithm)) {
				const instance = KEM_INSTANCES[algorithm];
				if (!instance) {
					throw new Error(`KEM algorithm '${algorithm}' not found in noble provider`);
				}
				const { publicKey, secretKey } = seed ? instance.keygen(seed) : instance.keygen();
				return {
					keyPair: {
						algorithm,
						publicKey: new Uint8Array(publicKey),
						privateKey: new Uint8Array(secretKey),
					},
				};
			}

			if (isSigAlgorithm(algorithm)) {
				const instance = SIG_INSTANCES[algorithm];
				if (!instance) {
					throw new Error(`Signature algorithm '${algorithm}' not found in noble provider`);
				}
				const { publicKey, secretKey } = seed ? instance.keygen(seed) : instance.keygen();
				return {
					keyPair: {
						algorithm,
						publicKey: new Uint8Array(publicKey),
						privateKey: new Uint8Array(secretKey),
					},
				};
			}

			throw new Error(
				`Algorithm '${algorithm}' is not supported by the noble provider. ` +
					`Supported algorithms: ${NOBLE_SUPPORTED_ALGORITHMS.join(", ")}`,
			);
		},

		async encapsulate({ algorithm, publicKey }: EncapsulateOptions): Promise<EncapsulationResult> {
			ensureAllowed(algorithm);

			if (!isKemAlgorithm(algorithm)) {
				throw new Error(`Algorithm '${algorithm}' is not a KEM algorithm in noble provider`);
			}

			const instance = KEM_INSTANCES[algorithm];
			if (!instance) {
				throw new Error(`KEM algorithm '${algorithm}' not found in noble provider`);
			}

			const { cipherText, sharedSecret } = instance.encapsulate(publicKey);
			return {
				ciphertext: new Uint8Array(cipherText),
				sharedSecret: new Uint8Array(sharedSecret),
			};
		},

		async decapsulate({
			algorithm,
			privateKey,
			ciphertext,
		}: DecapsulateOptions): Promise<Uint8Array> {
			ensureAllowed(algorithm);

			if (!isKemAlgorithm(algorithm)) {
				throw new Error(`Algorithm '${algorithm}' is not a KEM algorithm in noble provider`);
			}

			const instance = KEM_INSTANCES[algorithm];
			if (!instance) {
				throw new Error(`KEM algorithm '${algorithm}' not found in noble provider`);
			}

			return new Uint8Array(instance.decapsulate(ciphertext, privateKey));
		},

		async sign({ algorithm, data, privateKey }: SignOptions): Promise<SignatureResult> {
			ensureAllowed(algorithm);

			if (!isSigAlgorithm(algorithm)) {
				throw new Error(`Algorithm '${algorithm}' is not a signature algorithm in noble provider`);
			}

			const instance = SIG_INSTANCES[algorithm];
			if (!instance) {
				throw new Error(`Signature algorithm '${algorithm}' not found in noble provider`);
			}

			const signature = instance.sign(data, privateKey);
			return {
				signature: new Uint8Array(signature),
				algorithm,
			};
		},

		async verify({ algorithm, data, signature, publicKey }: VerifyOptions): Promise<boolean> {
			ensureAllowed(algorithm);

			if (!isSigAlgorithm(algorithm)) {
				throw new Error(`Algorithm '${algorithm}' is not a signature algorithm in noble provider`);
			}

			const instance = SIG_INSTANCES[algorithm];
			if (!instance) {
				throw new Error(`Signature algorithm '${algorithm}' not found in noble provider`);
			}

			return instance.verify(signature, data, publicKey);
		},

		async hash(data: Uint8Array, algorithm = DEFAULT_HASH_ALGORITHM): Promise<HashResult> {
			const hashFn = HASH_FUNCTIONS[algorithm];
			if (!hashFn) {
				throw new Error(
					`Hash algorithm '${algorithm}' is not supported by noble provider. ` +
						`Supported: ${Object.keys(HASH_FUNCTIONS).join(", ")}`,
				);
			}
			return {
				digest: hashFn(data),
				algorithm,
			};
		},
	};
}

/**
 * Validate requested algorithms against noble provider capabilities.
 * If no algorithms are requested, all supported algorithms are enabled.
 */
function validateRequestedAlgorithms(
	requested: readonly PqcAlgorithm[] | undefined,
): Set<PqcAlgorithm> {
	if (!requested || requested.length === 0) {
		return new Set(NOBLE_SUPPORTED_ALGORITHMS);
	}

	const result = new Set<PqcAlgorithm>();

	for (const algorithm of requested) {
		if (!isSupportedAlgorithm(algorithm)) {
			throw new Error(
				`Algorithm '${algorithm}' is not supported by the noble provider. ` +
					`Supported: ${NOBLE_SUPPORTED_ALGORITHMS.join(", ")}`,
			);
		}
		result.add(algorithm);
	}

	return result;
}

/**
 * Create the ExternalPqcProviderFactory for the noble provider.
 * The factory's probe() always returns true (pure JS, always available).
 */
export function createNobleProviderFactory(): ExternalPqcProviderFactory {
	return {
		metadata: {
			name: "noble",
			author: "Paul Miller (@paulmillr)",
			supportedAlgorithms: NOBLE_SUPPORTED_ALGORITHMS,
			version: "0.4.1",
			homepage: "https://github.com/paulmillr/noble-post-quantum",
		},
		probe: async () => true,
		create: async (options?: ExternalPqcProviderInitOptions) => {
			const allowed = validateRequestedAlgorithms(options?.algorithms);

			if (allowed.size === 0) {
				throw new Error("No noble algorithms are available with the current configuration");
			}

			return createNobleProvider(allowed);
		},
	};
}

export const nobleProviderFactory = createNobleProviderFactory();

/**
 * Register the noble provider in the external provider registry.
 * Call this to make the noble provider available via `initializeExternalPqcProvider("noble")`.
 */
export function registerNobleProvider(): void {
	registerExternalPqcProvider(nobleProviderFactory);
}

/**
 * List of all algorithms supported by the noble provider.
 */
export { NOBLE_SUPPORTED_ALGORITHMS };
