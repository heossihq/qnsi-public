import { z } from "zod";

/**
 * Validation schemas for tenant-sdk inputs
 */

export const uuidSchema = z.string().uuid("Invalid UUID format");

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
