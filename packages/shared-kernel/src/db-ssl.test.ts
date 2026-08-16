import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parsePostgresUrl, resolvePgSsl, resolvePgSslFromEnv } from "./db-ssl.js";

vi.mock("node:fs", () => ({
	readFileSync: vi.fn(),
}));

const mockReadFileSync = vi.mocked(readFileSync);

// Suppress diagnostic console.log output during tests (opt-in via DB_SSL_DIAGNOSTIC=1)
vi.spyOn(console, "log").mockImplementation(() => {});

describe("shared-kernel/db-ssl", () => {
	beforeEach(() => {
		mockReadFileSync.mockReset();
	});

	afterEach(() => {
		delete process.env["DATABASE_SSL_CA_PATH"];
		delete process.env["DB_SSL_DIAGNOSTIC"];
	});

	describe("resolvePgSsl", () => {
		it("returns false for disable mode", () => {
			expect(resolvePgSsl({ mode: "disable" })).toBe(false);
		});

		it("returns rejectUnauthorized=false for prefer mode (treated as require in Node pg)", () => {
			expect(resolvePgSsl({ mode: "prefer" })).toEqual({ rejectUnauthorized: false });
		});

		it("returns rejectUnauthorized=false for require mode", () => {
			expect(resolvePgSsl({ mode: "require" })).toEqual({ rejectUnauthorized: false });
		});

		it("returns rejectUnauthorized=false for no-verify mode", () => {
			expect(resolvePgSsl({ mode: "no-verify" })).toEqual({ rejectUnauthorized: false });
		});

		it("reads CA bundle and returns rejectUnauthorized=true for verify-full", () => {
			const fakeCa = "-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----";
			mockReadFileSync.mockReturnValueOnce(fakeCa);

			const result = resolvePgSsl({ mode: "verify-full", caPath: "/custom/ca.pem" });

			expect(mockReadFileSync).toHaveBeenCalledWith("/custom/ca.pem", "utf-8");
			expect(result).toEqual({ rejectUnauthorized: true, ca: fakeCa });
		});

		it("reads CA bundle for verify-ca with checkServerIdentity override", () => {
			const fakeCa = "-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----";
			mockReadFileSync.mockReturnValueOnce(fakeCa);

			const result = resolvePgSsl({ mode: "verify-ca", caPath: "/custom/ca.pem" });

			expect(result).toMatchObject({ rejectUnauthorized: true, ca: fakeCa });
			// verify-ca skips hostname verification - checkServerIdentity returns undefined
			expect(result).toHaveProperty("checkServerIdentity");
			const ssl = result as { checkServerIdentity: (host: string, cert: object) => undefined };
			expect(ssl.checkServerIdentity("any-host", {})).toBeUndefined();
		});

		it("verify-full does NOT include checkServerIdentity override", () => {
			const fakeCa = "-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----";
			mockReadFileSync.mockReturnValueOnce(fakeCa);

			const result = resolvePgSsl({ mode: "verify-full", caPath: "/custom/ca.pem" });

			expect(result).not.toHaveProperty("checkServerIdentity");
		});

		it("falls back to DATABASE_SSL_CA_PATH env var when no caPath provided", () => {
			const fakeCa = "-----BEGIN CERTIFICATE-----\nENV\n-----END CERTIFICATE-----";
			mockReadFileSync.mockReturnValueOnce(fakeCa);
			process.env["DATABASE_SSL_CA_PATH"] = "/env/ca.pem";

			const result = resolvePgSsl({ mode: "verify-full" });

			expect(mockReadFileSync).toHaveBeenCalledWith("/env/ca.pem", "utf-8");
			expect(result).toEqual({ rejectUnauthorized: true, ca: fakeCa });
		});

		it("falls back to default RDS CA path when no caPath or env var", () => {
			const fakeCa = "-----BEGIN CERTIFICATE-----\nRDS\n-----END CERTIFICATE-----";
			mockReadFileSync.mockReturnValueOnce(fakeCa);
			delete process.env["DATABASE_SSL_CA_PATH"];

			const result = resolvePgSsl({ mode: "verify-full" });

			expect(mockReadFileSync).toHaveBeenCalledWith("/etc/ssl/certs/rds-ca-bundle.pem", "utf-8");
			expect(result).toEqual({ rejectUnauthorized: true, ca: fakeCa });
		});

		it("throws if CA bundle file is missing for verify-full", () => {
			mockReadFileSync.mockImplementationOnce(() => {
				throw new Error("ENOENT: no such file or directory");
			});

			expect(() => resolvePgSsl({ mode: "verify-full", caPath: "/missing/ca.pem" })).toThrow(
				/sslmode=verify-full requires CA bundle at \/missing\/ca\.pem/,
			);
		});

		it("throws if CA bundle file is missing for verify-ca", () => {
			mockReadFileSync.mockImplementationOnce(() => {
				throw new Error("ENOENT: no such file or directory");
			});

			expect(() => resolvePgSsl({ mode: "verify-ca", caPath: "/missing/ca.pem" })).toThrow(
				/sslmode=verify-ca requires CA bundle at \/missing\/ca\.pem/,
			);
		});

		it("throws for unknown/unsupported sslmode (fail closed)", () => {
			expect(() => resolvePgSsl({ mode: "something-unknown" as "require" })).toThrow(
				/\[db-ssl\] unsupported sslmode="something-unknown"/,
			);
		});
	});

	describe("IP-host guard", () => {
		it("throws for IPv4 hostname with verify-full", () => {
			expect(() =>
				resolvePgSsl({ mode: "verify-full", caPath: "/ca.pem", hostname: "10.0.0.1" }),
			).toThrow(/sslmode=verify-full requires a DNS hostname, not an IP address/);
		});

		it("throws for IPv6 hostname with verify-full", () => {
			expect(() =>
				resolvePgSsl({ mode: "verify-full", caPath: "/ca.pem", hostname: "::1" }),
			).toThrow(/sslmode=verify-full requires a DNS hostname, not an IP address/);
		});

		it("throws for IPv4 hostname with verify-ca", () => {
			expect(() =>
				resolvePgSsl({ mode: "verify-ca", caPath: "/ca.pem", hostname: "192.168.1.1" }),
			).toThrow(/sslmode=verify-ca requires a DNS hostname, not an IP address/);
		});

		it("allows DNS hostname with verify-full", () => {
			const fakeCa = "-----BEGIN CERTIFICATE-----\nDNS\n-----END CERTIFICATE-----";
			mockReadFileSync.mockReturnValueOnce(fakeCa);

			const result = resolvePgSsl({
				mode: "verify-full",
				caPath: "/ca.pem",
				hostname: "mydb.xxxx.us-east-1.rds.amazonaws.com",
			});

			expect(result).toEqual({ rejectUnauthorized: true, ca: fakeCa });
		});

		it("allows DNS hostname with verify-ca", () => {
			const fakeCa = "-----BEGIN CERTIFICATE-----\nDNS\n-----END CERTIFICATE-----";
			mockReadFileSync.mockReturnValueOnce(fakeCa);

			const result = resolvePgSsl({
				mode: "verify-ca",
				caPath: "/ca.pem",
				hostname: "mydb.xxxx.us-east-1.rds.amazonaws.com",
			});

			expect(result).toMatchObject({ rejectUnauthorized: true, ca: fakeCa });
		});

		it("skips IP guard when hostname is not provided", () => {
			const fakeCa = "-----BEGIN CERTIFICATE-----\nNOHOST\n-----END CERTIFICATE-----";
			mockReadFileSync.mockReturnValueOnce(fakeCa);

			// No hostname - IP guard is skipped, caller is responsible
			const result = resolvePgSsl({ mode: "verify-full", caPath: "/ca.pem" });

			expect(result).toEqual({ rejectUnauthorized: true, ca: fakeCa });
		});

		it("does not apply IP guard for require mode", () => {
			// IP hostnames are fine for non-verifying modes
			const result = resolvePgSsl({ mode: "require", hostname: "10.0.0.1" });
			expect(result).toEqual({ rejectUnauthorized: false });
		});
	});

	describe("parsePostgresUrl", () => {
		it("parses URL with sslmode=verify-full and sslrootcert", () => {
			const fakeCa = "-----BEGIN CERTIFICATE-----\nPARSED\n-----END CERTIFICATE-----";
			mockReadFileSync.mockReturnValueOnce(fakeCa);

			const result = parsePostgresUrl(
				"postgresql://user:pass@mydb.rds.amazonaws.com:5432/db?sslmode=verify-full&sslrootcert=/custom/ca.pem",
			);

			expect(result.ssl).toEqual({ rejectUnauthorized: true, ca: fakeCa });
			// sslmode and sslrootcert should be stripped from the connection string
			expect(result.connectionString).not.toContain("sslmode");
			expect(result.connectionString).not.toContain("sslrootcert");
			expect(result.connectionString).toContain(
				"postgresql://user:pass@mydb.rds.amazonaws.com:5432/db",
			);
		});

		it("parses URL with sslmode=disable", () => {
			const result = parsePostgresUrl("postgresql://user:pass@host:5432/db?sslmode=disable");

			expect(result.ssl).toBe(false);
			expect(result.connectionString).not.toContain("sslmode");
		});

		it("parses URL with sslmode=no-verify", () => {
			const result = parsePostgresUrl("postgresql://user:pass@host:5432/db?sslmode=no-verify");

			expect(result.ssl).toEqual({ rejectUnauthorized: false });
		});

		it("parses URL with sslmode=require", () => {
			const result = parsePostgresUrl("postgresql://user:pass@host:5432/db?sslmode=require");

			expect(result.ssl).toEqual({ rejectUnauthorized: false });
		});

		it("defaults to prefer (treated as require) when no sslmode in URL", () => {
			const result = parsePostgresUrl("postgresql://user:pass@host:5432/db");

			expect(result.ssl).toEqual({ rejectUnauthorized: false });
		});

		it("preserves other query parameters", () => {
			const result = parsePostgresUrl(
				"postgresql://user:pass@host:5432/db?sslmode=disable&application_name=test",
			);

			expect(result.connectionString).toContain("application_name=test");
			expect(result.connectionString).not.toContain("sslmode");
		});

		it("rejects IP-literal hostname with verify-full", () => {
			expect(() =>
				parsePostgresUrl(
					"postgresql://user:pass@10.0.0.1:5432/db?sslmode=verify-full&sslrootcert=/ca.pem",
				),
			).toThrow(/sslmode=verify-full requires a DNS hostname, not an IP address/);
		});
	});

	describe("resolvePgSslFromEnv", () => {
		it("resolves disable mode", () => {
			expect(resolvePgSslFromEnv("disable")).toBe(false);
		});

		it("resolves require mode", () => {
			expect(resolvePgSslFromEnv("require")).toEqual({ rejectUnauthorized: false });
		});

		it("resolves verify-full with CA path", () => {
			const fakeCa = "-----BEGIN CERTIFICATE-----\nENV\n-----END CERTIFICATE-----";
			mockReadFileSync.mockReturnValueOnce(fakeCa);

			const result = resolvePgSslFromEnv("verify-full", "/custom/ca.pem");

			expect(result).toEqual({ rejectUnauthorized: true, ca: fakeCa });
		});

		it("normalizes off/false/0 to disable", () => {
			expect(resolvePgSslFromEnv("off")).toBe(false);
			expect(resolvePgSslFromEnv("false")).toBe(false);
			expect(resolvePgSslFromEnv("0")).toBe(false);
		});

		it("throws for unknown/unsupported values (fail closed)", () => {
			expect(() => resolvePgSslFromEnv("something-random")).toThrow(
				/\[db-ssl\] unsupported sslmode="something-random"/,
			);
		});

		it("is case-insensitive", () => {
			expect(resolvePgSslFromEnv("DISABLE")).toBe(false);
			expect(resolvePgSslFromEnv("Require")).toEqual({ rejectUnauthorized: false });
		});

		it("trims whitespace", () => {
			expect(resolvePgSslFromEnv("  disable  ")).toBe(false);
		});

		it("rejects IP-literal dbHost with verify-full", () => {
			expect(() => resolvePgSslFromEnv("verify-full", "/ca.pem", "10.0.0.1")).toThrow(
				/sslmode=verify-full requires a DNS hostname, not an IP address/,
			);
		});

		it("normalizes prefer and no-verify to SSL without verification", () => {
			expect(resolvePgSslFromEnv("prefer")).toEqual({ rejectUnauthorized: false });
			expect(resolvePgSslFromEnv("no-verify")).toEqual({ rejectUnauthorized: false });
		});

		it("normalizes verify-ca and reads the CA bundle", () => {
			const fakeCa = "-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----";
			mockReadFileSync.mockReturnValueOnce(fakeCa);

			const result = resolvePgSslFromEnv("verify-ca", "/custom/ca.pem", "db.example.com");

			expect(result).toMatchObject({ rejectUnauthorized: true, ca: fakeCa });
		});

		it("stringifies non-Error throws from the CA bundle read", () => {
			mockReadFileSync.mockImplementationOnce(() => {
				throw "raw fs failure";
			});

			expect(() => resolvePgSslFromEnv("verify-full", "/custom/ca.pem")).toThrow(
				/could not be read: raw fs failure/,
			);
		});
	});

	describe("logSslDiagnostic (opt-in via DB_SSL_DIAGNOSTIC)", () => {
		it("does not log when DB_SSL_DIAGNOSTIC is not set", () => {
			const logSpy = vi.mocked(console.log);
			logSpy.mockClear();

			parsePostgresUrl("postgresql://user:pass@host:5432/db?sslmode=disable");

			expect(logSpy).not.toHaveBeenCalled();
		});

		it("logs when DB_SSL_DIAGNOSTIC=1", () => {
			process.env["DB_SSL_DIAGNOSTIC"] = "1";
			const logSpy = vi.mocked(console.log);
			logSpy.mockClear();

			parsePostgresUrl("postgresql://user:pass@host:5432/db?sslmode=disable");

			expect(logSpy).toHaveBeenCalledWith("[db-ssl] host=host sslmode=disable ca_configured=false");
		});

		it("does not log when DB_SSL_DIAGNOSTIC=0", () => {
			process.env["DB_SSL_DIAGNOSTIC"] = "0";
			const logSpy = vi.mocked(console.log);
			logSpy.mockClear();

			parsePostgresUrl("postgresql://user:pass@host:5432/db?sslmode=disable");

			expect(logSpy).not.toHaveBeenCalled();
		});
	});
});
