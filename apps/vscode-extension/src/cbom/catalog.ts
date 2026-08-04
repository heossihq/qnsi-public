import { ALGORITHM_TO_NIST } from "@heossihq/qnsi-crypto-inventory-sdk";

export type Urgency = "critical" | "high" | "medium" | "low";

export interface VulnRule {
	/** Stable id / short label for the detected algorithm or API. */
	readonly id: string;
	/** Regex source (matched per line, case-insensitive unless flags say otherwise). */
	readonly pattern: string;
	readonly flags: string;
	readonly urgency: Urgency;
	/** Recommended post-quantum / modern replacement. */
	readonly recommend: string;
	/** Why this is flagged. */
	readonly reason: string;
}

/**
 * High-signal detection rules for quantum-vulnerable or broken cryptography.
 * Patterns are intentionally specific (sized tokens, named APIs, PEM headers) to keep
 * false positives low. Quantum-vulnerable public-key crypto (RSA/EC/DH/DSA, incl. the
 * 25519 curves) → migrate to NIST PQC; classically-broken primitives (DES/RC4/MD5/SHA-1)
 * and Grover-weakened symmetric sizes → modern symmetric/hash.
 */
export const VULN_RULES: readonly VulnRule[] = [
	// ── RSA ──────────────────────────────────────────────────────────────────
	{
		id: "RSA",
		pattern: "\\brsa[-_]?(512|1024|2048|3072|4096)\\b",
		flags: "gi",
		urgency: "critical",
		recommend: "ML-KEM-768 (encapsulation) or ML-DSA-65 (signatures)",
		reason: "RSA is broken by Shor's algorithm on a cryptographically-relevant quantum computer.",
	},
	{
		id: "RSA",
		pattern:
			'generateKeyPairSync\\(\\s*[\'"]rsa[\'"]|KeyPairGenerator\\.getInstance\\(\\s*"RSA"|RSA\\.generate\\(|rsa\\.GenerateKey\\(|\\bRSA-(OAEP|PSS|PKCS1)',
		flags: "g",
		urgency: "critical",
		recommend: "ML-KEM-768 (encapsulation) or ML-DSA-65 (signatures)",
		reason: "RSA key generation/usage - broken by Shor's algorithm on a quantum computer.",
	},
	// ── Elliptic curve (ECDSA / ECDH / named curves) ─────────────────────────
	{
		id: "ECC",
		pattern:
			"\\b(ecdsa|ecdh)\\b|\\bsecp(192|224|256|384|521)r?1\\b|ecdsa\\.GenerateKey\\(|ec\\.generate_private_key\\(",
		flags: "gi",
		urgency: "critical",
		recommend: "ML-DSA-65 (signatures) or ML-KEM-768 (key exchange)",
		reason: "Elliptic-curve cryptography is broken by Shor's algorithm on a quantum computer.",
	},
	{
		id: "Curve25519",
		pattern: "\\b(ed25519|x25519|curve25519)\\b",
		flags: "gi",
		urgency: "high",
		recommend: "ML-DSA-65 / ML-KEM-768 (or a hybrid x25519+ML-KEM transition)",
		reason: "Edwards/Montgomery curves are quantum-vulnerable (Shor's algorithm).",
	},
	// ── Diffie-Hellman / DSA ─────────────────────────────────────────────────
	{
		id: "DiffieHellman",
		pattern: "\\bdiffie[-\\s]?hellman\\b|createDiffieHellman\\(|\\bDH-\\d{3,4}\\b",
		flags: "gi",
		urgency: "critical",
		recommend: "ML-KEM-768",
		reason: "Finite-field Diffie-Hellman is broken by Shor's algorithm on a quantum computer.",
	},
	{
		id: "DSA",
		pattern: "\\bDSA\\b(?!-DSA|-SHA)",
		flags: "g",
		urgency: "critical",
		recommend: "ML-DSA-65",
		reason: "DSA is broken by Shor's algorithm on a quantum computer.",
	},
	// ── Classically broken / weak ────────────────────────────────────────────
	{
		id: "3DES/DES",
		pattern: "\\b(3des|triple-?des|des-ede3?|desede|des)\\b",
		flags: "gi",
		urgency: "high",
		recommend: "AES-256-GCM",
		reason: "DES/3DES are deprecated and broken; do not use for new data.",
	},
	{
		id: "RC4",
		pattern: "\\brc4\\b|arcfour",
		flags: "gi",
		urgency: "high",
		recommend: "AES-256-GCM (or ChaCha20-Poly1305)",
		reason: "RC4 is broken; it must not be used.",
	},
	{
		id: "MD5",
		pattern: "\\bmd5\\b",
		flags: "gi",
		urgency: "high",
		recommend: "SHA-256 or SHA-3",
		reason: "MD5 is collision-broken; unusable for security.",
	},
	{
		id: "SHA-1",
		pattern: "\\bsha-?1\\b",
		flags: "gi",
		urgency: "high",
		recommend: "SHA-256 or SHA-3",
		reason: "SHA-1 is collision-broken; migrate to SHA-2/SHA-3.",
	},
	{
		id: "AES-128/192",
		pattern: "\\baes-?(128|192)\\b",
		flags: "gi",
		urgency: "medium",
		recommend: "AES-256-GCM",
		reason: "Grover's algorithm halves symmetric strength; use 256-bit keys for long-term data.",
	},
	// ── Key/cert material on disk ────────────────────────────────────────────
	{
		id: "RSA private key (PEM)",
		pattern: "-----BEGIN RSA PRIVATE KEY-----",
		flags: "g",
		urgency: "critical",
		recommend: "Re-issue with a PQC algorithm (ML-DSA) where supported",
		reason: "An RSA private key - quantum-vulnerable; subject to harvest-now-decrypt-later.",
	},
	{
		id: "EC private key (PEM)",
		pattern: "-----BEGIN EC PRIVATE KEY-----",
		flags: "g",
		urgency: "critical",
		recommend: "Re-issue with a PQC algorithm (ML-DSA) where supported",
		reason: "An elliptic-curve private key - quantum-vulnerable.",
	},
];

/** Canonical PQC algorithm ids (quantum-resistant) - never flagged. */
export const PQC_ALGORITHMS: ReadonlySet<string> = new Set(
	Object.keys(ALGORITHM_TO_NIST).map((k) => k.toLowerCase()),
);

/** NIST standardized names of the PQC algorithms (e.g. "ml-kem-768"). */
export const PQC_NIST_NAMES: ReadonlySet<string> = new Set(
	Object.values(ALGORITHM_TO_NIST).map((v) => v.toLowerCase()),
);

export { ALGORITHM_TO_NIST };
