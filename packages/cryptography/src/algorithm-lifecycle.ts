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
	readonly replacementAlgorithm?: string;
}

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
	"sphincs-shake-128f-simple": {
		name: "SLH-DSA-SHAKE-128f",
		type: "signature",
		status: "NIST_FINAL",
		nistStandard: "FIPS 205",
		securityLevel: 1,
	},
	"sphincs-shake-256f-simple": {
		name: "SLH-DSA-SHAKE-256f",
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
		securityLevel: 1,
	},
	"falcon-1024": {
		name: "FN-DSA-1024",
		type: "signature",
		status: "NIST_DRAFT",
		nistStandard: "FIPS 206 (draft)",
		securityLevel: 5,
	},

	// ─── HQC (NIST selected March 2025, draft standard expected 2026) ───
	"hqc-128": {
		name: "HQC-128",
		type: "kem",
		status: "NIST_DRAFT",
		securityLevel: 1,
	},
	"hqc-192": {
		name: "HQC-192",
		type: "kem",
		status: "NIST_DRAFT",
		securityLevel: 3,
	},
	"hqc-256": {
		name: "HQC-256",
		type: "kem",
		status: "NIST_DRAFT",
		securityLevel: 5,
	},

	// ─── Classical Signature Algorithms (quantum-vulnerable) ────────────
	"rsa-2048": {
		name: "RSA-2048",
		type: "signature",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: "2030-01-01",
		replacementAlgorithm: "dilithium-2",
	},
	"rsa-4096": {
		name: "RSA-4096",
		type: "signature",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: "2030-01-01",
		replacementAlgorithm: "dilithium-3",
	},
	"ecdsa-p256": {
		name: "ECDSA-P256",
		type: "signature",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: "2030-01-01",
		replacementAlgorithm: "dilithium-2",
	},
	"ecdsa-p384": {
		name: "ECDSA-P384",
		type: "signature",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: "2030-01-01",
		replacementAlgorithm: "dilithium-3",
	},
	ed25519: {
		name: "Ed25519",
		type: "signature",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: "2030-01-01",
		replacementAlgorithm: "dilithium-2",
	},

	// ─── Classical KEM / Key Agreement (quantum-vulnerable) ─────────────
	"ecdh-p256": {
		name: "ECDH-P256",
		type: "kem",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: "2030-01-01",
		replacementAlgorithm: "kyber-768",
	},
	"ecdh-p384": {
		name: "ECDH-P384",
		type: "kem",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: "2030-01-01",
		replacementAlgorithm: "kyber-1024",
	},
	"dh-2048": {
		name: "DH-2048",
		type: "kem",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: "2030-01-01",
		replacementAlgorithm: "kyber-768",
	},
	"rsa-oaep-2048": {
		name: "RSA-OAEP-2048",
		type: "kem",
		status: "DEPRECATED",
		securityLevel: 0,
		deprecationDate: "2030-01-01",
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
	"sha3-256": {
		name: "SHA3-256",
		type: "hash",
		status: "NIST_FINAL",
		nistStandard: "FIPS 202",
		securityLevel: 3,
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
		securityLevel: 3,
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
 */
export function normalizeAlgorithmId(algorithm: string): string {
	return algorithm.toLowerCase().replace(/_/g, "-").trim();
}

/**
 * Look up algorithm lifecycle metadata by identifier.
 * Returns null if the algorithm is unknown.
 */
export function getAlgorithmLifecycle(algorithm: string): AlgorithmLifecycleMetadata | null {
	return ALGORITHM_LIFECYCLE_REGISTRY[normalizeAlgorithmId(algorithm)] ?? null;
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
