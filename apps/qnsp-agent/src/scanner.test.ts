import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as tls from "node:tls";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkpointPath, listScanCheckpointSummaries, scanScopeHash } from "./scan-checkpoint.js";
import { runScan } from "./scanner.js";

// A real, long-lived (valid to 2126) self-signed RSA-2048 X.509 certificate + its private
// key, used to exercise the certificate parser and the live TLS-endpoint probe against a
// genuine local TLS server. Generated with `openssl req -x509 -newkey rsa:2048 -nodes`.
const TEST_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIDTzCCAjegAwIBAgIUf3TqVg2lq0Lu2+344Kap6Eut7UAwDQYJKoZIhvcNAQEL
BQAwNjEeMBwGA1UEAwwVcW5zcC1hZ2VudC10ZXN0LmxvY2FsMRQwEgYDVQQKDAtI
RU9TU0kgVGVzdDAgFw0yNjA3MTkxMDIxMjRaGA8yMTI2MDYyNTEwMjEyNFowNjEe
MBwGA1UEAwwVcW5zcC1hZ2VudC10ZXN0LmxvY2FsMRQwEgYDVQQKDAtIRU9TU0kg
VGVzdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALf05eSnT/HImhr+
1PDFFOchureHEULTgHD3HYGr6hyOt1+XS6I5JX/O7AJQJDGUOggwpPJqfeMU6EMF
TS4henrpib1n+KGt0KgBnC3j8uXn5jX5V+eqBWVaGal49MtwogFquPkIOS0DTm3M
L1uv7ISc1dmaz4A8tTsYWJjRkP2qUQLyr8vRK/KX1kcKxKRLv6sGWpKgjQITciBW
e3AcS7XUGettbhLk4fEKiGELaSd0watAjVRwIuzf9CxZEf8Z+MlcJkHREXgkUn1V
pSUoKP9gHRhheIcR+Lt03giwU6w+zgaGxhWVDIPImOBuJDgRcWtJIMxmlUdyX2nm
YBm6/lECAwEAAaNTMFEwHQYDVR0OBBYEFDoRAvrtiFe/Mu2DNQhXR2dCqUUnMB8G
A1UdIwQYMBaAFDoRAvrtiFe/Mu2DNQhXR2dCqUUnMA8GA1UdEwEB/wQFMAMBAf8w
DQYJKoZIhvcNAQELBQADggEBAGuSv/mZpToWNP1jF+9M2qkscK9fpaJTw9KBdJiU
e99nDC/vcJgai3XbJ+NLfzOm55zcN9MlYdsfpwMLDNgkwFs810pdDVlZIm7EbddR
tCPuYIZ7sUs/CsfpYhHon6r7b5v9fHGRlXNsV3tLxJCwVyGxI8I8tLhYcMT0H0Ja
qLye+sXLHCBkSHNvxnm+LqjSL7QD2MSh7gu2M/Eu9M3jvXbtd10+igjAFQVUSXu8
nhgOojE7VjqVn9rlzrhAIiAo/Tv52g88dCR+e4GiZ4sJD+rjuuIVIkjDHJ1wOorK
hDTHrdHt/qYLN2fAVTw41NGRrUWbgbzk+CeTcEn8uWLvya0=
-----END CERTIFICATE-----
`;

const TEST_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC39OXkp0/xyJoa
/tTwxRTnIbq3hxFC04Bw9x2Bq+ocjrdfl0uiOSV/zuwCUCQxlDoIMKTyan3jFOhD
BU0uIXp66Ym9Z/ihrdCoAZwt4/Ll5+Y1+VfnqgVlWhmpePTLcKIBarj5CDktA05t
zC9br+yEnNXZms+APLU7GFiY0ZD9qlEC8q/L0Svyl9ZHCsSkS7+rBlqSoI0CE3Ig
VntwHEu11BnrbW4S5OHxCohhC2kndMGrQI1UcCLs3/QsWRH/GfjJXCZB0RF4JFJ9
VaUlKCj/YB0YYXiHEfi7dN4IsFOsPs4GhsYVlQyDyJjgbiQ4EXFrSSDMZpVHcl9p
5mAZuv5RAgMBAAECggEAKVhZ3kMrkO5zEnuxjP7itJMsZejt3HzwapNj9pvWxb3e
4ZV96pNZBgmSGm/8Podv5pzWSeTc7++oRz33C5X7MwpvypoGdAI+ujAIc/j+hCVT
pNBqrTcVuOKgD2rP7DSfuN1Nfy1VunP6ieuBPmSDLogYeWzV097xJbvSV+CMK7Ld
KhI5EG6YcFpZ/j+k7mwp08kOm5PPwxIpBbZtK2vFkYa8mOBtPyZR4yHIgTK00M2t
RYH9LargBG0324X0XcdXfLPJ+Px5Lx+rzx/9+YqKyzgts2xrQqVMoT8TcocCb719
tubTd6kOHigpPgtyOC2gLiMIiK8K0AXIhEaN9ruIpQKBgQDdgSSjoIfK+gumpm4Z
rAPnGsq9QFHitYuyXGkiDPqfIk1iffU/3PuAFkxKHvQiEsCxEGmiaMLVj2ddgOdP
zwugzEBiBztf0GHAdmfNfKK1s5/FJDlcvBGPeVShpEKN9uhavil3u2/dvDR4kUXM
JlLnSfRaz5hd1qGNCjDmE7rwdQKBgQDUms/f2RGZwGbHWerTdHUmlicXQpjsVeQA
9YsB9flz//dsHVpAF9N5cI7u2sTMGe40DDdnFnuCnsjZDDE3XNGDn88Wkujny8g8
xidYmBNLSHeQDutifQ55rnEgdPL0S33eVL4WdGEwuPLcYY0DCnXj4RVBhytJESfZ
s+iNPHSa7QKBgAqIFWHiRBKWiO9Hgnyd/SGD2Jfe8wXAc//q/OStkUz3qI5CRuLe
cubIKKBtkFX+ZkME8MDUEk9tHhEIC/dzdK4UiAshJOWNVth7yLuwbVwOSk5pRoDu
QDd+IVP+J1vwnWOTHw2eT9dPF3+UCKmIOPDeR0v6CtiLV+sIzQJjdcPxAoGBAJVk
LzupCSATvWTJPyPUylkR22gRyOkQtYUjBMmc8Otc6pwSyA8Pbu7/c8BNA0oz0ljK
WMfcWW+AabtyQMcZNrOZwOeo1XXDkPF7f7xWKACXbERS532uSFSiiiV3aBzXSxvG
Skf3ATA+VZEcDv0bBZnZ2JjSBU1ze6ATNg7Ac2NFAoGATOQQIPmywB/2fFIVHCKy
0HU0S3MKnmB9Y4368V3hrDetMNYsl/5MUBYbvr1BJFyDj+nmQivtYD357ZAClWZ2
3mEtp6FJZZQXbJxPa/GT4rNEMX/c4ACC/yVO5aggPoGl4jDAoNqbQP4MpL1jZdBB
he1Mq5KfxED48TpptZUJcyI=
-----END PRIVATE KEY-----
`;

/** Bind a real TLS server to the first bindable port from the scanner's probe list. */
async function startTlsServerOnScannerPort(): Promise<{ server: tls.Server; port: number }> {
	// Prefer high ports that do not need privileges and rarely collide.
	for (const port of [9443, 4443, 3443, 8444]) {
		const bound = await new Promise<tls.Server | null>((resolve) => {
			const server = tls.createServer({ cert: TEST_CERT_PEM, key: TEST_KEY_PEM });
			server.once("error", () => resolve(null));
			server.listen(port, "127.0.0.1", () => resolve(server));
		});
		if (bound) return { server: bound, port };
	}
	throw new Error("could not bind any scanner TLS port for the test");
}

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qnsp-agent-test-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(name: string, content: string): string {
	const p = path.join(tmpDir, name);
	fs.writeFileSync(p, content, { mode: 0o600 });
	return p;
}

function generateRsaKeyPem(): string {
	const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
	return privateKey.export({ type: "pkcs8", format: "pem" }) as string;
}

function generateEcKeyPem(): string {
	const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
	return privateKey.export({ type: "sec1", format: "pem" }) as string;
}

describe("scanner", () => {
	it("discovers RSA private key files", async () => {
		const pem = generateRsaKeyPem();
		writeFile("id_rsa", pem);

		const result = await runScan([tmpDir], "test-host");

		expect(result.assets.length).toBeGreaterThanOrEqual(1);
		const key = result.assets.find((a) => a.type === "key" || a.type === "ssh_key");
		expect(key).toBeDefined();
		expect(key?.path).toContain("id_rsa");
	});

	it("discovers EC private key files", async () => {
		const pem = generateEcKeyPem();
		writeFile("id_ecdsa", pem);

		const result = await runScan([tmpDir], "test-host");

		expect(result.assets.length).toBeGreaterThanOrEqual(1);
		const key = result.assets.find((a) => a.path.includes("id_ecdsa"));
		expect(key).toBeDefined();
		expect(key?.algorithm).toMatch(/EC|ECDSA/i);
	});

	it("discovers PKCS12 keystore files", async () => {
		writeFile("keystore.p12", "binary-content-fixture");

		const result = await runScan([tmpDir], "test-host");

		const ks = result.assets.find((a) => a.path.includes("keystore.p12"));
		expect(ks).toBeDefined();
		expect(ks?.type).toBe("key");
		expect(ks?.algorithm).toBe("PKCS12");
	});

	it("discovers JKS keystore files", async () => {
		writeFile("app.jks", "binary-content-fixture");

		const result = await runScan([tmpDir], "test-host");

		const ks = result.assets.find((a) => a.path.includes("app.jks"));
		expect(ks).toBeDefined();
		expect(ks?.algorithm).toBe("JKS");
	});

	it("skips non-crypto files", async () => {
		writeFile("README.md", "# Hello World");
		writeFile("config.json", '{"key": "value"}');
		writeFile("app.log", "some log output");

		const result = await runScan([tmpDir], "test-host");

		expect(result.assets).toHaveLength(0);
	});

	it("skips files exceeding size limit", async () => {
		// Write a large .pem file (> 1MB)
		const large = "A".repeat(1024 * 1024 + 1);
		writeFile("large.pem", large);

		const result = await runScan([tmpDir], "test-host");

		expect(result.assets).toHaveLength(0);
	});

	it("reports encrypted or otherwise unreadable private keys without exposing key material", async () => {
		writeFile(
			"encrypted.key",
			"-----BEGIN RSA PRIVATE KEY-----\nnot-a-decryptable-private-key\n-----END RSA PRIVATE KEY-----",
		);

		const result = await runScan([path.join(tmpDir, "encrypted.key")], "test-host");

		expect(result.assets).toEqual([
			expect.objectContaining({
				type: "ssh_key",
				algorithm: "RSA",
				metadata: { encrypted: true },
			}),
		]);
		expect(result.filesScanned).toBe(1);
	});

	it("classifies PKCS8 signing material as a JWT key from its filename", async () => {
		const { privateKey } = crypto.generateKeyPairSync("ed25519");
		writeFile("jwt-signing.pem", privateKey.export({ type: "pkcs8", format: "pem" }).toString());

		const result = await runScan([tmpDir], "test-host");

		expect(result.assets).toEqual([
			expect.objectContaining({ type: "jwt_key", algorithm: "PKCS8" }),
		]);
	});

	it("parses an X.509 certificate and extracts algorithm, key size, subject and fingerprint", async () => {
		writeFile("server.pem", TEST_CERT_PEM);

		const result = await runScan([tmpDir], "test-host");

		const cert = result.assets.find((a) => a.type === "certificate");
		expect(cert).toBeDefined();
		expect(cert?.algorithm).toBe("RSA");
		expect(cert?.keySize).toBe(2048);
		expect(cert?.subject).toContain("qnsp-agent-test.local");
		expect(cert?.issuer).toContain("qnsp-agent-test.local");
		expect(cert?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
		expect(cert?.expiresAt).toBeDefined();
	});

	it("ignores a file whose CERTIFICATE marker wraps unparseable content", async () => {
		writeFile(
			"broken.crt",
			"-----BEGIN CERTIFICATE-----\nnot-base64-der-content\n-----END CERTIFICATE-----",
		);

		const result = await runScan([tmpDir], "test-host");

		// parseCertificate returns null on a throw, so no certificate asset is produced.
		expect(result.assets.find((a) => a.type === "certificate")).toBeUndefined();
		expect(result.filesScanned).toBe(1);
	});

	it("reads a .pem file with no PEM markers and yields no assets", async () => {
		writeFile("notcrypto.pem", "just some plain text, definitely not a PEM block\n");

		const result = await runScan([tmpDir], "test-host");

		expect(result.assets).toHaveLength(0);
		expect(result.filesScanned).toBe(1);
	});

	it("commits a durable progress checkpoint on the configured file cadence", async () => {
		writeFile("id_rsa", generateRsaKeyPem());
		const stateDir = path.join(tmpDir, "cadence-state");

		const result = await runScan([tmpDir], "cadence-host", {
			stateDir,
			checkpointEveryFiles: 1,
		});

		// One key file scanned; with a cadence of 1 the progress checkpoint path runs.
		expect(result.filesScanned).toBe(1);
		expect(result.assetCount).toBe(1);
		// The checkpoint is removed once the scan completes cleanly.
		expect(fs.existsSync(checkpointPath(stateDir, scanScopeHash([tmpDir], "cadence-host")))).toBe(
			false,
		);
	});

	it("discovers a live local TLS endpoint and records its certificate", async () => {
		const { server, port } = await startTlsServerOnScannerPort();
		try {
			const scanRoot = path.join(tmpDir, "tls-empty");
			fs.mkdirSync(scanRoot);

			const result = await runScan([scanRoot], "tls-host");

			const endpoint = result.assets.find(
				(a) => a.type === "tls_endpoint" && a.path === `tls-host:${port}`,
			);
			expect(endpoint).toBeDefined();
			expect(endpoint?.algorithm).toBe("TLS");
			expect(endpoint?.subject).toContain("qnsp-agent-test.local");
			expect(endpoint?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
			expect((endpoint?.metadata as { port?: number } | undefined)?.port).toBe(port);
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	}, 20_000);

	it("validates checkpoint and evidence batch bounds", async () => {
		await expect(runScan([tmpDir], "test-host", { checkpointEveryFiles: 0 })).rejects.toThrow(
			"checkpointEveryFiles",
		);
		await expect(runScan([tmpDir], "test-host", { assetBatchSize: 0 })).rejects.toThrow(
			"assetBatchSize",
		);
		await expect(runScan([tmpDir], "test-host", { assetBatchSize: 10_001 })).rejects.toThrow(
			"assetBatchSize",
		);
	});

	it("does not traverse symlinks or excluded dependency directories", async () => {
		const target = path.join(tmpDir, "target");
		fs.mkdirSync(target);
		fs.writeFileSync(path.join(target, "id_rsa"), generateRsaKeyPem(), { mode: 0o600 });
		fs.symlinkSync(target, path.join(tmpDir, "linked"));
		const excluded = path.join(tmpDir, "node_modules");
		fs.mkdirSync(excluded);
		fs.writeFileSync(path.join(excluded, "private.pem"), generateEcKeyPem(), { mode: 0o600 });

		const symlinkOnly = await runScan([path.join(tmpDir, "linked")], "test-host");
		expect(symlinkOnly.assets).toHaveLength(0);

		const directoryScan = await runScan([tmpDir], "test-host");
		expect(directoryScan.assets).toHaveLength(1);
		expect(directoryScan.assets[0]?.path).toContain("target/id_rsa");
	});

	it("handles non-existent scan paths gracefully", async () => {
		const result = await runScan(["/nonexistent/path/xyz"], "test-host");

		expect(result.assets).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
		expect(result.scannedPaths).toHaveLength(0);
	});

	it("returns scan metadata", async () => {
		const result = await runScan([tmpDir], "test-host");

		expect(result.durationMs).toBeGreaterThanOrEqual(0);
		expect(result.scannedPaths).toContain(tmpDir);
		expect(result.filesScanned).toBe(0);
		expect(result.directoriesScanned).toBe(1);
		expect(result.resumed).toBe(false);
	});

	it("resumes from a committed cursor after interruption without losing findings", async () => {
		const scanDir = path.join(tmpDir, "scan-root");
		fs.mkdirSync(scanDir);
		fs.writeFileSync(path.join(scanDir, "id_rsa"), generateRsaKeyPem(), { mode: 0o600 });
		fs.writeFileSync(path.join(scanDir, "second.pem"), generateEcKeyPem(), { mode: 0o600 });
		const stateDir = path.join(tmpDir, "agent-state");

		await expect(
			runScan([scanDir], "resume-host", {
				stateDir,
				assetBatchSize: 1,
				onAssetBatch: async () => {
					throw new Error("controlled interruption");
				},
			}),
		).rejects.toThrow("controlled interruption");

		const scopeHash = scanScopeHash([scanDir], "resume-host");
		const checkpoint = checkpointPath(stateDir, scopeHash);
		expect(fs.statSync(checkpoint).mode & 0o777).toBe(0o600);
		expect(await listScanCheckpointSummaries(stateDir)).toEqual([
			expect.objectContaining({
				hostname: "resume-host",
				filesScanned: 1,
				assetsFound: 1,
				pendingAssetCount: 1,
			}),
		]);

		const batches: string[][] = [];
		const resumed = await runScan([scanDir], "resume-host", {
			stateDir,
			assetBatchSize: 1,
			onAssetBatch: async (assets) => {
				batches.push(assets.map((asset) => asset.path));
			},
		});

		expect(resumed.resumed).toBe(true);
		expect(batches.flat()).toEqual(expect.arrayContaining([expect.stringContaining("id_rsa")]));
		expect(batches.flat()).toEqual(expect.arrayContaining([expect.stringContaining("second.pem")]));
		expect(fs.existsSync(checkpoint)).toBe(false);
	});

	it("emits bounded evidence batches and removes the checkpoint only after the final batch", async () => {
		const scanDir = path.join(tmpDir, "batch-root");
		fs.mkdirSync(scanDir);
		for (const name of ["a.pem", "b.pem", "c.pem"]) {
			fs.writeFileSync(path.join(scanDir, name), generateEcKeyPem(), { mode: 0o600 });
		}
		const stateDir = path.join(tmpDir, "batch-state");
		const batchSizes: number[] = [];
		const finalStates: boolean[] = [];

		const result = await runScan([scanDir], "batch-host", {
			stateDir,
			assetBatchSize: 2,
			onAssetBatch: async (assets, context) => {
				batchSizes.push(assets.length);
				finalStates.push(context.final);
				expect(
					fs.existsSync(checkpointPath(stateDir, scanScopeHash([scanDir], "batch-host"))),
				).toBe(true);
			},
		});

		expect(batchSizes).toEqual([2, 1]);
		expect(finalStates).toEqual([false, true]);
		expect(result.assetCount).toBe(3);
		expect(result.assets).toEqual([]);
		expect(fs.existsSync(checkpointPath(stateDir, scanScopeHash([scanDir], "batch-host")))).toBe(
			false,
		);
	});

	it("fails closed when a persisted checkpoint is corrupt", async () => {
		const stateDir = path.join(tmpDir, "corrupt-state");
		const scopeHash = scanScopeHash([tmpDir], "corrupt-host");
		const checkpoint = checkpointPath(stateDir, scopeHash);
		fs.mkdirSync(path.dirname(checkpoint), { recursive: true });
		fs.writeFileSync(checkpoint, "{not-json", { mode: 0o600 });

		await expect(runScan([tmpDir], "corrupt-host", { stateDir })).rejects.toThrow();
		expect(fs.readFileSync(checkpoint, "utf8")).toBe("{not-json");
	});
});
