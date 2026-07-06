/**
 * PQC-TLS certificate generation and configuration.
 *
 * NOTE: Full PQC-TLS support requires OpenSSL 3.x compiled with post-quantum
 * cryptography extensions. Standard Node.js TLS does not yet support PQC algorithms
 * in X.509 certificates. This module provides certificate generation utilities that
 * can be used with custom TLS implementations or when PQC-TLS support becomes
 * available in Node.js/OpenSSL.
 *
 * For production use, PQC-TLS certificates must be generated using OpenSSL 3.x
 * with PQC extensions or a compatible TLS library that supports PQC algorithms.
 */

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
	access,
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { PqcAlgorithm } from "../provider.js";

const execFileAsync = promisify(execFile);
const DEFAULT_PROVIDER = "oqsprovider";
const DEFAULT_COMMON_NAME = "qnsp.local";
const DEFAULT_ORGANIZATION = "Quantum-Native Security Infrastructure";
const DEFAULT_SIGNATURE_ALGORITHM: PqcAlgorithm = "dilithium-3";
const DEFAULT_VALIDITY_DAYS = 30;
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(MODULE_DIR, "../../../..");
const LOCAL_OQS_PROVIDER_DIR = resolve(WORKSPACE_ROOT, "tooling", "oqs-provider", "_build", "lib");

type SignatureAlgorithmAlias = Partial<Record<PqcAlgorithm, string | null>>;

const SIGNATURE_OPENSSL_ALIASES: SignatureAlgorithmAlias = {
	// KEMs don't have signature aliases
	"kyber-512": null,
	"kyber-768": null,
	"kyber-1024": null,
	// FIPS 204 - ML-DSA (used by oqsprovider)
	"dilithium-2": "mldsa44",
	"dilithium-3": "mldsa65",
	"dilithium-5": "mldsa87",
	// Falcon
	"falcon-512": "falcon512",
	"falcon-1024": "falcon1024",
	// FIPS 205 - SLH-DSA
	"sphincs-sha2-128f-simple": "sphincssha2128fsimple",
	"sphincs-sha2-128s-simple": "sphincssha2128ssimple",
	"sphincs-sha2-192f-simple": "sphincssha2192fsimple",
	"sphincs-sha2-192s-simple": "sphincssha2192ssimple",
	"sphincs-sha2-256f-simple": "sphincssha2256fsimple",
	"sphincs-sha2-256s-simple": "sphincssha2256ssimple",
	"sphincs-shake-128f-simple": "sphincsshake128fsimple",
	"sphincs-shake-128s-simple": "sphincsshake128ssimple",
	"sphincs-shake-192f-simple": "sphincsshake192fsimple",
	"sphincs-shake-192s-simple": "sphincsshake192ssimple",
	"sphincs-shake-256f-simple": "sphincsshake256fsimple",
	"sphincs-shake-256s-simple": "sphincsshake256ssimple",
};

export interface PqcTlsCertificate {
	readonly cert: string;
	readonly key: string;
	readonly algorithm: PqcAlgorithm;
	readonly provider: string;
	readonly certPath?: string;
	readonly keyPath?: string;
	readonly metadata?: {
		readonly generatedAt: string;
		readonly validityDays: number;
		readonly commonName: string;
		readonly organization: string;
		readonly source: "generated" | "existing";
	};
}

export interface PqcTlsOptions {
	readonly kemAlgorithm?: PqcAlgorithm;
	readonly signatureAlgorithm?: PqcAlgorithm;
	readonly provider?: string;
	readonly commonName?: string;
	readonly organization?: string;
	readonly validityDays?: number;
	readonly outputDirectory?: string;
	readonly opensslPath?: string;
	readonly opensslEnv?: Record<string, string>;
	readonly filePrefix?: string;
	readonly certPath?: string;
	readonly keyPath?: string;
}

export interface EnsurePqcCertificateFilesOptions
	extends Omit<PqcTlsOptions, "certPath" | "keyPath"> {
	readonly certPath?: string | null;
	readonly keyPath?: string | null;
	readonly reuseExisting?: boolean;
}

export interface PqcTlsArtifact extends PqcTlsCertificate {
	readonly certPath: string;
	readonly keyPath: string;
}

/**
 * Check if the current Node.js/OpenSSL build supports PQC-TLS.
 * Full PQC-TLS support requires OpenSSL 3.x with PQC extensions.
 */
export function checkPqcTlsSupport(): {
	supported: boolean;
	opensslVersion?: string;
	message: string;
} {
	const opensslVersion = process.versions.openssl;

	if (!opensslVersion) {
		return {
			supported: false,
			message: "OpenSSL version not available",
		};
	}

	const opensslMajor = parseInt(opensslVersion.split(".")[0] ?? "0", 10);
	const supported = opensslMajor >= 3;

	return {
		supported,
		opensslVersion,
		message: supported
			? `OpenSSL ${opensslVersion} may support PQC-TLS with appropriate build flags. Verify PQC extension support.`
			: `OpenSSL ${opensslVersion} does not support PQC-TLS. OpenSSL 3.x+ with PQC extensions required.`,
	};
}

/**
 * Generate PQC-capable X.509 certificates (self-signed) via OpenSSL 3.x + oqsprovider.
 * Files are emitted to disk (re-usable PEM artifacts) and returned in-memory for Fastify HTTPS wiring.
 */
export async function generatePqcCertificate(options: PqcTlsOptions = {}): Promise<PqcTlsArtifact> {
	const signatureProfile = resolveSignatureAlgorithm(options.signatureAlgorithm);
	const provider = options.provider ?? DEFAULT_PROVIDER;
	const opensslPath = options.opensslPath ?? process.env["OPENSSL_PATH"] ?? "openssl";
	const validityDays = options.validityDays ?? DEFAULT_VALIDITY_DAYS;
	const commonName = options.commonName ?? DEFAULT_COMMON_NAME;
	const organization = options.organization ?? DEFAULT_ORGANIZATION;
	const outputDirectory = resolve(options.outputDirectory ?? join(process.cwd(), "var", "pqc-tls"));
	const filePrefix = sanitizeFileSegment(
		options.filePrefix ?? commonName ?? `pqc-${signatureProfile.opensslName}`,
	);
	const certPath = resolve(options.certPath ?? resolve(outputDirectory, `${filePrefix}.cert.pem`));
	const keyPath = resolve(options.keyPath ?? resolve(outputDirectory, `${filePrefix}.key.pem`));

	await mkdir(outputDirectory, { recursive: true });

	const tempDir = await mkdtemp(join(outputDirectory, ".tmp-pqc-tls-"));
	const tmpKeyPath = join(tempDir, `${randomUUID()}-key.pem`);
	const tmpCertPath = join(tempDir, `${randomUUID()}-cert.pem`);
	const configPath = join(tempDir, "openssl.cnf");

	try {
		const providerModulePath = await resolveOqsProviderModulePath(options.opensslEnv);
		await writeFile(
			configPath,
			buildOpenSslConfig(
				{
					commonName,
					organization,
				},
				providerModulePath,
			),
			"utf8",
		);

		const args = [
			"req",
			"-x509",
			"-new",
			"-newkey",
			signatureProfile.opensslName,
			"-config",
			configPath,
			"-extensions",
			"qnsp_tls",
			"-keyout",
			tmpKeyPath,
			"-out",
			tmpCertPath,
			"-days",
			String(validityDays),
			"-nodes",
			"-subj",
			buildSubject(commonName, organization),
		];

		await runOpenSsl(opensslPath, args, options.opensslEnv);
		await chmod(tmpKeyPath, 0o600);
		await chmod(tmpCertPath, 0o644);

		await mkdir(dirname(certPath), { recursive: true });
		await mkdir(dirname(keyPath), { recursive: true });

		await rename(tmpKeyPath, keyPath);
		await rename(tmpCertPath, certPath);

		const [cert, key] = await Promise.all([readFile(certPath, "utf8"), readFile(keyPath, "utf8")]);

		return {
			cert,
			key,
			algorithm: signatureProfile.algorithm,
			provider,
			certPath,
			keyPath,
			metadata: {
				generatedAt: new Date().toISOString(),
				validityDays,
				commonName,
				organization,
				source: "generated",
			},
		};
	} catch (error) {
		throw new Error(
			`Failed to generate PQC-TLS certificate via OpenSSL: ${error instanceof Error ? error.message : String(error)}`,
		);
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
}

export async function ensurePqcCertificateFiles(
	options: EnsurePqcCertificateFilesOptions,
): Promise<PqcTlsArtifact> {
	const normalizedCertPath = options.certPath ? resolve(options.certPath) : null;
	const normalizedKeyPath = options.keyPath ? resolve(options.keyPath) : null;

	if (options.reuseExisting !== false && normalizedCertPath && normalizedKeyPath) {
		const [certExists, keyExists] = await Promise.all([
			fileExists(normalizedCertPath),
			fileExists(normalizedKeyPath),
		]);
		if (certExists && keyExists) {
			const [cert, key] = await Promise.all([
				readFile(normalizedCertPath, "utf8"),
				readFile(normalizedKeyPath, "utf8"),
			]);
			return {
				cert,
				key,
				algorithm: options.signatureAlgorithm ?? DEFAULT_SIGNATURE_ALGORITHM,
				provider: options.provider ?? DEFAULT_PROVIDER,
				certPath: normalizedCertPath,
				keyPath: normalizedKeyPath,
				metadata: {
					generatedAt: (await fileStatTimestamp(normalizedCertPath)) ?? new Date().toISOString(),
					validityDays: options.validityDays ?? DEFAULT_VALIDITY_DAYS,
					commonName: options.commonName ?? DEFAULT_COMMON_NAME,
					organization: options.organization ?? DEFAULT_ORGANIZATION,
					source: "existing",
				},
			};
		}
	}

	const resolvedOutputDir =
		options.outputDirectory ??
		(normalizedCertPath ? dirname(normalizedCertPath) : undefined) ??
		(normalizedKeyPath ? dirname(normalizedKeyPath) : undefined);

	const generateOptions: PqcTlsOptions = {
		...(options.kemAlgorithm ? { kemAlgorithm: options.kemAlgorithm } : {}),
		...(options.signatureAlgorithm ? { signatureAlgorithm: options.signatureAlgorithm } : {}),
		...(options.provider ? { provider: options.provider } : {}),
		...(options.commonName ? { commonName: options.commonName } : {}),
		...(options.organization ? { organization: options.organization } : {}),
		...(options.validityDays ? { validityDays: options.validityDays } : {}),
		...(resolvedOutputDir ? { outputDirectory: resolvedOutputDir } : {}),
		...(options.opensslPath ? { opensslPath: options.opensslPath } : {}),
		...(options.opensslEnv ? { opensslEnv: options.opensslEnv } : {}),
		...(options.filePrefix ? { filePrefix: options.filePrefix } : {}),
		...(normalizedCertPath
			? { certPath: normalizedCertPath }
			: options.certPath
				? { certPath: options.certPath }
				: {}),
		...(normalizedKeyPath
			? { keyPath: normalizedKeyPath }
			: options.keyPath
				? { keyPath: options.keyPath }
				: {}),
	};
	return generatePqcCertificate(generateOptions);
}

/**
 * Build Fastify HTTPS options for PQC certificates, constraining TLS 1.3 cipher suites.
 */
export function getPqcTlsOptions(certificate: PqcTlsCertificate): {
	key: string;
	cert: string;
	ciphers: string;
	minVersion: string;
	maxVersion: string;
} {
	return {
		key: certificate.key,
		cert: certificate.cert,
		ciphers: "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256",
		minVersion: "TLSv1.3",
		maxVersion: "TLSv1.3",
	};
}

function resolveSignatureAlgorithm(algorithm?: PqcAlgorithm): {
	algorithm: PqcAlgorithm;
	opensslName: string;
} {
	const candidate = algorithm ?? DEFAULT_SIGNATURE_ALGORITHM;
	const opensslName = SIGNATURE_OPENSSL_ALIASES[candidate];
	if (!opensslName) {
		throw new Error(
			`Algorithm '${candidate}' is not supported for PQC-TLS certificate generation. Use a signature algorithm such as dilithium-2/3/5.`,
		);
	}
	return { algorithm: candidate, opensslName };
}

function sanitizeFileSegment(value: string): string {
	return (
		value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9.-]+/gu, "-")
			.replace(/^-+/, "")
			.replace(/-+$/, "") || "pqc-tls"
	);
}

function buildSubject(commonName: string, organization: string): string {
	return `/CN=${commonName}/O=${organization}`;
}

function buildOpenSslConfig(
	subject: {
		readonly commonName: string;
		readonly organization: string;
	},
	providerModulePath?: string | null,
): string {
	const altName = subject.commonName.includes(".") ? subject.commonName : "localhost";
	const providerSection = providerModulePath
		? `
openssl_conf = oqsprovider_init

[oqsprovider_init]
providers = provider_section

[provider_section]
default = default_sect
oqsprovider = oqsprovider_sect

[default_sect]
activate = 1

[oqsprovider_sect]
activate = 1
module = ${providerModulePath}
`.trim()
		: "";

	const providerHeader = providerSection ? `${providerSection}\n\n` : "";

	return `
${providerHeader}[ req ]
distinguished_name = req_distinguished_name
x509_extensions = qnsp_tls
prompt = no

[ req_distinguished_name ]
CN = ${subject.commonName}
O = ${subject.organization}

[ qnsp_tls ]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = ${subject.commonName}
DNS.2 = ${altName}
`.trim();
}

async function resolveOqsProviderModulePath(
	envOverrides?: Record<string, string>,
): Promise<string | null> {
	if (envOverrides?.["OPENSSL_MODULES"] || process.env["OPENSSL_MODULES"]) {
		return null;
	}

	const candidateEnv = [
		process.env["QNSI_OQS_PROVIDER_MODULE"],
		process.env["QNSP_OQS_PROVIDER_MODULE"],
		process.env["QNSI_OQS_PROVIDER_PATH"],
		process.env["QNSP_OQS_PROVIDER_PATH"],
		process.env["QNSI_OPENSSL_MODULES"],
		process.env["QNSP_OPENSSL_MODULES"],
	];

	for (const candidate of candidateEnv) {
		const moduleFile = await findProviderModuleFile(candidate);
		if (moduleFile) {
			return moduleFile;
		}
	}

	return findProviderModuleFile(LOCAL_OQS_PROVIDER_DIR);
}

async function findProviderModuleFile(pathCandidate?: string): Promise<string | null> {
	if (!pathCandidate) {
		return null;
	}

	const resolvedCandidate = resolve(pathCandidate);
	const providerFilenames = ["oqsprovider.dylib", "oqsprovider.so", "oqsprovider.dll"];

	if (await fileExists(resolvedCandidate)) {
		if (providerFilenames.some((name) => resolvedCandidate.endsWith(name))) {
			return resolvedCandidate;
		}
	}

	for (const fileName of providerFilenames) {
		const candidateFile = join(resolvedCandidate, fileName);
		if (await fileExists(candidateFile)) {
			return candidateFile;
		}
	}

	return null;
}

async function runOpenSsl(
	opensslPath: string,
	args: readonly string[],
	envOverrides?: Record<string, string>,
): Promise<void> {
	try {
		await execFileAsync(opensslPath, args, {
			env: {
				...process.env,
				...envOverrides,
			},
		});
	} catch (error) {
		if (error instanceof Error && "stderr" in error) {
			throw new Error(
				`OpenSSL command failed: ${error.message}\nstderr: ${(error as Error & { stderr?: string }).stderr}`,
			);
		}
		throw error;
	}
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function fileStatTimestamp(path: string): Promise<string | null> {
	try {
		const fileStat = await stat(path);
		return fileStat.mtime.toISOString();
	} catch {
		return null;
	}
}
