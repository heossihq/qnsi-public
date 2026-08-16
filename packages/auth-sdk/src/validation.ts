import { z } from "zod";

/**
 * Validation schemas for auth-sdk inputs
 */

export const uuidSchema = z.string().uuid("Invalid UUID format");
export const emailSchema = z.string().email("Invalid email format");
export const urlSchema = z.string().url("Invalid URL format");

/**
 * Validates a UUID string
 */
export function validateUUID(value: string, fieldName: string): void {
	// safeParse keeps the failure in the return value: parse() can only
	// reject with a ZodError, and a failed parse always carries an issue.
	const parsed = uuidSchema.safeParse(value);
	if (!parsed.success) {
		const detail = parsed.error.issues.map((issue) => issue.message).join("; ");
		throw new Error(`Invalid ${fieldName}: ${detail}`);
	}
}

/**
 * Validates an email string
 */
export function validateEmail(value: string, fieldName: string): void {
	// safeParse keeps the failure in the return value: parse() can only
	// reject with a ZodError, and a failed parse always carries an issue.
	const parsed = emailSchema.safeParse(value);
	if (!parsed.success) {
		const detail = parsed.error.issues.map((issue) => issue.message).join("; ");
		throw new Error(`Invalid ${fieldName}: ${detail}`);
	}
}

/**
 * Validates a URL string
 */
export function validateURL(value: string, fieldName: string): void {
	// safeParse keeps the failure in the return value: parse() can only
	// reject with a ZodError, and a failed parse always carries an issue.
	const parsed = urlSchema.safeParse(value);
	if (!parsed.success) {
		const detail = parsed.error.issues.map((issue) => issue.message).join("; ");
		throw new Error(`Invalid ${fieldName}: ${detail}`);
	}
}
