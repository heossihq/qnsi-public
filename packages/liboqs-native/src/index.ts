/**
 * @heossi/liboqs-native — typed loader for the liboqs N-API addon.
 *
 * The C++ addon (src/addon.cc) is compiled to a platform-specific
 * `oqs_native.node` by node-gyp and distributed via prebuildify prebuilds.
 * At runtime node-gyp-build resolves the correct prebuild (or falls back to
 * local compilation) and exposes the KEM / Sig classes plus algorithm
 * introspection helpers.
 *
 * This file is the single source of truth. tsc emits dist/index.js +
 * dist/index.d.ts from here — never hand-edit dist/.
 *
 * The package is published as CommonJS ("type": "commonjs"). With
 * verbatimModuleSyntax enabled we use TypeScript's classic CJS syntax:
 * `import x = require("...")` for values and `export = { ... }` for the
 * module shape, which produces a deterministic, tooling-friendly runtime.
 */

import path = require("node:path");
// node-gyp-build has no upstream types; describe the single call shape we use.
type NodeGypBuild = (root: string) => NativeBinding;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeGypBuild: NodeGypBuild = require("node-gyp-build") as NodeGypBuild;

interface NativeBinding {
	readonly KEM: liboqs.KEMConstructor;
	readonly Sig: liboqs.SigConstructor;
	getSupportedKems(): string[];
	getSupportedSignatures(): string[];
	isKemAlgorithmSupported(algorithm: string): boolean;
	isSignatureAlgorithmSupported(algorithm: string): boolean;
	version(): string;
}

const packageRoot = path.resolve(__dirname, "..");
const binding: NativeBinding = nodeGypBuild(packageRoot);

declare namespace liboqs {
	interface KeyPair {
		readonly publicKey: Buffer;
		readonly secretKey: Buffer;
	}

	interface Encapsulation {
		readonly ciphertext: Buffer;
		readonly sharedSecret: Buffer;
	}

	/**
	 * Algorithm-detail introspection returned by KEM.details() / Sig.details().
	 * Length fields come straight from the OQS_KEM / OQS_SIG struct so callers
	 * don't have to hardcode constants per parameter set.
	 */
	interface KEMDetails {
		readonly algorithm: string;
		readonly algVersion: string;
		readonly claimedNistLevel: number;
		readonly indCca: boolean;
		readonly lengthPublicKey: number;
		readonly lengthSecretKey: number;
		readonly lengthCiphertext: number;
		readonly lengthSharedSecret: number;
		/** 0 if upstream liboqs build does not expose a derand seed length. */
		readonly lengthKeypairSeed: number;
		/** 0 if upstream liboqs build does not expose a derand encaps seed length. */
		readonly lengthEncapsSeed: number;
	}

	interface SigDetails {
		readonly algorithm: string;
		readonly algVersion: string;
		readonly claimedNistLevel: number;
		readonly eufCma: boolean;
		readonly sufCma: boolean;
		readonly sigWithCtxSupport: boolean;
		readonly lengthPublicKey: number;
		readonly lengthSecretKey: number;
		readonly lengthSignature: number;
	}

	interface KEM {
		generateKeypair(): KeyPair;
		/**
		 * Deterministic keypair generation from a caller-supplied seed.
		 * Seed must be exactly `details().lengthKeypairSeed` bytes. INTENDED
		 * FOR NIST ACVP TEST-VECTOR USE — production code should call
		 * generateKeypair() so randomness flows through the OpenSSL DRBG
		 * (see https://qnsi.heossi.com/trust/entropy).
		 */
		generateKeypairDerand(seed: Buffer | Uint8Array): KeyPair;
		encapsulate(publicKey: Buffer | Uint8Array): Encapsulation;
		/**
		 * Deterministic encapsulation from a caller-supplied seed.
		 * Seed must be exactly `details().lengthEncapsSeed` bytes (32 for ML-KEM).
		 * NIST ACVP TEST-VECTOR USE ONLY.
		 */
		encapsulateDerand(publicKey: Buffer | Uint8Array, seed: Buffer | Uint8Array): Encapsulation;
		decapsulate(ciphertext: Buffer | Uint8Array, secretKey: Buffer | Uint8Array): Buffer;
		details(): KEMDetails;
		free(): void;
	}

	interface KEMConstructor {
		new (algorithm: string): KEM;
	}

	interface Sig {
		generateKeypair(): KeyPair;
		sign(message: Buffer | Uint8Array, privateKey: Buffer | Uint8Array): Buffer;
		verify(
			message: Buffer | Uint8Array,
			signature: Buffer | Uint8Array,
			publicKey: Buffer | Uint8Array,
		): boolean;
		details(): SigDetails;
		free(): void;
	}

	interface SigConstructor {
		new (algorithm: string): Sig;
	}
}

const liboqs = {
	KEM: binding.KEM,
	Sig: binding.Sig,
	getSupportedKems(): string[] {
		return binding.getSupportedKems();
	},
	getSupportedSignatures(): string[] {
		return binding.getSupportedSignatures();
	},
	isKemAlgorithmSupported(algorithm: string): boolean {
		return binding.isKemAlgorithmSupported(algorithm);
	},
	isSignatureAlgorithmSupported(algorithm: string): boolean {
		return binding.isSignatureAlgorithmSupported(algorithm);
	},
	version(): string {
		return binding.version();
	},
};

export = liboqs;
