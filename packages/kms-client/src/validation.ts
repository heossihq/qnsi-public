import { z } from "zod";

/**
 * Validation schemas for kms-client inputs
 */

export const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Validates a UUID string
 */
export function validateUUID(value: string, fieldName: string): void {
	// safeParse keeps the failure in the return value, so there is no non-ZodError arm to
	// guard: parse() can only reject with a ZodError.
	const result = uuidSchema.safeParse(value);
	if (!result.success) {
		// A failed parse always carries at least one issue, so there is no empty case to guard.
		const detail = result.error.issues.map((issue) => issue.message).join("; ");
		throw new Error(`Invalid ${fieldName}: ${detail}`);
	}
}
