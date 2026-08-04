import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { scanDirectory, scanFileContent } from "./scanner.js";

function algorithms(findings: readonly { algorithm: string }[]): string[] {
	return findings.map((f) => f.algorithm).sort();
}

describe("scanFileContent - true positives", () => {
	it("detects node:crypto RSA keygen and resolves adjacent modulusLength", () => {
		const source = [
			`import { generateKeyPairSync } from "node:crypto";`,
			`const { privateKey } = generateKeyPairSync("rsa", {`,
			`  modulusLength: 2048,`,
			`});`,
		].join("\n");
		const findings = scanFileContent("src/keys.ts", source, "typescript");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.algorithm).toBe("rsa-2048");
		expect(findings[0]?.keySize).toBe(2048);
		expect(findings[0]?.line).toBe(2);
		expect(findings[0]?.classification).toBe("classical");
	});

	it("detects JCA Cipher/Signature/MessageDigest string arguments", () => {
		const source = [
			`Cipher c = Cipher.getInstance("RSA/ECB/PKCS1Padding");`,
			`Signature s = Signature.getInstance("SHA256withECDSA");`,
			`MessageDigest d = MessageDigest.getInstance("MD5");`,
		].join("\n");
		const found = algorithms(scanFileContent("App.java", source, "java"));
		expect(found).toEqual(["ecdsa-unknown", "md5", "rsa-unknown"]);
	});

	it("detects python weak hash, RSA generate with size, and PyJWT alg", () => {
		const source = [
			`import hashlib`,
			`digest = hashlib.md5(data)`,
			`key = RSA.generate(4096)`,
			`token = jwt.encode(payload, key, algorithm="RS256")`,
		].join("\n");
		const found = algorithms(scanFileContent("app.py", source, "python"));
		expect(found).toEqual(["md5", "rsa-4096", "rsa-unknown"]);
	});

	it("detects go stdlib imports and curve selection", () => {
		const source = [
			`import (`,
			`  "crypto/rsa"`,
			`  "crypto/sha1"`,
			`)`,
			`key, _ := rsa.GenerateKey(rand.Reader, 2048)`,
			`curve := elliptic.P384()`,
		].join("\n");
		const found = algorithms(scanFileContent("main.go", source, "go"));
		expect(found).toEqual(["ecdsa-p384", "rsa-2048", "rsa-unknown", "sha1"]);
	});

	it("detects PEM artifact headers and hybrid TLS groups in config", () => {
		const source = [`-----BEGIN RSA PRIVATE KEY-----`, `ssl_groups: X25519MLKEM768`].join("\n");
		const findings = scanFileContent("deploy/tls.yaml", source, "config");
		expect(algorithms(findings)).toEqual(["rsa-unknown", "x25519mlkem768"]);
		expect(findings.find((f) => f.algorithm === "x25519mlkem768")?.classification).toBe("hybrid");
	});

	it("classifies PQC usage as pqc so readiness reflects adoption", () => {
		const source = `import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";`;
		const findings = scanFileContent("src/pqc.ts", source, "typescript");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.classification).toBe("pqc");
		expect(findings[0]?.algorithm).toBe("ml-kem-768");
	});

	it("flags test paths with testContext", () => {
		const findings = scanFileContent(
			"src/__tests__/rsa.test.ts",
			`generateKeyPairSync("rsa", { modulusLength: 1024 });`,
			"typescript",
		);
		expect(findings[0]?.testContext).toBe(true);
		expect(findings[0]?.algorithm).toBe("rsa-1024");
	});
});

describe("scanFileContent - adversarial negatives (the guard the spec requires)", () => {
	it("never fires on crypto APIs mentioned in comments", () => {
		const source = [
			`// migrated away from Cipher.getInstance("RSA/ECB/PKCS1Padding")`,
			`/* old code: generateKeyPairSync("rsa", { modulusLength: 2048 }) */`,
			`const done = true;`,
		].join("\n");
		expect(scanFileContent("src/notes.ts", source, "typescript")).toHaveLength(0);
	});

	it("never fires on python comments or docstrings", () => {
		const source = [
			`# TODO: drop hashlib.md5(...) usage`,
			`def f():`,
			`    """Previously called rsa.generate_private_key()."""`,
			`    return None`,
		].join("\n");
		expect(scanFileContent("app.py", source, "python")).toHaveLength(0);
	});

	it("never fires on bare algorithm words in prose strings", () => {
		const source = [
			`const msg = "We recommend replacing RSA and ECDSA with ML-KEM.";`,
			`log.info("MD5 is broken; SHA1 too");`,
		].join("\n");
		expect(scanFileContent("src/prose.ts", source, "typescript")).toHaveLength(0);
	});
});

describe("scanDirectory", () => {
	let dir: string | null = null;

	afterEach(async () => {
		if (dir) {
			await rm(dir, { recursive: true, force: true });
			dir = null;
		}
	});

	it("walks a tree, skips node_modules and binaries, reports summary", async () => {
		dir = await mkdtemp(join(tmpdir(), "ccs-test-"));
		await mkdir(join(dir, "src"));
		await mkdir(join(dir, "node_modules", "dep"), { recursive: true });
		await writeFile(
			join(dir, "src", "keys.ts"),
			`generateKeyPairSync("rsa", { modulusLength: 3072 });`,
		);
		await writeFile(
			join(dir, "node_modules", "dep", "index.js"),
			`generateKeyPairSync("rsa", { modulusLength: 1024 });`,
		);
		await writeFile(join(dir, "logo.ts"), Buffer.from([0x00, 0x01, 0x02, 0x67]));
		await writeFile(join(dir, "README.md"), "# no scan target");

		const summary = await scanDirectory({ rootDir: dir });
		expect(summary.findings).toHaveLength(1);
		expect(summary.findings[0]?.algorithm).toBe("rsa-3072");
		expect(summary.findings[0]?.path).toBe("src/keys.ts");
		expect(summary.filesScanned).toBe(1);
		expect(summary.truncated).toBe(false);
		expect(summary.filesSkipped).toBeGreaterThanOrEqual(2);
	});

	it("reports truncation honestly when maxFindings caps the scan", async () => {
		dir = await mkdtemp(join(tmpdir(), "ccs-cap-"));
		await writeFile(
			join(dir, "many.py"),
			Array.from({ length: 5 }, () => `h = hashlib.md5(x)`).join("\n"),
		);
		const summary = await scanDirectory({ rootDir: dir, maxFindings: 3 });
		expect(summary.findings).toHaveLength(3);
		expect(summary.truncated).toBe(true);
	});
});
