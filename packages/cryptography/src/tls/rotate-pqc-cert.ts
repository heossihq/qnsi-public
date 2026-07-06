#!/usr/bin/env node
/**
 * PQC-TLS certificate rotation CLI.
 *
 * This script generates new PQC-TLS certificates and updates rotation metadata.
 * It is designed to be run via cron or systemd timers for scheduled rotation.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PqcAlgorithm } from "../provider.js";
import { generatePqcCertificate, type PqcTlsOptions } from "./pqc-tls.js";

export interface RotationMetadata {
	readonly lastRotationAt: string;
	readonly version: number;
	readonly certPath: string;
	readonly keyPath: string;
	readonly algorithm: string;
	readonly checksum: string;
}

export interface RotatePqcCertOptions extends PqcTlsOptions {
	readonly service?: string;
	readonly metadataPath?: string;
	readonly force?: boolean;
	readonly minValidityDaysRemaining?: number;
}

/**
 * Calculate SHA-256 checksum of certificate content.
 */
async function calculateChecksum(content: string): Promise<string> {
	const { createHash } = await import("node:crypto");
	return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Read existing rotation metadata.
 */
async function readMetadata(metadataPath: string): Promise<RotationMetadata | null> {
	try {
		const content = await readFile(metadataPath, "utf8");
		return JSON.parse(content) as RotationMetadata;
	} catch {
		return null;
	}
}

/**
 * Write rotation metadata.
 */
async function writeMetadata(metadataPath: string, metadata: RotationMetadata): Promise<void> {
	await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

/**
 * Check if certificate needs rotation based on validity period.
 */
function needsRotation(metadata: RotationMetadata | null, options: RotatePqcCertOptions): boolean {
	if (options.force) {
		return true;
	}

	if (!metadata) {
		return true;
	}

	const lastRotation = new Date(metadata.lastRotationAt);
	const now = new Date();
	const daysSinceRotation = (now.getTime() - lastRotation.getTime()) / (1000 * 60 * 60 * 24);
	const validityDays = options.validityDays ?? 30;
	const minRemaining = options.minValidityDaysRemaining ?? 7;

	return daysSinceRotation >= validityDays - minRemaining;
}

/**
 * Rotate PQC-TLS certificate.
 */
export async function rotatePqcCertificate(options: RotatePqcCertOptions): Promise<{
	certificate: Awaited<ReturnType<typeof generatePqcCertificate>>;
	metadata: RotationMetadata;
	rotated: boolean;
}> {
	const service = options.service ?? "default";
	const outputDirectory = options.outputDirectory ?? resolve(process.cwd(), "var", "pqc-tls");
	const metadataPath =
		options.metadataPath ?? resolve(outputDirectory, `${service}-rotation-metadata.json`);

	const existingMetadata = await readMetadata(metadataPath);

	if (!needsRotation(existingMetadata, options)) {
		if (!existingMetadata) {
			throw new Error("No existing metadata found and rotation not forced");
		}

		const { readFile: readFileSync } = await import("node:fs/promises");
		const [cert, key] = await Promise.all([
			readFileSync(existingMetadata.certPath, "utf8"),
			readFileSync(existingMetadata.keyPath, "utf8"),
		]);

		return {
			certificate: {
				cert,
				key,
				algorithm: existingMetadata.algorithm as PqcAlgorithm,
				provider: options.provider ?? "oqsprovider",
				certPath: existingMetadata.certPath,
				keyPath: existingMetadata.keyPath,
				metadata: {
					generatedAt: existingMetadata.lastRotationAt,
					validityDays: options.validityDays ?? 30,
					commonName: options.commonName ?? "qnsp.local",
					organization: options.organization ?? "Quantum-Native Security Infrastructure",
					source: "existing",
				},
			},
			metadata: existingMetadata,
			rotated: false,
		};
	}

	const certificate = await generatePqcCertificate({
		...options,
		filePrefix: options.filePrefix ?? service,
		commonName: options.commonName ?? `${service}.qnsp.local`,
	});

	if (!certificate.certPath || !certificate.keyPath) {
		throw new Error("Certificate generation must specify certPath and keyPath");
	}

	const certChecksum = await calculateChecksum(certificate.cert);
	const metadata: RotationMetadata = {
		lastRotationAt: new Date().toISOString(),
		version: existingMetadata ? existingMetadata.version + 1 : 1,
		certPath: certificate.certPath,
		keyPath: certificate.keyPath,
		algorithm: certificate.algorithm,
		checksum: certChecksum,
	};

	await writeMetadata(metadataPath, metadata);

	return {
		certificate,
		metadata,
		rotated: true,
	};
}

/**
 * CLI entry point.
 */
export async function main(args: string[]): Promise<number> {
	const service = args.find((arg) => arg.startsWith("--service="))?.split("=")[1];
	const force = args.includes("--force");
	const minValidityDaysRemaining = args
		.find((arg) => arg.startsWith("--min-validity-days="))
		?.split("=")[1];
	const validityDays = args.find((arg) => arg.startsWith("--validity-days="))?.split("=")[1];
	const outputDir = args.find((arg) => arg.startsWith("--output-dir="))?.split("=")[1];
	const opensslPath = args.find((arg) => arg.startsWith("--openssl-path="))?.split("=")[1];
	const algorithm = args.find((arg) => arg.startsWith("--algorithm="))?.split("=")[1];

	if (!service) {
		console.error("Error: --service=<service-name> is required");
		console.error("Usage: rotate-pqc-cert --service=<name> [options]");
		console.error("Options:");
		console.error("  --force                    Force rotation even if not needed");
		console.error(
			"  --min-validity-days=<n>    Minimum days remaining before rotation (default: 7)",
		);
		console.error("  --validity-days=<n>        Certificate validity in days (default: 30)");
		console.error("  --output-dir=<path>        Output directory (default: var/pqc-tls)");
		console.error("  --openssl-path=<path>      Path to OpenSSL binary");
		console.error("  --algorithm=<name>         Signature algorithm (default: dilithium-3)");
		return 1;
	}

	try {
		const rotateOptions: RotatePqcCertOptions = {
			service,
			force,
			commonName: `${service}.qnsp.local`,
			filePrefix: service,
			...(minValidityDaysRemaining
				? { minValidityDaysRemaining: Number.parseInt(minValidityDaysRemaining, 10) }
				: {}),
			...(validityDays ? { validityDays: Number.parseInt(validityDays, 10) } : {}),
			...(outputDir ? { outputDirectory: outputDir } : {}),
			...(opensslPath ? { opensslPath } : {}),
			...(algorithm ? { signatureAlgorithm: algorithm as PqcAlgorithm } : {}),
		};

		const result = await rotatePqcCertificate(rotateOptions);

		if (result.rotated) {
			console.log(
				`✓ Rotated PQC-TLS certificate for ${service} (version ${result.metadata.version})`,
			);
			console.log(`  Certificate: ${result.metadata.certPath}`);
			console.log(`  Private key: ${result.metadata.keyPath}`);
			console.log(`  Algorithm: ${result.metadata.algorithm}`);
			console.log(`  Checksum: ${result.metadata.checksum.substring(0, 16)}...`);
		} else {
			console.log(
				`✓ Certificate for ${service} is still valid (version ${result.metadata.version}, expires in ${Math.ceil((new Date(result.metadata.lastRotationAt).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (1000 * 60 * 60 * 24))} days)`,
			);
		}

		return 0;
	} catch (error) {
		console.error(
			"Error rotating PQC certificate:",
			error instanceof Error ? error.message : String(error),
		);
		return 1;
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main(process.argv.slice(2))
		.then((code) => {
			process.exit(code);
		})
		.catch((error) => {
			console.error("Fatal error:", error);
			process.exit(1);
		});
}
