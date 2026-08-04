/**
 * C/C++ rule pack: OpenSSL EVP/legacy APIs.
 */

import type { CryptoDetectionRule } from "../types.js";

const LANGS = ["c", "cpp"] as const;

export const cRules: readonly CryptoDetectionRule[] = [
	{
		id: "c-openssl-rsa",
		languages: LANGS,
		pattern: /\b(RSA_generate_key(?:_ex)?|EVP_PKEY_RSA|EVP_RSA_gen)\b/,
		algorithm: "rsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "OpenSSL",
		wantsKeySize: true,
	},
	{
		id: "c-openssl-ec",
		languages: LANGS,
		pattern:
			/\b(EC_KEY_new(?:_by_curve_name)?|EVP_PKEY_EC|NID_(?:X9_62_prime256v1|secp384r1|secp521r1))\b/,
		algorithm: (match) => {
			const token = match[1] ?? "";
			if (token.includes("prime256v1")) return "ecdsa-p256";
			if (token.includes("secp384r1")) return "ecdsa-p384";
			if (token.includes("secp521r1")) return "ecdsa-p521";
			return "ecdsa-unknown";
		},
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "OpenSSL",
	},
	{
		id: "c-openssl-weak-digest",
		languages: LANGS,
		pattern: /\bEVP_(md5|sha1)\s*\(\s*\)|\b(MD5|SHA1)_(?:Init|Update|Final)\b/,
		algorithm: (match) => ((match[1] ?? match[2] ?? "").toLowerCase() === "md5" ? "md5" : "sha1"),
		category: "hash",
		classification: "classical",
		confidence: "high",
		library: "OpenSSL",
	},
	{
		id: "c-openssl-weak-cipher",
		languages: LANGS,
		pattern: /\bEVP_(des_ede3[a-z0-9_]*|des_[a-z0-9_]+|rc4[a-z0-9_]*)\s*\(/,
		algorithm: (match) => {
			const name = (match[1] ?? "").toLowerCase();
			if (name.startsWith("des_ede3")) return "3des";
			if (name.startsWith("des")) return "des";
			return "rc4";
		},
		category: "symmetric",
		classification: "classical",
		confidence: "high",
		library: "OpenSSL",
	},
	{
		id: "c-pqc-liboqs",
		languages: LANGS,
		pattern: /\bOQS_(?:KEM|SIG)_(?:new\s*\(\s*)?(?:OQS_(?:KEM|SIG)_alg_)?([a-z0-9_]+)/i,
		algorithm: (match) => {
			const name = (match[1] ?? "").toLowerCase().replace(/_/g, "-");
			return name.length > 2 ? name : null;
		},
		category: "asymmetric",
		classification: "pqc",
		confidence: "medium",
		library: "liboqs",
	},
];
