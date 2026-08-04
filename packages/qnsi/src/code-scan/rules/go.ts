/**
 * Go rule pack: standard library crypto/* imports and call sites.
 * Import lines are unambiguous evidence in Go - an unused import fails the
 * Go compiler, so an import IS usage.
 */

import type { CryptoDetectionRule } from "../types.js";

const LANGS = ["go"] as const;

export const goRules: readonly CryptoDetectionRule[] = [
	{
		id: "go-import-classical-asymmetric",
		languages: LANGS,
		pattern: /"crypto\/(rsa|ecdsa|elliptic|dsa|ed25519)"/,
		algorithm: (match) => {
			const pkg = match[1] ?? "";
			if (pkg === "rsa") return "rsa-unknown";
			if (pkg === "dsa") return "dsa-unknown";
			if (pkg === "ed25519") return "ed25519";
			return "ecdsa-unknown";
		},
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "go stdlib",
	},
	{
		id: "go-rsa-generatekey",
		languages: LANGS,
		pattern: /rsa\.GenerateKey\s*\(/,
		algorithm: "rsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "crypto/rsa",
		wantsKeySize: true,
	},
	{
		id: "go-elliptic-curve",
		languages: LANGS,
		pattern: /elliptic\.(P224|P256|P384|P521)\s*\(/,
		algorithm: (match) => {
			const curve = match[1] ?? "";
			if (curve === "P256") return "ecdsa-p256";
			if (curve === "P384") return "ecdsa-p384";
			if (curve === "P521") return "ecdsa-p521";
			return "ecdsa-unknown";
		},
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "crypto/elliptic",
	},
	{
		id: "go-import-weak-hash",
		languages: LANGS,
		pattern: /"crypto\/(md5|sha1)"/,
		algorithm: (match) => match[1] ?? "md5",
		category: "hash",
		classification: "classical",
		confidence: "high",
		library: "go stdlib",
	},
	{
		id: "go-import-weak-cipher",
		languages: LANGS,
		pattern: /"crypto\/(des|rc4)"/,
		algorithm: (match) => match[1] ?? "des",
		category: "symmetric",
		classification: "classical",
		confidence: "high",
		library: "go stdlib",
	},
	{
		id: "go-pqc-imports",
		languages: LANGS,
		pattern:
			/"(?:crypto\/mlkem|github\.com\/[^"]*(?:mlkem|ml-kem|mldsa|ml-dsa|kyber|dilithium)[^"]*)"/,
		algorithm: (match) => {
			const path = match[0].toLowerCase();
			if (path.includes("dsa") || path.includes("dilithium")) return "ml-dsa-65";
			return "ml-kem-768";
		},
		category: "asymmetric",
		classification: "pqc",
		confidence: "medium",
		library: "go pqc",
	},
];
