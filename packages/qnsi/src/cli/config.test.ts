import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EXIT_CODES, loadConfig } from "./config.js";

describe("config", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("loadConfig", () => {
		/**
		 * DEFAULT TO PRODUCTION - this test previously asserted localhost, which was the bug.
		 *
		 * The CLI ships as the `qnsi` bin inside @heossihq/qnsi, the package every customer
		 * installs from npm. It defaulted every service URL to http://localhost:8095 etc., so
		 * a customer's very first command died with "fetch failed". Proven 2026-07-14. Every
		 * published CLI (aws, gh, stripe) defaults to production; local dev is the special
		 * case that sets an env var - and it still works, as the next test proves.
		 *
		 * The path must also NOT carry the service prefix: the edge gateway strips only
		 * `/proxy`, and every command already appends `/kms/v1/...`. It used to derive
		 * `/proxy/kms`, producing `/proxy/kms/kms/v1/keys` -> 404 for 8 of 11 command groups.
		 */
		it("defaults to PRODUCTION via the edge gateway, with no double service prefix", () => {
			const config = loadConfig();
			expect(config.edgeGatewayUrl).toBe("https://api.qnsi.heossi.com");
			expect(config.kmsServiceUrl).toBe("https://api.qnsi.heossi.com/proxy");
			expect(config.vaultServiceUrl).toBe("https://api.qnsi.heossi.com/proxy");
			expect(config.auditServiceUrl).toBe("https://api.qnsi.heossi.com/proxy");

			// storage and billing legitimately keep a prefix - their commands omit it.
			expect(config.storageServiceUrl).toBe("https://api.qnsi.heossi.com/proxy/storage");
			expect(config.billingServiceUrl).toBe("https://api.qnsi.heossi.com/proxy/billing");

			expect(config.outputFormat).toBe("table");
			expect(config.verbose).toBe(false);
		});

		it("local development still works - an explicit service URL always wins", () => {
			process.env["QNSI_KMS_SERVICE_URL"] = "http://localhost:8095";
			process.env["QNSI_VAULT_SERVICE_URL"] = "http://localhost:8090";
			const config = loadConfig();
			expect(config.kmsServiceUrl).toBe("http://localhost:8095");
			expect(config.vaultServiceUrl).toBe("http://localhost:8090");
		});

		it("should load configuration from environment variables", () => {
			process.env["QNSI_AUTH_SERVICE_URL"] = "https://auth.example.com";
			process.env["QNSI_SERVICE_ID"] = "test-service-id";
			process.env["QNSI_SERVICE_SECRET"] = "test-secret";
			process.env["QNSI_TENANT_ID"] = "test-tenant";
			process.env["QNSI_OUTPUT_FORMAT"] = "json";
			process.env["QNSI_VERBOSE"] = "true";

			const config = loadConfig();
			expect(config.authServiceUrl).toBe("https://auth.example.com");
			expect(config.serviceId).toBe("test-service-id");
			expect(config.serviceSecret).toBe("test-secret");
			expect(config.tenantId).toBe("test-tenant");
			expect(config.outputFormat).toBe("json");
			expect(config.verbose).toBe(true);
		});

		it("should allow overrides", () => {
			const config = loadConfig({
				authServiceUrl: "https://override.example.com",
				serviceId: "override-id",
				verbose: true,
			});
			expect(config.authServiceUrl).toBe("https://override.example.com");
			expect(config.serviceId).toBe("override-id");
			expect(config.verbose).toBe(true);
		});

		it("should prioritize overrides over environment variables", () => {
			process.env["QNSI_AUTH_SERVICE_URL"] = "https://env.example.com";
			const config = loadConfig({
				authServiceUrl: "https://override.example.com",
			});
			expect(config.authServiceUrl).toBe("https://override.example.com");
		});
	});

	describe("EXIT_CODES", () => {
		it("should define all exit codes", () => {
			expect(EXIT_CODES.SUCCESS).toBe(0);
			expect(EXIT_CODES.GENERAL_ERROR).toBe(1);
			expect(EXIT_CODES.INVALID_ARGUMENTS).toBe(2);
			expect(EXIT_CODES.AUTH_ERROR).toBe(3);
			expect(EXIT_CODES.AUTHORIZATION_ERROR).toBe(4);
			expect(EXIT_CODES.NOT_FOUND).toBe(5);
			expect(EXIT_CODES.RATE_LIMITED).toBe(6);
			expect(EXIT_CODES.NETWORK_ERROR).toBe(7);
		});
	});
});
