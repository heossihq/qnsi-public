import { z } from "zod";

/**
 * Validation schemas for kms-client inputs
 */

export const uuidSchema = z.string().uuid("Invalid UUID format");

const keyCustodyResourceSchema = z
	.object({
		id: z.string().uuid(),
		keyId: z.string().min(1),
		tenantId: z.string().uuid(),
		exportable: z.literal(false).nullable(),
		custodyPolicy: z.object({
			exportable: z.literal(false).nullable(),
			enforcement: z.enum(["service", "unverified"]),
			hardwareNonExportability: z.literal("not_verified"),
			policyVersion: z.literal(1).nullable(),
		}),
	})
	.passthrough()
	.superRefine((resource, ctx) => {
		const enforced = resource.custodyPolicy.enforcement === "service";
		if (
			resource.exportable !== resource.custodyPolicy.exportable ||
			resource.exportable !== (enforced ? false : null) ||
			resource.custodyPolicy.policyVersion !== (enforced ? 1 : null)
		)
			ctx.addIssue({ code: "custom", message: "Inconsistent custody policy" });
	});

export function validateKeyCustodyResource(value: unknown) {
	const parsed = keyCustodyResourceSchema.safeParse(value);
	if (!parsed.success) throw new Error("KMS authoritative custody response unavailable or invalid");
	return parsed.data;
}

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
