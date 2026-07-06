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
		it("should load default configuration", () => {
			const config = loadConfig();
			expect(config.authServiceUrl).toBe("http://localhost:8081");
			expect(config.kmsServiceUrl).toBe("http://localhost:8095");
			expect(config.vaultServiceUrl).toBe("http://localhost:8090");
			expect(config.auditServiceUrl).toBe("http://localhost:8103");
			expect(config.outputFormat).toBe("table");
			expect(config.verbose).toBe(false);
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
