/**
 * Language-independent artifact rules: PEM headers, JWK fields, TLS config
 * cipher strings. These fire in "config" files and any source language.
 */

import type { CryptoDetectionRule, Language } from "../types.js";

const ALL: readonly Language[] = [
	"javascript",
	"typescript",
	"python",
	"java",
	"kotlin",
	"go",
	"c",
	"cpp",
	"csharp",
	"rust",
	"config",
];

export const artifactRules: readonly CryptoDetectionRule[] = [
	{
		id: "artifact-pem-classical-key-header",
		languages: ALL,
		pattern: /-----BEGIN (RSA|EC|DSA) PRIVATE KEY-----/,
		algorithm: (match) => {
			const kind = match[1] ?? "";
			if (kind === "RSA") return "rsa-unknown";
			if (kind === "EC") return "ecdsa-unknown";
			return "dsa-unknown";
		},
		category: "artifact",
		classification: "classical",
		confidence: "high",
		library: "PEM",
	},
	{
		id: "artifact-jwk-classical-kty",
		languages: ALL,
		pattern: /"kty"\s*:\s*"(RSA|EC|OKP)"/,
		algorithm: (match) => {
			const kty = match[1] ?? "";
			if (kty === "RSA") return "rsa-unknown";
			if (kty === "EC") return "ecdsa-unknown";
			return "ed25519";
		},
		category: "artifact",
		classification: "classical",
		confidence: "medium",
		library: "JWK",
	},
	{
		id: "artifact-config-hybrid-tls-group",
		languages: ALL,
		pattern: /\b(X25519MLKEM768|SecP256r1MLKEM768|SecP384r1MLKEM1024|X25519Kyber768Draft00)\b/,
		algorithm: (match) => (match[1] ?? "").toLowerCase(),
		category: "protocol",
		classification: "hybrid",
		confidence: "high",
		library: "TLS config",
	},
	{
		id: "artifact-cargo-classical-dep",
		languages: ["config"],
		pattern: /^\s*(rsa|p256|p384|k256|ed25519-dalek|md5|sha1)\s*=\s*["{]/,
		algorithm: (match) => {
			const crate = match[1] ?? "";
			if (crate === "rsa") return "rsa-unknown";
			if (crate === "ed25519-dalek") return "ed25519";
			if (crate === "md5" || crate === "sha1") return crate;
			return `ecdsa-${crate === "p384" ? "p384" : "p256"}`;
		},
		category: "artifact",
		classification: "classical",
		confidence: "medium",
		library: "Cargo.toml",
	},
	{
		id: "artifact-cargo-pqc-dep",
		languages: ["config"],
		pattern: /^\s*(ml-kem|ml-dsa|fips203|fips204|fips205|oqs|pqcrypto)\s*=\s*["{]/,
		algorithm: (match) => {
			const crate = match[1] ?? "";
			if (crate === "ml-dsa" || crate === "fips204") return "ml-dsa-65";
			return "ml-kem-768";
		},
		category: "artifact",
		classification: "pqc",
		confidence: "medium",
		library: "Cargo.toml",
	},
	{
		id: "artifact-cargo-hybrid-tls-pqc-dep",
		languages: ["config"],
		pattern: /^\s*(aws-lc-rs|rustls-post-quantum)\s*=\s*["{]/,
		algorithm: "x25519mlkem768",
		category: "artifact",
		classification: "hybrid",
		confidence: "medium",
		library: "Cargo.toml",
	},
];
