import { describe, expect, it } from "vitest";

import type { PqcTlsCertificate } from "./pqc-tls.js";
import {
	checkPqcTlsSupport,
	fileStatTimestamp,
	formatPqcTlsError,
	getPqcTlsOptions,
	normalizeOpenSslError,
} from "./pqc-tls.js";

describe("pqc-tls", () => {
	it("normalizes operational errors and missing stat evidence", async () => {
		expect(formatPqcTlsError(new Error("boom"))).toBe("boom");
		expect(formatPqcTlsError("offline")).toBe("offline");
		const stderrError = Object.assign(new Error("openssl failed"), { stderr: "provider missing" });
		expect(normalizeOpenSslError(stderrError)).toMatchObject({
			message: expect.stringContaining("provider missing"),
		});
		expect(normalizeOpenSslError("offline")).toBe("offline");
		await expect(fileStatTimestamp("/definitely/missing/qnsi-cert.pem")).resolves.toMatch(
			/^\d{4}-\d{2}-\d{2}T/,
		);
	});

	describe("checkPqcTlsSupport", () => {
		it("reports an unavailable OpenSSL runtime explicitly", () => {
			expect(checkPqcTlsSupport({})).toEqual({
				supported: false,
				message: "OpenSSL version not available",
			});
		});

		it("distinguishes pre-3 and OpenSSL 3 runtimes", () => {
			expect(checkPqcTlsSupport({ opensslVersion: "2.0.0" }).supported).toBe(false);
			expect(checkPqcTlsSupport({ opensslVersion: "3.5.0" }).supported).toBe(true);
		});

		it("should return support status based on OpenSSL version", () => {
			const result = checkPqcTlsSupport();

			expect(result).toHaveProperty("supported");
			expect(result).toHaveProperty("message");
			expect(typeof result.supported).toBe("boolean");
			expect(typeof result.message).toBe("string");

			if (result.opensslVersion) {
				expect(typeof result.opensslVersion).toBe("string");
				const major = parseInt(result.opensslVersion.split(".")[0] ?? "0", 10);
				expect(result.supported).toBe(major >= 3);
			}
		});

		it("should indicate lack of support when OpenSSL version is unavailable", () => {
			// This test documents the behavior when process.versions.openssl is undefined
			// In real Node.js environments, this is always defined, but we test the guard
			const result = checkPqcTlsSupport();

			if (!process.versions.openssl) {
				expect(result.supported).toBe(false);
				expect(result.message).toContain("not available");
			}
		});

		it("should provide appropriate message for OpenSSL 3.x", () => {
			const result = checkPqcTlsSupport();

			if (result.opensslVersion) {
				const major = parseInt(result.opensslVersion.split(".")[0] ?? "0", 10);
				if (major >= 3) {
					expect(result.message).toContain("may support PQC-TLS");
					expect(result.message).toContain("Verify PQC extension support");
				} else {
					expect(result.message).toContain("does not support PQC-TLS");
					expect(result.message).toContain("OpenSSL 3.x+ with PQC extensions required");
				}
			}
		});
	});

	describe("getPqcTlsOptions", () => {
		it("should return TLS 1.3 configuration with PQC-friendly ciphers", () => {
			const mockCert: PqcTlsCertificate = {
				cert: `TEST_CERT_${Date.now()}`,
				key: `TEST_PRIVATE_KEY_${Date.now()}`,
				algorithm: "dilithium-3",
				provider: "oqsprovider",
			};

			const options = getPqcTlsOptions(mockCert);

			expect(options.key).toBe(mockCert.key);
			expect(options.cert).toBe(mockCert.cert);
			expect(options.minVersion).toBe("TLSv1.3");
			expect(options.maxVersion).toBe("TLSv1.3");
			expect(options.ciphers).toContain("TLS_AES_256_GCM_SHA384");
			expect(options.ciphers).toContain("TLS_CHACHA20_POLY1305_SHA256");
			expect(options.ciphers).toContain("TLS_AES_128_GCM_SHA256");
		});

		it("should enforce TLS 1.3 only", () => {
			const mockCert: PqcTlsCertificate = {
				cert: "test-cert",
				key: "test-key",
				algorithm: "falcon-512",
				provider: "oqsprovider",
			};

			const options = getPqcTlsOptions(mockCert);

			expect(options.minVersion).toBe("TLSv1.3");
			expect(options.maxVersion).toBe("TLSv1.3");
		});

		it("should include certificate and key from input", () => {
			const testCert = `CUSTOM_CERT_${Date.now()}`;
			const testKey = `CUSTOM_PRIVATE_KEY_${Date.now()}`;

			const mockCert: PqcTlsCertificate = {
				cert: testCert,
				key: testKey,
				algorithm: "dilithium-5",
				provider: "oqsprovider",
			};

			const options = getPqcTlsOptions(mockCert);

			expect(options.cert).toBe(testCert);
			expect(options.key).toBe(testKey);
		});
	});
});
