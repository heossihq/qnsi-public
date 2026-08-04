/**
 * Rust rule pack: rsa/p256/p384/ed25519-dalek/ring/openssl crates.
 * `use` declarations are strong evidence; Cargo.toml dependency lines are
 * matched by the artifacts pack (config language).
 */

import type { CryptoDetectionRule } from "../types.js";

const LANGS = ["rust"] as const;

export const rustRules: readonly CryptoDetectionRule[] = [
	{
		id: "rs-use-classical-crates",
		languages: LANGS,
		pattern: /\buse\s+(rsa|p256|p384|k256|ed25519_dalek|x25519_dalek)\b/,
		algorithm: (match) => {
			const crate = match[1] ?? "";
			if (crate === "rsa") return "rsa-unknown";
			if (crate === "p256" || crate === "k256") return "ecdsa-p256";
			if (crate === "p384") return "ecdsa-p384";
			if (crate === "ed25519_dalek") return "ed25519";
			return "ecdh-x25519";
		},
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "rust crates",
	},
	{
		id: "rs-rsa-generate",
		languages: LANGS,
		pattern: /RsaPrivateKey::new\s*\(/,
		algorithm: "rsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "rsa crate",
		wantsKeySize: true,
	},
	{
		id: "rs-ring-classical",
		languages: LANGS,
		pattern: /ring::signature::(?:RSA|ECDSA|ED25519)[A-Z0-9_]*/,
		algorithm: (match) => {
			const token = match[0];
			if (token.includes("RSA")) return "rsa-unknown";
			if (token.includes("ECDSA")) return "ecdsa-unknown";
			return "ed25519";
		},
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "ring",
	},
	{
		id: "rs-weak-hash-crates",
		languages: LANGS,
		pattern: /\buse\s+(md5|md_5|sha1|sha_1)\b|\b(Md5|Sha1)::(?:new|digest)\b/,
		algorithm: (match) => {
			const token = (match[1] ?? match[2] ?? "").toLowerCase().replace(/_/g, "");
			return token.includes("md5") ? "md5" : "sha1";
		},
		category: "hash",
		classification: "classical",
		confidence: "high",
		library: "rust crates",
	},
	{
		id: "rs-pqc-crates",
		languages: LANGS,
		pattern: /\buse\s+(?:pqcrypto|ml_kem|ml_dsa|fips203|fips204|fips205|oqs)\b/,
		algorithm: (match) => {
			const token = match[0];
			if (token.includes("dsa") || token.includes("204")) return "ml-dsa-65";
			return "ml-kem-768";
		},
		category: "asymmetric",
		classification: "pqc",
		confidence: "medium",
		library: "rust pqc crates",
	},
];
