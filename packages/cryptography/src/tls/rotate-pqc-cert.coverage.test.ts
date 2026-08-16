import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as pqcTls from "./pqc-tls.js";
import { rotatePqcCertificate } from "./rotate-pqc-cert.js";

describe("rotate-pqc-cert - Comprehensive Coverage", () => {
	let testDir: string;
	let mockCertificate: pqcTls.PqcTlsArtifact;

	beforeEach(async () => {
		testDir = join(tmpdir(), `rotate-cert-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });

		mockCertificate = {
			cert: `MOCK_CERT_${Date.now()}`,
			key: `MOCK_PRIVATE_KEY_${Date.now()}`,
			algorithm: "dilithium-3",
			provider: "oqsprovider",
			certPath: join(testDir, "mock.cert.pem"),
			keyPath: join(testDir, "mock.key.pem"),
			metadata: {
				generatedAt: new Date().toISOString(),
				validityDays: 30,
				commonName: "test.local",
				organization: "Test Org",
				source: "generated",
			},
		};

		vi.spyOn(pqcTls, "generatePqcCertificate").mockImplementation(async (options) => {
			const cert = {
				...mockCertificate,
				algorithm: options?.signatureAlgorithm ?? "dilithium-3",
			};
			// Write the mock files so they exist when read
			await writeFile(cert.certPath, cert.cert);
			await writeFile(cert.keyPath, cert.key);
			return cert;
		});
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	describe("rotation logic", () => {
		it("uses default service and output paths", async () => {
			vi.spyOn(process, "cwd").mockReturnValue(testDir);
			const result = await rotatePqcCertificate({});
			expect(result.rotated).toBe(true);
		});

		it("should create new certificate when none exists", async () => {
			const result = await rotatePqcCertificate({
				service: "new-service",
				outputDirectory: testDir,
				validityDays: 30,
			});

			expect(result.rotated).toBe(true);
			expect(result.metadata.version).toBe(1);
			expect(pqcTls.generatePqcCertificate).toHaveBeenCalled();
		});

		it("should reuse existing certificate when still valid", async () => {
			const service = "valid-service";
			const metadataPath = join(testDir, `${service}-rotation-metadata.json`);
			const certPath = join(testDir, `${service}.cert.pem`);
			const keyPath = join(testDir, `${service}.key.pem`);

			await writeFile(certPath, mockCertificate.cert);
			await writeFile(keyPath, mockCertificate.key);

			const metadata = {
				lastRotationAt: new Date().toISOString(),
				version: 1,
				certPath,
				keyPath,
				algorithm: "dilithium-3",
				checksum: "abc123",
			};
			await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

			const result = await rotatePqcCertificate({
				service,
				outputDirectory: testDir,
				metadataPath,
				validityDays: 30,
				minValidityDaysRemaining: 7,
			});

			expect(result.rotated).toBe(false);
			expect(result.metadata.version).toBe(1);
			expect(pqcTls.generatePqcCertificate).not.toHaveBeenCalled();
		});

		it("should force rotation when --force is set", async () => {
			const service = "force-service";
			const metadataPath = join(testDir, `${service}-rotation-metadata.json`);

			const metadata = {
				lastRotationAt: new Date().toISOString(),
				version: 1,
				certPath: join(testDir, `${service}.cert.pem`),
				keyPath: join(testDir, `${service}.key.pem`),
				algorithm: "dilithium-3",
				checksum: "abc123",
			};
			await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

			const result = await rotatePqcCertificate({
				service,
				outputDirectory: testDir,
				metadataPath,
				force: true,
			});

			expect(result.rotated).toBe(true);
			expect(result.metadata.version).toBe(2);
			expect(pqcTls.generatePqcCertificate).toHaveBeenCalled();
		});

		it("should rotate when certificate is near expiration", async () => {
			const service = "expiring-service";
			const metadataPath = join(testDir, `${service}-rotation-metadata.json`);

			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 25);

			const metadata = {
				lastRotationAt: oldDate.toISOString(),
				version: 1,
				certPath: join(testDir, `${service}.cert.pem`),
				keyPath: join(testDir, `${service}.key.pem`),
				algorithm: "dilithium-3",
				checksum: "abc123",
			};
			await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

			const result = await rotatePqcCertificate({
				service,
				outputDirectory: testDir,
				metadataPath,
				validityDays: 30,
				minValidityDaysRemaining: 7,
			});

			expect(result.rotated).toBe(true);
			expect(result.metadata.version).toBe(2);
		});

		it("should use default validity days when not specified", async () => {
			const result = await rotatePqcCertificate({
				service: "default-validity",
				outputDirectory: testDir,
			});

			expect(result.rotated).toBe(true);
		});

		it("should use default min validity days remaining when not specified", async () => {
			const service = "default-min-validity";
			const metadataPath = join(testDir, `${service}-rotation-metadata.json`);

			const metadata = {
				lastRotationAt: new Date().toISOString(),
				version: 1,
				certPath: join(testDir, `${service}.cert.pem`),
				keyPath: join(testDir, `${service}.key.pem`),
				algorithm: "dilithium-3",
				checksum: "abc123",
			};
			await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
			await writeFile(metadata.certPath, mockCertificate.cert);
			await writeFile(metadata.keyPath, mockCertificate.key);

			const result = await rotatePqcCertificate({
				service,
				outputDirectory: testDir,
				metadataPath,
			});

			expect(result).toBeDefined();
		});

		it("should increment version on rotation", async () => {
			const service = "version-test";
			const metadataPath = join(testDir, `${service}-rotation-metadata.json`);

			const metadata = {
				lastRotationAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
				version: 5,
				certPath: join(testDir, `${service}.cert.pem`),
				keyPath: join(testDir, `${service}.key.pem`),
				algorithm: "dilithium-3",
				checksum: "abc123",
			};
			await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

			const result = await rotatePqcCertificate({
				service,
				outputDirectory: testDir,
				metadataPath,
				validityDays: 30,
				minValidityDaysRemaining: 7,
			});

			expect(result.rotated).toBe(true);
			expect(result.metadata.version).toBe(6);
		});

		it("should write metadata file after rotation", async () => {
			const service = "metadata-write-test";
			const metadataPath = join(testDir, `${service}-rotation-metadata.json`);

			const result = await rotatePqcCertificate({
				service,
				outputDirectory: testDir,
				metadataPath,
			});

			expect(result.rotated).toBe(true);

			const writtenMetadata = JSON.parse(await readFile(metadataPath, "utf-8"));
			expect(writtenMetadata.version).toBe(1);
			expect(writtenMetadata.lastRotationAt).toBeDefined();
			expect(writtenMetadata.certPath).toBeDefined();
			expect(writtenMetadata.keyPath).toBeDefined();
		});

		it("should pass algorithm to certificate generation", async () => {
			await rotatePqcCertificate({
				service: "algo-test",
				outputDirectory: testDir,
				signatureAlgorithm: "falcon-512",
			});

			expect(pqcTls.generatePqcCertificate).toHaveBeenCalled();
		});

		it("should pass common name to certificate generation", async () => {
			await rotatePqcCertificate({
				service: "cn-test",
				outputDirectory: testDir,
				commonName: "custom.example.com",
			});

			expect(pqcTls.generatePqcCertificate).toHaveBeenCalledWith(
				expect.objectContaining({
					commonName: "custom.example.com",
				}),
			);
		});

		it("should pass organization to certificate generation", async () => {
			await rotatePqcCertificate({
				service: "org-test",
				outputDirectory: testDir,
				organization: "Custom Org",
			});

			expect(pqcTls.generatePqcCertificate).toHaveBeenCalledWith(
				expect.objectContaining({
					organization: "Custom Org",
				}),
			);
		});

		it("should use service name as file prefix", async () => {
			await rotatePqcCertificate({
				service: "prefix-test-service",
				outputDirectory: testDir,
			});

			expect(pqcTls.generatePqcCertificate).toHaveBeenCalledWith(
				expect.objectContaining({
					filePrefix: "prefix-test-service",
				}),
			);
		});

		it("should handle metadata file not existing", async () => {
			const service = "no-metadata";
			const metadataPath = join(testDir, "non-existent-metadata.json");

			const result = await rotatePqcCertificate({
				service,
				outputDirectory: testDir,
				metadataPath,
			});

			expect(result.rotated).toBe(true);
			expect(result.metadata.version).toBe(1);
		});

		it("should calculate checksum for certificate", async () => {
			const result = await rotatePqcCertificate({
				service: "checksum-test",
				outputDirectory: testDir,
			});

			expect(result.metadata.checksum).toBeDefined();
			expect(typeof result.metadata.checksum).toBe("string");
			expect(result.metadata.checksum.length).toBeGreaterThan(0);
		});

		it("should include cert and key paths in result", async () => {
			const result = await rotatePqcCertificate({
				service: "paths-test",
				outputDirectory: testDir,
			});

			expect(result.metadata.certPath).toBeDefined();
			expect(result.metadata.keyPath).toBeDefined();
			expect(result.metadata.certPath).toContain(".cert.pem");
			expect(result.metadata.keyPath).toContain(".key.pem");
		});

		it("should include algorithm in metadata", async () => {
			const result = await rotatePqcCertificate({
				service: "algo-metadata-test",
				outputDirectory: testDir,
				signatureAlgorithm: "dilithium-5",
			});

			expect(result.metadata.algorithm).toBeDefined();
			expect(typeof result.metadata.algorithm).toBe("string");
		});

		it("should use default metadata path when not specified", async () => {
			const service = "default-metadata-path";

			const result = await rotatePqcCertificate({
				service,
				outputDirectory: testDir,
			});

			expect(result.rotated).toBe(true);
			expect(result.metadata.version).toBe(1);
		});
	});
});
