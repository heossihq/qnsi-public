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
import type { KEM, Signer } from "@noble/post-quantum/utils.js";

import type { PqcAlgorithm, PqcKeyPair, PqcProvider } from "./pqc-types.js";

export const NOBLE_SUPPORTED_ALGORITHMS: readonly PqcAlgorithm[] = [
	"kyber-512",
	"kyber-768",
	"kyber-1024",
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
];

const KEM_BY_ALG: Readonly<Record<string, KEM>> = {
	"kyber-512": ml_kem512,
	"kyber-768": ml_kem768,
	"kyber-1024": ml_kem1024,
} as const;

const SIGNER_BY_ALG: Readonly<Record<string, Signer>> = {
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
} as const;

function assertSupportedAlgorithm(
	algorithm: PqcAlgorithm,
	enabled: ReadonlySet<PqcAlgorithm>,
): void {
	if (!enabled.has(algorithm)) {
		throw new Error(
			`Algorithm '${algorithm}' is not enabled in this provider instance. Enabled: ${[...enabled].join(", ")}`,
		);
	}
}

function getKem(algorithm: PqcAlgorithm): KEM | undefined {
	return KEM_BY_ALG[algorithm];
}

function getSigner(algorithm: PqcAlgorithm): Signer | undefined {
	return SIGNER_BY_ALG[algorithm];
}

export function createNobleProvider(options?: {
	readonly algorithms?: readonly PqcAlgorithm[];
}): PqcProvider {
	const enabled = new Set<PqcAlgorithm>(options?.algorithms ?? NOBLE_SUPPORTED_ALGORITHMS);

	return {
		name: "noble",
		async generateKeyPair({ algorithm }): Promise<{ readonly keyPair: PqcKeyPair }> {
			assertSupportedAlgorithm(algorithm, enabled);
			const kem = getKem(algorithm);
			if (kem) {
				const kp = kem.keygen();
				return {
					keyPair: {
						algorithm,
						publicKey: kp.publicKey,
						privateKey: kp.secretKey,
					},
				};
			}
			const signer = getSigner(algorithm);
			if (!signer) {
				throw new Error(`Unsupported algorithm '${algorithm}'`);
			}
			const kp = signer.keygen();
			return {
				keyPair: {
					algorithm,
					publicKey: kp.publicKey,
					privateKey: kp.secretKey,
				},
			};
		},
		async encapsulate({
			algorithm,
			publicKey,
		}): Promise<{ readonly ciphertext: Uint8Array; readonly sharedSecret: Uint8Array }> {
			assertSupportedAlgorithm(algorithm, enabled);
			const kem = getKem(algorithm);
			if (!kem) {
				throw new Error(`Algorithm '${algorithm}' is not a KEM algorithm`);
			}
			const { cipherText, sharedSecret } = kem.encapsulate(publicKey);
			return { ciphertext: cipherText, sharedSecret };
		},
		async decapsulate({ algorithm, ciphertext, privateKey }): Promise<Uint8Array> {
			assertSupportedAlgorithm(algorithm, enabled);
			const kem = getKem(algorithm);
			if (!kem) {
				throw new Error(`Algorithm '${algorithm}' is not a KEM algorithm`);
			}
			return kem.decapsulate(ciphertext, privateKey);
		},
		async sign({ algorithm, data, privateKey }): Promise<{ readonly signature: Uint8Array }> {
			assertSupportedAlgorithm(algorithm, enabled);
			const signer = getSigner(algorithm);
			if (!signer) {
				throw new Error(`Algorithm '${algorithm}' is not a signature algorithm`);
			}
			return { signature: signer.sign(data, privateKey) };
		},
		async verify({ algorithm, data, signature, publicKey }): Promise<boolean> {
			assertSupportedAlgorithm(algorithm, enabled);
			const signer = getSigner(algorithm);
			if (!signer) {
				throw new Error(`Algorithm '${algorithm}' is not a signature algorithm`);
			}
			return signer.verify(signature, data, publicKey);
		},
	};
}

export function createNobleProviderFactory() {
	return async (options?: {
		readonly algorithms?: readonly PqcAlgorithm[];
	}): Promise<PqcProvider> => {
		return createNobleProvider(options);
	};
}

export function registerNobleProvider(): void {
	// no-op; kept for backwards compatibility
}
