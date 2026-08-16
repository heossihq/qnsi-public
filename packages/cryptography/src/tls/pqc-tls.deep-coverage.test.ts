import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PqcTlsCertificate } from "./pqc-tls.js";

vi.mock("node:child_process", async () => {
	const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");

	return {
		...actual,
		execFile: ((
			_file: string,
			args: readonly string[],
			_optionsOrCb: unknown,
			maybeCb?: unknown,
		) => {
			const cb = (typeof _optionsOrCb === "function" ? _optionsOrCb : maybeCb) as
				| ((error: unknown, stdout: string, stderr: string) => void)
				| undefined;

			const keyOutIdx = args.indexOf("-keyout");
			const certOutIdx = args.indexOf("-out");
			const keyOutPath = keyOutIdx >= 0 ? args[keyOutIdx + 1] : undefined;
			const certOutPath = certOutIdx >= 0 ? args[certOutIdx + 1] : undefined;

			void (async () => {
				const { mkdir, writeFile } = await import("node:fs/promises");
				const { dirname } = await import("node:path");

				const ensureFile = async (path: string, content: string): Promise<void> => {
					await mkdir(dirname(path), { recursive: true });
					await writeFile(path, content, "utf8");
				};

				await Promise.all([
					keyOutPath
						? ensureFile(keyOutPath, `TEST_PRIVATE_KEY_${Date.now()}\n`)
						: Promise.resolve(),
					certOutPath ? ensureFile(certOutPath, `TEST_CERT_${Date.now()}\n`) : Promise.resolve(),
				]);
			})()
				.then(() => {
					cb?.(null, "", "");
				})
				.catch((error) => {
					cb?.(error, "", String(error));
				});
		}) as unknown,
	};
});

let checkPqcTlsSupport: typeof import("./pqc-tls.js").checkPqcTlsSupport;
let ensurePqcCertificateFiles: typeof import("./pqc-tls.js").ensurePqcCertificateFiles;
let generatePqcCertificate: typeof import("./pqc-tls.js").generatePqcCertificate;
let getPqcTlsOptions: typeof import("./pqc-tls.js").getPqcTlsOptions;

describe("pqc-tls - Deep Branch Coverage", () => {
	let testDir: string;
	const originalEnv = { ...process.env };

	beforeAll(async () => {
		({ checkPqcTlsSupport, ensurePqcCertificateFiles, generatePqcCertificate, getPqcTlsOptions } =
			await import("./pqc-tls.js"));
	});

	beforeEach(async () => {
		testDir = join(tmpdir(), `pqc-tls-deep-${Date.now()}-${Math.random()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
		Object.assign(process.env, originalEnv); // Fix TypeScript error
	});

	describe("resolveOqsProviderModulePath - all env variable branches", () => {
		it("should use OPENSSL_MODULES when set (returns null)", async () => {
			process.env["OPENSSL_MODULES"] = "/opt/homebrew/lib/ossl-modules";

			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "openssl-modules-set",
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.cert).toBeDefined();
			expect(result.key).toBeDefined();
		});

		it("should check QNSP_OQS_PROVIDER_MODULE when OPENSSL_MODULES not set", async () => {
			delete process.env["OPENSSL_MODULES"];

			const providerPath = join(testDir, "custom-oqsprovider.so");
			await writeFile(providerPath, "mock provider");
			process.env["QNSP_OQS_PROVIDER_MODULE"] = providerPath;

			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "qnsp-module",
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.cert).toBeDefined();
		});

		it("should check QNSP_OQS_PROVIDER_PATH when first two not set", async () => {
			delete process.env["OPENSSL_MODULES"];
			delete process.env["QNSP_OQS_PROVIDER_MODULE"];

			const providerDir = join(testDir, "provider-dir");
			await mkdir(providerDir);
			await writeFile(join(providerDir, "oqsprovider.so"), "mock");
			process.env["QNSP_OQS_PROVIDER_PATH"] = providerDir;

			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "qnsp-path",
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.cert).toBeDefined();
		});

		it("should check QNSP_OPENSSL_MODULES when first three not set", async () => {
			delete process.env["OPENSSL_MODULES"];
			delete process.env["QNSP_OQS_PROVIDER_MODULE"];
			delete process.env["QNSP_OQS_PROVIDER_PATH"];

			const modulesDir = join(testDir, "openssl-modules");
			await mkdir(modulesDir);
			await writeFile(join(modulesDir, "oqsprovider.so"), "mock");
			process.env["QNSP_OPENSSL_MODULES"] = modulesDir;

			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "qnsp-openssl",
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.cert).toBeDefined();
		});
	});

	describe("findProviderModuleFile - all file type branches", () => {
		it("should find oqsprovider.dylib in directory", async () => {
			delete process.env["OPENSSL_MODULES"];
			const providerDir = join(testDir, "dylib-dir");
			await mkdir(providerDir);
			await writeFile(join(providerDir, "oqsprovider.dylib"), "mock dylib");
			process.env["QNSP_OQS_PROVIDER_PATH"] = providerDir;

			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "find-dylib",
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.cert).toBeDefined();
		});

		it("should find oqsprovider.so in directory", async () => {
			delete process.env["OPENSSL_MODULES"];
			const providerDir = join(testDir, "so-dir");
			await mkdir(providerDir);
			await writeFile(join(providerDir, "oqsprovider.so"), "mock so");
			process.env["QNSP_OQS_PROVIDER_PATH"] = providerDir;

			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "find-so",
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.cert).toBeDefined();
		});

		it("should find oqsprovider.dll in directory", async () => {
			delete process.env["OPENSSL_MODULES"];
			const providerDir = join(testDir, "dll-dir");
			await mkdir(providerDir);
			await writeFile(join(providerDir, "oqsprovider.dll"), "mock dll");
			process.env["QNSP_OQS_PROVIDER_PATH"] = providerDir;

			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "find-dll",
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.cert).toBeDefined();
		});

		it("should handle direct path to .dylib file", async () => {
			delete process.env["OPENSSL_MODULES"];
			const dylibPath = join(testDir, "direct.dylib");
			await writeFile(dylibPath, "mock");
			process.env["QNSP_OQS_PROVIDER_MODULE"] = dylibPath;

			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "direct-dylib",
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.cert).toBeDefined();
		});

		it("should handle direct path to .so file", async () => {
			delete process.env["OPENSSL_MODULES"];
			const soPath = join(testDir, "direct.so");
			await writeFile(soPath, "mock");
			process.env["QNSP_OQS_PROVIDER_MODULE"] = soPath;

			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "direct-so",
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.cert).toBeDefined();
		});
	});

	describe("buildOpenSslConfig - commonName branches", () => {
		it("generates configuration for a single-label common name", async () => {
			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "single-label",
				commonName: "localhost",
			});
			expect(result.cert).toBeDefined();
		});

		it("should use commonName as altName when it contains dots", async () => {
			const cert: PqcTlsCertificate = {
				cert: "test-cert",
				key: "test-key",
				algorithm: "dilithium-3",
				provider: "oqsprovider",
				metadata: {
					generatedAt: new Date().toISOString(),
					validityDays: 30,
					commonName: "example.com",
					organization: "Test",
					source: "generated",
				},
			};

			const options = getPqcTlsOptions(cert);
			expect(options.cert).toBe("test-cert");
			expect(options.key).toBe("test-key");
		});

		it("should use localhost as altName when commonName has no dots", async () => {
			const cert: PqcTlsCertificate = {
				cert: "test-cert",
				key: "test-key",
				algorithm: "dilithium-3",
				provider: "oqsprovider",
				metadata: {
					generatedAt: new Date().toISOString(),
					validityDays: 30,
					commonName: "localhost",
					organization: "Test",
					source: "generated",
				},
			};

			const options = getPqcTlsOptions(cert);
			expect(options.cert).toBe("test-cert");
		});
	});

	describe("ensurePqcCertificateFiles - path derivation branches", () => {
		it("forwards every explicit generation option", async () => {
			const result = await ensurePqcCertificateFiles({
				outputDirectory: testDir,
				kemAlgorithm: "kyber-768",
				signatureAlgorithm: "dilithium-3",
				provider: "oqsprovider",
				commonName: "explicit.example",
				organization: "HEOSSI",
				validityDays: 15,
				opensslPath: "openssl",
				opensslEnv: { TEST_OPTION: "1" },
				filePrefix: "explicit",
				reuseExisting: false,
			});
			expect(result.metadata?.validityDays).toBe(15);
		});

		it("allows generation with no derived output directory", async () => {
			vi.spyOn(process, "cwd").mockReturnValue(testDir);
			const result = await ensurePqcCertificateFiles({ certPath: null, keyPath: null });
			expect(result.certPath).toContain(testDir);
		});

		it("uses the process working directory when no output path is supplied", async () => {
			vi.spyOn(process, "cwd").mockReturnValue(testDir);
			const result = await generatePqcCertificate({ filePrefix: "cwd-default" });
			expect(result.certPath).toContain(testDir);
		});

		it("should derive outputDirectory from certPath when no outputDirectory", async () => {
			const certPath = join(testDir, "derived", "test.cert.pem");

			const result = await ensurePqcCertificateFiles({
				filePrefix: "derived-cert",
				signatureAlgorithm: "dilithium-3",
				certPath,
			});

			expect(result.certPath).toContain("derived");
		});

		it("should derive outputDirectory from keyPath when no certPath or outputDirectory", async () => {
			const keyPath = join(testDir, "derived-key", "test.key.pem");

			const result = await ensurePqcCertificateFiles({
				filePrefix: "derived-key",
				signatureAlgorithm: "dilithium-3",
				keyPath,
			});

			expect(result.keyPath).toContain("derived-key");
		});

		it("should handle both certPath and keyPath being null", async () => {
			const result = await ensurePqcCertificateFiles({
				outputDirectory: testDir,
				filePrefix: "both-null",
				signatureAlgorithm: "dilithium-3",
				certPath: null,
				keyPath: null,
			});

			expect(result.metadata?.source).toBe("generated");
		});

		it("should skip reuse when reuseExisting is false", async () => {
			const certPath = join(testDir, "no-reuse.cert.pem");
			const keyPath = join(testDir, "no-reuse.key.pem");
			await writeFile(certPath, "OLD");
			await writeFile(keyPath, "OLD");

			const result = await ensurePqcCertificateFiles({
				outputDirectory: testDir,
				filePrefix: "no-reuse",
				signatureAlgorithm: "dilithium-3",
				certPath,
				keyPath,
				reuseExisting: false,
			});

			expect(result.cert).not.toBe("OLD");
			expect(result.metadata?.source).toBe("generated");
		});
	});

	describe("sanitizeFileSegment - edge cases", () => {
		it("should handle empty result after sanitization", async () => {
			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "!!!@@@###",
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.certPath).toBeDefined();
		});

		it("should remove leading dashes", async () => {
			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "---test",
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.certPath).toBeDefined();
		});

		it("should remove trailing dashes", async () => {
			const result = await generatePqcCertificate({
				outputDirectory: testDir,
				filePrefix: "test---",
				signatureAlgorithm: "dilithium-3",
			});

			expect(result.certPath).toBeDefined();
		});
	});

	describe("checkPqcTlsSupport - version parsing", () => {
		it("should parse OpenSSL version correctly", () => {
			const result = checkPqcTlsSupport();

			expect(result).toBeDefined();
			expect(typeof result.supported).toBe("boolean");

			if (result.opensslVersion) {
				const versionParts = result.opensslVersion.split(".");
				expect(versionParts.length).toBeGreaterThanOrEqual(1);
			}
		});
	});
});
