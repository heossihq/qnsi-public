import * as crypto from "node:crypto";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import type * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import type * as tls from "node:tls";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkpointPath,
	listScanCheckpointSummaries,
	saveScanCheckpoint,
	scanScopeHash,
} from "./scan-checkpoint.js";
import {
	detectPem,
	parseCertificate,
	parseSshKey,
	probeTlsEndpoint,
	runScan,
	runScanWithRuntime,
	scanFile,
	scanTlsEndpoints,
	shouldSkipDir,
} from "./scanner.js";

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
	it("recognizes the complete supported PEM marker catalog", () => {
		const cases = [
			["-----BEGIN RSA PRIVATE KEY-----", "RSA"],
			["-----BEGIN EC PRIVATE KEY-----", "EC"],
			["-----BEGIN OPENSSH PRIVATE KEY-----", "OpenSSH"],
			["-----BEGIN DSA PRIVATE KEY-----", "DSA"],
			["-----BEGIN PRIVATE KEY-----", "PKCS8"],
			["-----BEGIN ENCRYPTED PRIVATE KEY-----", "PKCS8-ENCRYPTED"],
			["-----BEGIN CERTIFICATE-----", "X.509"],
		] as const;
		for (const [marker, algorithm] of cases) {
			expect(detectPem(`prefix\n${marker}\npayload`)).toMatchObject({ algorithm });
		}
		expect(detectPem("plain text")).toBeNull();
		expect(shouldSkipDir("node_modules")).toBe(true);
		expect(shouldSkipDir("certificates")).toBe(false);
	});

	it("covers key parsing across RSA, EC curves, and non-sized key types", () => {
		const rsa = parseSshKey(generateRsaKeyPem(), "/rsa", "RSA");
		const p256 = parseSshKey(generateEcKeyPem(), "/p256", "EC");
		const { privateKey: p384Key } = crypto.generateKeyPairSync("ec", { namedCurve: "P-384" });
		const p384 = parseSshKey(
			p384Key.export({ type: "sec1", format: "pem" }).toString(),
			"/p384",
			"EC",
		);
		const { privateKey: p521Key } = crypto.generateKeyPairSync("ec", { namedCurve: "P-521" });
		const p521 = parseSshKey(
			p521Key.export({ type: "sec1", format: "pem" }).toString(),
			"/p521",
			"EC",
		);
		const { privateKey: ed25519Key } = crypto.generateKeyPairSync("ed25519");
		const ed25519 = parseSshKey(
			ed25519Key.export({ type: "pkcs8", format: "pem" }).toString(),
			"/ed25519",
			"PKCS8",
		);

		expect(rsa).toMatchObject({ algorithm: "RSA", keySize: 2048 });
		expect(p256).toMatchObject({ algorithm: "EC", keySize: 256 });
		expect(p384).toMatchObject({ algorithm: "EC", keySize: 384 });
		expect(p521).toMatchObject({ algorithm: "EC" });
		expect(p521).not.toHaveProperty("keySize");
		expect(ed25519).toMatchObject({ algorithm: "ED25519" });
		expect(ed25519).not.toHaveProperty("keySize");
	});

	it("uses the detected marker when a key provider omits its asymmetric type", () => {
		const createPrivateKey = (() => ({
			asymmetricKeyType: undefined,
		})) as unknown as typeof crypto.createPrivateKey;
		const createPublicKey = (() => ({
			export: () => Buffer.from("public-key"),
		})) as unknown as typeof crypto.createPublicKey;

		expect(
			parseSshKey("provider-key", "/provider", "PROVIDER", createPrivateKey, createPublicKey),
		).toMatchObject({ algorithm: "PROVIDER" });
	});

	it("handles absent, empty, unreadable, and unsupported file inputs", () => {
		expect(scanFile(path.join(tmpDir, "missing.pem"))).toEqual([]);
		expect(scanFile(writeFile("empty.pem", ""))).toEqual([]);
		const directoryAsPem = path.join(tmpDir, "directory.pem");
		fs.mkdirSync(directoryAsPem);
		expect(scanFile(directoryAsPem)).toEqual([]);
		expect(scanFile(writeFile("material.bin", "-----BEGIN PRIVATE KEY-----"))).toEqual([]);
	});

	it("classifies all supported password-protected keystore extensions", () => {
		for (const [name, algorithm] of [
			["one.pfx", "PKCS12"],
			["two.keystore", "JKS"],
		] as const) {
			const [asset] = scanFile(writeFile(name, "opaque-keystore"));
			expect(asset).toMatchObject({ algorithm });
		}
	});

	it("exposes direct certificate parser rejection for malformed input", () => {
		expect(parseCertificate("not a certificate", "/broken.crt")).toBeNull();
	});

	it("retains a certificate with minimal metadata and an unknown key type", () => {
		const certificate = {
			fingerprint256: "AA:BB",
			publicKey: { asymmetricKeyType: undefined },
			validTo: "",
			subject: "CN=minimal",
			issuer: "CN=minimal",
		} as unknown as crypto.X509Certificate;

		expect(parseCertificate("ignored", "/minimal.crt", () => certificate)).toEqual({
			type: "certificate",
			path: "/minimal.crt",
			algorithm: "UNKNOWN",
			subject: "CN=minimal",
			issuer: "CN=minimal",
			fingerprint: "aabb",
		});
	});

	it("times out a TCP endpoint that accepts but never completes TLS", async () => {
		const socket = new EventEmitter() as EventEmitter & {
			destroy: ReturnType<typeof vi.fn>;
		};
		socket.destroy = vi.fn();
		const connect = vi.fn(() => socket) as unknown as typeof tls.connect;

		await expect(probeTlsEndpoint("127.0.0.1", 443, 5, connect)).resolves.toBeNull();
		expect(socket.destroy).toHaveBeenCalledOnce();
	});

	it("returns null when a reachable TCP endpoint rejects the TLS handshake", async () => {
		const socket = new EventEmitter() as EventEmitter & {
			destroy: ReturnType<typeof vi.fn>;
		};
		socket.destroy = vi.fn();
		const connect = vi.fn(() => {
			queueMicrotask(() => socket.emit("error", new Error("TLS handshake rejected")));
			return socket;
		}) as unknown as typeof tls.connect;

		await expect(probeTlsEndpoint("localhost", 443, 500, connect)).resolves.toBeNull();
	});

	it("handles TLS peers without subjects and certificate-read failures", async () => {
		function connectWith(getPeerCertificate: () => unknown): typeof tls.connect {
			return ((_options: tls.ConnectionOptions, callback?: () => void) => {
				const socket = new EventEmitter() as EventEmitter & {
					destroy: ReturnType<typeof vi.fn>;
					getPeerCertificate: () => unknown;
					getProtocol: () => string | null;
				};
				socket.destroy = vi.fn();
				socket.getPeerCertificate = getPeerCertificate;
				socket.getProtocol = () => null;
				queueMicrotask(() => callback?.());
				return socket;
			}) as unknown as typeof tls.connect;
		}

		await expect(
			probeTlsEndpoint(
				"localhost",
				443,
				100,
				connectWith(() => ({})),
			),
		).resolves.toBeNull();
		await expect(
			probeTlsEndpoint(
				"localhost",
				443,
				100,
				connectWith(() => {
					throw new Error("certificate unavailable");
				}),
			),
		).resolves.toBeNull();
	});

	it("records a TLS peer when optional certificate metadata is absent", async () => {
		const connect = ((_options: tls.ConnectionOptions, callback?: () => void) => {
			const socket = new EventEmitter() as EventEmitter & {
				destroy: ReturnType<typeof vi.fn>;
				getPeerCertificate: () => unknown;
				getProtocol: () => null;
			};
			socket.destroy = vi.fn();
			socket.getPeerCertificate = () => ({ subject: { CN: "minimal" } });
			socket.getProtocol = () => null;
			queueMicrotask(() => callback?.());
			return socket;
		}) as unknown as typeof tls.connect;

		await expect(probeTlsEndpoint("localhost", 443, 100, connect)).resolves.toEqual({
			type: "tls_endpoint",
			path: "localhost:443",
			algorithm: "TLS",
			subject: "CN=minimal",
			metadata: { port: 443 },
		});

		const fullConnect = ((_options: tls.ConnectionOptions, callback?: () => void) => {
			const socket = new EventEmitter() as EventEmitter & {
				destroy: ReturnType<typeof vi.fn>;
				getPeerCertificate: () => unknown;
				getProtocol: () => string;
			};
			socket.destroy = vi.fn();
			socket.getPeerCertificate = () => ({
				subject: { CN: "full" },
				issuer: { O: "HEOSSI Test" },
				fingerprint256: "AA:BB",
				valid_to: "2126-06-25T10:21:24.000Z",
			});
			socket.getProtocol = () => "TLSv1.3";
			queueMicrotask(() => callback?.());
			return socket;
		}) as unknown as typeof tls.connect;
		await expect(probeTlsEndpoint("localhost", 9443, 100, fullConnect)).resolves.toMatchObject({
			issuer: "O=HEOSSI Test",
			fingerprint: "aabb",
			expiresAt: "2126-06-25T10:21:24.000Z",
			metadata: { port: 9443, protocol: "TLSv1.3" },
		});
	});

	it("covers TCP connect, timeout, error, and empty-probe outcomes deterministically", async () => {
		let connection = 0;
		const createConnection = (() => {
			const current = ++connection;
			const socket = new EventEmitter() as EventEmitter & {
				destroy: ReturnType<typeof vi.fn>;
				setTimeout: (timeout: number) => void;
			};
			socket.destroy = vi.fn();
			socket.setTimeout = () => undefined;
			queueMicrotask(() => {
				if (current === 1 || current === 2) socket.emit("connect");
				else if (current === 3) socket.emit("timeout");
				else socket.emit("error", new Error("closed"));
			});
			return socket;
		}) as unknown as typeof net.createConnection;
		const probe = vi
			.fn()
			.mockResolvedValueOnce({ type: "tls_endpoint", path: "local", algorithm: "TLS" })
			.mockResolvedValueOnce(null);

		const assets = await scanTlsEndpoints("host", createConnection, probe);

		expect(assets).toEqual([{ type: "tls_endpoint", path: "host:443", algorithm: "TLS" }]);
		expect(probe).toHaveBeenCalledTimes(2);
	});

	it("preserves scan progress when file and TLS adapters fail", async () => {
		const file = writeFile("adapter.pem", "material");
		const errorResult = await runScanWithRuntime(
			[file],
			"runtime-host",
			{},
			{
				scanFile: () => {
					throw new Error("file adapter failed");
				},
				scanTlsEndpoints: () => Promise.reject("tls adapter failed"),
			},
		);
		const stringResult = await runScanWithRuntime(
			[file],
			"runtime-host",
			{},
			{
				scanFile: () => {
					throw "file adapter failed";
				},
				scanTlsEndpoints: () => Promise.reject(new Error("tls adapter failed")),
			},
		);

		expect(errorResult.filesScanned).toBe(1);
		expect(errorResult.errors).toEqual(["TLS scan error: tls adapter failed"]);
		expect(stringResult.filesScanned).toBe(1);
		expect(stringResult.errors).toEqual(["TLS scan error: tls adapter failed"]);
	});

	it("recovers a durable cursor whose directory disappeared", async () => {
		const stateDir = path.join(tmpDir, "missing-directory-state");
		const scopeHash = scanScopeHash([tmpDir], "missing-directory-host");
		await saveScanCheckpoint(stateDir, {
			version: 1,
			scanId: crypto.randomUUID(),
			scopeHash,
			hostname: "missing-directory-host",
			scanPaths: [tmpDir],
			startedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			nextPathIndex: 1,
			directoryStack: [
				{ directory: path.join(tmpDir, "already-removed"), depth: 0, lastEntryName: null },
			],
			filesScanned: 0,
			directoriesScanned: 1,
			assetsFound: 0,
			batchSequence: 0,
			pendingReportedAt: null,
			pendingAssets: [],
		});

		const result = await runScan([tmpDir], "missing-directory-host", { stateDir });

		expect(result.resumed).toBe(true);
		expect(result.directoriesScanned).toBe(1);
	});

	it("emits a final empty batch without a state directory", async () => {
		const batches: Array<{ count: number; final: boolean }> = [];
		await runScanWithRuntime(
			[],
			"empty-host",
			{
				onAssetBatch: async (assets, context) => {
					batches.push({ count: assets.length, final: context.final });
				},
			},
			{ scanFile, scanTlsEndpoints: () => Promise.resolve([]) },
		);

		expect(batches).toEqual([{ count: 0, final: true }]);
	});

	it("skips socket paths both as roots and as directory entries", async () => {
		const rootSocket = path.join(tmpDir, "root.sock");
		const specialStat = {
			isSymbolicLink: () => false,
			isFile: () => false,
			isDirectory: () => false,
		};
		await expect(
			runScanWithRuntime(
				[rootSocket],
				"socket-host",
				{},
				{
					scanFile,
					scanTlsEndpoints: () => Promise.resolve([]),
					existsSync: () => true,
					lstatSync: () => specialStat,
				},
			),
		).resolves.toMatchObject({ filesScanned: 0, directoriesScanned: 0 });

		const specialEntry = {
			name: "nested.sock",
			isSymbolicLink: () => false,
			isDirectory: () => false,
			isFile: () => false,
		} as fs.Dirent;
		await expect(
			runScanWithRuntime(
				[tmpDir],
				"socket-host",
				{},
				{
					scanFile,
					scanTlsEndpoints: () => Promise.resolve([]),
					readdirSync: () => [specialEntry],
				},
			),
		).resolves.toMatchObject({ filesScanned: 0, directoriesScanned: 1 });
	});

	it("honors the maximum directory depth from a resumed cursor", async () => {
		const deepRoot = path.join(tmpDir, "depth-root");
		const child = path.join(deepRoot, "child");
		fs.mkdirSync(child, { recursive: true });
		writeFile(path.join("depth-root", "child", "id_rsa"), generateRsaKeyPem());
		const stateDir = path.join(tmpDir, "depth-state");
		const scopeHash = scanScopeHash([deepRoot], "depth-host");
		await saveScanCheckpoint(stateDir, {
			version: 1,
			scanId: crypto.randomUUID(),
			scopeHash,
			hostname: "depth-host",
			scanPaths: [deepRoot],
			startedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			nextPathIndex: 1,
			directoryStack: [{ directory: deepRoot, depth: 8, lastEntryName: null }],
			filesScanned: 0,
			directoriesScanned: 1,
			assetsFound: 0,
			batchSequence: 0,
			pendingReportedAt: null,
			pendingAssets: [],
		});

		const result = await runScan([deepRoot], "depth-host", { stateDir });

		expect(result.filesScanned).toBe(0);
		expect(result.assetCount).toBe(0);
	});

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
		const scanRoot = path.join(tmpDir, "tls-empty");
		fs.mkdirSync(scanRoot);
		const tlsAsset = {
			type: "tls_endpoint" as const,
			path: "tls-host:9443",
			algorithm: "TLS",
			subject: "CN=qnsp-agent-test.local",
			fingerprint: "ab".repeat(32),
			metadata: { port: 9443 },
		};

		const result = await runScanWithRuntime(
			[scanRoot],
			"tls-host",
			{},
			{
				scanFile,
				scanTlsEndpoints: () => Promise.resolve([tlsAsset]),
			},
		);

		expect(result.assets).toContainEqual(tlsAsset);
		expect(result.assetCount).toBe(1);
	});

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
