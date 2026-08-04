/**
 * Generate determinism / conformance vectors for the public PQC sandbox.
 *
 * Output: `apps/web/lib/pqc-conformance-vectors.json`
 *
 * What this proves: given a fixed seed and the @noble/post-quantum library
 * version pinned in `apps/web/package.json`, the public/secret key bytes
 * produced by `keygen(seed)` are deterministic. Anyone running the same
 * library version with the same seed must produce keys whose SHA-256
 * matches the values published here. If a future noble release ever
 * changes byte-level output for the same seed, the conformance route at
 * /api/sandbox/pqc-runtime/conformance starts returning false - surfacing a
 * potential FIPS compliance regression.
 *
 * What this does NOT claim: these are not NIST official ACVP test
 * vectors. NIST publishes official conformance vectors at
 * https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program
 * - those are the canonical proof of FIPS 203 / 204 / 205 conformance for
 * the library implementation. The vectors below are *determinism vectors*
 * tied to a specific noble version.
 *
 * Run:  pnpm --filter @heossihq/qnsi-web-portal run bench:gen-conformance
 *
 * Re-run only when intentionally upgrading @noble/post-quantum and
 * commit the new JSON together with the package.json bump.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	type ConformanceVector,
	KEM_REGISTRY,
	NOBLE_VERSION,
	SIG_REGISTRY,
	sha256Hex,
} from "../lib/pqc-sandbox.js";

interface SeededTarget {
	readonly algorithm: ConformanceVector["algorithm"];
	readonly kind: ConformanceVector["kind"];
	readonly seedHex: string;
	readonly note: string;
}

// Fixed seeds - chosen as recognisable byte patterns, not secret. Keeping
// them in plain hex (rather than base64) so they can be copy-pasted into
// reference test scripts. Each seed length is the size noble's keygen
// validates against (`abytes(seed, N, 'seed')`).
const ML_KEM_SEED =
	"00112233445566778899aabbccddeeff" +
	"00112233445566778899aabbccddeeff" +
	"ffeeddccbbaa99887766554433221100" +
	"ffeeddccbbaa99887766554433221100"; // 64 bytes
const ML_DSA_SEED = "0123456789abcdef0123456789abcdef" + "fedcba9876543210fedcba9876543210"; // 32 bytes

// SLH-DSA seeds: 48/72/96 bytes for security categories 1/3/5.
const SLH_DSA_SEED_PATTERN = "0123456789abcdeffedcba98765432100011223344556677"; // 48 hex chars = 24 bytes
const SLH_DSA_SEED_48 = SLH_DSA_SEED_PATTERN.repeat(2); // 48 bytes for SLH-DSA-128
const SLH_DSA_SEED_72 = SLH_DSA_SEED_PATTERN.repeat(3); // 72 bytes for SLH-DSA-192
const SLH_DSA_SEED_96 = SLH_DSA_SEED_PATTERN.repeat(4); // 96 bytes for SLH-DSA-256

const TARGETS: SeededTarget[] = [
	{
		algorithm: "ml-kem-512",
		kind: "kem",
		seedHex: ML_KEM_SEED,
		note: "ML-KEM-512 keygen with fixed 64-byte seed (FIPS 203, security category 1).",
	},
	{
		algorithm: "ml-kem-768",
		kind: "kem",
		seedHex: ML_KEM_SEED,
		note: "ML-KEM-768 keygen with fixed 64-byte seed (FIPS 203, security category 3).",
	},
	{
		algorithm: "ml-kem-1024",
		kind: "kem",
		seedHex: ML_KEM_SEED,
		note: "ML-KEM-1024 keygen with fixed 64-byte seed (FIPS 203, security category 5).",
	},
	{
		algorithm: "ml-dsa-44",
		kind: "signature",
		seedHex: ML_DSA_SEED,
		note: "ML-DSA-44 keygen with fixed 32-byte seed (FIPS 204, security category 2).",
	},
	{
		algorithm: "ml-dsa-65",
		kind: "signature",
		seedHex: ML_DSA_SEED,
		note: "ML-DSA-65 keygen with fixed 32-byte seed (FIPS 204, security category 3).",
	},
	{
		algorithm: "ml-dsa-87",
		kind: "signature",
		seedHex: ML_DSA_SEED,
		note: "ML-DSA-87 keygen with fixed 32-byte seed (FIPS 204, security category 5).",
	},
	{
		algorithm: "slh-dsa-sha2-128f",
		kind: "signature",
		seedHex: SLH_DSA_SEED_48,
		note: "SLH-DSA-SHA2-128f keygen with fixed 48-byte seed (FIPS 205, security category 1).",
	},
	{
		algorithm: "slh-dsa-sha2-192f",
		kind: "signature",
		seedHex: SLH_DSA_SEED_72,
		note: "SLH-DSA-SHA2-192f keygen with fixed 72-byte seed (FIPS 205, security category 3).",
	},
	{
		algorithm: "slh-dsa-sha2-256f",
		kind: "signature",
		seedHex: SLH_DSA_SEED_96,
		note: "SLH-DSA-SHA2-256f keygen with fixed 96-byte seed (FIPS 205, security category 5).",
	},
];

function getGitSha(): string | null {
	try {
		return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
	} catch {
		return null;
	}
}

function generate(): void {
	const vectors: ConformanceVector[] = [];

	for (const target of TARGETS) {
		const seed = Buffer.from(target.seedHex, "hex");
		let publicKey: Uint8Array;
		let secretKey: Uint8Array;
		if (target.kind === "kem") {
			const entry = KEM_REGISTRY[target.algorithm as keyof typeof KEM_REGISTRY];
			const kp = entry.instance.keygen(seed);
			publicKey = kp.publicKey;
			secretKey = kp.secretKey;
		} else {
			const entry = SIG_REGISTRY[target.algorithm as keyof typeof SIG_REGISTRY];
			const kp = entry.instance.keygen(seed);
			publicKey = kp.publicKey;
			secretKey = kp.secretKey;
		}

		const expectedPublicKeySha256 = sha256Hex(publicKey);
		const expectedSecretKeySha256 = sha256Hex(secretKey);

		vectors.push({
			algorithm: target.algorithm,
			kind: target.kind,
			seedHex: target.seedHex,
			expectedPublicKeySha256,
			expectedSecretKeySha256,
			note: target.note,
		});

		console.log(
			`${target.algorithm.padEnd(12)} pub-sha256=${expectedPublicKeySha256.slice(0, 16)}…  sec-sha256=${expectedSecretKeySha256.slice(0, 16)}…`,
		);
	}

	const here = dirname(fileURLToPath(import.meta.url));
	const out = join(here, "..", "lib", "pqc-conformance-vectors.json");

	const payload = {
		schemaVersion: 1,
		generatedAt: new Date().toISOString(),
		gitSha: getGitSha(),
		generator: "apps/web/scripts/generate-conformance-vectors.ts",
		library: {
			name: "@noble/post-quantum",
			version: NOBLE_VERSION,
			source: "https://github.com/paulmillr/noble-post-quantum",
		},
		standards: {
			"FIPS 203":
				"Module-Lattice-Based Key-Encapsulation Mechanism Standard (NIST, finalized August 2024)",
			"FIPS 204": "Module-Lattice-Based Digital Signature Standard (NIST, finalized August 2024)",
			"FIPS 205": "Stateless Hash-Based Digital Signature Standard (NIST, finalized August 2024)",
		},
		nistConformanceReference:
			"https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/post-quantum-cryptography",
		disclaimer:
			"These are determinism vectors for QNSI's pinned @noble/post-quantum version. Re-running keygen with each seed using the same library version must produce keys whose SHA-256 matches the expected values. Independent NIST conformance is established by the upstream @noble/post-quantum project against NIST ACVP test vectors.",
		vectors,
	};

	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
	console.log(`\nWrote ${out}`);
}

generate();
