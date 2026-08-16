import type { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockConfig, setupTestEnvironment, type TestEnvironment } from "../commands/test-utils.js";
import { EXIT_CODES } from "../config.js";
import { getAuthHeaders, requestServiceToken, resolveApiKeyTenant } from "./auth.js";
import { getEffectiveConfig } from "./command-config.js";
import { promptForConfirmation, promptForInput, promptForSecret } from "./prompt.js";
import { RateLimiter } from "./rate-limiter.js";
import { getCachedToken, setCachedToken } from "./token-cache.js";

vi.mock("node:readline", () => ({
	createInterface: vi.fn(() => ({
		question: (_prompt: string, cb: (answer: string) => void) => cb("  typed-answer  "),
		close: vi.fn(),
	})),
}));

let env: TestEnvironment;

beforeEach(() => {
	env = setupTestEnvironment();
});

afterEach(() => {
	env.cleanup();
});

describe("prompt", () => {
	it("trims answers from secret and input prompts", async () => {
		expect(await promptForSecret()).toBe("typed-answer");
		expect(await promptForInput("Name: ")).toBe("typed-answer");
	});

	it("confirmation accepts y and yes case-insensitively and denies the rest", async () => {
		const readline = await import("node:readline");
		const answers = ["y", "YES", "n", ""];
		vi.mocked(readline.createInterface).mockImplementation(
			() =>
				({
					question: (_prompt: string, cb: (answer: string) => void) => cb(answers.shift() ?? ""),
					close: vi.fn(),
				}) as never,
		);
		expect(await promptForConfirmation("Proceed?")).toBe(true);
		expect(await promptForConfirmation("Proceed?")).toBe(true);
		expect(await promptForConfirmation("Proceed?")).toBe(false);
		expect(await promptForConfirmation("Proceed?")).toBe(false);
	});
});

describe("token-cache", () => {
	it("serves cached tokens inside the TTL and evicts expired entries", () => {
		vi.useFakeTimers();
		try {
			setCachedToken("svc-ttl", "tok-1");
			expect(getCachedToken("svc-ttl")).toBe("tok-1");
			vi.advanceTimersByTime(3_600_001);
			expect(getCachedToken("svc-ttl")).toBeNull();
			// The expired entry was evicted, not just skipped.
			expect(getCachedToken("svc-ttl")).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("requestServiceToken", () => {
	function tokenResponse() {
		return {
			ok: true,
			status: 200,
			headers: new Headers(),
			json: async () => ({ accessToken: "svc-token-1" }),
		};
	}

	it("requires a service id", async () => {
		await requestServiceToken({ ...mockConfig, serviceId: null });
		expect(env.mockError.mock.calls.join(" ")).toContain("QNSI_SERVICE_ID must be set");
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.AUTH_ERROR);
	});

	it("mints, caches, and reuses tokens per service id", async () => {
		env.mockFetch.mockResolvedValue(tokenResponse());
		const first = await requestServiceToken({ ...mockConfig, serviceId: "svc-mint-1" });
		expect(first).toBe("svc-token-1");
		const [url, init] = env.mockFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(`${mockConfig.authServiceUrl}/auth/service-token`);
		expect(JSON.parse(init.body as string)).toEqual({
			serviceId: "svc-mint-1",
			audience: "internal-service",
		});

		env.mockFetch.mockClear();
		const second = await requestServiceToken({ ...mockConfig, serviceId: "svc-mint-1" });
		expect(second).toBe("svc-token-1");
		expect(env.mockFetch).not.toHaveBeenCalled();
	});

	it("prompts for the secret on a TTY and fails closed off-TTY", async () => {
		const readline = await import("node:readline");
		vi.mocked(readline.createInterface).mockImplementation(
			() =>
				({
					question: (_prompt: string, cb: (answer: string) => void) => cb("typed-answer"),
					close: vi.fn(),
				}) as never,
		);
		Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
		env.mockFetch.mockResolvedValue(tokenResponse());
		const token = await requestServiceToken({
			...mockConfig,
			serviceId: "svc-tty-1",
			serviceSecret: null,
		});
		expect(token).toBe("svc-token-1");
		const [, init] = env.mockFetch.mock.calls[0] as [string, RequestInit];
		expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer typed-answer");

		Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
		await requestServiceToken({ ...mockConfig, serviceId: "svc-no-tty", serviceSecret: null });
		expect(env.mockError.mock.calls.join(" ")).toContain("QNSI_SERVICE_SECRET must be set");
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.AUTH_ERROR);
	});

	it("exits RATE_LIMITED when the defensive limiter trips and rethrows other limiter errors", async () => {
		const { RateLimitError } = await import("./rate-limiter.js");
		vi.spyOn(RateLimiter.prototype, "checkLimit").mockRejectedValueOnce(
			new RateLimitError("limit hit", 1_000),
		);
		// process.exit is a no-op under test, so control continues to the rethrow;
		// production stops at the exit. Assert both the exit code and the error.
		await expect(
			requestServiceToken({ ...mockConfig, serviceId: "svc-limited" }),
		).rejects.toBeInstanceOf(RateLimitError);
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.RATE_LIMITED);

		vi.spyOn(RateLimiter.prototype, "checkLimit").mockRejectedValueOnce(
			new Error("unexpected limiter fault"),
		);
		await expect(
			requestServiceToken({ ...mockConfig, serviceId: "svc-limiter-fault" }),
		).rejects.toThrow("unexpected limiter fault");
	});

	it("routes enforcement statuses through the backend handler and other failures to AUTH_ERROR", async () => {
		env.mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 429,
			headers: new Headers(),
			text: async () => JSON.stringify({ message: "limited", tier: "free" }),
		});
		await requestServiceToken({ ...mockConfig, serviceId: "svc-enforced" });
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.RATE_LIMITED);

		env.mockExit.mockClear();
		env.mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			headers: new Headers(),
			text: async () => "internal error",
		});
		await requestServiceToken({ ...mockConfig, serviceId: "svc-500" });
		expect(env.mockError.mock.calls.join(" ")).toContain("Failed to get service token: 500");
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.AUTH_ERROR);
	});

	it("maps network failures to NETWORK_ERROR, for Error and non-Error causes", async () => {
		env.mockFetch.mockRejectedValueOnce(new Error("connection refused"));
		await requestServiceToken({ ...mockConfig, serviceId: "svc-neterr" });
		expect(env.mockError.mock.calls.join(" ")).toContain("Network error: connection refused");
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.NETWORK_ERROR);

		env.mockFetch.mockRejectedValueOnce("raw failure");
		await requestServiceToken({ ...mockConfig, serviceId: "svc-neterr-raw" });
		expect(env.mockError.mock.calls.join(" ")).toContain("Network error: Unknown error");
	});
});

describe("resolveApiKeyTenant and getAuthHeaders", () => {
	const TENANT = "22222222-2222-4222-8222-222222222222";

	it("returns null without a key, honors explicit tenants, and caches resolutions", async () => {
		expect(await resolveApiKeyTenant({ ...mockConfig, apiKey: null })).toBeNull();
		expect(
			await resolveApiKeyTenant({ ...mockConfig, apiKey: "k1", tenantId: "explicit-tenant" }),
		).toBe("explicit-tenant");

		env.mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ tenantId: TENANT }),
		});
		const key = `resolve-key-${Date.now()}`;
		const resolved = await resolveApiKeyTenant({ ...mockConfig, apiKey: key, tenantId: null });
		expect(resolved).toBe(TENANT);
		expect((env.mockFetch.mock.calls[0] as [string])[0]).toBe(
			"https://api.qnsi.heossi.com/proxy/billing/v1/sdk/activate",
		);

		env.mockFetch.mockClear();
		expect(await resolveApiKeyTenant({ ...mockConfig, apiKey: key, tenantId: null })).toBe(TENANT);
		expect(env.mockFetch).not.toHaveBeenCalled();
	});

	it("returns null for non-ok activations, malformed bodies, and transport failures", async () => {
		const base = { ...mockConfig, tenantId: null, edgeGatewayUrl: "https://edge.test/" };
		env.mockFetch.mockResolvedValueOnce({ ok: false });
		expect(await resolveApiKeyTenant({ ...base, apiKey: "k-nonok" })).toBeNull();

		env.mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ tenantId: 42 }) });
		expect(await resolveApiKeyTenant({ ...base, apiKey: "k-badbody" })).toBeNull();

		env.mockFetch.mockRejectedValueOnce(new Error("offline"));
		expect(await resolveApiKeyTenant({ ...base, apiKey: "k-offline" })).toBeNull();
		expect((env.mockFetch.mock.calls[0] as [string])[0]).toBe(
			"https://edge.test/proxy/billing/v1/sdk/activate",
		);
	});

	it("getAuthHeaders prefers the api-key path and attaches the resolved tenant", async () => {
		env.mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ tenantId: TENANT }),
		});
		const headers = await getAuthHeaders({
			...mockConfig,
			apiKey: `header-key-${Date.now()}`,
			tenantId: null,
		});
		expect(headers["Authorization"]).toMatch(/^Bearer header-key-/);
		expect(headers["x-qnsp-tenant"]).toBe(TENANT);
		expect(headers["x-tenant-id"]).toBe(TENANT);
	});

	it("getAuthHeaders omits tenant headers when resolution fails", async () => {
		env.mockFetch.mockResolvedValueOnce({ ok: false });
		const headers = await getAuthHeaders({
			...mockConfig,
			apiKey: `header-key-unresolved-${Date.now()}`,
			tenantId: null,
		});
		expect(headers["Authorization"]).toBeDefined();
		expect(headers["x-qnsp-tenant"]).toBeUndefined();
	});

	it("getAuthHeaders exits AUTH_ERROR when no service token can be minted", async () => {
		await getAuthHeaders({ ...mockConfig, serviceId: null }).catch(() => undefined);
		expect(env.mockExit).toHaveBeenCalledWith(EXIT_CODES.AUTH_ERROR);
	});

	it("getAuthHeaders service path uses the minted token", async () => {
		env.mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers(),
			json: async () => ({ accessToken: "svc-token-h" }),
		});
		const headers = await getAuthHeaders({ ...mockConfig, serviceId: "svc-headers-1" });
		expect(headers["Authorization"]).toBe("Bearer svc-token-h");
	});
});

describe("getEffectiveConfig", () => {
	function commandWith(globals: Record<string, unknown>): Command {
		return { optsWithGlobals: () => globals } as unknown as Command;
	}

	it("applies global overrides over the base config", () => {
		const effective = getEffectiveConfig(
			mockConfig,
			commandWith({
				authServiceUrl: "http://localhost:9999",
				tenantId: "override-tenant",
				output: "table",
				verbose: true,
			}),
		);
		expect(effective.authServiceUrl).toBe("http://localhost:9999");
		expect(effective.tenantId).toBe("override-tenant");
		expect(effective.outputFormat).toBe("table");
		expect(effective.verbose).toBe(true);
		// Untouched fields fall through to the base config.
		expect(effective.kmsServiceUrl).toBe(mockConfig.kmsServiceUrl);
	});

	it("returns the base config when no globals are set", () => {
		const effective = getEffectiveConfig(mockConfig, commandWith({}));
		expect(effective.authServiceUrl).toBe(mockConfig.authServiceUrl);
		expect(effective.outputFormat).toBe(mockConfig.outputFormat);
	});
});
