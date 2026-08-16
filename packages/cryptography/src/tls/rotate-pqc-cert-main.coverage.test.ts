import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as pqcTls from "./pqc-tls.js";
import { main } from "./rotate-pqc-cert.js";

describe("rotate-pqc-cert CLI - Coverage", () => {
	let testDir: string;
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(async () => {
		testDir = join(tmpdir(), `rotate-cli-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });

		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		vi.spyOn(pqcTls, "generatePqcCertificate").mockResolvedValue({
			cert: "MOCK CERT",
			key: "MOCK KEY",
			algorithm: "dilithium-3",
			provider: "oqsprovider",
			certPath: join(testDir, "test.cert.pem"),
			keyPath: join(testDir, "test.key.pem"),
			metadata: {
				generatedAt: new Date().toISOString(),
				validityDays: 30,
				commonName: "test.local",
				organization: "Test",
				source: "generated",
			},
		});
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	describe("CLI argument parsing", () => {
		it("runs when loaded as the direct command entry point", async () => {
			const originalArgv = process.argv;
			const originalExitCode = process.exitCode;
			try {
				process.argv = ["node", fileURLToPath(new URL("./rotate-pqc-cert.ts", import.meta.url))];
				process.exitCode = undefined;
				vi.resetModules();
				await import("./rotate-pqc-cert.js");
				await vi.waitFor(() => expect(process.exitCode).toBe(1));
			} finally {
				process.argv = originalArgv;
				process.exitCode = originalExitCode;
			}
		});

		it("should return error code when --service is missing", async () => {
			const exitCode = await main([]);

			expect(exitCode).toBe(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("--service=<service-name> is required"),
			);
		});

		it("should show usage when --service is missing", async () => {
			await main([]);

			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Options:"));
		});

		it("should parse --service argument", async () => {
			const exitCode = await main(["--service=test-service", `--output-dir=${testDir}`]);

			expect(exitCode).toBe(0);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Rotated PQC-TLS certificate for test-service"),
			);
		});

		it("uses the default CLI output directory when none is supplied", async () => {
			vi.spyOn(process, "cwd").mockReturnValue(testDir);
			await expect(main(["--service=default-output"])).resolves.toBe(0);
		});

		it("should parse --force argument", async () => {
			const exitCode = await main(["--service=force-test", "--force", `--output-dir=${testDir}`]);

			expect(exitCode).toBe(0);
		});

		it("should parse --min-validity-days argument", async () => {
			const exitCode = await main([
				"--service=min-validity-test",
				"--min-validity-days=14",
				`--output-dir=${testDir}`,
			]);

			expect(exitCode).toBe(0);
		});

		it("should parse --validity-days argument", async () => {
			const exitCode = await main([
				"--service=validity-test",
				"--validity-days=60",
				`--output-dir=${testDir}`,
			]);

			expect(exitCode).toBe(0);
		});

		it("should parse --output-dir argument", async () => {
			const exitCode = await main(["--service=output-test", `--output-dir=${testDir}`]);

			expect(exitCode).toBe(0);
		});

		it("should parse --openssl-path argument", async () => {
			const exitCode = await main([
				"--service=openssl-test",
				"--openssl-path=/custom/openssl",
				`--output-dir=${testDir}`,
			]);

			expect(exitCode).toBe(0);
		});

		it("should parse --algorithm argument", async () => {
			const exitCode = await main([
				"--service=algo-test",
				"--algorithm=falcon-512",
				`--output-dir=${testDir}`,
			]);

			expect(exitCode).toBe(0);
		});

		it("should parse multiple arguments together", async () => {
			const exitCode = await main([
				"--service=multi-test",
				"--force",
				"--validity-days=90",
				"--min-validity-days=10",
				"--algorithm=dilithium-5",
				`--output-dir=${testDir}`,
			]);

			expect(exitCode).toBe(0);
		});
	});

	describe("CLI output", () => {
		it("reports a still-valid certificate without rotating it", async () => {
			const service = "still-valid";
			const certPath = join(testDir, `${service}.cert.pem`);
			const keyPath = join(testDir, `${service}.key.pem`);
			await writeFile(certPath, "CERT");
			await writeFile(keyPath, "KEY");
			await writeFile(
				join(testDir, `${service}-rotation-metadata.json`),
				JSON.stringify({
					lastRotationAt: new Date().toISOString(),
					version: 3,
					certPath,
					keyPath,
					algorithm: "dilithium-3",
					checksum: "abc",
				}),
			);

			const code = await main([`--service=${service}`, `--output-dir=${testDir}`]);

			expect(code).toBe(0);
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("is still valid"));
		});

		it("should log success message on rotation", async () => {
			await main(["--service=success-test", `--output-dir=${testDir}`]);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("✓ Rotated PQC-TLS certificate"),
			);
		});

		it("should log certificate path", async () => {
			await main(["--service=path-test", `--output-dir=${testDir}`]);

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Certificate:"));
		});

		it("should log private key path", async () => {
			await main(["--service=key-test", `--output-dir=${testDir}`]);

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Private key:"));
		});

		it("should log algorithm", async () => {
			await main(["--service=algo-log-test", `--output-dir=${testDir}`]);

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Algorithm:"));
		});

		it("should log checksum", async () => {
			await main(["--service=checksum-test", `--output-dir=${testDir}`]);

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Checksum:"));
		});

		it("should log version number", async () => {
			await main(["--service=version-test", `--output-dir=${testDir}`]);

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("version 1"));
		});
	});

	describe("CLI error handling", () => {
		it("should return error code on failure", async () => {
			vi.spyOn(pqcTls, "generatePqcCertificate").mockRejectedValue(
				new Error("Mock generation error"),
			);

			const exitCode = await main(["--service=error-test", `--output-dir=${testDir}`]);

			expect(exitCode).toBe(1);
		});

		it("should log error message on failure", async () => {
			vi.spyOn(pqcTls, "generatePqcCertificate").mockRejectedValue(
				new Error("Mock generation error"),
			);

			await main(["--service=error-msg-test", `--output-dir=${testDir}`]);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error rotating PQC certificate:",
				"Mock generation error",
			);
		});

		it("should handle non-Error exceptions", async () => {
			vi.spyOn(pqcTls, "generatePqcCertificate").mockRejectedValue("String error");

			await main(["--service=string-error-test", `--output-dir=${testDir}`]);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error rotating PQC certificate:",
				"String error",
			);
		});
	});
});
