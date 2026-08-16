import { z } from "zod";

export type CryptoPolicyTier = "default" | "strict" | "maximum" | "government";

const limitNumberSchema = z
	.union([z.number(), z.null()])
	.transform((value) => {
		if (value === null) {
			return -1;
		}
		// No Infinity arms: z.number() rejects non-finite values before the
		// transform runs (pinned by the entitlement-limits regression test),
		// so Infinity checks here were unreachable dead branches.
		return value;
	})
	.refine((value) => typeof value === "number" && Number.isFinite(value), {
		message: "Limit must be a finite number after normalization",
	});

export const EntitlementLimitsSchema = z
	.object({
		storageGB: limitNumberSchema,
		apiCalls: limitNumberSchema,
		enclavesEnabled: z.boolean(),
		aiTrainingEnabled: z.boolean(),
		aiInferenceEnabled: z.boolean(),
		sseEnabled: z.boolean(),
		vaultEnabled: z.boolean(),
		vaultSecretsCount: limitNumberSchema,
		vaultSecretVersionsCount: limitNumberSchema,
		kmsKeysCount: limitNumberSchema,
		kmsOpsPerMonth: limitNumberSchema,
		apiKeysCount: limitNumberSchema,
		cryptoPolicyTier: z.enum(["default", "strict", "maximum", "government"] as const),
		// Source-code scanning quotas, added to pricing TierLimits after this
		// schema was written. The drift broke ALL consumers: this schema is
		// strict, so the 3 extra keys made every parseEntitlementLimits call
		// return null, and fail-closed count-gates denied paid-sensitive
		// requests with ENTITLEMENTS_UNAVAILABLE (2026-08-15 incident).
		// Optional with -1 (unlimited) defaults so pre-drift 13-key payloads
		// still parse. Keep this schema field-for-field with
		// packages/pricing/src/tiers.ts TierLimits - the regression test pins it.
		codeScanRepos: limitNumberSchema.optional().default(-1),
		codeScanFindingsStored: limitNumberSchema.optional().default(-1),
		codeScanUploadsPerRepoPerDay: limitNumberSchema.optional().default(-1),
	})
	.strict();

export type EntitlementLimits = z.infer<typeof EntitlementLimitsSchema>;

export function parseEntitlementLimits(value: unknown): EntitlementLimits | null {
	const parsed = EntitlementLimitsSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function isUnlimitedLimit(value: number): boolean {
	return value < 0;
}
