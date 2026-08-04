/**
 * Java/Kotlin rule pack: JCA/JCE getInstance() families, BouncyCastle.
 * JCA takes algorithms as string arguments, so the string content is the
 * signal - anchored on the API call, never matched bare.
 */

import type { CryptoDetectionRule } from "../types.js";

const LANGS = ["java", "kotlin"] as const;

function jcaSignatureAlgorithm(spec: string): string | null {
	const upper = spec.toUpperCase();
	if (upper.includes("WITHRSA")) return "rsa-unknown";
	if (upper.includes("WITHECDSA")) return "ecdsa-unknown";
	if (upper.includes("WITHDSA")) return "dsa-unknown";
	if (upper === "ED25519") return "ed25519";
	if (upper === "ED448") return "ed448";
	return null;
}

export const javaRules: readonly CryptoDetectionRule[] = [
	{
		id: "java-jca-keypairgenerator",
		languages: LANGS,
		pattern:
			/KeyPairGenerator\.getInstance\s*\(\s*"(RSA|EC|DSA|DiffieHellman|DH|Ed25519|Ed448|X25519|X448)"/,
		algorithm: (match) => {
			const name = match[1] ?? "";
			if (name === "RSA") return "rsa-unknown";
			if (name === "EC") return "ecdsa-unknown";
			if (name === "DSA") return "dsa-unknown";
			if (name === "Ed25519") return "ed25519";
			if (name === "Ed448") return "ed448";
			if (name === "X25519") return "ecdh-x25519";
			if (name === "X448") return "ecdh-x448";
			return "ecdh-unknown";
		},
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "JCA",
		wantsKeySize: true,
	},
	{
		id: "java-jca-cipher-rsa",
		languages: LANGS,
		pattern: /Cipher\.getInstance\s*\(\s*"RSA[^"]*"/,
		algorithm: "rsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "JCA",
	},
	{
		id: "java-jca-cipher-symmetric",
		languages: LANGS,
		pattern: /Cipher\.getInstance\s*\(\s*"((?:AES|DES|DESede|RC4|ARCFOUR|Blowfish)[^"]*)"/,
		algorithm: (match) => {
			const transform = (match[1] ?? "").toUpperCase();
			if (transform.startsWith("DESEDE")) return "3des";
			if (transform.startsWith("DES")) return "des";
			if (transform.startsWith("RC4") || transform.startsWith("ARCFOUR")) return "rc4";
			if (transform.startsWith("AES")) {
				return transform.includes("GCM") ? "aes-unknown-gcm" : "aes-unknown";
			}
			return "blowfish";
		},
		category: "symmetric",
		classification: "classical",
		confidence: "high",
		library: "JCA",
	},
	{
		id: "java-jca-signature",
		languages: LANGS,
		pattern: /Signature\.getInstance\s*\(\s*"([A-Za-z0-9/]+)"/,
		algorithm: (match) => jcaSignatureAlgorithm(match[1] ?? ""),
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "JCA",
	},
	{
		id: "java-jca-weak-digest",
		languages: LANGS,
		pattern: /MessageDigest\.getInstance\s*\(\s*"(MD5|SHA-?1)"/i,
		algorithm: (match) => ((match[1] ?? "").toUpperCase() === "MD5" ? "md5" : "sha1"),
		category: "hash",
		classification: "classical",
		confidence: "high",
		library: "JCA",
	},
	{
		id: "java-jca-keyagreement",
		languages: LANGS,
		pattern: /KeyAgreement\.getInstance\s*\(\s*"(ECDH|DH|DiffieHellman|X25519|X448)"/,
		algorithm: (match) => {
			const name = match[1] ?? "";
			if (name === "ECDH") return "ecdh-unknown";
			if (name === "X25519") return "ecdh-x25519";
			if (name === "X448") return "ecdh-x448";
			return "dh-unknown";
		},
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "JCA",
	},
	{
		id: "java-bouncycastle-classical",
		languages: LANGS,
		pattern:
			/org\.bouncycastle\.(?:crypto\.generators\.(RSAKeyPairGenerator|ECKeyPairGenerator|DSAKeyPairGenerator)|jce\.provider)/,
		algorithm: (match) => {
			const cls = match[1] ?? "";
			if (cls.startsWith("RSA")) return "rsa-unknown";
			if (cls.startsWith("EC")) return "ecdsa-unknown";
			if (cls.startsWith("DSA")) return "dsa-unknown";
			return null;
		},
		category: "asymmetric",
		classification: "classical",
		confidence: "medium",
		library: "BouncyCastle",
	},
	{
		id: "java-pqc-bouncycastle",
		languages: LANGS,
		pattern:
			/org\.bouncycastle\.pqc\.|"(ML-KEM(?:-512|-768|-1024)?|ML-DSA(?:-44|-65|-87)?|SLH-DSA[A-Za-z0-9-]*)"/,
		algorithm: (match) => {
			const name = (match[1] ?? "").toLowerCase();
			if (!name) return "ml-kem-768";
			if (name === "ml-kem") return "ml-kem-768";
			if (name === "ml-dsa") return "ml-dsa-65";
			return name;
		},
		category: "asymmetric",
		classification: "pqc",
		confidence: "medium",
		library: "BouncyCastle PQC",
	},
];
