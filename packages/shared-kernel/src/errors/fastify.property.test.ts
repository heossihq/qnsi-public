/**
 * Property-Based Tests for mapStandardError
 *
 * Platform-Hardening Spec - Tasks 8.1, 8.2, 8.3
 *
 * Property 2: Error response shape conformance (8.1)
 * Property 3: Production error sanitization (8.2)
 * Property 4: Zod validation rejection (8.3)
 */

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ZodError, ZodIssueCode } from "zod";

import { ApplicationError, ForbiddenError, UnauthorizedError } from "../errors.js";
import type { StandardErrorResponse } from "./fastify.js";
import { mapStandardError } from "./fastify.js";
import {
	AuthenticationError,
	AuthorizationError,
	ConfigurationError,
	CryptographyError,
	DatabaseError,
	NetworkError,
	RateLimitError,
	ResourceNotFoundError,
	SystemError,
	TimeoutError,
	ValidationError,
	WarningError,
} from "./index.js";

const baseOptions = { serviceName: "test-service" };
const productionOptions = { serviceName: "test-service", exposeInternalMessages: false };
const devOptions = { serviceName: "test-service", exposeInternalMessages: true };

/**
 * Arbitrary for generating random QNSPError subclass instances.
 */
const qnspErrorArb = fc.oneof(
	fc.string({ minLength: 1 }).map((msg) => new ValidationError(msg, "field")),
	fc.string({ minLength: 1 }).map((msg) => new AuthenticationError(msg)),
	fc.string({ minLength: 1 }).map((msg) => new AuthorizationError(msg, "resource", "action")),
	fc
		.record({
			msg: fc.string({ minLength: 1 }),
			url: fc.webUrl(),
			status: fc.integer({ min: 100, max: 599 }),
		})
		.map((r) => new NetworkError(r.msg, r.url, "GET", r.status)),
	fc
		.record({ msg: fc.string({ minLength: 1 }), ms: fc.integer({ min: 1, max: 60_000 }) })
		.map((r) => new TimeoutError(r.msg, r.ms, "op")),
	fc.string({ minLength: 1 }).map((msg) => new ConfigurationError(msg, "key")),
	fc.string({ minLength: 1 }).map((msg) => new DatabaseError(msg, "SELECT", "table")),
	fc.string({ minLength: 1 }).map((msg) => new CryptographyError(msg, "encrypt")),
	fc.string({ minLength: 1 }).map((msg) => new ResourceNotFoundError(msg)),
	fc.string({ minLength: 1 }).map((msg) => new SystemError(msg, "component")),
	fc
		.record({ msg: fc.string({ minLength: 1 }), retryAfter: fc.integer({ min: 1, max: 300 }) })
		.map((r) => new RateLimitError(r.msg, r.retryAfter, 100)),
	fc.string({ minLength: 1 }).map((msg) => new WarningError(msg)),
);

/**
 * Arbitrary for generating random ApplicationError subclass instances.
 */
const applicationErrorArb = fc.oneof(
	fc.string({ minLength: 1 }).map((msg) => new ApplicationError(msg, { code: "APP_ERR" })),
	fc.string({ minLength: 1 }).map((msg) => new UnauthorizedError(msg)),
	fc.string({ minLength: 1 }).map((msg) => new ForbiddenError(msg)),
);

/**
 * Safe field name arbitrary that avoids Object prototype property names
 * (e.g., "constructor", "toString", "__proto__") which break Zod's flatten().
 */
const safeFieldNameArb = fc
	.string({ minLength: 1, maxLength: 30 })
	.filter(
		(s) =>
			!(s in Object.prototype) && s !== "__proto__" && s !== "constructor" && s !== "prototype",
	);

/**
 * Arbitrary for generating random ZodError instances with realistic issues.
 */
const zodErrorArb = fc
	.array(
		fc.record({
			path: fc.array(fc.oneof(safeFieldNameArb, fc.integer({ min: 0, max: 100 })), {
				minLength: 1,
				maxLength: 4,
			}),
			message: fc.string({ minLength: 1 }),
		}),
		{ minLength: 1, maxLength: 5 },
	)
	.map(
		(issues) =>
			new ZodError(
				issues.map((issue) => ({
					code: ZodIssueCode.invalid_type,
					expected: "string",
					received: "undefined",
					path: issue.path,
					message: issue.message,
				})),
			),
	);

/**
 * Arbitrary for generating random plain Error instances.
 */
const plainErrorArb = fc.string({ minLength: 1 }).map((msg) => new Error(msg));

/**
 * Arbitrary for generating random non-Error throwables (strings, numbers, objects).
 */
const nonErrorArb = fc.oneof(
	fc.string({ minLength: 1 }),
	fc.integer(),
	fc.constant(null),
	fc.constant(undefined),
);

/**
 * Combined arbitrary for all possible error types that mapStandardError handles.
 */
const anyErrorArb = fc.oneof(
	qnspErrorArb.map((e) => e as unknown),
	applicationErrorArb.map((e) => e as unknown),
	zodErrorArb.map((e) => e as unknown),
	plainErrorArb.map((e) => e as unknown),
	nonErrorArb,
);

// ── Task 8.1: Property 2 - Error response shape conformance ─────────────────

describe("Property 2: Error response shape conformance", () => {
	function assertValidShape(response: StandardErrorResponse): void {
		expect(typeof response.statusCode).toBe("number");
		expect(response.statusCode).toBeGreaterThanOrEqual(100);
		expect(response.statusCode).toBeLessThanOrEqual(599);
		expect(typeof response.error).toBe("string");
		expect(response.error.length).toBeGreaterThan(0);
		expect(typeof response.message).toBe("string");
		expect(response.message.length).toBeGreaterThan(0);
		// details is optional but if present must not be a function
		if (response.details !== undefined) {
			expect(typeof response.details).not.toBe("function");
		}
	}

	it("produces valid shape for any QNSPError subclass", () => {
		fc.assert(
			fc.property(qnspErrorArb, (error) => {
				const response = mapStandardError(error, baseOptions);
				assertValidShape(response);
			}),
			{ numRuns: 100 },
		);
	});

	it("produces valid shape for any ApplicationError subclass", () => {
		fc.assert(
			fc.property(applicationErrorArb, (error) => {
				const response = mapStandardError(error, baseOptions);
				assertValidShape(response);
			}),
			{ numRuns: 100 },
		);
	});

	it("produces valid shape for any ZodError", () => {
		fc.assert(
			fc.property(zodErrorArb, (error) => {
				const response = mapStandardError(error, baseOptions);
				assertValidShape(response);
			}),
			{ numRuns: 100 },
		);
	});

	it("produces valid shape for any plain Error", () => {
		fc.assert(
			fc.property(plainErrorArb, (error) => {
				const response = mapStandardError(error, baseOptions);
				assertValidShape(response);
			}),
			{ numRuns: 100 },
		);
	});

	it("produces valid shape for any non-Error throwable", () => {
		fc.assert(
			fc.property(nonErrorArb, (error) => {
				const response = mapStandardError(error, baseOptions);
				assertValidShape(response);
			}),
			{ numRuns: 100 },
		);
	});

	it("produces valid shape for any error type (combined)", () => {
		fc.assert(
			fc.property(anyErrorArb, (error) => {
				const response = mapStandardError(error, baseOptions);
				assertValidShape(response);
			}),
			{ numRuns: 100 },
		);
	});
});

// ── Task 8.2: Property 3 - Production error sanitization ────────────────────

describe("Property 3: Production error sanitization", () => {
	it("suppresses 5xx messages when exposeInternalMessages is false", () => {
		fc.assert(
			fc.property(qnspErrorArb, (error) => {
				const response = mapStandardError(error, productionOptions);
				if (response.statusCode >= 500) {
					expect(response.message).toBe("Internal error");
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("suppresses plain Error messages when NODE_ENV=production", () => {
		fc.assert(
			fc.property(plainErrorArb, (error) => {
				const response = mapStandardError(error, productionOptions);
				// Plain errors always map to 500
				expect(response.statusCode).toBe(500);
				expect(response.message).toBe("Internal error");
			}),
			{ numRuns: 100 },
		);
	});

	it("suppresses non-Error throwable messages when NODE_ENV=production", () => {
		fc.assert(
			fc.property(nonErrorArb, (error) => {
				const response = mapStandardError(error, productionOptions);
				expect(response.statusCode).toBe(500);
				expect(response.message).toBe("Internal error");
			}),
			{ numRuns: 100 },
		);
	});

	it("does not include stack traces when NODE_ENV=production without exposeStack", () => {
		fc.assert(
			fc.property(anyErrorArb, (error) => {
				const response = mapStandardError(error, productionOptions);
				if (response.details && typeof response.details === "object") {
					const details = response.details as Record<string, unknown>;
					expect(details["stack"]).toBeUndefined();
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("exposes 5xx messages when exposeInternalMessages is true", () => {
		fc.assert(
			fc.property(
				fc.string({ minLength: 1 }).map((msg) => new SystemError(msg, "component")),
				(error) => {
					const response = mapStandardError(error, devOptions);
					// SystemError → 500, and with exposeInternalMessages: true, message should be original
					expect(response.statusCode).toBe(500);
					expect(response.message).toBe(error.message);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("preserves 4xx messages regardless of exposeInternalMessages setting", () => {
		fc.assert(
			fc.property(
				fc.string({ minLength: 1 }).map((msg) => new ValidationError(msg, "field")),
				(error) => {
					const prodResponse = mapStandardError(error, productionOptions);
					const devResponse = mapStandardError(error, devOptions);
					// ValidationError → 400, message should be preserved in both modes
					expect(prodResponse.statusCode).toBe(400);
					expect(devResponse.statusCode).toBe(400);
					expect(prodResponse.message).toBe(error.message);
					expect(devResponse.message).toBe(error.message);
				},
			),
			{ numRuns: 100 },
		);
	});
});

// ── Task 8.3: Property 4 - Zod validation rejection ────────────────────────

describe("Property 4: Zod validation rejection", () => {
	it("maps ZodError to 400 INVALID_REQUEST", () => {
		fc.assert(
			fc.property(zodErrorArb, (error) => {
				const response = mapStandardError(error, baseOptions);
				expect(response.statusCode).toBe(400);
				expect(response.error).toBe("INVALID_REQUEST");
				expect(response.message).toBe("Validation failed");
			}),
			{ numRuns: 100 },
		);
	});

	it("includes flattened details for ZodError", () => {
		fc.assert(
			fc.property(zodErrorArb, (error) => {
				const response = mapStandardError(error, baseOptions);
				expect(response.details).toBeDefined();
				const details = response.details as { formErrors?: unknown; fieldErrors?: unknown };
				// ZodError.flatten() produces { formErrors, fieldErrors }
				expect(details).toHaveProperty("formErrors");
				expect(details).toHaveProperty("fieldErrors");
			}),
			{ numRuns: 100 },
		);
	});

	it("ZodError response is identical when NODE_ENV=production vs dev", () => {
		fc.assert(
			fc.property(zodErrorArb, (error) => {
				const prodResponse = mapStandardError(error, productionOptions);
				const devResponse = mapStandardError(error, devOptions);
				// ZodError is a 400, so exposeInternalMessages doesn't affect it
				expect(prodResponse.statusCode).toBe(devResponse.statusCode);
				expect(prodResponse.error).toBe(devResponse.error);
				expect(prodResponse.message).toBe(devResponse.message);
			}),
			{ numRuns: 100 },
		);
	});
});
