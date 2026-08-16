/**
 * Server-side helpers powering the public PQC sandbox endpoints.
 *
 * Three callers share these primitives:
 *
 *   /api/sandbox/pqc-runtime               - fresh keys/sig per request (the curl demo)
 *   /api/sandbox/pqc-runtime/conformance   - deterministic-seed reproduction check
 *   /api/health/pqc-sandbox             - self-canary used to monitor the demo
 *
 * Why centralized: the demo, the conformance proof, and the canary all need
 * the SAME code path so that the canary actually guards the demo. If we
 * duplicated, the canary could pass while the demo broke.
 */
import { createHash } from "node:crypto";

import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import { ml_kem512, ml_kem768, ml_kem1024 } from "@noble/post-quantum/ml-kem.js";
import {
	slh_dsa_sha2_128f,
	slh_dsa_sha2_192f,
	slh_dsa_sha2_256f,
} from "@noble/post-quantum/slh-dsa.js";
import type { Signer } from "@noble/post-quantum/utils.js";

export type KemId = "ml-kem-512" | "ml-kem-768" | "ml-kem-1024";
export type SigId =
	| "ml-dsa-44"
	| "ml-dsa-65"
	| "ml-dsa-87"
	| "slh-dsa-sha2-128f"
	| "slh-dsa-sha2-192f"
	| "slh-dsa-sha2-256f";

interface KemEntry {
	readonly instance: typeof ml_kem768;
	readonly fipsStandard: string;
	readonly nistSecurityCategory: number;
}

interface SigEntry {
	readonly instance: Signer;
	readonly fipsStandard: string;
	readonly nistSecurityCategory: number;
}

export const KEM_REGISTRY: Record<KemId, KemEntry> = {
	"ml-kem-512": { instance: ml_kem512, fipsStandard: "FIPS 203", nistSecurityCategory: 1 },
	"ml-kem-768": { instance: ml_kem768, fipsStandard: "FIPS 203", nistSecurityCategory: 3 },
	"ml-kem-1024": { instance: ml_kem1024, fipsStandard: "FIPS 203", nistSecurityCategory: 5 },
};

// SLH-DSA SHA2-based "f" (fast) variants chosen for sandbox latency.
// The "s" (small) variants have shorter signatures but signing takes
// 1-15 seconds, which exceeds the public-sandbox response budget.
export const SIG_REGISTRY: Record<SigId, SigEntry> = {
	"ml-dsa-44": { instance: ml_dsa44, fipsStandard: "FIPS 204", nistSecurityCategory: 2 },
	"ml-dsa-65": { instance: ml_dsa65, fipsStandard: "FIPS 204", nistSecurityCategory: 3 },
	"ml-dsa-87": { instance: ml_dsa87, fipsStandard: "FIPS 204", nistSecurityCategory: 5 },
	"slh-dsa-sha2-128f": {
		instance: slh_dsa_sha2_128f,
		fipsStandard: "FIPS 205",
		nistSecurityCategory: 1,
	},
	"slh-dsa-sha2-192f": {
		instance: slh_dsa_sha2_192f,
		fipsStandard: "FIPS 205",
		nistSecurityCategory: 3,
	},
	"slh-dsa-sha2-256f": {
		instance: slh_dsa_sha2_256f,
		fipsStandard: "FIPS 205",
		nistSecurityCategory: 5,
	},
};

export const DEFAULT_KEM: KemId = "ml-kem-768";
export const DEFAULT_SIG: SigId = "ml-dsa-65";
export const DEFAULT_ML_DSA: SigId = "ml-dsa-65";
export const DEFAULT_SLH_DSA: SigId = "slh-dsa-sha2-128f";
export const NOBLE_VERSION = "0.6.1";

export const ML_DSA_IDS: ReadonlySet<SigId> = new Set<SigId>([
	"ml-dsa-44",
	"ml-dsa-65",
	"ml-dsa-87",
]);
export const SLH_DSA_IDS: ReadonlySet<SigId> = new Set<SigId>([
	"slh-dsa-sha2-128f",
	"slh-dsa-sha2-192f",
	"slh-dsa-sha2-256f",
]);

export function isMlDsaId(id: string): id is SigId {
	return ML_DSA_IDS.has(id as SigId);
}

export function isSlhDsaId(id: string): id is SigId {
	return SLH_DSA_IDS.has(id as SigId);
}

export const DEMO_MESSAGE = new TextEncoder().encode(
	"QNSI sandbox demo: this message was signed at the moment of your request.",
);

export interface OperationTiming {
	readonly operation: string;
	readonly milliseconds: number;
}

export function nowMs(): number {
	return Number(process.hrtime.bigint()) / 1_000_000;
}

export function toB64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("base64");
}

export function sha256Hex(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

export function ctEq(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		// i is bounded by a.length and the lengths are equal, so both reads
		// are always defined.
		diff |= (a[i] as number) ^ (b[i] as number);
	}
	return diff === 0;
}

export function isKemId(v: string): v is KemId {
	return v in KEM_REGISTRY;
}

export function isSigId(v: string): v is SigId {
	return v in SIG_REGISTRY;
}

export interface KemDemoResult {
	readonly algorithm: KemId;
	readonly fipsStandard: string;
	readonly nistSecurityCategory: number;
	readonly publicKeyBase64: string;
	readonly secretKeyBase64Truncated: string;
	readonly ciphertextBase64: string;
	readonly sharedSecretBase64: string;
	readonly sizes: {
		readonly publicKeyBytes: number;
		readonly secretKeyBytes: number;
		readonly ciphertextBytes: number;
		readonly sharedSecretBytes: number;
	};
	readonly integrity: {
		readonly encapDecapSharedSecretsMatch: boolean;
	};
	readonly timings: readonly OperationTiming[];
}

export function runKemDemo(id: KemId): KemDemoResult {
	const entry = KEM_REGISTRY[id];
	const timings: OperationTiming[] = [];

	let t0 = nowMs();
	const keypair = entry.instance.keygen();
	timings.push({ operation: "keygen", milliseconds: nowMs() - t0 });

	t0 = nowMs();
	const enc = entry.instance.encapsulate(keypair.publicKey);
	timings.push({ operation: "encapsulate", milliseconds: nowMs() - t0 });

	t0 = nowMs();
	const decapsSharedSecret = entry.instance.decapsulate(enc.cipherText, keypair.secretKey);
	timings.push({ operation: "decapsulate", milliseconds: nowMs() - t0 });

	return {
		algorithm: id,
		fipsStandard: entry.fipsStandard,
		nistSecurityCategory: entry.nistSecurityCategory,
		publicKeyBase64: toB64(keypair.publicKey),
		secretKeyBase64Truncated: `${toB64(keypair.secretKey).slice(0, 64)}…`,
		ciphertextBase64: toB64(enc.cipherText),
		sharedSecretBase64: toB64(enc.sharedSecret),
		sizes: {
			publicKeyBytes: keypair.publicKey.length,
			secretKeyBytes: keypair.secretKey.length,
			ciphertextBytes: enc.cipherText.length,
			sharedSecretBytes: enc.sharedSecret.length,
		},
		integrity: {
			encapDecapSharedSecretsMatch: ctEq(enc.sharedSecret, decapsSharedSecret),
		},
		timings,
	};
}

export interface SigDemoResult {
	readonly algorithm: SigId;
	readonly fipsStandard: string;
	readonly nistSecurityCategory: number;
	readonly publicKeyBase64: string;
	readonly secretKeyBase64Truncated: string;
	readonly messageBase64: string;
	readonly signatureBase64: string;
	readonly sizes: {
		readonly publicKeyBytes: number;
		readonly secretKeyBytes: number;
		readonly messageBytes: number;
		readonly signatureBytes: number;
	};
	readonly integrity: {
		readonly signatureVerifies: boolean;
	};
	readonly timings: readonly OperationTiming[];
}

export function runSignatureDemo(id: SigId): SigDemoResult {
	const entry = SIG_REGISTRY[id];
	const timings: OperationTiming[] = [];

	let t0 = nowMs();
	const keypair = entry.instance.keygen();
	timings.push({ operation: "keygen", milliseconds: nowMs() - t0 });

	t0 = nowMs();
	const signature = entry.instance.sign(DEMO_MESSAGE, keypair.secretKey);
	timings.push({ operation: "sign", milliseconds: nowMs() - t0 });

	t0 = nowMs();
	const verified = entry.instance.verify(signature, DEMO_MESSAGE, keypair.publicKey);
	timings.push({ operation: "verify", milliseconds: nowMs() - t0 });

	return {
		algorithm: id,
		fipsStandard: entry.fipsStandard,
		nistSecurityCategory: entry.nistSecurityCategory,
		publicKeyBase64: toB64(keypair.publicKey),
		secretKeyBase64Truncated: `${toB64(keypair.secretKey).slice(0, 64)}…`,
		messageBase64: toB64(DEMO_MESSAGE),
		signatureBase64: toB64(signature),
		sizes: {
			publicKeyBytes: keypair.publicKey.length,
			secretKeyBytes: keypair.secretKey.length,
			messageBytes: DEMO_MESSAGE.length,
			signatureBytes: signature.length,
		},
		integrity: {
			signatureVerifies: verified,
		},
		timings,
	};
}

export interface ConformanceVector {
	readonly algorithm: KemId | SigId;
	readonly kind: "kem" | "signature";
	readonly seedHex: string;
	readonly expectedPublicKeySha256: string;
	readonly expectedSecretKeySha256: string;
	readonly note: string;
}

export interface ConformanceCheckResult {
	readonly algorithm: KemId | SigId;
	readonly kind: "kem" | "signature";
	readonly matches: boolean;
	readonly expected: { readonly publicKeySha256: string; readonly secretKeySha256: string };
	readonly actual: { readonly publicKeySha256: string; readonly secretKeySha256: string };
	readonly note: string;
}

export function runConformanceCheck(vector: ConformanceVector): ConformanceCheckResult {
	const seed = Buffer.from(vector.seedHex, "hex");
	let publicKey: Uint8Array;
	let secretKey: Uint8Array;
	if (vector.kind === "kem") {
		const entry = KEM_REGISTRY[vector.algorithm as KemId];
		const kp = entry.instance.keygen(seed);
		publicKey = kp.publicKey;
		secretKey = kp.secretKey;
	} else {
		const entry = SIG_REGISTRY[vector.algorithm as SigId];
		const kp = entry.instance.keygen(seed);
		publicKey = kp.publicKey;
		secretKey = kp.secretKey;
	}

	const actualPub = sha256Hex(publicKey);
	const actualSec = sha256Hex(secretKey);

	return {
		algorithm: vector.algorithm,
		kind: vector.kind,
		matches:
			actualPub === vector.expectedPublicKeySha256 && actualSec === vector.expectedSecretKeySha256,
		expected: {
			publicKeySha256: vector.expectedPublicKeySha256,
			secretKeySha256: vector.expectedSecretKeySha256,
		},
		actual: { publicKeySha256: actualPub, secretKeySha256: actualSec },
		note: vector.note,
	};
}
