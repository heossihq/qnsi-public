/**
 * QNSP Agent Scanner
 *
 * Discovers cryptographic assets on the local filesystem:
 *   - SSH private keys (RSA, ECDSA, Ed25519, DSA)
 *   - X.509 certificates (PEM and DER)
 *   - PKCS#12 / JKS keystores
 *   - TLS endpoints (active listening ports)
 *   - JWT signing keys (PEM)
 *
 * Uses only Node.js built-ins (fs, crypto, tls) - no external deps.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import * as tls from "node:tls";

import { formatError, logger } from "./logger.js";
import {
	loadScanCheckpoint,
	removeScanCheckpoint,
	type ScanCheckpoint,
	saveScanCheckpoint,
	scanScopeHash,
} from "./scan-checkpoint.js";

export interface ScannedAsset {
	readonly type: "ssh_key" | "certificate" | "key" | "jwt_key" | "tls_endpoint";
	readonly path: string;
	readonly algorithm: string;
	readonly keySize?: number;
	readonly expiresAt?: string;
	readonly subject?: string;
	readonly issuer?: string;
	readonly fingerprint?: string;
	readonly metadata?: Record<string, unknown>;
}

// File extensions and patterns to scan
const SSH_KEY_PATTERNS = [
	/^id_rsa$/,
	/^id_ecdsa$/,
	/^id_ed25519$/,
	/^id_dsa$/,
	/^id_rsa_[a-z0-9_-]+$/,
	/^id_ecdsa_[a-z0-9_-]+$/,
	/\.pem$/i,
	/\.key$/i,
];

const CERT_EXTENSIONS = new Set([".pem", ".crt", ".cer", ".der"]);
const KEYSTORE_EXTENSIONS = new Set([".p12", ".pfx", ".jks", ".keystore"]);
const JWT_KEY_PATTERNS = [/jwt.*\.pem$/i, /signing.*\.pem$/i, /private.*\.pem$/i];

// PEM header markers
const PEM_MARKERS: Record<string, { type: ScannedAsset["type"]; algorithm: string }> = {
	"-----BEGIN RSA PRIVATE KEY-----": { type: "ssh_key", algorithm: "RSA" },
	"-----BEGIN EC PRIVATE KEY-----": { type: "ssh_key", algorithm: "EC" },
	"-----BEGIN OPENSSH PRIVATE KEY-----": { type: "ssh_key", algorithm: "OpenSSH" },
	"-----BEGIN DSA PRIVATE KEY-----": { type: "ssh_key", algorithm: "DSA" },
	"-----BEGIN PRIVATE KEY-----": { type: "key", algorithm: "PKCS8" },
	"-----BEGIN ENCRYPTED PRIVATE KEY-----": { type: "key", algorithm: "PKCS8-ENCRYPTED" },
	"-----BEGIN CERTIFICATE-----": { type: "certificate", algorithm: "X.509" },
};

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB - skip large files
const MAX_SCAN_DEPTH = 8;
const DEFAULT_CHECKPOINT_EVERY_FILES = 250;
const DEFAULT_ASSET_BATCH_SIZE = 250;

export function shouldSkipDir(name: string): boolean {
	const skip = new Set([
		"node_modules",
		".git",
		"proc",
		"sys",
		"dev",
		"run",
		"tmp",
		"var/log",
		"var/cache",
		"var/tmp",
		"__pycache__",
		".npm",
		".cache",
	]);
	return skip.has(name);
}

/**
 * Detect PEM content and return asset type + algorithm.
 */
export function detectPem(
	content: string,
): { type: ScannedAsset["type"]; algorithm: string } | null {
	for (const [marker, info] of Object.entries(PEM_MARKERS)) {
		if (content.includes(marker)) {
			return info;
		}
	}
	return null;
}

/**
 * Parse an X.509 certificate from PEM and extract metadata.
 */
export function parseCertificate(
	pemContent: string,
	filePath: string,
	createCertificate: (content: string) => crypto.X509Certificate = (content) =>
		new crypto.X509Certificate(content),
): ScannedAsset | null {
	try {
		const cert = createCertificate(pemContent);
		const fingerprint = cert.fingerprint256.replace(/:/g, "").toLowerCase();
		const algorithm = cert.publicKey.asymmetricKeyType?.toUpperCase() ?? "UNKNOWN";
		const keySize =
			cert.publicKey.asymmetricKeyType === "rsa"
				? (
						cert.publicKey as crypto.KeyObject & {
							asymmetricKeyDetails?: { modulusLength?: number };
						}
					).asymmetricKeyDetails?.modulusLength
				: undefined;

		return {
			type: "certificate",
			path: filePath,
			algorithm,
			...(keySize !== undefined ? { keySize } : {}),
			...(cert.validTo ? { expiresAt: new Date(cert.validTo).toISOString() } : {}),
			subject: cert.subject,
			issuer: cert.issuer,
			fingerprint,
		};
	} catch {
		return null;
	}
}

/**
 * Parse an SSH private key and extract algorithm + key size.
 */
export function parseSshKey(
	pemContent: string,
	filePath: string,
	detectedAlgorithm: string,
	createPrivateKey: typeof crypto.createPrivateKey = crypto.createPrivateKey,
	createPublicKey: typeof crypto.createPublicKey = crypto.createPublicKey,
): ScannedAsset {
	try {
		const keyObj = createPrivateKey({ key: pemContent, format: "pem" });
		const algorithm = keyObj.asymmetricKeyType?.toUpperCase() ?? detectedAlgorithm;
		const keySize =
			keyObj.asymmetricKeyType === "rsa"
				? (keyObj as crypto.KeyObject & { asymmetricKeyDetails?: { modulusLength?: number } })
						.asymmetricKeyDetails?.modulusLength
				: keyObj.asymmetricKeyType === "ec"
					? (
							keyObj as crypto.KeyObject & { asymmetricKeyDetails?: { namedCurve?: string } }
						).asymmetricKeyDetails?.namedCurve?.includes("256")
						? 256
						: (
									keyObj as crypto.KeyObject & { asymmetricKeyDetails?: { namedCurve?: string } }
								).asymmetricKeyDetails?.namedCurve?.includes("384")
							? 384
							: undefined
					: undefined;

		// Compute fingerprint from public key
		const pubKey = createPublicKey(keyObj);
		const pubDer = pubKey.export({ type: "spki", format: "der" });
		const fingerprint = crypto.createHash("sha256").update(pubDer).digest("hex");

		return {
			type: "ssh_key",
			path: filePath,
			algorithm,
			...(keySize !== undefined ? { keySize } : {}),
			fingerprint,
		};
	} catch {
		// Key may be encrypted - still report it with detected algorithm
		return {
			type: "ssh_key",
			path: filePath,
			algorithm: detectedAlgorithm,
			metadata: { encrypted: true },
		};
	}
}

/**
 * Scan a single file and return discovered assets.
 */
export function scanFile(filePath: string): ScannedAsset[] {
	const ext = path.extname(filePath).toLowerCase();
	const basename = path.basename(filePath);
	const assets: ScannedAsset[] = [];

	// Skip files that are too large
	let stat: fs.Stats;
	try {
		stat = fs.statSync(filePath);
	} catch {
		return assets;
	}
	if (stat.size === 0 || stat.size > MAX_FILE_SIZE_BYTES) return assets;

	// Keystore files - report by extension, can't parse without password
	if (KEYSTORE_EXTENSIONS.has(ext)) {
		assets.push({
			type: "key",
			path: filePath,
			algorithm: ext === ".jks" || ext === ".keystore" ? "JKS" : "PKCS12",
			metadata: { keystoreType: ext.slice(1).toUpperCase(), encrypted: true },
		});
		return assets;
	}

	// Only read text-based files for PEM detection
	if (!CERT_EXTENSIONS.has(ext) && !SSH_KEY_PATTERNS.some((p) => p.test(basename))) return assets;

	let content: string;
	try {
		content = fs.readFileSync(filePath, "utf8");
	} catch {
		return assets;
	}

	const detected = detectPem(content);
	if (!detected) return assets;

	// JWT key detection by filename pattern
	const isJwtKey = JWT_KEY_PATTERNS.some((p) => p.test(filePath));
	if (isJwtKey && detected.type === "key") {
		assets.push({
			type: "jwt_key",
			path: filePath,
			algorithm: detected.algorithm,
		});
		return assets;
	}

	if (detected.type === "certificate") {
		const cert = parseCertificate(content, filePath);
		if (cert) assets.push(cert);
	} else {
		const key = parseSshKey(content, filePath, detected.algorithm);
		assets.push(key);
	}

	return assets;
}

/**
 * Probe a TCP port for TLS and extract certificate info.
 */
export async function probeTlsEndpoint(
	host: string,
	port: number,
	timeoutMs = 3000,
	connect: typeof tls.connect = tls.connect,
): Promise<ScannedAsset | null> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			socket.destroy();
			resolve(null);
		}, timeoutMs);

		const socket = connect(
			{
				host,
				port,
				rejectUnauthorized: false,
				...(net.isIP(host) === 0 ? { servername: host } : {}),
			},
			() => {
				clearTimeout(timer);
				try {
					const cert = socket.getPeerCertificate(true);
					if (!cert?.subject) {
						socket.destroy();
						resolve(null);
						return;
					}

					const fingerprint = cert.fingerprint256?.replace(/:/g, "").toLowerCase();
					const expiresAt = cert.valid_to ? new Date(cert.valid_to).toISOString() : undefined;
					const subject = Object.entries(cert.subject)
						.map(([k, v]) => `${k}=${v}`)
						.join(", ");
					const issuer = cert.issuer
						? Object.entries(cert.issuer)
								.map(([k, v]) => `${k}=${v}`)
								.join(", ")
						: undefined;
					const protocol = socket.getProtocol();

					socket.destroy();
					resolve({
						type: "tls_endpoint",
						path: `${host}:${port}`,
						algorithm: "TLS",
						...(expiresAt !== undefined ? { expiresAt } : {}),
						subject,
						...(issuer !== undefined ? { issuer } : {}),
						...(fingerprint !== undefined ? { fingerprint } : {}),
						metadata: {
							port,
							...(protocol != null ? { protocol } : {}),
						},
					});
				} catch {
					socket.destroy();
					resolve(null);
				}
			},
		);

		socket.on("error", () => {
			clearTimeout(timer);
			resolve(null);
		});
	});
}

/**
 * Discover locally listening TLS ports and probe them.
 */
export async function scanTlsEndpoints(
	hostname: string,
	createConnection: typeof net.createConnection = net.createConnection,
	probe: typeof probeTlsEndpoint = probeTlsEndpoint,
): Promise<ScannedAsset[]> {
	// Common TLS ports to probe on localhost
	const TLS_PORTS = [443, 8443, 8080, 8444, 9443, 3443, 4443];
	const assets: ScannedAsset[] = [];

	await Promise.all(
		TLS_PORTS.map(async (port) => {
			// Quick TCP check first to avoid TLS handshake on closed ports
			const isOpen = await new Promise<boolean>((resolve) => {
				const sock = createConnection({ host: "127.0.0.1", port });
				sock.setTimeout(500);
				sock.on("connect", () => {
					sock.destroy();
					resolve(true);
				});
				sock.on("error", () => resolve(false));
				sock.on("timeout", () => {
					sock.destroy();
					resolve(false);
				});
			});

			if (!isOpen) return;

			const asset = await probe("127.0.0.1", port);
			if (asset) {
				assets.push({ ...asset, path: `${hostname}:${port}` });
			}
		}),
	);

	return assets;
}

export interface ScanResult {
	readonly assets: ScannedAsset[];
	readonly assetCount: number;
	readonly scannedPaths: string[];
	readonly durationMs: number;
	readonly errors: string[];
	readonly scanId: string;
	readonly resumed: boolean;
	readonly filesScanned: number;
	readonly directoriesScanned: number;
}

export interface ScanBatchContext {
	readonly scanId: string;
	readonly sequence: number;
	readonly reportedAt: string;
	readonly final: boolean;
}

export interface ScanOptions {
	readonly stateDir?: string;
	readonly checkpointEveryFiles?: number;
	readonly assetBatchSize?: number;
	readonly onAssetBatch?: (
		assets: readonly ScannedAsset[],
		context: ScanBatchContext,
	) => Promise<void>;
}

export interface ScannerRuntime {
	readonly scanFile: typeof scanFile;
	readonly scanTlsEndpoints: (hostname: string) => Promise<ScannedAsset[]>;
	readonly existsSync?: (path: fs.PathLike) => boolean;
	readonly lstatSync?: (
		path: fs.PathLike,
	) => Pick<fs.Stats, "isSymbolicLink" | "isFile" | "isDirectory">;
	readonly readdirSync?: (path: fs.PathLike, options: { withFileTypes: true }) => fs.Dirent[];
}

const DEFAULT_SCANNER_RUNTIME: ScannerRuntime = {
	scanFile,
	scanTlsEndpoints,
};

function updateCheckpoint(
	checkpoint: ScanCheckpoint,
	changes: Partial<ScanCheckpoint>,
): ScanCheckpoint {
	return { ...checkpoint, ...changes, updatedAt: new Date().toISOString() };
}

/**
 * Run a full scan of the configured paths and return all discovered assets.
 */
export async function runScan(
	scanPaths: string[],
	hostname: string,
	options: ScanOptions = {},
): Promise<ScanResult> {
	return runScanWithRuntime(scanPaths, hostname, options, DEFAULT_SCANNER_RUNTIME);
}

export async function runScanWithRuntime(
	scanPaths: string[],
	hostname: string,
	options: ScanOptions,
	runtime: ScannerRuntime,
): Promise<ScanResult> {
	const startMs = Date.now();
	const errors: string[] = [];
	const checkpointEveryFiles = options.checkpointEveryFiles ?? DEFAULT_CHECKPOINT_EVERY_FILES;
	const assetBatchSize = options.assetBatchSize ?? DEFAULT_ASSET_BATCH_SIZE;
	if (checkpointEveryFiles < 1) throw new Error("checkpointEveryFiles must be at least 1");
	if (assetBatchSize < 1 || assetBatchSize > 10_000) {
		throw new Error("assetBatchSize must be between 1 and 10000");
	}

	const normalizedPaths = scanPaths.map((scanPath) => path.resolve(scanPath));
	const existsPath = runtime.existsSync ?? fs.existsSync;
	const lstatPath = runtime.lstatSync ?? fs.lstatSync;
	const readDirectory = runtime.readdirSync ?? fs.readdirSync;
	const now = new Date().toISOString();
	const checkpoint = options.stateDir
		? await loadScanCheckpoint(options.stateDir, normalizedPaths, hostname)
		: {
				version: 1 as const,
				scanId: crypto.randomUUID(),
				scopeHash: scanScopeHash(normalizedPaths, hostname),
				hostname,
				scanPaths: normalizedPaths,
				startedAt: now,
				updatedAt: now,
				nextPathIndex: 0,
				directoryStack: [],
				filesScanned: 0,
				directoriesScanned: 0,
				assetsFound: 0,
				batchSequence: 0,
				pendingReportedAt: null,
				pendingAssets: [],
			};
	const resumed =
		checkpoint.nextPathIndex > 0 ||
		checkpoint.filesScanned > 0 ||
		checkpoint.directoryStack.length > 0 ||
		checkpoint.batchSequence > 0;
	let state = checkpoint;
	const stateDir = options.stateDir;
	const scannedPaths = state.scanPaths.filter((scanPath) => existsPath(scanPath));
	const directoryEntryCache = new Map<string, fs.Dirent[]>();

	const persist = async (): Promise<void> => {
		if (stateDir) await saveScanCheckpoint(stateDir, state);
	};

	const emitPendingBatch = async (final: boolean): Promise<void> => {
		const onAssetBatch = options.onAssetBatch as NonNullable<ScanOptions["onAssetBatch"]>;
		const reportedAt = state.pendingReportedAt ?? state.startedAt;
		await persist();
		await onAssetBatch(state.pendingAssets, {
			scanId: state.scanId,
			sequence: state.batchSequence,
			reportedAt,
			final,
		});
		state = updateCheckpoint(state, {
			batchSequence: state.batchSequence + 1,
			pendingReportedAt: null,
			pendingAssets: [],
		});
		await persist();
	};

	if (options.onAssetBatch && state.pendingAssets.length >= assetBatchSize) {
		await emitPendingBatch(false);
	}

	const processFile = async (filePath: string): Promise<void> => {
		let found: ScannedAsset[] = [];
		try {
			found = runtime.scanFile(filePath);
		} catch (err) {
			logger.debug("Error scanning file", {
				path: filePath,
				error: formatError(err),
			});
		}
		state = updateCheckpoint(state, {
			filesScanned: state.filesScanned + 1,
			assetsFound: state.assetsFound + found.length,
			pendingReportedAt:
				found.length > 0
					? (state.pendingReportedAt ?? new Date().toISOString())
					: state.pendingReportedAt,
			pendingAssets: [...state.pendingAssets, ...found],
		});

		if (options.onAssetBatch && state.pendingAssets.length >= assetBatchSize) {
			await emitPendingBatch(false);
		} else if (state.filesScanned % checkpointEveryFiles === 0) {
			await persist();
			logger.info("Scan progress checkpoint committed", {
				scanId: state.scanId,
				filesScanned: state.filesScanned,
				directoriesScanned: state.directoriesScanned,
				assetsFound: state.assetsFound,
			});
		}
	};

	while (state.nextPathIndex < state.scanPaths.length || state.directoryStack.length > 0) {
		if (state.directoryStack.length === 0) {
			const scanPath = state.scanPaths[state.nextPathIndex];
			state = updateCheckpoint(state, { nextPathIndex: state.nextPathIndex + 1 });
			if (!scanPath || !existsPath(scanPath)) {
				logger.debug("Scan path does not exist, skipping", { path: scanPath });
				continue;
			}
			const stat = lstatPath(scanPath);
			if (stat.isSymbolicLink()) continue;
			if (stat.isFile()) {
				await processFile(scanPath);
				continue;
			}
			if (!stat.isDirectory()) continue;
			state = updateCheckpoint(state, {
				directoriesScanned: state.directoriesScanned + 1,
				directoryStack: [
					...state.directoryStack,
					{ directory: scanPath, depth: 0, lastEntryName: null },
				],
			});
			logger.debug("Scanning path", { path: scanPath, scanId: state.scanId });
		}

		const frame = state.directoryStack[state.directoryStack.length - 1] as {
			directory: string;
			depth: number;
			lastEntryName: string | null;
		};
		let entries: fs.Dirent[];
		try {
			const cached = directoryEntryCache.get(frame.directory);
			entries =
				cached ??
				readDirectory(frame.directory, { withFileTypes: true }).sort((a, b) =>
					a.name.localeCompare(b.name),
				);
			if (!cached) directoryEntryCache.set(frame.directory, entries);
		} catch {
			directoryEntryCache.delete(frame.directory);
			state = updateCheckpoint(state, { directoryStack: state.directoryStack.slice(0, -1) });
			continue;
		}

		const entry = entries.find(
			(candidate) => frame.lastEntryName === null || candidate.name > frame.lastEntryName,
		);
		if (!entry) {
			directoryEntryCache.delete(frame.directory);
			state = updateCheckpoint(state, { directoryStack: state.directoryStack.slice(0, -1) });
			continue;
		}

		const advancedFrame = { ...frame, lastEntryName: entry.name };
		state = updateCheckpoint(state, {
			directoryStack: [...state.directoryStack.slice(0, -1), advancedFrame],
		});
		const fullPath = path.join(frame.directory, entry.name);
		if (entry.isSymbolicLink()) continue;
		if (entry.isDirectory()) {
			if (frame.depth >= MAX_SCAN_DEPTH || shouldSkipDir(entry.name)) continue;
			state = updateCheckpoint(state, {
				directoriesScanned: state.directoriesScanned + 1,
				directoryStack: [
					...state.directoryStack,
					{ directory: fullPath, depth: frame.depth + 1, lastEntryName: null },
				],
			});
		} else if (entry.isFile()) {
			await processFile(fullPath);
		}
	}

	// TLS endpoint scan
	try {
		const tlsAssets = await runtime.scanTlsEndpoints(hostname);
		state = updateCheckpoint(state, {
			assetsFound: state.assetsFound + tlsAssets.length,
			pendingReportedAt:
				tlsAssets.length > 0
					? (state.pendingReportedAt ?? new Date().toISOString())
					: state.pendingReportedAt,
			pendingAssets: [...state.pendingAssets, ...tlsAssets],
		});
		if (tlsAssets.length > 0) {
			logger.info("Discovered TLS endpoints", { count: tlsAssets.length });
		}
	} catch (err) {
		errors.push(`TLS scan error: ${formatError(err)}`);
	}

	if (options.onAssetBatch) await emitPendingBatch(true);
	const assets = options.onAssetBatch ? [] : [...state.pendingAssets];
	if (stateDir) await removeScanCheckpoint(stateDir, state.scopeHash);

	const durationMs = Date.now() - startMs;
	logger.info("Scan complete", {
		scanId: state.scanId,
		assetCount: state.assetsFound,
		filesScanned: state.filesScanned,
		directoriesScanned: state.directoriesScanned,
		pathCount: scannedPaths.length,
		durationMs,
	});

	return {
		assets,
		assetCount: state.assetsFound,
		scannedPaths,
		durationMs,
		errors,
		scanId: state.scanId,
		resumed,
		filesScanned: state.filesScanned,
		directoriesScanned: state.directoriesScanned,
	};
}
