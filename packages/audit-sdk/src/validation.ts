import { z } from "zod";

/**
 * Validation schemas for audit-sdk inputs
 */

export const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Validates a UUID string
 */
export function validateUUID(value: string, fieldName: string): void {
	// safeParse keeps the failure in the return value: parse() can only reject with a
	// ZodError, so there was no non-ZodError arm to guard, and a failed parse always
	// carries at least one issue.
	const result = uuidSchema.safeParse(value);
	if (!result.success) {
		const detail = result.error.issues.map((issue) => issue.message).join("; ");
		throw new Error(`Invalid ${fieldName}: ${detail}`);
	}
}
