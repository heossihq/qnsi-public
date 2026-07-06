/**
 * Algorithm catalog — canonical registry of every PQC algorithm family
 * QNSI ships, used by /algorithms (catalog index) and
 * /algorithms/[family] (per-family pages).
 *
 * Source-of-truth for the FIPS-finalised families (ML-KEM, ML-DSA, SLH-DSA):
 *   - FIPS 203 / 204 / 205 (Aug 2024) — official NIST specifications
 *   - apps/web/scripts/run-nist-acvp-conformance.ts — ACVP runner
 *   - apps/web/public/pqc-evidence/acvp-latest.json — pass/fail counts
 *
 * Source-of-truth for the broader liboqs surface (BIKE, McEliece,
 * FrodoKEM, NTRU, NTRU-Prime, Falcon, MAYO, CROSS, UOV, SNOVA):
 *   - github.com/open-quantum-safe/liboqs @ 0.15.0 — src/kem/kem.h + src/sig/sig.h
 *   - tooling/liboqs-src/ (local clone for inspection)
 *
 * Keep ACVP-status fields aligned with /verify/conformance evidence
 * (regenerated per release). Numbers here are HUMAN-FRIENDLY SUMMARIES,
 * the authoritative source is the SHA-3-256-digested JSON on
 * /pqc-evidence/acvp-latest.json.
 */

export type AlgorithmType = "KEM" | "Signature";
export type AlgorithmFamilyKind =
	| "lattice-based"
	| "code-based"
	| "hash-based"
	| "multivariate"
	| "isogeny-based";
export type FipsStatus = "FIPS-finalised" | "FIPS-pending" | "non-FIPS";
export type AcvpStatus = "passing" | "partial" | "deferred" | "non-addressable";
export type CryptoPolicyTier = "default" | "strict" | "maximum" | "government";

export interface AlgorithmVariant {
	readonly name: string; // canonical NIST / liboqs name, e.g. "ML-KEM-768"
	readonly securityLevel: 1 | 2 | 3 | 4 | 5;
	readonly publicKeyBytes: number;
	readonly secretKeyBytes: number;
	readonly ciphertextBytes?: number; // KEMs only
	readonly signatureBytes?: number; // signatures only
	readonly note?: string;
}

export interface AlgorithmFamily {
	readonly slug: string; // URL slug, e.g. "ml-kem"
	readonly name: string; // display name, e.g. "ML-KEM"
	readonly longName: string;
	readonly aliases: readonly string[]; // other names this family is known by
	readonly type: AlgorithmType;
	readonly familyKind: AlgorithmFamilyKind;
	readonly fipsStandard?: string; // "FIPS 203", "FIPS 204", "FIPS 205", "FIPS 206 (pending)", or undefined
	readonly fipsStatus: FipsStatus;
	readonly summary: string; // 1-2 sentence positioning
	readonly mechanism: string; // 1 paragraph — how it works at a high level
	readonly variants: readonly AlgorithmVariant[];
	readonly qnspSupport: {
		readonly providers: readonly ("noble" | "liboqs")[];
		readonly minimumTier: CryptoPolicyTier;
		readonly defaultForTier?: CryptoPolicyTier;
	};
	readonly acvp: {
		readonly nobleStatus: AcvpStatus;
		readonly liboqsStatus: AcvpStatus;
		readonly note?: string;
	};
	readonly useCases: readonly string[];
	readonly tradeoffs: readonly string[];
	readonly references: {
		readonly nistPdf?: string;
		readonly upstreamCode?: string;
		readonly designPaper?: string;
	};
}

export const ALGORITHM_CATALOG: readonly AlgorithmFamily[] = [
	// ────────────────────────── FIPS-finalised KEMs ──────────────────────────
	{
		slug: "ml-kem",
		name: "ML-KEM",
		longName: "Module-Lattice-based Key Encapsulation Mechanism",
		aliases: ["Kyber", "CRYSTALS-Kyber", "Module-LWE KEM"],
		type: "KEM",
		familyKind: "lattice-based",
		fipsStandard: "FIPS 203",
		fipsStatus: "FIPS-finalised",
		summary:
			"NIST's primary post-quantum key encapsulation standard, finalised August 2024 as FIPS 203. ML-KEM is QNSI's default KEM in every tier and powers PQC TLS key agreement, KMS-wrapped data keys, and vault secret encryption.",
		mechanism:
			"ML-KEM is built on the hardness of the Module Learning With Errors (Module-LWE) problem over polynomial rings. Encapsulation generates a 32-byte shared secret and a ciphertext that can be decapsulated only by the holder of the corresponding secret key. Parameter sets ML-KEM-512 / 768 / 1024 trade key size against security category (NIST levels 1 / 3 / 5). FIPS 203 §6.2 specifies a deterministic seed-driven Encaps_internal(ek, m) and Decaps_internal(dk, c) pair, which is exactly what NIST ACVP test vectors exercise.",
		variants: [
			{
				name: "ML-KEM-512",
				securityLevel: 1,
				publicKeyBytes: 800,
				secretKeyBytes: 1632,
				ciphertextBytes: 768,
				note: "Development / testing tier. Smallest key footprint.",
			},
			{
				name: "ML-KEM-768",
				securityLevel: 3,
				publicKeyBytes: 1184,
				secretKeyBytes: 2400,
				ciphertextBytes: 1088,
				note: "Production default across QNSI backend services. Recommended for hybrid PQC TLS (X25519+ML-KEM-768).",
			},
			{
				name: "ML-KEM-1024",
				securityLevel: 5,
				publicKeyBytes: 1568,
				secretKeyBytes: 3168,
				ciphertextBytes: 1568,
				note: "Maximum + Government crypto policy default. Required for `government` tier.",
			},
		],
		qnspSupport: {
			providers: ["noble", "liboqs"],
			minimumTier: "default",
			defaultForTier: "default",
		},
		acvp: {
			nobleStatus: "passing",
			liboqsStatus: "passing",
			note: "Both providers pass all 240 ML-KEM ACVP tests (keyGen 75 + encapsulation AFT 75 + decapsulation VAL 30 + §7.2/§7.3 key-validation 60). liboqs driven via OQS_KEM_keypair_derand + OQS_KEM_encaps_derand bindings shipped in @heossi/liboqs-native 0.15.1.",
		},
		useCases: [
			"PQC TLS key agreement (hybrid with X25519 for production)",
			"KMS-wrapped data keys (envelope encryption)",
			"Vault secret-key derivation",
			"PQC-encrypted object storage (SSE-X)",
			"Encrypted vector search index keys",
		],
		tradeoffs: [
			"Smallest combined key + ciphertext footprint of the FIPS-finalised KEMs",
			"Highest performance — sub-millisecond keygen / encaps / decaps on modern CPUs",
			"Module-LWE security assumption is well-studied but newer than RSA / ECDH classical assumptions",
		],
		references: {
			nistPdf: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.203.pdf",
			upstreamCode: "https://github.com/open-quantum-safe/liboqs/tree/main/src/kem/ml_kem",
			designPaper: "https://pq-crystals.org/kyber/",
		},
	},

	// ────────────────────────── FIPS-finalised Signatures ──────────────────────────
	{
		slug: "ml-dsa",
		name: "ML-DSA",
		longName: "Module-Lattice-based Digital Signature Algorithm",
		aliases: ["Dilithium", "CRYSTALS-Dilithium", "Module-LWE Signature"],
		type: "Signature",
		familyKind: "lattice-based",
		fipsStandard: "FIPS 204",
		fipsStatus: "FIPS-finalised",
		summary:
			"NIST's primary post-quantum digital signature standard, finalised August 2024 as FIPS 204. ML-DSA powers JWT signing, audit-log integrity, code-signing, and authn token issuance across QNSI.",
		mechanism:
			"ML-DSA is built on the hardness of the Module Learning With Errors (Module-LWE) and Module Short Integer Solution (Module-SIS) problems. Signatures are generated via the Fiat-Shamir transform applied to an identification protocol over polynomial rings. FIPS 204 Algorithm 1 specifies ML-DSA.KeyGen(ξ) where ξ is a 32-byte random seed, internally calling ML-DSA.KeyGen_internal(ξ). Parameter sets ML-DSA-44 / 65 / 87 target NIST security levels 2 / 3 / 5.",
		variants: [
			{
				name: "ML-DSA-44",
				securityLevel: 2,
				publicKeyBytes: 1312,
				secretKeyBytes: 2560,
				signatureBytes: 2420,
				note: "JWT signing default. Smallest signature size of the FIPS-finalised signatures.",
			},
			{
				name: "ML-DSA-65",
				securityLevel: 3,
				publicKeyBytes: 1952,
				secretKeyBytes: 4032,
				signatureBytes: 3309,
				note: "Strict policy tier default. Recommended for high-security JWT and audit signing.",
			},
			{
				name: "ML-DSA-87",
				securityLevel: 5,
				publicKeyBytes: 2592,
				secretKeyBytes: 4896,
				signatureBytes: 4627,
				note: "Maximum + Government default. Required for `government` tier.",
			},
		],
		qnspSupport: {
			providers: ["noble", "liboqs"],
			minimumTier: "default",
			defaultForTier: "default",
		},
		acvp: {
			nobleStatus: "passing",
			liboqsStatus: "deferred",
			note: "noble passes all 75 ML-DSA keyGen ACVP tests. liboqs keyGen tests deferred because liboqs C library 0.15.0 does not yet expose OQS_SIG_keypair_derand. Sign / verify operations run against test vectors that provide the keypair, so signature correctness is independently exercised at runtime by the cross-verification service on Maximum and Government policy tiers.",
		},
		useCases: [
			"JWT signing (auth-service default)",
			"Audit-log Merkle root signing (audit-service)",
			"Inter-service SPIFFE SVID signing",
			"Code-signing artefacts",
			"Compliance evidence-pack signing",
		],
		tradeoffs: [
			"Larger signatures than Falcon but faster signing and simpler implementation",
			"Constant-time reference implementation (side-channel resistant)",
			"Same Module-LWE security assumption as ML-KEM — assumption-economy across families",
		],
		references: {
			nistPdf: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf",
			upstreamCode: "https://github.com/open-quantum-safe/liboqs/tree/main/src/sig/ml_dsa",
			designPaper: "https://pq-crystals.org/dilithium/",
		},
	},

	{
		slug: "slh-dsa",
		name: "SLH-DSA",
		longName: "Stateless Hash-based Digital Signature Algorithm",
		aliases: ["SPHINCS+", "Stateless Hash-DSA"],
		type: "Signature",
		familyKind: "hash-based",
		fipsStandard: "FIPS 205",
		fipsStatus: "FIPS-finalised",
		summary:
			"NIST's hash-based digital signature standard, finalised August 2024 as FIPS 205. SLH-DSA's security rests only on the hardness of finding hash function preimages — the most conservative assumption available — making it the natural choice for long-archival signatures and government-tier policy.",
		mechanism:
			"SLH-DSA combines a few-time hash signature (FORS) with a hypertree of one-time signatures (WOTS+) glued together using Merkle trees. The result is a stateless signature scheme whose security reduces solely to the security of the underlying hash function (SHA-2 or SHAKE). 12 parameter sets cover combinations of {SHA2, SHAKE} × {128, 192, 256 bits} × {fast, small}. The `f` (fast) variants prioritise signing speed; `s` (small) variants prioritise signature size.",
		variants: [
			{
				name: "SLH-DSA-SHA2-128s",
				securityLevel: 1,
				publicKeyBytes: 32,
				secretKeyBytes: 64,
				signatureBytes: 7856,
				note: "Smallest signature, slower signing. Hash: SHA-2-256.",
			},
			{
				name: "SLH-DSA-SHA2-128f",
				securityLevel: 1,
				publicKeyBytes: 32,
				secretKeyBytes: 64,
				signatureBytes: 17088,
				note: "Faster signing, larger signature. Hash: SHA-2-256.",
			},
			{
				name: "SLH-DSA-SHA2-256s",
				securityLevel: 5,
				publicKeyBytes: 64,
				secretKeyBytes: 128,
				signatureBytes: 29792,
				note: "Maximum / Government tier — smallest sig variant.",
			},
			{
				name: "SLH-DSA-SHA2-256f",
				securityLevel: 5,
				publicKeyBytes: 64,
				secretKeyBytes: 128,
				signatureBytes: 49856,
				note: "Maximum / Government tier — faster signing variant.",
			},
			{
				name: "SLH-DSA-SHAKE-128s / 128f / 192s / 192f / 256s / 256f",
				securityLevel: 5,
				publicKeyBytes: 32,
				secretKeyBytes: 64,
				signatureBytes: 7856,
				note: "SHAKE-based variants (6 additional). Identical security categories; SHAKE provides constant-time XOF for environments where SHA-2 acceleration is unavailable.",
			},
		],
		qnspSupport: {
			providers: ["noble", "liboqs"],
			minimumTier: "default",
		},
		acvp: {
			nobleStatus: "passing",
			liboqsStatus: "deferred",
			note: "noble passes all 120 SLH-DSA keyGen ACVP tests across all 12 parameter sets. liboqs keyGen tests deferred (same OQS_SIG_keypair_derand gap as ML-DSA).",
		},
		useCases: [
			"Long-archival signatures (decades-long validity)",
			"Government tier (FIPS-finalised conservative-assumption requirement)",
			"Code-signing for high-assurance artefacts",
			"Independent cross-verification of ML-DSA signatures (different security assumption)",
		],
		tradeoffs: [
			"Largest signatures of any FIPS-finalised PQC scheme (8 KB – 50 KB depending on parameter set)",
			"Slowest signing performance — milliseconds, not microseconds",
			"Strongest security argument — relies only on hash function security",
			"Stateless: no key-use counter to maintain (unlike LMS / XMSS)",
		],
		references: {
			nistPdf: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.205.pdf",
			upstreamCode: "https://github.com/open-quantum-safe/liboqs/tree/main/src/sig/sphincs",
			designPaper: "https://sphincs.org/",
		},
	},

	// ────────────────────────── Pending FIPS Signatures ──────────────────────────
	{
		slug: "fn-dsa",
		name: "FN-DSA",
		longName: "FFT-based NTRU Digital Signature Algorithm",
		aliases: ["Falcon", "Falcon-512", "Falcon-1024"],
		type: "Signature",
		familyKind: "lattice-based",
		fipsStandard: "FIPS 206 (pending)",
		fipsStatus: "FIPS-pending",
		summary:
			"NIST's fourth standardised PQC signature scheme, formally FN-DSA under FIPS 206 — the initial public draft is still pending as of mid-2026. Falcon's signatures are the most compact of the lattice-based PQC schemes, making it preferred for size-constrained transport.",
		mechanism:
			"Falcon uses the GPV trapdoor framework over NTRU lattices, with signatures generated via a discrete Gaussian sampler over the lattice. The result is signatures roughly 1/4 the size of equivalent-security ML-DSA signatures. The implementation complexity is higher than ML-DSA (floating-point Gaussian sampling requires care to avoid side-channels and rounding errors), which is why ML-DSA shipped first.",
		variants: [
			{
				name: "Falcon-512",
				securityLevel: 1,
				publicKeyBytes: 897,
				secretKeyBytes: 1281,
				signatureBytes: 666,
				note: "Smallest Falcon parameter set. Useful when signature bandwidth is the hard constraint.",
			},
			{
				name: "Falcon-1024",
				securityLevel: 5,
				publicKeyBytes: 1793,
				secretKeyBytes: 2305,
				signatureBytes: 1280,
				note: "High-security Falcon. Government workloads requiring compact signatures but not strictly limited to FIPS-finalised algorithms.",
			},
		],
		qnspSupport: {
			providers: ["liboqs"],
			minimumTier: "default",
		},
		acvp: {
			nobleStatus: "non-addressable",
			liboqsStatus: "non-addressable",
			note: "NIST has not yet published ACVP test vectors for Falcon (vectors will land alongside the FIPS 206 final standard). Falcon signatures are exercised via internal sign/verify test suites only.",
		},
		useCases: [
			"Size-constrained transport (where every byte counts — embedded, IoT, mobile)",
			"Standalone QNSI signatures when bandwidth dominates over CPU cost",
			"Future government / defence workloads pending FIPS 206 finalisation",
		],
		tradeoffs: [
			"Smallest signatures among lattice-based PQC schemes",
			"More complex implementation than ML-DSA — Gaussian sampling side-channels require careful engineering",
			"Not yet FIPS-finalised; do not use for FIPS-only government workloads until FIPS 206 lands",
		],
		references: {
			designPaper: "https://falcon-sign.info/",
			upstreamCode: "https://github.com/open-quantum-safe/liboqs/tree/main/src/sig/falcon",
		},
	},

	// ────────────────────────── Non-FIPS code-based KEMs ──────────────────────────
	{
		slug: "bike",
		name: "BIKE",
		longName: "Bit Flipping Key Encapsulation",
		aliases: ["Bit-Flipping KEM"],
		type: "KEM",
		familyKind: "code-based",
		fipsStatus: "non-FIPS",
		summary:
			"Code-based KEM finalist (round 4 of NIST PQC standardisation) using QC-MDPC codes. Available in liboqs for QNSI customers seeking additional code-based alternatives.",
		mechanism:
			"BIKE uses Quasi-Cyclic Moderate Density Parity Check (QC-MDPC) codes. Decryption involves iterative bit-flipping decoders. Three parameter sets target NIST security categories 1, 3, and 5.",
		variants: [
			{
				name: "BIKE-L1",
				securityLevel: 1,
				publicKeyBytes: 1541,
				secretKeyBytes: 5223,
				ciphertextBytes: 1573,
			},
			{
				name: "BIKE-L3",
				securityLevel: 3,
				publicKeyBytes: 3083,
				secretKeyBytes: 10105,
				ciphertextBytes: 3115,
			},
			{
				name: "BIKE-L5",
				securityLevel: 5,
				publicKeyBytes: 5122,
				secretKeyBytes: 16494,
				ciphertextBytes: 5154,
			},
		],
		qnspSupport: {
			providers: ["liboqs"],
			minimumTier: "default",
		},
		acvp: {
			nobleStatus: "non-addressable",
			liboqsStatus: "non-addressable",
			note: "Not selected for FIPS standardisation; no NIST ACVP vectors.",
		},
		useCases: [
			"Customer workloads requiring code-based alternatives beyond HQC",
			"Research and migration analysis",
		],
		tradeoffs: [
			"Secret keys are larger than HQC at equivalent security levels",
			"Not on the NIST PQC standardisation path — defer to HQC unless specific needs",
		],
		references: {
			designPaper: "https://bikesuite.org/",
			upstreamCode: "https://github.com/open-quantum-safe/liboqs/tree/main/src/kem/bike",
		},
	},

	{
		slug: "classic-mceliece",
		name: "Classic McEliece",
		longName: "Classic McEliece Code-Based KEM",
		aliases: ["McEliece", "Niederreiter"],
		type: "KEM",
		familyKind: "code-based",
		fipsStatus: "non-FIPS",
		summary:
			"The original code-based public-key cryptosystem, in continuous study since 1978 — by far the oldest cryptographic assumption in the PQC catalogue. Trades extremely large public keys for the most-studied security assumption available.",
		mechanism:
			"Classic McEliece uses binary Goppa codes. The public key is a permuted, scrambled generator matrix; the secret key is the underlying Goppa code structure. Encryption adds error vectors to a codeword; decryption uses Patterson's algorithm to correct the errors. Security has been studied continuously for 47+ years with no major breaks.",
		variants: [
			{
				name: "mceliece348864 / 460896 / 6688128 / 6960119 / 8192128",
				securityLevel: 5,
				publicKeyBytes: 261120,
				secretKeyBytes: 6452,
				ciphertextBytes: 96,
				note: "5 parameter sets covering NIST security categories 1, 3, and 5. Public keys range 261 KB – 1.36 MB.",
			},
		],
		qnspSupport: {
			providers: ["liboqs"],
			minimumTier: "maximum",
		},
		acvp: {
			nobleStatus: "non-addressable",
			liboqsStatus: "non-addressable",
		},
		useCases: [
			"Highest-assurance workloads where conservative assumption value outweighs key-size cost",
			"Stable long-term keys where the one-time public-key bandwidth is acceptable (private CA keys, root signing identities)",
		],
		tradeoffs: [
			"Public keys are 100x-1000x larger than ML-KEM-1024 — fundamentally not suitable for TLS or per-session usage",
			"Smallest ciphertexts in the PQC catalogue (96-240 bytes)",
			"Best-studied PQC security assumption (47+ years of cryptanalysis)",
		],
		references: {
			designPaper: "https://classic.mceliece.org/",
			upstreamCode:
				"https://github.com/open-quantum-safe/liboqs/tree/main/src/kem/classic_mceliece",
		},
	},

	{
		slug: "frodokem",
		name: "FrodoKEM",
		longName: "Frodo Key Encapsulation Mechanism",
		aliases: ["Frodo"],
		type: "KEM",
		familyKind: "lattice-based",
		fipsStatus: "non-FIPS",
		summary:
			"Plain Learning With Errors (LWE) KEM — same lattice family as ML-KEM but without the additional ring or module structure. Larger keys and ciphertexts but built on the most conservative lattice assumption.",
		mechanism:
			"FrodoKEM operates on plain LWE (no ring / module structure), avoiding any potential structural cryptanalysis advances against ring-LWE / module-LWE. The trade-off is significantly larger parameters. Two hash function variants (AES, SHAKE) × three security categories.",
		variants: [
			{
				name: "FrodoKEM-640-AES / SHAKE",
				securityLevel: 1,
				publicKeyBytes: 9616,
				secretKeyBytes: 19888,
				ciphertextBytes: 9720,
			},
			{
				name: "FrodoKEM-976-AES / SHAKE",
				securityLevel: 3,
				publicKeyBytes: 15632,
				secretKeyBytes: 31296,
				ciphertextBytes: 15744,
			},
			{
				name: "FrodoKEM-1344-AES / SHAKE",
				securityLevel: 5,
				publicKeyBytes: 21520,
				secretKeyBytes: 43088,
				ciphertextBytes: 21632,
			},
		],
		qnspSupport: {
			providers: ["liboqs"],
			minimumTier: "maximum",
		},
		acvp: {
			nobleStatus: "non-addressable",
			liboqsStatus: "non-addressable",
		},
		useCases: [
			"Customers requiring plain-LWE assumption (no module structure)",
			"Conservative lattice-based fallback under defence-in-depth policies",
		],
		tradeoffs: [
			"~10x larger keys and ciphertexts than ML-KEM at equivalent security levels",
			"Most conservative lattice assumption available",
		],
		references: {
			designPaper: "https://frodokem.org/",
			upstreamCode: "https://github.com/open-quantum-safe/liboqs/tree/main/src/kem/frodokem",
		},
	},

	{
		slug: "ntru",
		name: "NTRU",
		longName: "Number Theoretic Research Unit Cryptosystem",
		aliases: ["NTRU-HRSS", "NTRU-HPS"],
		type: "KEM",
		familyKind: "lattice-based",
		fipsStatus: "non-FIPS",
		summary:
			"One of the oldest lattice-based KEMs, in continuous study since 1996. NTRU was a NIST PQC finalist but not selected for FIPS standardisation in favour of ML-KEM.",
		mechanism:
			"NTRU operates over polynomial rings Z[x] / (x^n - 1) with small-coefficient polynomial inverses. Multiple parameter sets exist across NTRU-HPS and NTRU-HRSS variants.",
		variants: [
			{
				name: "ntru_hps2048509 / 677 / 821 / 1229",
				securityLevel: 1,
				publicKeyBytes: 699,
				secretKeyBytes: 935,
				ciphertextBytes: 699,
			},
			{
				name: "ntru_hrss701 / 1373",
				securityLevel: 3,
				publicKeyBytes: 1138,
				secretKeyBytes: 1450,
				ciphertextBytes: 1138,
			},
		],
		qnspSupport: {
			providers: ["liboqs"],
			minimumTier: "default",
		},
		acvp: {
			nobleStatus: "non-addressable",
			liboqsStatus: "non-addressable",
		},
		useCases: ["Migration from legacy NTRU deployments", "Research and comparative analysis"],
		tradeoffs: [
			"Not on the NIST standardisation path — defer to ML-KEM for new deployments",
			"30+ years of cryptanalytic study",
		],
		references: {
			upstreamCode: "https://github.com/open-quantum-safe/liboqs/tree/main/src/kem/ntru",
		},
	},

	{
		slug: "ntru-prime",
		name: "NTRU Prime",
		longName: "NTRU Prime (Streamlined / Light NTRU Prime)",
		aliases: ["sntrup761", "ntrulpr761"],
		type: "KEM",
		familyKind: "lattice-based",
		fipsStatus: "non-FIPS",
		summary:
			"NTRU variant designed to use a prime-degree ring polynomial, removing certain structural concerns. Notably deployed in OpenSSH's default post-quantum key exchange.",
		mechanism:
			"NTRU Prime uses an irreducible prime-degree ring polynomial x^p - x - 1, avoiding the smooth-factorisation structure of x^n - 1. Two variants: Streamlined NTRU Prime (sntrup) and Light NTRU Prime (ntrulpr).",
		variants: [
			{
				name: "sntrup761",
				securityLevel: 3,
				publicKeyBytes: 1158,
				secretKeyBytes: 1763,
				ciphertextBytes: 1039,
				note: "Default post-quantum KEM in OpenSSH 9.0+. Recognisable name to network security buyers.",
			},
		],
		qnspSupport: {
			providers: ["liboqs"],
			minimumTier: "default",
		},
		acvp: {
			nobleStatus: "non-addressable",
			liboqsStatus: "non-addressable",
		},
		useCases: [
			"Compatibility with OpenSSH PQ key exchange",
			"Customers preferring prime-degree NTRU variants",
		],
		tradeoffs: ["Recognisable in SSH ecosystem", "Smaller liboqs surface than ML-KEM or HQC"],
		references: {
			designPaper: "https://ntruprime.cr.yp.to/",
			upstreamCode: "https://github.com/open-quantum-safe/liboqs/tree/main/src/kem/ntruprime",
		},
	},

	// ────────────────────────── Multivariate signatures ──────────────────────────
	{
		slug: "mayo",
		name: "MAYO",
		longName: "Multivariate Quadratic Signatures (MAYO)",
		aliases: [],
		type: "Signature",
		familyKind: "multivariate",
		fipsStatus: "non-FIPS",
		summary:
			"Multivariate quadratic signature scheme in the NIST PQC additional-signatures track. Short signatures and small public keys; trades signing speed against parameter size.",
		mechanism:
			"MAYO is based on the hardness of solving systems of multivariate quadratic polynomial equations (MQ problem). Uses the Whipping technique to amplify a weak underlying signature into a secure construction.",
		variants: [
			{
				name: "MAYO-1 / MAYO-2 / MAYO-3 / MAYO-5",
				securityLevel: 5,
				publicKeyBytes: 1168,
				secretKeyBytes: 24,
				signatureBytes: 321,
			},
		],
		qnspSupport: {
			providers: ["liboqs"],
			minimumTier: "default",
		},
		acvp: {
			nobleStatus: "non-addressable",
			liboqsStatus: "non-addressable",
		},
		useCases: ["Compact signatures with small public key", "Research and migration analysis"],
		tradeoffs: [
			"Compact across all parameters",
			"Newer security analysis than lattice-based — fewer cryptanalysis-years",
		],
		references: {
			designPaper: "https://pqmayo.org/",
			upstreamCode: "https://github.com/open-quantum-safe/liboqs/tree/main/src/sig/mayo",
		},
	},

	{
		slug: "cross",
		name: "CROSS",
		longName: "Codes and Restricted Objects Signature Scheme",
		aliases: [],
		type: "Signature",
		familyKind: "code-based",
		fipsStatus: "non-FIPS",
		summary:
			"Code-based signature using the MPC-in-the-head paradigm over restricted syndrome decoding. NIST PQC additional-signatures track candidate.",
		mechanism:
			"CROSS combines syndrome decoding with the MPC-in-the-head zero-knowledge proof system to produce signatures whose security reduces to the hardness of decoding random codes. Multiple parameter sets balance signature size against signing speed.",
		variants: [
			{
				name: "CROSS-RSDP / CROSS-RSDPG (multiple param sets)",
				securityLevel: 5,
				publicKeyBytes: 77,
				secretKeyBytes: 32,
				signatureBytes: 13152,
			},
		],
		qnspSupport: {
			providers: ["liboqs"],
			minimumTier: "default",
		},
		acvp: {
			nobleStatus: "non-addressable",
			liboqsStatus: "non-addressable",
		},
		useCases: [
			"Code-based signature option for assumption diversification",
			"NIST PQC additional-signatures track inclusion",
		],
		tradeoffs: [
			"Tiny public keys (77 bytes), large signatures",
			"Code-based assumption diversifies away from lattice-based signature dominance",
		],
		references: {
			designPaper: "https://www.cross-crypto.com/",
			upstreamCode: "https://github.com/open-quantum-safe/liboqs/tree/main/src/sig/cross",
		},
	},

	{
		slug: "uov",
		name: "UOV",
		longName: "Unbalanced Oil and Vinegar Signatures",
		aliases: ["Oil-and-Vinegar"],
		type: "Signature",
		familyKind: "multivariate",
		fipsStatus: "non-FIPS",
		summary:
			"Multivariate signature scheme based on the Unbalanced Oil and Vinegar (UOV) construction, one of the longest-studied multivariate schemes.",
		mechanism:
			"UOV is built on the difficulty of solving structured systems of multivariate quadratic equations where some variables are 'oil' (random) and others are 'vinegar' (chosen). The asymmetric structure enables efficient signing while preserving the MQ hardness.",
		variants: [
			{
				name: "OV-Is / Ip / III / V (multiple param sets)",
				securityLevel: 5,
				publicKeyBytes: 412160,
				secretKeyBytes: 348704,
				signatureBytes: 96,
			},
		],
		qnspSupport: {
			providers: ["liboqs"],
			minimumTier: "default",
		},
		acvp: {
			nobleStatus: "non-addressable",
			liboqsStatus: "non-addressable",
		},
		useCases: [
			"Compact signatures (96 bytes) for size-constrained signature transport",
			"Multivariate diversification away from lattice-based signatures",
		],
		tradeoffs: [
			"Smallest signatures in the catalogue (96 bytes)",
			"Very large public keys (hundreds of KB)",
			"30+ years of cryptanalysis on UOV foundations",
		],
		references: {
			upstreamCode: "https://github.com/open-quantum-safe/liboqs/tree/main/src/sig/uov",
		},
	},

	{
		slug: "snova",
		name: "SNOVA",
		longName: "Simple Noncommutative-ring-based UOV Algorithm",
		aliases: [],
		type: "Signature",
		familyKind: "multivariate",
		fipsStatus: "non-FIPS",
		summary:
			"Multivariate signature scheme using a non-commutative ring structure to reduce public-key size relative to plain UOV. NIST PQC additional-signatures track candidate.",
		mechanism:
			"SNOVA modifies UOV's underlying field to a non-commutative matrix ring, dramatically reducing public-key size while preserving multivariate hardness.",
		variants: [
			{
				name: "SNOVA (multiple param sets at NIST levels 1, 3, 5)",
				securityLevel: 5,
				publicKeyBytes: 2456,
				secretKeyBytes: 48,
				signatureBytes: 168,
			},
		],
		qnspSupport: {
			providers: ["liboqs"],
			minimumTier: "default",
		},
		acvp: {
			nobleStatus: "non-addressable",
			liboqsStatus: "non-addressable",
		},
		useCases: [
			"Multivariate signatures with much smaller public keys than plain UOV",
			"NIST PQC additional-signatures track candidate",
		],
		tradeoffs: [
			"Compact public keys and signatures",
			"Non-commutative ring structure is newer — less cryptanalysis history than UOV",
		],
		references: {
			upstreamCode: "https://github.com/open-quantum-safe/liboqs/tree/main/src/sig/snova",
		},
	},
];

export function findAlgorithmFamily(slug: string): AlgorithmFamily | undefined {
	return ALGORITHM_CATALOG.find((f) => f.slug === slug);
}

export function algorithmSlugs(): readonly string[] {
	return ALGORITHM_CATALOG.map((f) => f.slug);
}
