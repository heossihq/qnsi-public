import type { PqcAlgorithm } from "./provider.js";

export type PqcFipsFamily =
	| "ML-KEM"
	| "ML-DSA"
	| "SLH-DSA"
	| "FN-DSA"
	| "HQC"
	| "BIKE"
	| "Classic McEliece"
	| "FrodoKEM"
	| "NTRU"
	| "NTRU-Prime"
	| "MAYO"
	| "CROSS"
	| "UOV"
	| "SNOVA";

/**
 * Maps every PQC algorithm to its standards family.
 * NIST-finalized: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205)
 * NIST-selected: HQC (selected March 2025, draft expected 2026), FN-DSA (FIPS 206 draft)
 * NIST Round 4: BIKE
 * ISO standards: Classic McEliece, FrodoKEM
 * Re-added: NTRU (liboqs 0.15), NTRU-Prime
 * NIST Additional Signatures Round 2: MAYO, CROSS, UOV, SNOVA
 */
const PQC_FIPS_FAMILY_BY_ALGORITHM: Partial<Record<PqcAlgorithm, PqcFipsFamily | null>> = {
	// FIPS 203 — ML-KEM
	"kyber-512": "ML-KEM",
	"kyber-768": "ML-KEM",
	"kyber-1024": "ML-KEM",
	// FIPS 204 — ML-DSA
	"dilithium-2": "ML-DSA",
	"dilithium-3": "ML-DSA",
	"dilithium-5": "ML-DSA",
	// FIPS 205 — SLH-DSA
	"sphincs-sha2-128f-simple": "SLH-DSA",
	"sphincs-sha2-128s-simple": "SLH-DSA",
	"sphincs-sha2-192f-simple": "SLH-DSA",
	"sphincs-sha2-192s-simple": "SLH-DSA",
	"sphincs-sha2-256f-simple": "SLH-DSA",
	"sphincs-sha2-256s-simple": "SLH-DSA",
	"sphincs-shake-128f-simple": "SLH-DSA",
	"sphincs-shake-128s-simple": "SLH-DSA",
	"sphincs-shake-192f-simple": "SLH-DSA",
	"sphincs-shake-192s-simple": "SLH-DSA",
	"sphincs-shake-256f-simple": "SLH-DSA",
	"sphincs-shake-256s-simple": "SLH-DSA",
	// FN-DSA (FIPS 206 — Initial Public Draft)
	"falcon-512": "FN-DSA",
	"falcon-1024": "FN-DSA",
	// HQC (NIST selected March 2025)
	"hqc-128": "HQC",
	"hqc-192": "HQC",
	"hqc-256": "HQC",
	// BIKE (NIST Round 4)
	"bike-l1": "BIKE",
	"bike-l3": "BIKE",
	"bike-l5": "BIKE",
	// Classic McEliece (ISO standard)
	"mceliece-348864": "Classic McEliece",
	"mceliece-460896": "Classic McEliece",
	"mceliece-6688128": "Classic McEliece",
	"mceliece-6960119": "Classic McEliece",
	"mceliece-8192128": "Classic McEliece",
	// FrodoKEM (ISO standard)
	"frodokem-640-aes": "FrodoKEM",
	"frodokem-640-shake": "FrodoKEM",
	"frodokem-976-aes": "FrodoKEM",
	"frodokem-976-shake": "FrodoKEM",
	"frodokem-1344-aes": "FrodoKEM",
	"frodokem-1344-shake": "FrodoKEM",
	// NTRU (lattice-based, re-added in liboqs 0.15)
	"ntru-hps-2048-509": "NTRU",
	"ntru-hps-2048-677": "NTRU",
	"ntru-hps-4096-821": "NTRU",
	"ntru-hps-4096-1229": "NTRU",
	"ntru-hrss-701": "NTRU",
	"ntru-hrss-1373": "NTRU",
	// NTRU-Prime
	sntrup761: "NTRU-Prime",
	// MAYO (NIST Additional Signatures Round 2)
	"mayo-1": "MAYO",
	"mayo-2": "MAYO",
	"mayo-3": "MAYO",
	"mayo-5": "MAYO",
	// CROSS (NIST Additional Signatures Round 2)
	"cross-rsdp-128-balanced": "CROSS",
	"cross-rsdp-128-fast": "CROSS",
	"cross-rsdp-128-small": "CROSS",
	"cross-rsdp-192-balanced": "CROSS",
	"cross-rsdp-192-fast": "CROSS",
	"cross-rsdp-192-small": "CROSS",
	"cross-rsdp-256-balanced": "CROSS",
	"cross-rsdp-256-fast": "CROSS",
	"cross-rsdp-256-small": "CROSS",
	"cross-rsdpg-128-balanced": "CROSS",
	"cross-rsdpg-128-fast": "CROSS",
	"cross-rsdpg-128-small": "CROSS",
	"cross-rsdpg-192-balanced": "CROSS",
	"cross-rsdpg-192-fast": "CROSS",
	"cross-rsdpg-192-small": "CROSS",
	"cross-rsdpg-256-balanced": "CROSS",
	"cross-rsdpg-256-fast": "CROSS",
	"cross-rsdpg-256-small": "CROSS",
	// UOV (NIST Additional Signatures Round 2)
	"ov-Is": "UOV",
	"ov-Ip": "UOV",
	"ov-III": "UOV",
	"ov-V": "UOV",
	"ov-Is-pkc": "UOV",
	"ov-Ip-pkc": "UOV",
	"ov-III-pkc": "UOV",
	"ov-V-pkc": "UOV",
	"ov-Is-pkc-skc": "UOV",
	"ov-Ip-pkc-skc": "UOV",
	"ov-III-pkc-skc": "UOV",
	"ov-V-pkc-skc": "UOV",
	// SNOVA (NIST Additional Signatures Round 2, liboqs 0.14+)
	"snova-24-5-4": "SNOVA",
	"snova-24-5-4-shake": "SNOVA",
	"snova-24-5-4-esk": "SNOVA",
	"snova-24-5-4-shake-esk": "SNOVA",
	"snova-25-8-3": "SNOVA",
	"snova-37-17-2": "SNOVA",
	"snova-37-8-4": "SNOVA",
	"snova-24-5-5": "SNOVA",
	"snova-56-25-2": "SNOVA",
	"snova-49-11-3": "SNOVA",
	"snova-60-10-4": "SNOVA",
	"snova-29-6-5": "SNOVA",
};

/**
 * Comprehensive mapping from internal algorithm names to NIST/standards display labels.
 * This is the canonical source of truth for algorithm naming across the entire platform.
 * All SDKs, APIs, and UI components should use these labels for auditor-facing output.
 *
 * Naming conventions:
 * - NIST-finalized: Use FIPS standard names (ML-KEM-512, ML-DSA-44, SLH-DSA-SHAKE-128f)
 * - NIST-selected/draft: Use expected standard names (FN-DSA-512, HQC-128)
 * - ISO standards: Use ISO-recognized names (Classic-McEliece-348864, FrodoKEM-640-AES)
 * - NIST candidates: Use submission names (BIKE-L1, MAYO-1, CROSS-RSDP-128-balanced)
 * - Re-added: Use original names (NTRU-HPS-2048-509, sntrup761)
 */
const PQC_FIPS_LABEL_BY_ALGORITHM: Partial<Record<PqcAlgorithm, string>> = {
	// FIPS 203 — ML-KEM
	"kyber-512": "ML-KEM-512",
	"kyber-768": "ML-KEM-768",
	"kyber-1024": "ML-KEM-1024",
	// FIPS 204 — ML-DSA
	"dilithium-2": "ML-DSA-44",
	"dilithium-3": "ML-DSA-65",
	"dilithium-5": "ML-DSA-87",
	// FIPS 205 — SLH-DSA (SHA-2 variants)
	"sphincs-sha2-128f-simple": "SLH-DSA-SHA2-128f",
	"sphincs-sha2-128s-simple": "SLH-DSA-SHA2-128s",
	"sphincs-sha2-192f-simple": "SLH-DSA-SHA2-192f",
	"sphincs-sha2-192s-simple": "SLH-DSA-SHA2-192s",
	"sphincs-sha2-256f-simple": "SLH-DSA-SHA2-256f",
	"sphincs-sha2-256s-simple": "SLH-DSA-SHA2-256s",
	// FIPS 205 — SLH-DSA (SHAKE variants)
	"sphincs-shake-128f-simple": "SLH-DSA-SHAKE-128f",
	"sphincs-shake-128s-simple": "SLH-DSA-SHAKE-128s",
	"sphincs-shake-192f-simple": "SLH-DSA-SHAKE-192f",
	"sphincs-shake-192s-simple": "SLH-DSA-SHAKE-192s",
	"sphincs-shake-256f-simple": "SLH-DSA-SHAKE-256f",
	"sphincs-shake-256s-simple": "SLH-DSA-SHAKE-256s",
	// FN-DSA (FIPS 206 draft)
	"falcon-512": "FN-DSA-512",
	"falcon-1024": "FN-DSA-1024",
	// HQC (NIST selected March 2025)
	"hqc-128": "HQC-128",
	"hqc-192": "HQC-192",
	"hqc-256": "HQC-256",
	// BIKE (NIST Round 4)
	"bike-l1": "BIKE-L1",
	"bike-l3": "BIKE-L3",
	"bike-l5": "BIKE-L5",
	// Classic McEliece (ISO standard)
	"mceliece-348864": "Classic-McEliece-348864",
	"mceliece-460896": "Classic-McEliece-460896",
	"mceliece-6688128": "Classic-McEliece-6688128",
	"mceliece-6960119": "Classic-McEliece-6960119",
	"mceliece-8192128": "Classic-McEliece-8192128",
	// FrodoKEM (ISO standard)
	"frodokem-640-aes": "FrodoKEM-640-AES",
	"frodokem-640-shake": "FrodoKEM-640-SHAKE",
	"frodokem-976-aes": "FrodoKEM-976-AES",
	"frodokem-976-shake": "FrodoKEM-976-SHAKE",
	"frodokem-1344-aes": "FrodoKEM-1344-AES",
	"frodokem-1344-shake": "FrodoKEM-1344-SHAKE",
	// NTRU (lattice-based, re-added in liboqs 0.15)
	"ntru-hps-2048-509": "NTRU-HPS-2048-509",
	"ntru-hps-2048-677": "NTRU-HPS-2048-677",
	"ntru-hps-4096-821": "NTRU-HPS-4096-821",
	"ntru-hps-4096-1229": "NTRU-HPS-4096-1229",
	"ntru-hrss-701": "NTRU-HRSS-701",
	"ntru-hrss-1373": "NTRU-HRSS-1373",
	// NTRU-Prime
	sntrup761: "sntrup761",
	// MAYO (NIST Additional Signatures Round 2)
	"mayo-1": "MAYO-1",
	"mayo-2": "MAYO-2",
	"mayo-3": "MAYO-3",
	"mayo-5": "MAYO-5",
	// CROSS (NIST Additional Signatures Round 2)
	"cross-rsdp-128-balanced": "CROSS-RSDP-128-balanced",
	"cross-rsdp-128-fast": "CROSS-RSDP-128-fast",
	"cross-rsdp-128-small": "CROSS-RSDP-128-small",
	"cross-rsdp-192-balanced": "CROSS-RSDP-192-balanced",
	"cross-rsdp-192-fast": "CROSS-RSDP-192-fast",
	"cross-rsdp-192-small": "CROSS-RSDP-192-small",
	"cross-rsdp-256-balanced": "CROSS-RSDP-256-balanced",
	"cross-rsdp-256-fast": "CROSS-RSDP-256-fast",
	"cross-rsdp-256-small": "CROSS-RSDP-256-small",
	"cross-rsdpg-128-balanced": "CROSS-RSDPG-128-balanced",
	"cross-rsdpg-128-fast": "CROSS-RSDPG-128-fast",
	"cross-rsdpg-128-small": "CROSS-RSDPG-128-small",
	"cross-rsdpg-192-balanced": "CROSS-RSDPG-192-balanced",
	"cross-rsdpg-192-fast": "CROSS-RSDPG-192-fast",
	"cross-rsdpg-192-small": "CROSS-RSDPG-192-small",
	"cross-rsdpg-256-balanced": "CROSS-RSDPG-256-balanced",
	"cross-rsdpg-256-fast": "CROSS-RSDPG-256-fast",
	"cross-rsdpg-256-small": "CROSS-RSDPG-256-small",
	// UOV (NIST Additional Signatures Round 2)
	"ov-Is": "UOV-Is",
	"ov-Ip": "UOV-Ip",
	"ov-III": "UOV-III",
	"ov-V": "UOV-V",
	"ov-Is-pkc": "UOV-Is-pkc",
	"ov-Ip-pkc": "UOV-Ip-pkc",
	"ov-III-pkc": "UOV-III-pkc",
	"ov-V-pkc": "UOV-V-pkc",
	"ov-Is-pkc-skc": "UOV-Is-pkc-skc",
	"ov-Ip-pkc-skc": "UOV-Ip-pkc-skc",
	"ov-III-pkc-skc": "UOV-III-pkc-skc",
	"ov-V-pkc-skc": "UOV-V-pkc-skc",
	// SNOVA (NIST Additional Signatures Round 2, liboqs 0.14+)
	"snova-24-5-4": "SNOVA-24-5-4",
	"snova-24-5-4-shake": "SNOVA-24-5-4-SHAKE",
	"snova-24-5-4-esk": "SNOVA-24-5-4-ESK",
	"snova-24-5-4-shake-esk": "SNOVA-24-5-4-SHAKE-ESK",
	"snova-25-8-3": "SNOVA-25-8-3",
	"snova-37-17-2": "SNOVA-37-17-2",
	"snova-37-8-4": "SNOVA-37-8-4",
	"snova-24-5-5": "SNOVA-24-5-5",
	"snova-56-25-2": "SNOVA-56-25-2",
	"snova-49-11-3": "SNOVA-49-11-3",
	"snova-60-10-4": "SNOVA-60-10-4",
	"snova-29-6-5": "SNOVA-29-6-5",
};

/**
 * Comprehensive mapping from internal algorithm names to NIST/standards display names.
 * Exported as the canonical reference for all SDKs and services.
 * NIST display-name labels for all 90 catalogued algorithm identifiers, including HQC
 * (label reference only — HQC is currently disabled for CVE-2025-48946; the runtime-supported
 * set is 87, see crypto-policy ALGORITHM_TO_NIST).
 */
export const ALGORITHM_NIST_NAMES: Readonly<Record<string, string>> =
	PQC_FIPS_LABEL_BY_ALGORITHM as Record<string, string>;

export function getPqcFipsFamily(algorithm: PqcAlgorithm): PqcFipsFamily | null {
	return PQC_FIPS_FAMILY_BY_ALGORITHM[algorithm] ?? null;
}

export function getPqcFipsLabel(algorithm: PqcAlgorithm): string | null {
	return PQC_FIPS_LABEL_BY_ALGORITHM[algorithm] ?? null;
}

export function formatPqcAlgorithmForTelemetry(algorithm: PqcAlgorithm): string {
	return getPqcFipsLabel(algorithm) ?? algorithm;
}

/**
 * Convert internal algorithm name to NIST/standards display name.
 * Returns the original name if no mapping exists.
 */
export function toNistAlgorithmName(algorithm: string): string {
	return ALGORITHM_NIST_NAMES[algorithm] ?? algorithm;
}
