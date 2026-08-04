/**
 * Python rule pack: pyca/cryptography, PyCryptodome, hashlib, PyJWT.
 */

import type { CryptoDetectionRule } from "../types.js";

const LANGS = ["python"] as const;

export const pythonRules: readonly CryptoDetectionRule[] = [
	{
		id: "py-cryptography-rsa-generate",
		languages: LANGS,
		pattern: /rsa\.generate_private_key\s*\(/,
		algorithm: "rsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "pyca/cryptography",
		wantsKeySize: true,
	},
	{
		id: "py-cryptography-ec-curve",
		languages: LANGS,
		pattern: /\bec\.(SECP192R1|SECP256R1|SECP256K1|SECP384R1|SECP521R1)\b/,
		algorithm: (match) => {
			const curve = match[1] ?? "";
			if (curve.includes("192")) return "ecdsa-p192";
			if (curve.includes("256")) return "ecdsa-p256";
			if (curve.includes("384")) return "ecdsa-p384";
			return "ecdsa-p521";
		},
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "pyca/cryptography",
	},
	{
		id: "py-cryptography-pkcs1v15",
		languages: LANGS,
		pattern: /padding\.PKCS1v15\s*\(/,
		algorithm: "rsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "pyca/cryptography",
	},
	{
		id: "py-cryptography-ed25519",
		languages: LANGS,
		pattern: /\b(Ed25519PrivateKey|Ed448PrivateKey|X25519PrivateKey|X448PrivateKey)\b/,
		algorithm: (match) => {
			const cls = match[1] ?? "";
			if (cls.startsWith("Ed25519")) return "ed25519";
			if (cls.startsWith("Ed448")) return "ed448";
			return cls.startsWith("X25519") ? "ecdh-x25519" : "ecdh-x448";
		},
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "pyca/cryptography",
	},
	{
		id: "py-pycryptodome-rsa",
		languages: LANGS,
		pattern: /\bRSA\.generate\s*\(\s*(\d{3,5})?/,
		algorithm: "rsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "PyCryptodome",
		wantsKeySize: true,
	},
	{
		id: "py-pycryptodome-weak-cipher",
		languages: LANGS,
		pattern:
			/from\s+Crypto(?:dome)?\.Cipher\s+import\s+.*\b(DES3|DES|ARC4|ARC2)\b|\b(DES3|DES|ARC4)\.new\s*\(/,
		algorithm: (match) => {
			const name = (match[1] ?? match[2] ?? "").toUpperCase();
			if (name === "DES3") return "3des";
			if (name === "DES") return "des";
			return "rc4";
		},
		category: "symmetric",
		classification: "classical",
		confidence: "high",
		library: "PyCryptodome",
	},
	{
		id: "py-hashlib-weak-hash",
		languages: LANGS,
		pattern: /hashlib\.(md5|sha1)\s*\(/,
		algorithm: (match) => (match[1] ?? "").toLowerCase(),
		category: "hash",
		classification: "classical",
		confidence: "high",
		library: "hashlib",
	},
	{
		id: "py-jwt-classical-alg",
		languages: LANGS,
		pattern:
			/algorithms?\s*=\s*\[?\s*["'](RS256|RS384|RS512|PS256|PS384|PS512|ES256|ES384|ES512|EdDSA)["']/,
		algorithm: (match) => {
			const alg = match[1] ?? "";
			if (alg.startsWith("RS") || alg.startsWith("PS")) return "rsa-unknown";
			if (alg === "ES256") return "ecdsa-p256";
			if (alg === "ES384") return "ecdsa-p384";
			if (alg === "ES512") return "ecdsa-p521";
			return "ed25519";
		},
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "PyJWT",
	},
	{
		id: "py-pqc-liboqs",
		languages: LANGS,
		pattern: /\boqs\.(KeyEncapsulation|Signature)\s*\(\s*["']([A-Za-z0-9_-]+)["']/,
		algorithm: (match) => (match[2] ?? "").toLowerCase().replace(/_/g, "-"),
		category: "asymmetric",
		classification: "pqc",
		confidence: "high",
		library: "liboqs-python",
	},
];
