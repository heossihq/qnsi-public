/**
 * Canonical algorithm ids - MUST stay aligned with the keys consumed by
 * crypto-inventory-service's PqcReadinessAssessor (ALGORITHM_BASE_URGENCY /
 * RECOMMENDED_REPLACEMENT) and isPqcAlgorithm(). An id the assessor does not
 * know falls back to migration urgency "high", which is fail-safe.
 */

const RSA_SIZES = new Set([1024, 2048, 3072, 4096]);

/** rsa + optional size → "rsa-2048" | "rsa-unknown". */
export function canonicalRsa(keySize: number | null): string {
	if (keySize !== null && RSA_SIZES.has(keySize)) {
		return `rsa-${keySize}`;
	}
	return "rsa-unknown";
}

const CURVE_MAP: Record<string, string> = {
	// NIST P-curves under their many aliases
	"p-192": "p192",
	p192: "p192",
	prime192v1: "p192",
	secp192r1: "p192",
	"p-256": "p256",
	p256: "p256",
	prime256v1: "p256",
	secp256r1: "p256",
	secp256k1: "p256",
	"p-384": "p384",
	p384: "p384",
	secp384r1: "p384",
	"p-521": "p521",
	p521: "p521",
	secp521r1: "p521",
};

/**
 * Curve name → canonical "ecdsa-p256"-style id. `usage` distinguishes
 * signing (ecdsa) from key agreement (ecdh); default is ecdsa.
 */
export function canonicalEcCurve(curve: string, usage: "ecdsa" | "ecdh" = "ecdsa"): string | null {
	const suffix = CURVE_MAP[curve.toLowerCase()];
	if (!suffix) {
		return null;
	}
	return `${usage}-${suffix}`;
}

/**
 * Normalize an algorithm token the way the assessor does (lowercase,
 * underscores → dashes).
 */
export function normalizeAlgorithmId(algorithm: string): string {
	return algorithm.toLowerCase().replace(/_/g, "-");
}

/**
 * Search adjacent lines for a key-size literal near a size-parameterized
 * finding (e.g. `modulusLength: 2048` on the line after `generateKeyPair`).
 * Window is deliberately small to avoid picking up unrelated numbers.
 */
export function findKeySizeNear(lines: readonly string[], lineIndex: number): number | null {
	const SIZE_PATTERN =
		/(?:modulusLength|keySize|key_size|keysize|bits|size|modulus_length)\s*[:=(]\s*(\d{3,5})/i;
	const INLINE_PATTERN = /\b(1024|2048|3072|4096)\b/;

	const start = lineIndex;
	const end = Math.min(lines.length - 1, lineIndex + 4);
	for (let i = start; i <= end; i++) {
		// The loop bound guarantees the index is in range.
		const line = lines[i] as string;
		const named = SIZE_PATTERN.exec(line);
		if (named?.[1]) {
			// The capture is 3-5 digits, so parseInt is always finite.
			return Number.parseInt(named[1], 10);
		}
		// Inline literal only counts on the firing line itself, e.g. RSA.generate(2048)
		if (i === start) {
			const inline = INLINE_PATTERN.exec(line);
			if (inline?.[1]) {
				return Number.parseInt(inline[1], 10);
			}
		}
	}
	return null;
}
