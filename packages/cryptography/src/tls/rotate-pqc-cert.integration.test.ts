/**
 * Integration tests for PQC certificate rotation CLI.
 *
 * These tests require OpenSSL 3.x with oqsprovider installed.
 * Skip if not available.
 */

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { rotatePqcCertificate } from "./rotate-pqc-cert.js";

const execFileAsync = promisify(execFile);

async function hasOpenSslWithOqsProvider(): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync("openssl", ["version"]);
		if (!stdout.includes("OpenSSL 3")) {
			return false;
		}
		// Check if oqsprovider is available
		const { stdout: providers } = await execFileAsync("openssl", ["list", "-providers"]);
		return providers.includes("oqsprovider") || providers.includes("oqs");
	} catch {
		return false;
	}
}

const hasOqsProvider = await hasOpenSslWithOqsProvider();

if (!hasOqsProvider) {
	throw new Error(
		"OpenSSL 3 with oqsprovider is required for PQC certificate rotation integration verification",
	);
}

describe("rotatePqcCertificate integration", () => {
	it("generates new PQC certificate with OpenSSL", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "pqc-rotate-integration-"));
		try {
			const result = await rotatePqcCertificate({
				service: "integration-test",
				outputDirectory: tempDir,
				validityDays: 1,
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.rotated).toBe(true);
			expect(result.metadata.version).toBe(1);
			expect(result.metadata.algorithm).toBe("dilithium-3");
			expect(result.certificate.certPath).toBeDefined();
			expect(result.certificate.keyPath).toBeDefined();

			// Verify files exist
			const certExists = await stat(result.metadata.certPath)
				.then(() => true)
				.catch(() => false);
			const keyExists = await stat(result.metadata.keyPath)
				.then(() => true)
				.catch(() => false);

			expect(certExists).toBe(true);
			expect(keyExists).toBe(true);

			// Verify certificate content
			const cert = await readFile(result.metadata.certPath, "utf8");
			expect(cert).toContain("-----");
			expect(cert).toContain("END");

			// Verify key content
			const key = await readFile(result.metadata.keyPath, "utf8");
			expect(key).toContain("-----");
			expect(key).toContain("END");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("rotates certificate when near expiration", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "pqc-rotate-integration-"));
		try {
			const service = "integration-test";
			const metadataPath = resolve(tempDir, `${service}-rotation-metadata.json`);

			// Generate initial certificate
			const initial = await rotatePqcCertificate({
				service,
				outputDirectory: tempDir,
				validityDays: 30,
				signatureAlgorithm: "dilithium-3",
			});

			expect(initial.rotated).toBe(true);
			expect(initial.metadata.version).toBe(1);

			// Modify metadata to represent near-expiration
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 25); // 25 days ago
			const modifiedMetadata = {
				...initial.metadata,
				lastRotationAt: oldDate.toISOString(),
			};
			await writeFile(metadataPath, `${JSON.stringify(modifiedMetadata, null, 2)}\n`);

			// Attempt rotation (should detect need)
			const rotated = await rotatePqcCertificate({
				service,
				outputDirectory: tempDir,
				metadataPath,
				validityDays: 30,
				minValidityDaysRemaining: 7,
				signatureAlgorithm: "dilithium-3",
			});

			expect(rotated.rotated).toBe(true);
			expect(rotated.metadata.version).toBe(2);
			expect(rotated.metadata.checksum).not.toBe(initial.metadata.checksum);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("preserves certificate when still valid", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "pqc-rotate-integration-"));
		try {
			const service = "integration-test";

			// Generate initial certificate
			const initial = await rotatePqcCertificate({
				service,
				outputDirectory: tempDir,
				validityDays: 30,
				signatureAlgorithm: "dilithium-3",
			});

			expect(initial.rotated).toBe(true);
			const initialChecksum = initial.metadata.checksum;

			// Attempt rotation immediately (should reuse)
			const reused = await rotatePqcCertificate({
				service,
				outputDirectory: tempDir,
				validityDays: 30,
				minValidityDaysRemaining: 7,
				signatureAlgorithm: "dilithium-3",
			});

			expect(reused.rotated).toBe(false);
			expect(reused.metadata.version).toBe(initial.metadata.version);
			expect(reused.metadata.checksum).toBe(initialChecksum);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
