/**
 * Algorithm Lifecycle Registry
 *
 * Canonical source of truth for all cryptographic algorithm metadata including
 * NIST lifecycle status, deprecation dates, security levels, and replacement paths.
 * Used by crypto-inventory-service (migration planner) and edge-gateway (attestation).
 *
 * Updated per FIPS 203, 204, 205 (August 2024), FIPS 206 IPD (2025), HQC selection (March 2025).
 */

/**
 * Algorithm lifecycle status per NIST standards.
 */
export type AlgorithmLifecycleStatus =
	| "NIST_FINAL" // FIPS 203/204/205 finalized
	| "NIST_DRAFT" // Under NIST review
	| "DEPRECATED" // Scheduled for removal (quantum-vulnerable)
	| "FORBIDDEN" // Not allowed
	| "CLASSICAL"; // Pre-quantum, still accepted with caveats

/**
 * Full algorithm metadata with NIST lifecycle tracking.
 */
export interface AlgorithmLifecycleMetadata {
	readonly name: string;
	readonly type: "kem" | "signature" | "symmetric" | "hash";
	readonly status: AlgorithmLifecycleStatus;
	readonly nistStandard?: string;
	readonly securityLevel: number; // NIST security level (0-5)
	readonly deprecationDate?: string; // ISO date when algorithm becomes forbidden
	readonly removalDate?: string; // ISO date NIST removes it from its standards (IR 8547)
	readonly replacementAlgorithm?: string;
	/**
	 * Where a non-final algorithm sits in the NIST process as of
	 * {@link STANDARDS_BASELINE_VERIFIED_AT}. Required for every NIST_DRAFT entry
	 * so "draft" never hides which round or selection it belongs to.
	 */
	readonly processStage?: string;
}

/**
 * Date the registry's standards statuses were last reconciled against the
 * published NIST process. Claims about draft/round status are time-sensitive:
 * bump this and re-verify against csrc.nist.gov before repeating them.
 */
export const STANDARDS_BASELINE_VERIFIED_AT = "2026-10-21";

/**
 * NIST IR 8547 transition schedule for quantum-vulnerable algorithms.
 *
 * IR 8547 is still an *initial public draft* (November 2024) as of the baseline
 * date above - NIST has not published a final revision. The dates are therefore
 * NIST's expected approach, not a settled compliance deadline; they are encoded
 * once here so every classical entry carries the same schedule and the whole
 * schedule moves with one edit if NIST revises it.
 */
export const NIST_IR_8547 = {
	deprecationDate: "2030-01-01",
	removalDate: "2035-01-01",
} as const;

/**
 * NIST PQC Algorithm Lifecycle Registry.
 *
 * Keys are normalized algorithm identifiers (lowercase, hyphens).
 * Both services (edge-gateway, crypto-inventory-service) MUST use this as canonical source.
 */
export const ALGORITHM_LIFECYCLE_REGISTRY: Readonly<Record<string, AlgorithmLifecycleMetadata>> = {
	// ─── KEM Algorithms (FIPS 203 - ML-KEM) ────────────────────────────
	"kyber-512": {
		name: "ML-KEM-512",
		type: "kem",
		status: "NIST_FINAL",
		nistStandard: "FIPS 203",
		securityLevel: 1,
	},
	"kyber-768": {
		name: "ML-KEM-768",
		type: "kem",
		status: "NIST_FINAL",
		nistStandard: "FIPS 203",
		securityLevel: 3,
	},
	"kyber-1024": {
		name: "ML-KEM-1024",
		type: "kem",
		status: "NIST_FINAL",
		nistStandard: "FIPS 203",
		securityLevel: 5,
	},

	// ─── Signature Algorithms (FIPS 204 - ML-DSA) ──────────────────────
	"dilithium-2": {
		name: "ML-DSA-44",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 204",
		securityLevel: 2,
	},
	"dilithium-3": {
		name: "ML-DSA-65",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 204",
		securityLevel: 3,
	},
	"dilithium-5": {
		name: "ML-DSA-87",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 204",
		securityLevel: 5,
	},

	// ─── SPHINCS+ (FIPS 205 - SLH-DSA) ─────────────────────────────────
	// All 12 parameter sets: SHA-2 / SHAKE x 128 / 192 / 256 x fast / small.
	// Security level comes from the parameter-set suffix (128 -> 1, 192 -> 3,
	// 256 -> 5); the fast/small axis only trades signature size against signing
	// time and does not change the NIST category. Omitting any set here makes it
	// invisible to level-based policy checks (it would floor at 0), so the full
	// matrix is tracked even though only the 256-bit sets are production defaults.
	"sphincs-sha2-128f-simple": {
		name: "SLH-DSA-SHA2-128f",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 1,
	},
	"sphincs-sha2-128s-simple": {
		name: "SLH-DSA-SHA2-128s",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 1,
	},
	"sphincs-sha2-192f-simple": {
		name: "SLH-DSA-SHA2-192f",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 3,
	},
	"sphincs-sha2-192s-simple": {
		name: "SLH-DSA-SHA2-192s",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 3,
	},
	"sphincs-sha2-256f-simple": {
		name: "SLH-DSA-SHA2-256f",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 5,
	},
	"sphincs-sha2-256s-simple": {
		name: "SLH-DSA-SHA2-256s",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 5,
	},
	"sphincs-shake-128f-simple": {
		name: "SLH-DSA-SHAKE-128f",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 1,
	},
	"sphincs-shake-128s-simple": {
		name: "SLH-DSA-SHAKE-128s",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 1,
	},
	"sphincs-shake-192f-simple": {
		name: "SLH-DSA-SHAKE-192f",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 3,
	},
	"sphincs-shake-192s-simple": {
		name: "SLH-DSA-SHAKE-192s",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 3,
	},
	"sphincs-shake-256f-simple": {
		name: "SLH-DSA-SHAKE-256f",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 5,
	},
	"sphincs-shake-256s-simple": {
		name: "SLH-DSA-SHAKE-256s",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 5,
	},

	// ─── FN-DSA / Falcon (FIPS 206 - Initial Public Draft submitted 2025) ──
	"falcon-512": {
		name: "FN-DSA-512",
		type: "signature",
		status: "NIST_DRAFT",
		nistStandard: "FIPS 206 (draft)",
		processStage: "FIPS 206 initial public draft; FN-DSA standardization underway",
		securityLevel: 1,
	},
	"falcon-1024": {
		name: "FN-DSA-1024",
		type: "signature",
		status: "NIST_DRAFT",
		nistStandard: "FIPS 206 (draft)",
		processStage: "FIPS 206 initial public draft; FN-DSA standardization underway",
		securityLevel: 5,
	},

	// ─── HQC (NIST selected March 2025, draft standard expected 2026) ───
	"hqc-128": {
		name: "HQC-128",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "NIST-selected backup KEM (March 2025); draft standard pending",
		securityLevel: 1,
	},
	"hqc-192": {
		name: "HQC-192",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "NIST-selected backup KEM (March 2025); draft standard pending",
		securityLevel: 3,
	},
	"hqc-256": {
		name: "HQC-256",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "NIST-selected backup KEM (March 2025); draft standard pending",
		securityLevel: 5,
	},

	// ─── NIST Round 4 / additional-signature candidates ────────────────
	// Every algorithm admitted by a crypto policy tier must carry a level here,
	// otherwise level-based checks floor it at 0. These entries mirror the
	// full 90-algorithm catalog (`SUPPORTED_KEM_ALGORITHMS` /
	// `SUPPORTED_SIGNATURE_ALGORITHMS`) and are guarded by
	// `algorithm-lifecycle.test.ts` plus the tier-policy parity test.
	"bike-l1": {
		name: "BIKE-L1",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "NIST Round 4 candidate",
		securityLevel: 1,
	},
	"bike-l3": {
		name: "BIKE-L3",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "NIST Round 4 candidate",
		securityLevel: 3,
	},
	"bike-l5": {
		name: "BIKE-L5",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "NIST Round 4 candidate",
		securityLevel: 5,
	},
	"mceliece-348864": {
		name: "Classic-McEliece-348864",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 1,
	},
	"mceliece-460896": {
		name: "Classic-McEliece-460896",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 3,
	},
	"mceliece-6688128": {
		name: "Classic-McEliece-6688128",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 5,
	},
	"mceliece-6960119": {
		name: "Classic-McEliece-6960119",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 5,
	},
	"mceliece-8192128": {
		name: "Classic-McEliece-8192128",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 5,
	},
	"frodokem-640-aes": {
		name: "FrodoKEM-640-AES",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 1,
	},
	"frodokem-640-shake": {
		name: "FrodoKEM-640-SHAKE",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 1,
	},
	"frodokem-976-aes": {
		name: "FrodoKEM-976-AES",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 3,
	},
	"frodokem-976-shake": {
		name: "FrodoKEM-976-SHAKE",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 3,
	},
	"frodokem-1344-aes": {
		name: "FrodoKEM-1344-AES",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 5,
	},
	"frodokem-1344-shake": {
		name: "FrodoKEM-1344-SHAKE",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 5,
	},
	"ntru-hps-2048-509": {
		name: "NTRU-HPS-2048-509",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 1,
	},
	"ntru-hps-2048-677": {
		name: "NTRU-HPS-2048-677",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 3,
	},
	"ntru-hps-4096-821": {
		name: "NTRU-HPS-4096-821",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 5,
	},
	"ntru-hps-4096-1229": {
		name: "NTRU-HPS-4096-1229",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 5,
	},
	"ntru-hrss-701": {
		name: "NTRU-HRSS-701",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 3,
	},
	"ntru-hrss-1373": {
		name: "NTRU-HRSS-1373",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 5,
	},
	sntrup761: {
		name: "sntrup761",
		type: "kem",
		status: "NIST_DRAFT",
		processStage: "Not selected for NIST standardization; supported for algorithmic diversity",
		securityLevel: 3,
	},
	"mayo-1": {
		name: "MAYO-1",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"mayo-2": {
		name: "MAYO-2",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"mayo-3": {
		name: "MAYO-3",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 3,
	},
	"mayo-5": {
		name: "MAYO-5",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 5,
	},
	"cross-rsdp-128-balanced": {
		name: "CROSS-RSDP-128-balanced",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 1,
	},
	"cross-rsdp-128-fast": {
		name: "CROSS-RSDP-128-fast",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 1,
	},
	"cross-rsdp-128-small": {
		name: "CROSS-RSDP-128-small",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 1,
	},
	"cross-rsdp-192-balanced": {
		name: "CROSS-RSDP-192-balanced",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 3,
	},
	"cross-rsdp-192-fast": {
		name: "CROSS-RSDP-192-fast",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 3,
	},
	"cross-rsdp-192-small": {
		name: "CROSS-RSDP-192-small",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 3,
	},
	"cross-rsdp-256-balanced": {
		name: "CROSS-RSDP-256-balanced",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 5,
	},
	"cross-rsdp-256-fast": {
		name: "CROSS-RSDP-256-fast",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 5,
	},
	"cross-rsdp-256-small": {
		name: "CROSS-RSDP-256-small",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 5,
	},
	"cross-rsdpg-128-balanced": {
		name: "CROSS-RSDPG-128-balanced",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 1,
	},
	"cross-rsdpg-128-fast": {
		name: "CROSS-RSDPG-128-fast",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 1,
	},
	"cross-rsdpg-128-small": {
		name: "CROSS-RSDPG-128-small",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 1,
	},
	"cross-rsdpg-192-balanced": {
		name: "CROSS-RSDPG-192-balanced",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 3,
	},
	"cross-rsdpg-192-fast": {
		name: "CROSS-RSDPG-192-fast",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 3,
	},
	"cross-rsdpg-192-small": {
		name: "CROSS-RSDPG-192-small",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 3,
	},
	"cross-rsdpg-256-balanced": {
		name: "CROSS-RSDPG-256-balanced",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 5,
	},
	"cross-rsdpg-256-fast": {
		name: "CROSS-RSDPG-256-fast",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 5,
	},
	"cross-rsdpg-256-small": {
		name: "CROSS-RSDPG-256-small",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 2; not advanced to Round 3 (October 2026)",
		securityLevel: 5,
	},
	"ov-Is": {
		name: "OV-Is",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"ov-Ip": {
		name: "OV-Ip",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"ov-III": {
		name: "OV-III",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 3,
	},
	"ov-V": {
		name: "OV-V",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 5,
	},
	"ov-Is-pkc": {
		name: "OV-Is-pkc",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"ov-Ip-pkc": {
		name: "OV-Ip-pkc",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"ov-III-pkc": {
		name: "OV-III-pkc",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 3,
	},
	"ov-V-pkc": {
		name: "OV-V-pkc",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 5,
	},
	"ov-Is-pkc-skc": {
		name: "OV-Is-pkc-skc",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"ov-Ip-pkc-skc": {
		name: "OV-Ip-pkc-skc",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"ov-III-pkc-skc": {
		name: "OV-III-pkc-skc",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 3,
	},
	"ov-V-pkc-skc": {
		name: "OV-V-pkc-skc",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 5,
	},
	"snova-24-5-4": {
		name: "SNOVA-24-5-4",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"snova-24-5-4-shake": {
		name: "SNOVA-24-5-4-SHAKE",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"snova-24-5-4-esk": {
		name: "SNOVA-24-5-4-esk",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"snova-24-5-4-shake-esk": {
		name: "SNOVA-24-5-4-SHAKE-esk",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"snova-25-8-3": {
		name: "SNOVA-25-8-3",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"snova-37-17-2": {
		name: "SNOVA-37-17-2",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 3,
	},
	"snova-37-8-4": {
		name: "SNOVA-37-8-4",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 3,
	},
	"snova-24-5-5": {
		name: "SNOVA-24-5-5",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 1,
	},
	"snova-56-25-2": {
		name: "SNOVA-56-25-2",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 5,
	},
	"snova-49-11-3": {
		name: "SNOVA-49-11-3",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 5,
	},
	"snova-60-10-4": {
		name: "SNOVA-60-10-4",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 5,
	},
	"snova-29-6-5": {
		name: "SNOVA-29-6-5",
		type: "signature",
		status: "NIST_DRAFT",
		processStage: "NIST Additional Signatures Round 3 candidate (October 2026)",
		securityLevel: 3,
	},

	// ─── Classical Signature Algorithms (quantum-vulnerable) ────────────
	"rsa-2048": {
		name: "RSA-2048",
		type: "signature",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: NIST_IR_8547.deprecationDate,
		removalDate: NIST_IR_8547.removalDate,
		replacementAlgorithm: "dilithium-2",
	},
	"rsa-4096": {
		name: "RSA-4096",
		type: "signature",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: NIST_IR_8547.deprecationDate,
		removalDate: NIST_IR_8547.removalDate,
		replacementAlgorithm: "dilithium-3",
	},
	"ecdsa-p256": {
		name: "ECDSA-P256",
		type: "signature",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: NIST_IR_8547.deprecationDate,
		removalDate: NIST_IR_8547.removalDate,
		replacementAlgorithm: "dilithium-2",
	},
	"ecdsa-p384": {
		name: "ECDSA-P384",
		type: "signature",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: NIST_IR_8547.deprecationDate,
		removalDate: NIST_IR_8547.removalDate,
		replacementAlgorithm: "dilithium-3",
	},
	ed25519: {
		name: "Ed25519",
		type: "signature",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: NIST_IR_8547.deprecationDate,
		removalDate: NIST_IR_8547.removalDate,
		replacementAlgorithm: "dilithium-2",
	},

	// ─── Classical KEM / Key Agreement (quantum-vulnerable) ─────────────
	"ecdh-p256": {
		name: "ECDH-P256",
		type: "kem",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: NIST_IR_8547.deprecationDate,
		removalDate: NIST_IR_8547.removalDate,
		replacementAlgorithm: "kyber-768",
	},
	"ecdh-p384": {
		name: "ECDH-P384",
		type: "kem",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: NIST_IR_8547.deprecationDate,
		removalDate: NIST_IR_8547.removalDate,
		replacementAlgorithm: "kyber-1024",
	},
	"dh-2048": {
		name: "DH-2048",
		type: "kem",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: NIST_IR_8547.deprecationDate,
		removalDate: NIST_IR_8547.removalDate,
		replacementAlgorithm: "kyber-768",
	},
	"rsa-oaep-2048": {
		name: "RSA-OAEP-2048",
		type: "kem",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: NIST_IR_8547.deprecationDate,
		removalDate: NIST_IR_8547.removalDate,
		replacementAlgorithm: "kyber-768",
	},

	// ─── Symmetric Algorithms (quantum-resistant) ───────────────────────
	"aes-256-gcm": {
		name: "AES-256-GCM",
		type: "symmetric",
		status: "NIST_FINAL",
		nistStandard: "FIPS 197",
		securityLevel: 5,
	},
	"aes-256-cbc": {
		name: "AES-256-CBC",
		type: "symmetric",
		status: "NIST_FINAL",
		nistStandard: "FIPS 197",
		securityLevel: 5,
	},
	"aes-128-gcm": {
		name: "AES-128-GCM",
		type: "symmetric",
		status: "CLASSICAL",
		nistStandard: "FIPS 197",
		securityLevel: 1,
	},
	"chacha20-poly1305": {
		name: "ChaCha20-Poly1305",
		type: "symmetric",
		status: "NIST_FINAL",
		securityLevel: 5,
	},

	// ─── Hash Algorithms ────────────────────────────────────────────────
	// NIST categories 2/4/5 are defined as "as hard as finding a collision" in
	// SHA-256/SHA-384/SHA-512 respectively (FIPS 203 §"Security strength"), so a
	// 256-bit digest is level 2, not level 3. Level 4 is only reachable through a
	// 384-bit hash: no FIPS 203/204/205 parameter set lands on level 4.
	"sha3-256": {
		name: "SHA3-256",
		type: "hash",
		status: "NIST_FINAL",
		nistStandard: "FIPS 202",
		securityLevel: 2,
	},
	"sha3-384": {
		name: "SHA3-384",
		type: "hash",
		status: "NIST_FINAL",
		nistStandard: "FIPS 202",
		securityLevel: 4,
	},
	"sha3-512": {
		name: "SHA3-512",
		type: "hash",
		status: "NIST_FINAL",
		nistStandard: "FIPS 202",
		securityLevel: 5,
	},
	"sha-256": {
		name: "SHA-256",
		type: "hash",
		status: "NIST_FINAL",
		nistStandard: "FIPS 180-4",
		securityLevel: 2,
	},
	"sha-384": {
		name: "SHA-384",
		type: "hash",
		status: "NIST_FINAL",
		nistStandard: "FIPS 180-4",
		securityLevel: 4,
	},
	"sha-512": {
		name: "SHA-512",
		type: "hash",
		status: "NIST_FINAL",
		nistStandard: "FIPS 180-4",
		securityLevel: 5,
	},
};

/**
 * Normalize an algorithm identifier for registry lookup.
 *
 * Registry keys keep the publisher casing (liboqs uses `OV-Is`, not `ov-is`), so
 * every lookup normalizes both the key and the query. Without the index below,
 * the 12 mixed-case UOV identifiers were unreachable and resolved as unknown
 * algorithms at enforcement time.
 */
export function normalizeAlgorithmId(algorithm: string): string {
	return algorithm.toLowerCase().replace(/_/g, "-").trim();
}

const NORMALIZED_LIFECYCLE_INDEX: Readonly<Record<string, AlgorithmLifecycleMetadata>> =
	Object.fromEntries(
		Object.entries(ALGORITHM_LIFECYCLE_REGISTRY).map(([id, meta]) => [
			normalizeAlgorithmId(id),
			meta,
		]),
	);

/**
 * Look up algorithm lifecycle metadata by identifier.
 * Returns null if the algorithm is unknown.
 */
export function getAlgorithmLifecycle(algorithm: string): AlgorithmLifecycleMetadata | null {
	return NORMALIZED_LIFECYCLE_INDEX[normalizeAlgorithmId(algorithm)] ?? null;
}

/**
 * Check whether an algorithm is considered PQC-safe (NIST_FINAL or quantum-resistant symmetric).
 */
export function isAlgorithmPqcSafe(algorithm: string): boolean {
	const metadata = getAlgorithmLifecycle(algorithm);
	if (!metadata) return false;
	return metadata.status === "NIST_FINAL" || metadata.status === "NIST_DRAFT";
}

/**
 * Check whether an algorithm is deprecated or quantum-vulnerable.
 */
export function isAlgorithmDeprecated(algorithm: string): boolean {
	const metadata = getAlgorithmLifecycle(algorithm);
	if (!metadata) return false;
	return metadata.status === "DEPRECATED" || metadata.status === "FORBIDDEN";
}

/**
 * Whether a scheduled ISO date has been reached at instant `at`.
 * Exported pure so every branch (absent date, unparsable date, past, future)
 * is unit-testable - the transition schedule must never have dead branches.
 */
export function hasScheduleReached(isoDate: string | undefined, at: Date): boolean {
	if (!isoDate) return false;
	const when = Date.parse(isoDate);
	if (Number.isNaN(when)) return false;
	return at.getTime() >= when;
}

/**
 * Whether NIST's transition schedule (IR 8547) has removed the algorithm at the
 * given instant: deprecated after 2030, removed from the standards after 2035.
 * Distinct from {@link isAlgorithmDeprecated}, which reports the *declared*
 * status rather than the schedule. Every DEPRECATED/FORBIDDEN entry carries a
 * removalDate (registry invariant, guarded in tests), so the date alone decides.
 */
export function isAlgorithmRemovedAt(algorithm: string, at: Date): boolean {
	const metadata = getAlgorithmLifecycle(algorithm);
	if (!metadata) return false;
	return hasScheduleReached(metadata.removalDate, at);
}

/** Whether the algorithm is past its NIST deprecation date (IR 8547: 2030). */
export function isAlgorithmDeprecatedAt(algorithm: string, at: Date): boolean {
	const metadata = getAlgorithmLifecycle(algorithm);
	if (!metadata) return false;
	return hasScheduleReached(metadata.deprecationDate, at);
}

/**
 * List all algorithms filtered by lifecycle status.
 */
export function listAlgorithmsByStatus(
	status: AlgorithmLifecycleStatus,
): ReadonlyArray<{ id: string } & AlgorithmLifecycleMetadata> {
	return Object.entries(ALGORITHM_LIFECYCLE_REGISTRY)
		.filter(([, meta]) => meta.status === status)
		.map(([id, meta]) => ({ id, ...meta }));
}

/**
 * List all algorithms filtered by type.
 */
export function listAlgorithmsByType(
	type: AlgorithmLifecycleMetadata["type"],
): ReadonlyArray<{ id: string } & AlgorithmLifecycleMetadata> {
	return Object.entries(ALGORITHM_LIFECYCLE_REGISTRY)
		.filter(([, meta]) => meta.type === type)
		.map(([id, meta]) => ({ id, ...meta }));
}
