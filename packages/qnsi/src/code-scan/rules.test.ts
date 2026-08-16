import { describe, expect, it } from "vitest";

import { scanFileContent } from "./scanner.js";
import type { Language } from "./types.js";

function algorithmsOf(source: string, language: Language, path = `src/probe.${language}`) {
	return scanFileContent(path, source, language).map((finding) => finding.algorithm);
}

type Case = readonly [source: string, expected: string];

function runCases(language: Language, cases: readonly Case[]) {
	for (const [source, expected] of cases) {
		expect(algorithmsOf(source, language), source).toContain(expected);
	}
}

describe("rust rules", () => {
	it("classifies classical crates, keygen, ring, weak hashes, and pqc crates", () => {
		runCases("rust", [
			["use rsa::RsaPrivateKey;", "rsa-unknown"],
			["use p256::ecdsa::SigningKey;", "ecdsa-p256"],
			["use k256::Secp256k1;", "ecdsa-p256"],
			["use p384::NistP384;", "ecdsa-p384"],
			["use ed25519_dalek::Keypair;", "ed25519"],
			["use x25519_dalek::StaticSecret;", "ecdh-x25519"],
			["let key = RsaPrivateKey::new(&mut rng, 2048);", "rsa-2048"],
			["let alg = &ring::signature::RSA_PKCS1_SHA256;", "rsa-unknown"],
			["let alg = &ring::signature::ECDSA_P256_SHA256_ASN1;", "ecdsa-unknown"],
			["let alg = &ring::signature::ED25519;", "ed25519"],
			["use md5;", "md5"],
			["use sha1;", "sha1"],
			["let d = Sha1::digest(data);", "sha1"],
			["let d = Md5::new();", "md5"],
			["use pqcrypto::kem;", "ml-kem-768"],
			["use ml_dsa::MlDsa65;", "ml-dsa-65"],
			["use fips204::traits::Signer;", "ml-dsa-65"],
			["use fips203::ml_kem_768;", "ml-kem-768"],
		]);
	});
});

describe("c rules", () => {
	it("classifies OpenSSL RSA/EC/digest/cipher and liboqs names", () => {
		runCases("c", [
			["RSA *rsa = RSA_generate_key(2048, RSA_F4, NULL, NULL);", "rsa-2048"],
			["EVP_PKEY *p = EVP_PKEY_new_id(EVP_PKEY_RSA);", "rsa-unknown"],
			["EC_KEY *k = EC_KEY_new_by_curve_name(NID_secp384r1);", "ecdsa-unknown"],
			["int nid = NID_X9_62_prime256v1;", "ecdsa-p256"],
			["int nid = NID_secp384r1;", "ecdsa-p384"],
			["int nid = NID_secp521r1;", "ecdsa-p521"],
			["EC_KEY *k = EC_KEY_new();", "ecdsa-unknown"],
			["const EVP_MD *md = EVP_md5();", "md5"],
			["const EVP_MD *md = EVP_sha1();", "sha1"],
			["MD5_Init(&ctx);", "md5"],
			["SHA1_Update(&ctx, buf, len);", "sha1"],
			["const EVP_CIPHER *c = EVP_des_ede3_cbc();", "3des"],
			["const EVP_CIPHER *c = EVP_des_cbc();", "des"],
			["const EVP_CIPHER *c = EVP_rc4();", "rc4"],
			["OQS_KEM *kem = OQS_KEM_new(OQS_KEM_alg_kyber_768);", "kyber-768"],
		]);
	});

	it("vetoes liboqs matches whose captured name is too short to be an algorithm", () => {
		expect(algorithmsOf("OQS_KEM_x(x);", "c")).toEqual([]);
	});
});

describe("csharp rules", () => {
	it("classifies System.Security.Cryptography families", () => {
		runCases("csharp", [
			["using var rsa = RSA.Create();", "rsa-unknown"],
			["var e = ECDsa.Create();", "ecdsa-unknown"],
			["var e = ECDiffieHellman.Create();", "ecdh-unknown"],
			["var curve = ECCurve.NamedCurves.nistP256;", "ecdsa-p256"],
			["var curve = ECCurve.NamedCurves.nistP384;", "ecdsa-p384"],
			["var curve = ECCurve.NamedCurves.nistP521;", "ecdsa-p521"],
			["using var md5 = MD5.Create();", "md5"],
			["using var sha = SHA1.Create();", "sha1"],
			["using var des = TripleDES.Create();", "3des"],
			["using var des = DES.Create();", "des"],
			["using var rc2 = RC2.Create();", "rc2"],
			["using var aes = Aes.Create();", "aes-unknown"],
		]);
	});
});

describe("go rules", () => {
	it("classifies stdlib imports, curve selection, and pqc module paths", () => {
		runCases("go", [
			['import "crypto/rsa"', "rsa-unknown"],
			['import "crypto/dsa"', "dsa-unknown"],
			['import "crypto/ed25519"', "ed25519"],
			['import "crypto/ecdsa"', "ecdsa-unknown"],
			["key, err := rsa.GenerateKey(rand.Reader, 2048)", "rsa-2048"],
			["curve := elliptic.P256()", "ecdsa-p256"],
			["curve := elliptic.P384()", "ecdsa-p384"],
			["curve := elliptic.P521()", "ecdsa-p521"],
			["curve := elliptic.P224()", "ecdsa-unknown"],
			['import "crypto/md5"', "md5"],
			['import "crypto/sha1"', "sha1"],
			['import "crypto/des"', "des"],
			['import "crypto/rc4"', "rc4"],
			['import "crypto/mlkem"', "ml-kem-768"],
			['import "github.com/cloudflare/circl/sign/mldsa/mldsa65"', "ml-dsa-65"],
			['import "github.com/example/kyber"', "ml-kem-768"],
		]);
	});
});

describe("java rules", () => {
	it("classifies JCA getInstance families and BouncyCastle", () => {
		runCases("java", [
			['KeyPairGenerator.getInstance("RSA");', "rsa-unknown"],
			['KeyPairGenerator.getInstance("EC");', "ecdsa-unknown"],
			['KeyPairGenerator.getInstance("DSA");', "dsa-unknown"],
			['KeyPairGenerator.getInstance("Ed25519");', "ed25519"],
			['KeyPairGenerator.getInstance("Ed448");', "ed448"],
			['KeyPairGenerator.getInstance("X25519");', "ecdh-x25519"],
			['KeyPairGenerator.getInstance("X448");', "ecdh-x448"],
			['KeyPairGenerator.getInstance("DH");', "ecdh-unknown"],
			['Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");', "rsa-unknown"],
			['Cipher.getInstance("AES/GCM/NoPadding");', "aes-unknown-gcm"],
			['Cipher.getInstance("AES/CBC/PKCS5Padding");', "aes-unknown"],
			['Cipher.getInstance("DESede/CBC/PKCS5Padding");', "3des"],
			['Cipher.getInstance("DES/ECB/PKCS5Padding");', "des"],
			['Cipher.getInstance("RC4");', "rc4"],
			['Cipher.getInstance("Blowfish/CBC/PKCS5Padding");', "blowfish"],
			['Signature.getInstance("SHA256withRSA");', "rsa-unknown"],
			['Signature.getInstance("SHA256withECDSA");', "ecdsa-unknown"],
			['Signature.getInstance("SHA1withDSA");', "dsa-unknown"],
			['Signature.getInstance("Ed25519");', "ed25519"],
			['Signature.getInstance("Ed448");', "ed448"],
			['MessageDigest.getInstance("MD5");', "md5"],
			['MessageDigest.getInstance("SHA-1");', "sha1"],
			['KeyAgreement.getInstance("ECDH");', "ecdh-unknown"],
			['KeyAgreement.getInstance("X25519");', "ecdh-x25519"],
			['KeyAgreement.getInstance("X448");', "ecdh-x448"],
			['KeyAgreement.getInstance("DH");', "dh-unknown"],
			["import org.bouncycastle.crypto.generators.RSAKeyPairGenerator;", "rsa-unknown"],
			["import org.bouncycastle.crypto.generators.ECKeyPairGenerator;", "ecdsa-unknown"],
			["import org.bouncycastle.crypto.generators.DSAKeyPairGenerator;", "dsa-unknown"],
			["import org.bouncycastle.pqc.jcajce.provider.BouncyCastlePQCProvider;", "ml-kem-768"],
			['KeyPairGenerator.getInstance("ML-KEM");', "ml-kem-768"],
			['KeyPairGenerator.getInstance("ML-DSA");', "ml-dsa-65"],
			['KeyPairGenerator.getInstance("ML-DSA-87");', "ml-dsa-87"],
		]);
	});

	it("vetoes plain-hash signature specs and bare BouncyCastle provider imports", () => {
		expect(algorithmsOf('Signature.getInstance("SHA256");', "java")).toEqual([]);
		expect(algorithmsOf("import org.bouncycastle.jce.provider.X;", "java")).toEqual([]);
	});
});

describe("javascript rules", () => {
	it("classifies node:crypto, WebCrypto, JWT algs, libraries, and pqc modules", () => {
		runCases("typescript", [
			['generateKeyPairSync("rsa", { modulusLength: 3072 });', "rsa-3072"],
			['generateKeyPair("ec", { namedCurve: "P-256" });', "ecdsa-unknown"],
			['const o = { namedCurve: "P-384" };', "ecdsa-p384"],
			['generateKeyPairSync("ed25519");', "ed25519"],
			['generateKeyPairSync("ed448");', "ed448"],
			['generateKeyPairSync("x25519");', "ecdh-x25519"],
			['generateKeyPairSync("x448");', "ecdh-x448"],
			['createHash("md5");', "md5"],
			['createHash("sha1");', "sha1"],
			['createCipheriv("aes-256-gcm", key, iv);', "aes-256-gcm"],
			['createCipheriv("aes-128-cbc", key, iv);', "aes-128"],
			['createDecipheriv("des-ede3-cbc", key, iv);', "3des"],
			['createCipheriv("des-cbc", key, iv);', "des"],
			['createCipheriv("rc4", key, "");', "rc4"],
			['const alg = "RSA-OAEP";', "rsa-unknown"],
			['await subtle.generateKey({ name: "ECDSA" }, true, []);', "ecdsa-unknown"],
			['await subtle.generateKey({ name: "ECDH" }, true, []);', "ecdh-unknown"],
			['jwt.verify(token, key, { algorithms: ["RS256"] });', "rsa-unknown"],
			['jwt.verify(token, key, { algorithms: ["ES256"] });', "ecdsa-p256"],
			['jwt.verify(token, key, { algorithms: ["ES384"] });', "ecdsa-p384"],
			['jwt.verify(token, key, { algorithms: ["ES512"] });', "ecdsa-p521"],
			['jwt.verify(token, key, { algorithms: ["EdDSA"] });', "ed25519"],
			['import EC from "elliptic";', "ecdsa-unknown"],
			["const pair = forge.pki.rsa.generateKeyPair(2048);", "rsa-2048"],
			['import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";', "ml-kem-768"],
			['import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";', "ml-dsa-65"],
			['import { slh_dsa } from "@noble/post-quantum/slh-dsa.js";', "slh-dsa-sha2-128f"],
			['import * as pq from "@noble/post-quantum";', "ml-kem-768"],
			['const algorithm = "ml_dsa_87";', "ml-dsa-87"],
		]);
	});

	it("vetoes cipher transforms that never resolve to a concrete AES id", () => {
		expect(
			algorithmsOf('createCipheriv("aes-gcm-of-unknown-size", key, iv);', "typescript"),
		).toEqual([]);
	});
});

describe("python rules", () => {
	it("classifies pyca, PyCryptodome, hashlib, PyJWT, and liboqs", () => {
		runCases("python", [
			["key = rsa.generate_private_key(public_exponent=65537, key_size=2048)", "rsa-2048"],
			["curve = ec.SECP192R1()", "ecdsa-p192"],
			["curve = ec.SECP256R1()", "ecdsa-p256"],
			["curve = ec.SECP384R1()", "ecdsa-p384"],
			["curve = ec.SECP521R1()", "ecdsa-p521"],
			["pad = padding.PKCS1v15()", "rsa-unknown"],
			["key = Ed25519PrivateKey.generate()", "ed25519"],
			["key = Ed448PrivateKey.generate()", "ed448"],
			["key = X25519PrivateKey.generate()", "ecdh-x25519"],
			["key = X448PrivateKey.generate()", "ecdh-x448"],
			["key = RSA.generate(2048)", "rsa-2048"],
			["from Crypto.Cipher import DES3", "3des"],
			["from Crypto.Cipher import DES", "des"],
			["from Crypto.Cipher import ARC4", "rc4"],
			["cipher = DES3.new(key, DES3.MODE_CBC)", "3des"],
			["digest = hashlib.md5(data)", "md5"],
			["digest = hashlib.sha1(data)", "sha1"],
			['jwt.decode(token, key, algorithms=["RS256"])', "rsa-unknown"],
			['jwt.decode(token, key, algorithms=["ES256"])', "ecdsa-p256"],
			['jwt.decode(token, key, algorithms=["ES384"])', "ecdsa-p384"],
			['jwt.decode(token, key, algorithms=["ES512"])', "ecdsa-p521"],
			['jwt.decode(token, key, algorithms=["EdDSA"])', "ed25519"],
			['kem = oqs.KeyEncapsulation("Kyber768")', "kyber768"],
			['sig = oqs.Signature("ML_DSA_65")', "ml-dsa-65"],
		]);
	});
});

describe("artifact rules", () => {
	it("classifies PEM headers, JWK kty fields, hybrid TLS groups, and Cargo deps", () => {
		runCases("config", [
			["-----BEGIN RSA PRIVATE KEY-----", "rsa-unknown"],
			["-----BEGIN EC PRIVATE KEY-----", "ecdsa-unknown"],
			["-----BEGIN DSA PRIVATE KEY-----", "dsa-unknown"],
			['{"kty": "RSA", "n": "..."}', "rsa-unknown"],
			['{"kty": "EC", "crv": "P-256"}', "ecdsa-unknown"],
			['{"kty": "OKP", "crv": "Ed25519"}', "ed25519"],
			["ssl_ecdh_curve X25519MLKEM768;", "x25519mlkem768"],
			['rsa = "0.9"', "rsa-unknown"],
			['p256 = { version = "0.13" }', "ecdsa-p256"],
			['p384 = "0.13"', "ecdsa-p384"],
			['ed25519-dalek = "2.0"', "ed25519"],
			['md5 = "0.7"', "md5"],
		]);
	});

	it("fires PEM rules inside source languages too", () => {
		expect(algorithmsOf('const pem = "-----BEGIN RSA PRIVATE KEY-----";', "typescript")).toContain(
			"rsa-unknown",
		);
	});
});

describe("extractor defensive arms", () => {
	it("every function extractor tolerates a match with no capture groups", async () => {
		const { ALL_RULES } = await import("./rules/index.js");
		const bareMatch = Object.assign(["match-without-groups"], {
			index: 0,
			input: "match-without-groups",
		}) as RegExpExecArray;
		for (const rule of ALL_RULES) {
			if (typeof rule.algorithm === "function") {
				const result = rule.algorithm(bareMatch, "match-without-groups");
				expect(result === null || typeof result === "string", rule.id).toBe(true);
			}
		}
	});
});

describe("canonical helpers", () => {
	it("canonicalRsa maps known sizes and falls back for odd or missing sizes", async () => {
		const { canonicalRsa, canonicalEcCurve, normalizeAlgorithmId, findKeySizeNear } = await import(
			"./canonical.js"
		);
		expect(canonicalRsa(2048)).toBe("rsa-2048");
		expect(canonicalRsa(1536)).toBe("rsa-unknown");
		expect(canonicalRsa(null)).toBe("rsa-unknown");

		expect(canonicalEcCurve("prime256v1")).toBe("ecdsa-p256");
		expect(canonicalEcCurve("secp384r1", "ecdh")).toBe("ecdh-p384");
		expect(canonicalEcCurve("curve25519")).toBeNull();

		expect(normalizeAlgorithmId("ML_DSA_65")).toBe("ml-dsa-65");

		expect(findKeySizeNear(["RSA.generate(2048)"], 0)).toBe(2048);
		expect(findKeySizeNear(["generateKeyPair(", "  modulusLength: 4096,"], 0)).toBe(4096);
		// Inline literals only count on the firing line itself.
		expect(findKeySizeNear(["generateKeyPair(", "  2048"], 0)).toBeNull();
		expect(findKeySizeNear(["no sizes here"], 0)).toBeNull();
	});
});

describe("scanner tails", () => {
	it("detects languages by extension, config files, and refuses minified bundles", async () => {
		const { detectLanguage, isTestPath, scanFileContent: scan } = await import("./scanner.js");
		expect(detectLanguage("bundle.min.js")).toBeNull();
		expect(detectLanguage("bundle.min.mjs")).toBeNull();
		expect(detectLanguage("Dockerfile")).toBe("config");
		expect(detectLanguage("Makefile")).toBeNull();
		expect(detectLanguage("main.rs")).toBe("rust");
		expect(detectLanguage("weird.unknownext")).toBeNull();

		expect(isTestPath("src/__tests__/x.ts")).toBe(true);
		expect(isTestPath("src/keys.test.ts")).toBe(true);
		expect(isTestPath("src/keys.ts")).toBe(false);

		// A language value outside the rule tables produces no findings.
		expect(scan("src/x.bf", "anything", "brainfuck" as never)).toEqual([]);
	});

	it("canonicalizes DSA key sizes when a 1024-bit size is adjacent", async () => {
		const { scanFileContent: scan } = await import("./scanner.js");
		const findings = scan(
			"src/Legacy.java",
			'KeyPairGenerator kpg = KeyPairGenerator.getInstance("DSA"); kpg.initialize(1024);',
			"java",
		);
		expect(findings.map((f) => f.algorithm)).toContain("dsa-1024");
	});

	it("skips symlinks, non-files, lockfiles, and oversized files during a walk", async () => {
		const { mkdtemp, mkdir, writeFile, rm, symlink } = await import("node:fs/promises");
		const { execFileSync } = await import("node:child_process");
		const { tmpdir } = await import("node:os");
		const { join } = await import("node:path");
		const { scanDirectory } = await import("./scanner.js");

		const dir = await mkdtemp(join(tmpdir(), "ccs-tails-"));
		try {
			await mkdir(join(dir, "nested"));
			await writeFile(join(dir, "nested", "a.py"), "h = hashlib.md5(x)\nh = hashlib.sha1(x)");
			await writeFile(join(dir, "b.py"), "h = hashlib.md5(x)");
			await writeFile(join(dir, "pnpm-lock.yaml"), "lockfile: true");
			await writeFile(join(dir, "big.py"), "h = hashlib.md5(x)".repeat(10));
			await symlink(join(dir, "b.py"), join(dir, "link.py"));
			execFileSync("mkfifo", [join(dir, "pipe.py")]);

			const summary = await scanDirectory({ rootDir: dir, maxFileBytes: 60 });
			expect(summary.findings.length).toBeGreaterThan(0);
			// lockfile + big file + symlink skipped; the fifo is silently ignored.
			expect(summary.filesSkipped).toBeGreaterThanOrEqual(3);
			expect(summary.findings.every((f) => !f.path.includes("link"))).toBe(true);

			// A findings cap inside a nested walk stops recursion at both levels.
			const capped = await scanDirectory({ rootDir: dir, maxFileBytes: 60, maxFindings: 1 });
			expect(capped.truncated).toBe(true);
			expect(capped.findings).toHaveLength(1);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

describe("strip tails", () => {
	it("keeps escaped quotes inside strings and strips trailing comments", async () => {
		const { stripComments } = await import("./strip.js");
		const [line] = stripComments('const s = "a\\"b"; // trailing', "typescript");
		expect(line).toBe('const s = "a\\"b"; ');
	});
});
