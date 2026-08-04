/**
 * Input Validation Hardening Module
 *
 * Provides secure Zod schema builders with enforced length limits, pattern
 * constraints, and a safe error formatter that strips Zod internals.
 *
 * @module input-validation
 */

import { z } from "zod";

// =============================================================================
// CONSTANTS
// =============================================================================

export const VALIDATION_LIMITS = {
	UUID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
	TENANT_ID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
	EMAIL_MAX_LENGTH: 254,
	DEFAULT_STRING_MAX: 1024,
	DEFAULT_ARRAY_MAX: 100,
	KEY_ID_PATTERN: /^[a-zA-Z0-9_-]{1,128}$/,
} as const;

// =============================================================================
// SCHEMA BUILDERS
// =============================================================================

/**
 * Secure string schema with configurable max length and optional pattern.
 * Rejects empty strings by default.
 */
export function secureString(opts?: {
	readonly max?: number;
	readonly pattern?: RegExp;
	readonly allowEmpty?: boolean;
}): z.ZodString {
	const max = opts?.max ?? VALIDATION_LIMITS.DEFAULT_STRING_MAX;
	let schema = z.string().max(max);
	if (!opts?.allowEmpty) {
		schema = schema.min(1);
	}
	if (opts?.pattern) {
		schema = schema.regex(opts.pattern);
	}
	return schema;
}

/**
 * Secure UUID schema - validates RFC 4122 UUID format.
 */
export function secureUuid(): z.ZodString {
	return z.string().regex(VALIDATION_LIMITS.UUID_PATTERN, "Must be a valid UUID");
}

/**
 * Secure tenant ID schema - same format as UUID.
 */
export function secureTenantId(): z.ZodString {
	return z.string().regex(VALIDATION_LIMITS.TENANT_ID_PATTERN, "Must be a valid tenant ID (UUID)");
}

/**
 * Secure email schema - enforces RFC 5321 max length and basic format.
 */
export function secureEmail(): z.ZodString {
	return z.string().email().max(VALIDATION_LIMITS.EMAIL_MAX_LENGTH);
}

/**
 * Secure key ID schema - alphanumeric with hyphens/underscores, max 128 chars.
 */
export function secureKeyId(): z.ZodString {
	return z.string().regex(VALIDATION_LIMITS.KEY_ID_PATTERN, "Must be a valid key ID");
}

// =============================================================================
// ERROR FORMATTER
// =============================================================================

export interface ValidationViolation {
	readonly field: string;
	readonly expected: string;
	readonly violation: string;
}

export interface ValidationErrorResponse {
	readonly statusCode: 400;
	readonly error: "VALIDATION_ERROR";
	readonly message: string;
	readonly violations: readonly ValidationViolation[];
}

/**
 * Format a Zod validation error into a safe, client-facing response.
 * Strips Zod internals, stack traces, and internal schema paths.
 */
export function formatValidationError(error: z.ZodError): ValidationErrorResponse {
	const violations: ValidationViolation[] = error.issues.map((issue) => {
		const field = issue.path.length > 0 ? issue.path.join(".") : "root";
		const violation = sanitizeMessage(issue.message);
		const expected = deriveExpected(issue);

		return { field, expected, violation };
	});

	return {
		statusCode: 400,
		error: "VALIDATION_ERROR",
		message: `Validation failed: ${violations.map((v) => `${v.field} ${v.violation}`).join("; ")}`,
		violations,
	};
}

function sanitizeMessage(message: string): string {
	return message
		.replace(/\bat\s+\S+:\d+:\d+/g, "")
		.replace(/ZodError/g, "")
		.trim()
		.slice(0, 256);
}

function deriveExpected(issue: z.ZodIssue): string {
	switch (issue.code) {
		case "too_big":
			return `max length ${issue.maximum}`;
		case "too_small":
			return `min length ${issue.minimum}`;
		case "invalid_type":
			return issue.expected;
		case "invalid_format": {
			const fmt = (issue as unknown as { format?: string }).format;
			if (fmt === "email") return "valid email address";
			if (fmt === "uuid") return "valid UUID";
			if (fmt === "regex") return "value matching required pattern";
			return "valid string";
		}
		case "invalid_value": {
			const vals = (issue as unknown as { values?: unknown[] }).values ?? [];
			return `one of: ${vals.join(", ")}`;
		}
		default:
			return "valid value";
	}
}
