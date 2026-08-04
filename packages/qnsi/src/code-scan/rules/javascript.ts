/**
 * JS/TS rule pack: node:crypto, WebCrypto, JWT alg strings, common libraries.
 * Every pattern anchors on API context - never a bare algorithm word.
 */

import { canonicalEcCurve } from "../canonical.js";
import type { CryptoDetectionRule } from "../types.js";

const LANGS = ["javascript", "typescript"] as const;

export const javascriptRules: readonly CryptoDetectionRule[] = [
	{
		id: "js-node-crypto-generate-keypair-rsa",
		languages: LANGS,
		pattern: /generateKeyPair(?:Sync)?\s*\(\s*["'`]rsa(?:-pss)?["'`]/,
		algorithm: "rsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "node:crypto",
		wantsKeySize: true,
	},
	{
		id: "js-node-crypto-generate-keypair-ec",
		languages: LANGS,
		pattern: /generateKeyPair(?:Sync)?\s*\(\s*["'`]ec["'`]/,
		algorithm: "ecdsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "node:crypto",
	},
	{
		id: "js-node-crypto-named-curve",
		languages: LANGS,
		pattern: /namedCurve\s*:\s*["'`]([A-Za-z0-9-]+)["'`]/,
		algorithm: (match) => canonicalEcCurve(match[1] ?? ""),
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "node:crypto",
	},
	{
		id: "js-node-crypto-generate-keypair-ed25519",
		languages: LANGS,
		pattern: /generateKeyPair(?:Sync)?\s*\(\s*["'`](ed25519|ed448|x25519|x448)["'`]/,
		algorithm: (match) => {
			const name = (match[1] ?? "").toLowerCase();
			return name === "x25519" || name === "x448" ? `ecdh-${name}` : name;
		},
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "node:crypto",
	},
	{
		id: "js-node-crypto-weak-hash",
		languages: LANGS,
		pattern: /createHash\s*\(\s*["'`](md5|sha1)["'`]/i,
		algorithm: (match) => (match[1] ?? "").toLowerCase(),
		category: "hash",
		classification: "classical",
		confidence: "high",
		library: "node:crypto",
	},
	{
		id: "js-node-crypto-cipheriv",
		languages: LANGS,
		pattern:
			/create(?:Cipheriv|Decipheriv)\s*\(\s*["'`]((?:aes|des|des3|des-ede3|rc4)[a-z0-9-]*)["'`]/i,
		algorithm: (match) => {
			const transform = (match[1] ?? "").toLowerCase();
			if (transform.startsWith("des-ede3") || transform.startsWith("des3")) return "3des";
			if (transform.startsWith("des")) return "des";
			if (transform.startsWith("rc4")) return "rc4";
			const aes = /^aes-?(\d{3})(?:-([a-z0-9]+))?/.exec(transform);
			if (aes) {
				return aes[2] === "gcm" ? `aes-${aes[1]}-gcm` : `aes-${aes[1]}`;
			}
			return null;
		},
		category: "symmetric",
		classification: "classical",
		confidence: "high",
		library: "node:crypto",
	},
	{
		id: "js-webcrypto-rsa",
		languages: LANGS,
		pattern: /["'`](RSASSA-PKCS1-v1_5|RSA-OAEP|RSA-PSS)["'`]/,
		algorithm: "rsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "WebCrypto",
		wantsKeySize: true,
	},
	{
		id: "js-webcrypto-ecdsa-ecdh",
		languages: LANGS,
		pattern: /name\s*:\s*["'`](ECDSA|ECDH)["'`]/,
		algorithm: (match) => `${(match[1] ?? "").toLowerCase()}-unknown`,
		category: "asymmetric",
		classification: "classical",
		confidence: "medium",
		library: "WebCrypto",
	},
	{
		id: "js-jwt-classical-alg",
		languages: LANGS,
		pattern:
			/\balg(?:orithm)?s?\b\s*[:=]\s*\[?\s*["'`](RS256|RS384|RS512|PS256|PS384|PS512|ES256|ES384|ES512|EdDSA)["'`]/,
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
		library: "jose/jsonwebtoken",
	},
	{
		id: "js-lib-elliptic",
		languages: LANGS,
		pattern: /require\s*\(\s*["'`]elliptic["'`]\s*\)|from\s+["'`]elliptic["'`]/,
		algorithm: "ecdsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "medium",
		library: "elliptic",
	},
	{
		id: "js-lib-node-forge-rsa",
		languages: LANGS,
		pattern: /forge\.pki\.rsa|forge\.rsa\./,
		algorithm: "rsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "node-forge",
		wantsKeySize: true,
	},
	// PQC usage - counted so readiness reflects code reality, not only gaps.
	{
		id: "js-pqc-noble-post-quantum",
		languages: LANGS,
		pattern: /from\s+["'`]@noble\/post-quantum(?:\/([a-z-]+)(?:\.js)?)?["'`]/,
		algorithm: (match) => {
			const mod = match[1] ?? "";
			if (mod.includes("ml-kem")) return "ml-kem-768";
			if (mod.includes("ml-dsa")) return "ml-dsa-65";
			if (mod.includes("slh-dsa")) return "slh-dsa-sha2-128f";
			return "ml-kem-768";
		},
		category: "asymmetric",
		classification: "pqc",
		confidence: "medium",
		library: "@noble/post-quantum",
	},
	{
		id: "js-pqc-explicit-mlkem-mldsa",
		languages: LANGS,
		pattern: /["'`](ml[-_]kem[-_](?:512|768|1024)|ml[-_]dsa[-_](?:44|65|87))["'`]/i,
		algorithm: (match) => (match[1] ?? "").toLowerCase().replace(/_/g, "-"),
		category: "asymmetric",
		classification: "pqc",
		confidence: "medium",
		library: "pqc",
	},
];
