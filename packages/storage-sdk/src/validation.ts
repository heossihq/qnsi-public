import { z } from "zod";

/**
 * Validation schemas for storage-sdk inputs
 */

export const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Validates a UUID string
 */
export function validateUUID(value: string, fieldName: string): void {
	const result = uuidSchema.safeParse(value);
	if (!result.success) {
		// A failed parse always carries at least one issue; joining keeps this branchless.
		throw new Error(
			`Invalid ${fieldName}: ${result.error.issues.map((i) => i.message).join(", ")}`,
		);
	}
}
