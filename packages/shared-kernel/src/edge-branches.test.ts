import type { PqcAlgorithm, PqcProvider } from "@heossihq/qnsi-cryptography";
import { registerPqcProvider, unregisterPqcProvider } from "@heossihq/qnsi-cryptography";
import { createDeterministicTestPqcProvider } from "@heossihq/qnsi-cryptography/testing/providers";
import { CircuitBreakerOpenError } from "@heossihq/qnsi-resilience";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
	createJwtAccessToken,
	createRefreshToken,
	ensureAuthSubject,
	parseRefreshToken,
} from "./auth-server.js";
import { mapStandardError } from "./errors/fastify.js";
import {
	AuthenticationError,
	createNetworkError,
	installFastifyErrorHandler,
	normalizeError,
	RateLimitError,
	SystemError,
	ValidationError,
	WarningError,
} from "./errors/index.js";
import { ApplicationError } from "./errors.js";
import { formatValidationError } from "./input-validation.js";
import { createJwtVerifier, signJwt, verifyJwt } from "./jwt.js";
import { installEnhancedSecurityHeaders, installSecurityHeaders } from "./security-headers.js";
import { ServiceClient, ServiceClientError } from "./service-client.js";
import { runTenantPurge } from "./tenant-purge.js";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

// Runs FIRST, before any describe registers a provider: the no-provider signing arm.
describe("signJwt with no PQC provider registered", () => {
	it("throws instead of silently signing", async () => {
		await expect(
			signJwt({
				payload: { sub: "user-1" },
				algorithm: "dilithium-2",
				privateKey: new Uint8Array(),
			}),
		).rejects.toThrow("No PQC provider available for JWT signing");
	});
});

describe("jwt edge branches", () => {
	const provider = createDeterministicTestPqcProvider({ seed: "edge-branch-seed" });

	beforeAll(() => {
		registerPqcProvider("edge-branch-pqc", provider);
	});

	afterAll(() => {
		unregisterPqcProvider("edge-branch-pqc");
	});

	it("rejects a token with an empty middle segment", async () => {
		const result = await verifyJwt({
			token: "aGVhZA..c2ln",
			publicKey: new Uint8Array(),
			provider,
		});
		expect(result.valid).toBe(false);
		expect(result.error).toContain("missing header, payload, or signature");
	});

	it("rejects a token whose header typ is not JWT", async () => {
		const header = Buffer.from(JSON.stringify({ alg: "Dilithium2", typ: "NOT-JWT" })).toString(
			"base64url",
		);
		const payload = Buffer.from(JSON.stringify({ sub: "u" })).toString("base64url");
		const result = await verifyJwt({
			token: `${header}.${payload}.AA`,
			publicKey: new Uint8Array(),
			provider,
		});
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Invalid token type");
	});

	it("resolves the registered provider when none is passed, for sign and verify", async () => {
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
		const token = await signJwt({
			payload: { sub: "resolved" },
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
		});
		const result = await verifyJwt({ token, publicKey: keyPair.publicKey });
		expect(result.valid).toBe(true);
		expect(result.payload?.sub).toBe("resolved");
	});

	it("accepts tokens without exp and with a past nbf", async () => {
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
		const noExp = await signJwt({
			payload: { sub: "no-exp" },
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
			provider,
		});
		expect((await verifyJwt({ token: noExp, publicKey: keyPair.publicKey, provider })).valid).toBe(
			true,
		);

		const now = Math.floor(Date.now() / 1000);
		const pastNbf = await signJwt({
			payload: { sub: "past-nbf", nbf: now - 100, exp: now + 3600 },
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
			provider,
		});
		expect(
			(await verifyJwt({ token: pastNbf, publicKey: keyPair.publicKey, provider })).valid,
		).toBe(true);
	});

	it("passes an unmapped algorithm name through to the JWT header", async () => {
		const stub = {
			name: "stub",
			sign: async () => ({ signature: new Uint8Array([1, 2, 3]) }),
		} as unknown as PqcProvider;
		const token = await signJwt({
			payload: { sub: "u" },
			algorithm: "not-a-mapped-alg" as PqcAlgorithm,
			privateKey: new Uint8Array(),
			provider: stub,
		});
		const headerPart = token.split(".")[0];
		if (!headerPart) throw new Error("token missing header part");
		const header = JSON.parse(Buffer.from(headerPart, "base64url").toString());
		expect(header.alg).toBe("not-a-mapped-alg");
	});

	it("stringifies non-Error throws from header and payload parsing", async () => {
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
		const token = await signJwt({
			payload: { sub: "u" },
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
			provider,
		});
		const realParse = JSON.parse.bind(JSON);

		vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
			throw "raw-header-failure";
		});
		const headerResult = await verifyJwt({ token, publicKey: keyPair.publicKey, provider });
		expect(headerResult.error).toContain("Failed to parse JWT header: raw-header-failure");
		vi.restoreAllMocks();

		vi.spyOn(JSON, "parse")
			.mockImplementationOnce(realParse)
			.mockImplementationOnce(() => {
				throw "raw-payload-failure";
			});
		const payloadResult = await verifyJwt({ token, publicKey: keyPair.publicKey, provider });
		expect(payloadResult.error).toContain("Failed to parse JWT payload: raw-payload-failure");
	});

	it("stringifies non-Error throws from the provider verify call", async () => {
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
		const token = await signJwt({
			payload: { sub: "u" },
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
			provider,
		});
		const thrower = {
			name: "thrower",
			verify: async () => {
				throw "verify-raw";
			},
		} as unknown as PqcProvider;
		const result = await verifyJwt({ token, publicKey: keyPair.publicKey, provider: thrower });
		expect(result.valid).toBe(false);
		expect(result.error).toBe("verify-raw");
	});

	it("labels the error metric unknown when no provider or algorithm was given", async () => {
		const result = await verifyJwt({ token: "not-a-jwt", publicKey: new Uint8Array() });
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Invalid JWT format");
	});

	it("createJwtVerifier without provider or algorithm resolves both from context", async () => {
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
		const token = await signJwt({
			payload: { sub: "adapter" },
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
			provider,
		});
		const verifier = createJwtVerifier();
		const result = await verifier.verify(token, keyPair.publicKey);
		expect(result.valid).toBe(true);
		expect(result.payload?.sub).toBe("adapter");
	});
});

describe("auth-server edge branches", () => {
	const provider = createDeterministicTestPqcProvider({ seed: "auth-server-edge-seed" });

	beforeAll(() => {
		registerPqcProvider("auth-server-edge-pqc", provider);
	});

	afterAll(() => {
		unregisterPqcProvider("auth-server-edge-pqc");
	});

	function decodePayload(token: string): Record<string, unknown> {
		const part = token.split(".")[1];
		if (!part) throw new Error("token missing payload part");
		return JSON.parse(Buffer.from(part, "base64url").toString());
	}

	const SUBJECT_ID = "c1b2c3d4-e5f6-4789-8abc-def012345678";

	it("ensureAuthSubject parses valid input and rejects invalid ids", () => {
		const subject = ensureAuthSubject({ id: SUBJECT_ID });
		expect(subject.id).toBe(SUBJECT_ID);
		expect(subject.roles).toEqual([]);
		expect(() => ensureAuthSubject({ id: "not-a-uuid" })).toThrow();
	});

	it("embeds every optional identity claim when the subject carries them", async () => {
		const identityId = "a1b2c3d4-e5f6-4789-8abc-def012345678";
		const userId = "b1b2c3d4-e5f6-4789-8abc-def012345678";
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
		const token = await createJwtAccessToken({
			subject: {
				id: identityId,
				identityId,
				userId,
				email: "u@example.com",
				tenantId: "tenant-1",
				roles: ["admin"],
				tenantPlan: "dev-pro",
			},
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
			provider,
		});
		const payload = decodePayload(token);
		expect(payload).toMatchObject({
			identity_id: identityId,
			user_id: userId,
			email: "u@example.com",
			tenant_id: "tenant-1",
			roles: ["admin"],
			tenant_plan: "dev-pro",
		});
		expect(payload["iss"]).toBeUndefined();
	});

	it("omits every optional claim for a minimal subject and resolves the registered provider", async () => {
		const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
		const token = await createJwtAccessToken({
			subject: { id: SUBJECT_ID, roles: [] },
			algorithm: "dilithium-2",
			privateKey: keyPair.privateKey,
		});
		const payload = decodePayload(token);
		expect(payload["sub"]).toBe(SUBJECT_ID);
		for (const absent of [
			"iss",
			"identity_id",
			"user_id",
			"email",
			"tenant_id",
			"roles",
			"tenant_plan",
		]) {
			expect(payload[absent]).toBeUndefined();
		}
		const verified = await verifyJwt({ token, publicKey: keyPair.publicKey, provider });
		expect(verified.valid).toBe(true);
	});

	it("refresh tokens require a tenant-scoped subject and round-trip through parse", () => {
		expect(() => createRefreshToken({ subject: { id: SUBJECT_ID, roles: [] } })).toThrow(
			"Refresh tokens require a tenant-scoped subject",
		);
		const issue = createRefreshToken({ subject: { id: SUBJECT_ID, tenantId: "t1", roles: [] } });
		const parsed = parseRefreshToken(issue.token);
		expect(parsed.tokenId).toBe(issue.metadata.tokenId);
		expect(parsed.secret.length).toBeGreaterThan(0);
	});
});

describe("errors edge branches", () => {
	it("ApplicationError defaults its code when none is supplied", () => {
		const error = new ApplicationError("plain failure");
		expect(error.code).toBe("APPLICATION_ERROR");
	});

	it("isWarning covers USER, VALIDATION, and neither", () => {
		expect(new AuthenticationError("denied").isWarning()).toBe(true);
		expect(new ValidationError("bad").isWarning()).toBe(true);
		expect(new SystemError("boom").isWarning()).toBe(false);
	});

	it("RateLimitError is retryable and WarningError is a warning", () => {
		expect(new RateLimitError("slow down", 30, 100).isRetryable()).toBe(true);
		expect(new WarningError("heads up").isWarning()).toBe(true);
	});

	it("createNetworkError keeps the request method and defaults to GET", () => {
		const base = { status: 502, statusText: "Bad Gateway", url: "https://svc/x" };
		const withMethod = createNetworkError({ ...base, method: "PUT" } as unknown as Response & {
			method?: string;
		});
		expect(withMethod.method).toBe("PUT");
		expect(withMethod.status).toBe(502);
		const withoutMethod = createNetworkError(base as unknown as Response & { method?: string });
		expect(withoutMethod.method).toBe("GET");
	});

	it("normalizeError wraps a plain Error as a SystemError", () => {
		const normalized = normalizeError(new Error("unclassified"));
		expect(normalized).toBeInstanceOf(SystemError);
		expect(normalized.message).toBe("unclassified");
	});

	it("constructs errors when the runtime lacks Error.captureStackTrace", () => {
		const original = Error.captureStackTrace;
		delete (Error as { captureStackTrace?: typeof Error.captureStackTrace }).captureStackTrace;
		try {
			const error = new AuthenticationError("no-v8");
			expect(error.name).toBe("AuthenticationError");
			expect(error.message).toBe("no-v8");
		} finally {
			Error.captureStackTrace = original;
		}
	});
});

describe("fastify error handler edge branches", () => {
	it("statusCode/code objects without a message fall back to Request failed", () => {
		const response = mapStandardError({ statusCode: 418, code: "TEAPOT" }, { serviceName: "svc" });
		expect(response).toEqual({ statusCode: 418, error: "TEAPOT", message: "Request failed" });
	});

	it("replies through a reply that exposes neither status nor code", () => {
		let handler:
			| ((error: unknown, request: Record<string, unknown>, reply: unknown) => unknown)
			| undefined;
		const server = {
			log: { error: vi.fn(), warn: vi.fn() },
			setErrorHandler: (h: typeof handler) => {
				handler = h;
			},
		};
		installFastifyErrorHandler(server as never, { serviceName: "svc" });
		if (!handler) throw new Error("handler not installed");
		const send = vi.fn((payload: unknown) => payload);
		handler(new Error("boom"), {}, { send });
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({ statusCode: 500, error: "INTERNAL_ERROR" }),
		);
		expect(server.log.error).toHaveBeenCalledOnce();
	});
});

describe("input-validation edge branches", () => {
	it("maps unmatched formats, valueless enums, and unknown issue codes", () => {
		const error = new z.ZodError([
			{ code: "invalid_format", format: "url", path: ["site"], message: "bad url" },
			{ code: "invalid_value", path: ["kind"], message: "bad value" },
			{ code: "custom", path: ["extra"], message: "custom check failed" },
		] as never);
		const formatted = formatValidationError(error);
		const byField = Object.fromEntries(formatted.violations.map((v) => [v.field, v.expected]));
		expect(byField["site"]).toBe("valid string");
		expect(byField["kind"]).toBe("one of: ");
		expect(byField["extra"]).toBe("valid value");
	});
});

describe("security-headers edge branches", () => {
	type Hook = (
		request: { url?: string },
		reply: { header: ReturnType<typeof vi.fn> },
		done: () => void,
	) => void;

	function capture(): { server: { addHook: (name: string, h: Hook) => void }; hooks: Hook[] } {
		const hooks: Hook[] = [];
		return { server: { addHook: (_name, h) => hooks.push(h) }, hooks };
	}

	it("basic installer treats a missing url as the empty path", () => {
		const { server, hooks } = capture();
		installSecurityHeaders(server as never, { excludePaths: ["/health"] });
		const header = vi.fn();
		const done = vi.fn();
		hooks[0]?.({}, { header }, done);
		expect(header).toHaveBeenCalledWith("x-content-type-options", "nosniff");
		expect(done).toHaveBeenCalledOnce();
	});

	it("enhanced installer applies HSTS defaults and skips excluded paths", () => {
		const { server, hooks } = capture();
		installEnhancedSecurityHeaders(server as never, {
			hsts: {},
			excludePaths: ["/health"],
		});
		const hook = hooks[0];
		if (!hook) throw new Error("hook not installed");

		const excludedHeader = vi.fn();
		const excludedDone = vi.fn();
		hook({ url: "/health?probe=1" }, { header: excludedHeader }, excludedDone);
		expect(excludedHeader).not.toHaveBeenCalled();
		expect(excludedDone).toHaveBeenCalledOnce();

		const header = vi.fn();
		hook({}, { header }, vi.fn());
		expect(header).toHaveBeenCalledWith(
			"strict-transport-security",
			"max-age=31536000; includeSubDomains",
		);
	});

	it("enhanced installer renders the preload directive when requested", () => {
		const { server, hooks } = capture();
		installEnhancedSecurityHeaders(server as never, {
			hsts: { maxAge: 60, includeSubDomains: false, preload: true },
		});
		const header = vi.fn();
		hooks[0]?.({ url: "/v1/x" }, { header }, vi.fn());
		expect(header).toHaveBeenCalledWith("strict-transport-security", "max-age=60; preload");
	});
});

describe("service-client edge branches", () => {
	const baseUrl = "https://svc.internal";

	it("emits a circuit-breaker audit event when the default breaker opens", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect refused")));
		const emit = vi.fn(async () => {});
		const client = new ServiceClient({
			baseUrl,
			auditClient: { emit },
			serviceName: "vault",
			tenantId: "system",
		});
		for (let i = 0; i < 5; i++) {
			await expect(client.get("/v1/x")).rejects.toThrow(ServiceClientError);
		}
		await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
		expect(emit).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "circuit_breaker.opened",
				resourceId: "vault",
				tenantId: "system",
			}),
		);
		expect(client.getCircuitBreakerState()).toBe("open");
	});

	it("opens the default breaker silently when no audit client is configured", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect refused")));
		const client = new ServiceClient({ baseUrl });
		for (let i = 0; i < 5; i++) {
			await expect(client.get("/v1/x")).rejects.toThrow(ServiceClientError);
		}
		expect(client.getCircuitBreakerState()).toBe("open");
	});

	it("drains an unreadable error body without masking the HTTP failure", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 502,
				statusText: "Bad Gateway",
				text: () => Promise.reject(new Error("body stream broken")),
				headers: { get: () => null },
			}),
		);
		const client = new ServiceClient({ baseUrl });
		await expect(client.get("/v1/x")).rejects.toMatchObject({
			statusCode: 502,
			code: "HTTP_502",
		});
	});

	it("maps a CircuitBreakerOpenError thrown mid-fetch to a 503", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new CircuitBreakerOpenError("breaker open")));
		const client = new ServiceClient({ baseUrl });
		await expect(client.get("/v1/x")).rejects.toMatchObject({
			statusCode: 503,
			code: "CIRCUIT_BREAKER_OPEN",
		});
	});

	it("wraps non-Error fetch rejections as UNKNOWN_ERROR", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue("raw transport failure"));
		const client = new ServiceClient({ baseUrl });
		await expect(client.get("/v1/x")).rejects.toMatchObject({
			statusCode: 500,
			code: "UNKNOWN_ERROR",
			message: "Unknown error",
		});
	});

	it("post and put omit the body field when no body is given", async () => {
		// A fresh Response per call: bodies are single-use.
		const fetchMock = vi.fn().mockImplementation(
			async () =>
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const client = new ServiceClient({ baseUrl });
		await client.post("/v1/x");
		await client.put("/v1/y");
		for (const call of fetchMock.mock.calls) {
			expect((call[1] as RequestInit).body).toBeUndefined();
		}
	});
});

describe("tenant-purge edge branches", () => {
	it("survives a failing ROLLBACK and still rethrows the original error", async () => {
		const release = vi.fn();
		const client = {
			query: vi.fn(async (sql: string) => {
				if (sql === "BEGIN") return { rowCount: null };
				if (sql === "ROLLBACK") throw new Error("rollback also failed");
				throw new Error("statement failed");
			}),
			release,
		};
		const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
		await expect(
			runTenantPurge(pool, "t1", ["DELETE FROM items WHERE tenant_id = $1"]),
		).rejects.toThrow("statement failed");
		expect(release).toHaveBeenCalledOnce();
	});

	it("counts a null rowCount as zero affected rows", async () => {
		const client = {
			query: vi.fn(async () => ({ rowCount: null })),
			release: vi.fn(),
		};
		const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
		const result = await runTenantPurge(pool, "t1", ["DELETE FROM items WHERE tenant_id = $1"]);
		expect(result).toEqual({ tenantId: "t1", deletedRows: { items: 0 }, totalRows: 0 });
	});
});
