/**
 * C# rule pack: System.Security.Cryptography.
 */

import type { CryptoDetectionRule } from "../types.js";

const LANGS = ["csharp"] as const;

export const csharpRules: readonly CryptoDetectionRule[] = [
	{
		id: "cs-rsa",
		languages: LANGS,
		pattern: /\b(RSACryptoServiceProvider|RSA\.Create|RSACng|RSAOpenSsl)\b\s*\(?/,
		algorithm: "rsa-unknown",
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "System.Security.Cryptography",
		wantsKeySize: true,
	},
	{
		id: "cs-ecdsa-ecdh",
		languages: LANGS,
		pattern: /\b(ECDsa(?:Cng|OpenSsl)?\.Create|ECDiffieHellman(?:Cng)?\.Create)\b/,
		algorithm: (match) => ((match[1] ?? "").startsWith("ECDsa") ? "ecdsa-unknown" : "ecdh-unknown"),
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "System.Security.Cryptography",
	},
	{
		id: "cs-named-curve",
		languages: LANGS,
		pattern: /ECCurve\.NamedCurves\.nistP(256|384|521)/,
		algorithm: (match) => `ecdsa-p${match[1] ?? "256"}`,
		category: "asymmetric",
		classification: "classical",
		confidence: "high",
		library: "System.Security.Cryptography",
	},
	{
		id: "cs-weak-hash",
		languages: LANGS,
		pattern: /\b(MD5|SHA1)(?:CryptoServiceProvider|Managed|Cng)?\.Create\s*\(/,
		algorithm: (match) => (match[1] ?? "").toLowerCase(),
		category: "hash",
		classification: "classical",
		confidence: "high",
		library: "System.Security.Cryptography",
	},
	{
		id: "cs-weak-cipher",
		languages: LANGS,
		pattern: /\b(DES|TripleDES|RC2|Aes)(?:CryptoServiceProvider|Managed|Cng)?\.Create\s*\(/,
		algorithm: (match) => {
			const name = match[1] ?? "";
			if (name === "TripleDES") return "3des";
			if (name === "DES") return "des";
			if (name === "RC2") return "rc2";
			return "aes-unknown";
		},
		category: "symmetric",
		classification: "classical",
		confidence: "high",
		library: "System.Security.Cryptography",
	},
];
