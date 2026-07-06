import type { PqcAlgorithm } from "./provider.js";

/**
 * Core NIST-finalized PQC KEM algorithms (FIPS 203 — ML-KEM).
 * These are the primary production-enforced KEMs.
 */
export const PQC_CORE_KEM_ALGORITHMS = ["kyber-512", "kyber-768", "kyber-1024"] as const;

/**
 * All PQC KEM algorithms supported by QNSP via liboqs.
 * Includes NIST-finalized, NIST-draft, and additional candidates.
 * Actual runtime availability depends on the installed liboqs build.
 */
export const PQC_KEM_ALGORITHMS = [
	// FIPS 203 — ML-KEM (NIST finalized)
	"kyber-512",
	"kyber-768",
	"kyber-1024",
	// HQC omitted — disabled upstream (liboqs OQS_ENABLE_KEM_HQC=OFF; CVE-2025-48946).
	// BIKE (NIST Round 4 candidate)
	"bike-l1",
	"bike-l3",
	"bike-l5",
	// Classic McEliece (ISO standard)
	"mceliece-348864",
	"mceliece-460896",
	"mceliece-6688128",
	"mceliece-6960119",
	"mceliece-8192128",
	// FrodoKEM (ISO standard)
	"frodokem-640-aes",
	"frodokem-640-shake",
	"frodokem-976-aes",
	"frodokem-976-shake",
	"frodokem-1344-aes",
	"frodokem-1344-shake",
	// NTRU (lattice-based, re-added in liboqs 0.15)
	"ntru-hps-2048-509",
	"ntru-hps-2048-677",
	"ntru-hps-4096-821",
	"ntru-hps-4096-1229",
	"ntru-hrss-701",
	"ntru-hrss-1373",
	// NTRU-Prime
	"sntrup761",
] as const;
export type PqcKemAlgorithm = (typeof PQC_KEM_ALGORITHMS)[number];

/**
 * Core NIST-finalized PQC signature algorithms (FIPS 204/205 — ML-DSA, SLH-DSA).
 * These are the primary production-enforced signatures.
 */
export const PQC_CORE_SIGNATURE_ALGORITHMS = [
	"dilithium-2",
	"dilithium-3",
	"dilithium-5",
	"falcon-512",
	"falcon-1024",
	"sphincs-shake-128f-simple",
	"sphincs-shake-256f-simple",
] as const;

/**
 * All PQC signature algorithms supported by QNSP via liboqs.
 * Includes NIST-finalized, NIST-draft, and additional candidates.
 * Actual runtime availability depends on the installed liboqs build.
 */
export const PQC_SIGNATURE_ALGORITHMS = [
	// FIPS 204 — ML-DSA (NIST finalized)
	"dilithium-2",
	"dilithium-3",
	"dilithium-5",
	// FIPS 205 — SLH-DSA (NIST finalized)
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
	// FN-DSA / Falcon (FIPS 206 draft)
	"falcon-512",
	"falcon-1024",
	// MAYO (NIST Additional Signatures Round 2)
	"mayo-1",
	"mayo-2",
	"mayo-3",
	"mayo-5",
	// CROSS (NIST Additional Signatures Round 2)
	"cross-rsdp-128-balanced",
	"cross-rsdp-128-fast",
	"cross-rsdp-128-small",
	"cross-rsdp-192-balanced",
	"cross-rsdp-192-fast",
	"cross-rsdp-192-small",
	"cross-rsdp-256-balanced",
	"cross-rsdp-256-fast",
	"cross-rsdp-256-small",
	"cross-rsdpg-128-balanced",
	"cross-rsdpg-128-fast",
	"cross-rsdpg-128-small",
	"cross-rsdpg-192-balanced",
	"cross-rsdpg-192-fast",
	"cross-rsdpg-192-small",
	"cross-rsdpg-256-balanced",
	"cross-rsdpg-256-fast",
	"cross-rsdpg-256-small",
	// UOV (NIST Additional Signatures Round 2)
	"ov-Is",
	"ov-Ip",
	"ov-III",
	"ov-V",
	"ov-Is-pkc",
	"ov-Ip-pkc",
	"ov-III-pkc",
	"ov-V-pkc",
	"ov-Is-pkc-skc",
	"ov-Ip-pkc-skc",
	"ov-III-pkc-skc",
	"ov-V-pkc-skc",
	// SNOVA (NIST Additional Signatures Round 2)
	"snova-24-5-4",
	"snova-24-5-4-shake",
	"snova-24-5-4-esk",
	"snova-24-5-4-shake-esk",
	"snova-25-8-3",
	"snova-37-17-2",
	"snova-37-8-4",
	"snova-24-5-5",
	"snova-56-25-2",
	"snova-49-11-3",
	"snova-60-10-4",
	"snova-29-6-5",
] as const;
export type PqcSignatureAlgorithm = (typeof PQC_SIGNATURE_ALGORITHMS)[number];

export function isPqcKemAlgorithm(value: string): value is PqcKemAlgorithm {
	return (PQC_KEM_ALGORITHMS as readonly string[]).includes(value);
}

export function isPqcSignatureAlgorithm(value: string): value is PqcSignatureAlgorithm {
	return (PQC_SIGNATURE_ALGORITHMS as readonly string[]).includes(value);
}

/**
 * Check if a value is one of the core NIST-finalized KEM algorithms.
 */
export function isCoreKemAlgorithm(value: string): boolean {
	return (PQC_CORE_KEM_ALGORITHMS as readonly string[]).includes(value);
}

/**
 * Check if a value is one of the core NIST-finalized signature algorithms.
 */
export function isCoreSignatureAlgorithm(value: string): boolean {
	return (PQC_CORE_SIGNATURE_ALGORITHMS as readonly string[]).includes(value);
}

export type PqcAlgorithmKind = "kem" | "signature";

export function getPqcAlgorithmKind(algorithm: PqcAlgorithm): PqcAlgorithmKind {
	return isPqcKemAlgorithm(algorithm) ? "kem" : "signature";
}

export function listPqcAlgorithmsByKind(kind: PqcAlgorithmKind): readonly PqcAlgorithm[] {
	return kind === "kem" ? PQC_KEM_ALGORITHMS : PQC_SIGNATURE_ALGORITHMS;
}
