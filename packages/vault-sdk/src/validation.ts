import { z } from "zod";

/**
 * Validation schemas for vault-sdk inputs
 */

export const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Validates a UUID string
 */
export function validateUUID(value: string, fieldName: string): void {
	// safeParse keeps the failure in the return value, so there is no
	// non-ZodError arm to guard: parse() can only reject with a ZodError.
	const parsed = uuidSchema.safeParse(value);
	if (!parsed.success) {
		// A failed parse always carries at least one issue - no empty case.
		const detail = parsed.error.issues.map((issue) => issue.message).join("; ");
		throw new Error(`Invalid ${fieldName}: ${detail}`);
	}
}
