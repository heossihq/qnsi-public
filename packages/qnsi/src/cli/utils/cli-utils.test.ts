import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockConfig, setupTestEnvironment, type TestEnvironment } from "../commands/test-utils.js";
import { EXIT_CODES } from "../config.js";
import { AuditLogger } from "./audit-logger.js";
import { handleBackendError, parseRateLimitHeaders, warnIfLowQuota } from "./backend-validator.js";
import { fetchWithBackendHandling } from "./fetcher.js";
import { isLocalhostUrl, validateAllServiceUrls, validateHttpsUrl } from "./https-validator.js";
import {
	APPROVED_PQC_ALGORITHMS,
	getDefaultSecurityProfile,
	getRecommendedPqcAlgorithm,
	validatePqcAlgorithm,
	validateSecurityProfile,
} from "./pqc-validator.js";
import { RateLimitError, RateLimiter } from "./rate-limiter.js";
import { sanitizeHeaders, sanitizeOutput } from "./sanitize.js";
import { getRecommendedSecurityHeaders, validateSecurityHeaders } from "./security-headers.js";

let env: TestEnvironment;

beforeEach(() => {
	env = setupTestEnvironment();
});

afterEach(() => {
	env.cleanup();
	vi.unstubAllEnvs();
});

describe("pqc-validator", () => {
	it("accepts every approved algorithm and rejects unknown or cross-family names", () => {
		for (const algorithm of APPROVED_PQC_ALGORITHMS.signature) {
			expect(validatePqcAlgorithm(algorithm, "signature")).toBe(true);
		}
		for (const algorithm of APPROVED_PQC_ALGORITHMS.kem) {
			expect(validatePqcAlgorithm(algorithm, "kem")).toBe(true);
		}
		expect(validatePqcAlgorithm("rsa-2048", "signature")).toBe(false);
		expect(validatePqcAlgorithm("dilithium-3", "kem")).toBe(false);
	});

	it("recommends by security level for both families", () => {
		expect(getRecommendedPqcAlgorithm(1, "signature")).toBe("dilithium-2");
		expect(getRecommendedPqcAlgorithm(3, "signature")).toBe("dilithium-3");
		expect(getRecommendedPqcAlgorithm(5, "signature")).toBe("dilithium-5");
		expect(getRecommendedPqcAlgorithm(1, "kem")).toBe("kyber-512");
		expect(getRecommendedPqcAlgorithm(3, "kem")).toBe("kyber-768");
		expect(getRecommendedPqcAlgorithm(5, "kem")).toBe("kyber-1024");
	});

	it("default profile validates cleanly; invalid fields produce named errors", () => {
		expect(validateSecurityProfile(getDefaultSecurityProfile())).toEqual([]);
		const errors = validateSecurityProfile({
			signatureAlgorithm: "rsa-2048" as never,
			kemAlgorithm: "x25519" as never,
			securityLevel: 2 as never,
		});
		expect(errors).toHaveLength(3);
		expect(errors.join(" ")).toContain("Invalid signature algorithm: rsa-2048");
		expect(errors.join(" ")).toContain("Invalid KEM algorithm: x25519");
		expect(errors.join(" ")).toContain("Invalid security level: 2");
	});
});

describe("sanitize", () => {
	it("redacts bearer tokens, JSON secrets, and header-style values", () => {
		expect(sanitizeOutput("Authorization: Bearer abc.def-123")).toContain("[REDACTED]");
		const redactedToken = sanitizeOutput('{"accessToken":"secret-token-value"}');
		expect(redactedToken).not.toContain("secret-token-value");
		expect(redactedToken).toContain("[REDACTED]");
		expect(sanitizeOutput('{"password":"hunter2"}')).not.toContain("hunter2");
		expect(sanitizeOutput("x-api-key: qnsi_pqc_api_12345")).toContain("[REDACTED]");
		expect(sanitizeOutput("Bearer standalone-token")).toBe("Bearer [REDACTED]");
		expect(sanitizeOutput("no secrets here")).toBe("no secrets here");
	});

	it("redacts sensitive header names case-insensitively and keeps the rest", () => {
		const sanitized = sanitizeHeaders({
			Authorization: "Bearer tok",
			"X-Api-Key": "key",
			"X-Refresh-Token": "tok2",
			"client-secret": "s",
			Password: "p",
			Accept: "application/json",
		});
		expect(sanitized["Authorization"]).toBe("[REDACTED]");
		expect(sanitized["X-Api-Key"]).toBe("[REDACTED]");
		expect(sanitized["X-Refresh-Token"]).toBe("[REDACTED]");
		expect(sanitized["client-secret"]).toBe("[REDACTED]");
		expect(sanitized["Password"]).toBe("[REDACTED]");
		expect(sanitized["Accept"]).toBe("application/json");
	});
});

describe("security-headers", () => {
	it("recommends the full header set and validates a compliant response", () => {
		const recommended = getRecommendedSecurityHeaders();
		expect(Object.keys(recommended)).toHaveLength(7);
		const result = validateSecurityHeaders(recommended as Record<string, string>);
		expect(result).toEqual({ missing: [], weak: [] });
	});

	it("reports missing and weak headers", () => {
		const result = validateSecurityHeaders({
			"Strict-Transport-Security": "includeSubDomains",
			"Content-Security-Policy": "default-src *",
		});
		expect(result.missing).toContain("X-Content-Type-Options");
		expect(result.missing).toContain("X-Frame-Options");
		expect(result.weak).toEqual(
			expect.arrayContaining([
				{ header: "Strict-Transport-Security", issue: "Missing max-age directive" },
				{ header: "Content-Security-Policy", issue: "Too permissive - allows all sources" },
			]),
		);
	});
});

describe("rate-limiter", () => {
	it("admits requests, warns at 80%, and fails closed at the cap with retry info", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const limiter = new RateLimiter(5, 60_000);
		for (let i = 0; i < 4; i++) {
			await limiter.checkLimit();
		}
		// The 80% warning triggers on the request that begins with 4/5 used.
		expect(warn).not.toHaveBeenCalled();
		await limiter.checkLimit();
		expect(warn).toHaveBeenCalledOnce();

		const error = await limiter.checkLimit().catch((e: unknown) => e);
		expect(error).toBeInstanceOf(RateLimitError);
		expect((error as RateLimitError).retryAfterMs).toBeGreaterThan(0);
		expect(limiter.getRemaining()).toBe(0);

		limiter.reset();
		expect(limiter.getRemaining()).toBe(5);
		await expect(limiter.checkLimit()).resolves.toBeUndefined();
	});

	it("expires window entries so old requests stop counting", async () => {
		vi.useFakeTimers();
		try {
			const limiter = new RateLimiter(2, 1_000);
			await limiter.checkLimit();
			await limiter.checkLimit();
			await expect(limiter.checkLimit()).rejects.toBeInstanceOf(RateLimitError);
			vi.advanceTimersByTime(1_001);
			expect(limiter.getRemaining()).toBe(2);
			await expect(limiter.checkLimit()).resolves.toBeUndefined();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("audit-logger", () => {
	it("does nothing when QNSI_CLI_AUDIT_LOGGING is not enabled", async () => {
		const logger = new AuditLogger(mockConfig);
		await logger.log({ action: "cli.test", actor: "svc", result: "success" });
		expect(env.mockFetch).not.toHaveBeenCalled();
	});

	it("posts entries to the audit service when enabled and reports failures", async () => {
		vi.stubEnv("QNSI_CLI_AUDIT_LOGGING", "true");
		env.mockFetch.mockResolvedValueOnce({ ok: true, status: 202 });
		const logger = new AuditLogger(mockConfig);
		await logger.logCommand("kms:list", ["--limit", "5"], "success", { extra: 1 });
		const [url, init] = env.mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(`${mockConfig.auditServiceUrl}/audit/v1/events`);
		const body = JSON.parse(init.body as string);
		expect(body).toMatchObject({
			topic: "cli.operation",
			sourceService: "qnsp-cli",
			action: "cli.kms:list",
			actor: mockConfig.serviceId,
			resource: "--limit 5",
			result: "success",
		});

		env.mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
		await logger.log({ action: "cli.test", actor: "svc", result: "failure" });
		expect(env.mockError).toHaveBeenCalledWith("Failed to log audit event: 500");

		env.mockFetch.mockRejectedValueOnce(new Error("network down"));
		await logger.log({ action: "cli.test", actor: "svc", result: "failure" });
		expect(env.mockError).toHaveBeenCalledWith("Audit logging failed:", "network down");

		env.mockFetch.mockRejectedValueOnce("raw failure");
		await logger.log({ action: "cli.test", actor: "svc", result: "failure" });
		expect(env.mockError).toHaveBeenCalledWith("Audit logging failed:", "Unknown error");
	});

	it("defaults missing tenant and service identity fields", async () => {
		vi.stubEnv("QNSI_CLI_AUDIT_LOGGING", "true");
		env.mockFetch.mockResolvedValueOnce({ ok: true, status: 202 });
		const logger = new AuditLogger({ ...mockConfig, tenantId: null, serviceId: null });
		await logger.logCommand("vault:list", [], "success");
		const [, init] = env.mockFetch.mock.calls[0] as [string, RequestInit];
		expect((init.headers as Record<string, string>)["x-qnsp-tenant"]).toBe("");
		expect(JSON.parse(init.body as string)).toMatchObject({ actor: "unknown" });
	});
});

describe("https-validator", () => {
	it("classifies localhost forms and malformed urls", () => {
		expect(isLocalhostUrl("http://localhost:8081")).toBe(true);
		expect(isLocalhostUrl("http://127.0.0.1:8081")).toBe(true);
		expect(isLocalhostUrl("http://[::1]:8081")).toBe(true);
		expect(isLocalhostUrl("http://auth.qnsp.local")).toBe(true);
		expect(isLocalhostUrl("http://example.com")).toBe(false);
		expect(isLocalhostUrl("not a url")).toBe(false);
	});

	it("exits for plain http in production and warns for non-local http otherwise", () => {
		validateHttpsUrl("http://api.example.com", "Auth service URL", "production");
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.INVALID_ARGUMENTS);

		env.mockError.mockClear();
		validateHttpsUrl("http://api.example.com", "Auth service URL", "staging");
		expect(env.mockError.mock.calls.join(" ")).toContain("unencrypted HTTP");

		env.mockError.mockClear();
		validateHttpsUrl("http://localhost:8081", "Auth service URL", "staging");
		validateHttpsUrl("https://api.example.com", "Auth service URL", "production");
		expect(env.mockError).not.toHaveBeenCalled();
	});

	it("validates all four service urls using NODE_ENV", () => {
		process.env["NODE_ENV"] = "development";
		validateAllServiceUrls({
			authServiceUrl: "http://localhost:8081",
			kmsServiceUrl: "http://localhost:8095",
			vaultServiceUrl: "http://localhost:8090",
			auditServiceUrl: "http://localhost:8103",
		});
		expect(env.mockExit).not.toHaveBeenCalled();

		delete process.env["NODE_ENV"];
		validateAllServiceUrls({
			authServiceUrl: "http://api.example.com",
			kmsServiceUrl: "https://kms.example.com",
			vaultServiceUrl: "https://vault.example.com",
			auditServiceUrl: "https://audit.example.com",
		});
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.INVALID_ARGUMENTS);
	});
});

describe("backend-validator", () => {
	function respond(status: number): Response {
		return { status, ok: false } as unknown as Response;
	}

	it("maps 429 to the rate-limited exit with tier guidance", () => {
		handleBackendError(respond(429), {
			error: "rate_limited",
			message: "slow down",
			statusCode: 429,
			tier: "free",
			limit: 60,
			remaining: 0,
			retryAfter: 30,
		});
		expect(env.mockError.mock.calls.join(" ")).toContain("Rate limit exceeded");
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.RATE_LIMITED);
	});

	it("fills placeholder values when the 429 body omits limit details", () => {
		handleBackendError(respond(429), { error: "rate_limited", message: "", statusCode: 429 });
		const output = env.mockError.mock.calls.join(" ");
		expect(output).toContain("(unknown)");
		expect(output).toContain("Limit: N/A");
		expect(output).toContain("Retry after: 60s");
	});

	it("maps 402, 403 with and without add-ons, 507, and unknown statuses", () => {
		handleBackendError(respond(402), {
			error: "payment",
			message: "paid feature",
			statusCode: 402,
			requiredAddOn: "byohsm",
		});
		expect(env.mockError.mock.calls.join(" ")).toContain("Required: byohsm");
		handleBackendError(respond(402), { error: "payment", message: "bare", statusCode: 402 });
		expect(env.mockError.mock.calls.join(" ")).toContain("Required: unknown");
		handleBackendError(respond(402), {
			error: "payment",
			message: "paid feature",
			statusCode: 402,
			requiredTier: "dev-pro",
		});
		expect(env.mockError.mock.calls.join(" ")).toContain("Payment required");
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.AUTHORIZATION_ERROR);

		handleBackendError(respond(403), {
			error: "forbidden",
			message: "addon needed",
			statusCode: 403,
			requiredAddOn: "code-scan",
		});
		expect(env.mockError.mock.calls.join(" ")).toContain('requires the "code-scan" add-on');

		handleBackendError(respond(403), {
			error: "forbidden",
			message: "tier too low",
			statusCode: 403,
		});
		expect(env.mockError.mock.calls.join(" ")).toContain("Access denied");

		handleBackendError(respond(507), {
			error: "quota",
			message: "storage full",
			statusCode: 507,
			tier: "free",
		});
		expect(env.mockError.mock.calls.join(" ")).toContain("Quota exceeded");

		handleBackendError(respond(500), { error: "boom", message: "", statusCode: 500 });
		expect(env.mockError.mock.calls.join(" ")).toContain("Backend error (500)");
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.GENERAL_ERROR);
	});

	it("parses rate-limit headers and warns only below ten percent quota", () => {
		const headers = new Headers({
			"x-ratelimit-limit": "100",
			"x-ratelimit-remaining": "5",
			"x-ratelimit-reset": "1700000000",
		});
		expect(parseRateLimitHeaders(headers)).toEqual({
			limit: 100,
			remaining: 5,
			reset: 1_700_000_000,
		});
		expect(parseRateLimitHeaders(new Headers())).toEqual({
			limit: null,
			remaining: null,
			reset: null,
		});

		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		warnIfLowQuota(5, 100);
		expect(warn).toHaveBeenCalledOnce();
		warn.mockClear();
		warnIfLowQuota(50, 100);
		warnIfLowQuota(null, 100);
		warnIfLowQuota(5, null);
		expect(warn).not.toHaveBeenCalled();
	});
});

describe("fetchWithBackendHandling", () => {
	it("passes successful responses through and surfaces low-quota warnings", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		env.mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers({ "x-ratelimit-limit": "100", "x-ratelimit-remaining": "2" }),
		});
		const response = await fetchWithBackendHandling(mockConfig, "https://svc/x");
		expect(response.status).toBe(200);
		expect(warn).toHaveBeenCalledOnce();
	});

	it("routes enforcement statuses through handleBackendError, parsing JSON or wrapping text", async () => {
		env.mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 429,
			headers: new Headers(),
			clone() {
				return { text: async () => JSON.stringify({ message: "limited", tier: "free" }) };
			},
		});
		await fetchWithBackendHandling(mockConfig, "https://svc/x");
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.RATE_LIMITED);

		env.mockExit.mockClear();
		env.mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 507,
			headers: new Headers(),
			text: async () => "plain text overflow",
		});
		await fetchWithBackendHandling(mockConfig, "https://svc/x");
		expect(env.mockError.mock.calls.join(" ")).toContain("plain text overflow");
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.GENERAL_ERROR);
	});

	it("ignores responses without standard headers", async () => {
		env.mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
		await expect(fetchWithBackendHandling(mockConfig, "https://svc/x")).resolves.toMatchObject({
			status: 200,
		});
	});
});
