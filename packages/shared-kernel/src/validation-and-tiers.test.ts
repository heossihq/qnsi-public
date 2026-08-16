import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
	formatValidationError,
	secureEmail,
	secureKeyId,
	secureString,
	secureTenantId,
	secureUuid,
	VALIDATION_LIMITS,
} from "./input-validation.js";
import {
	checkTierAccess,
	FEATURE_REQUIREMENTS,
	getTierLimits,
	isFeatureEnabled,
	TIER_LIMITS,
	TierError,
} from "./tier-limits.js";

const UUID = "a1b2c3d4-e5f6-4789-8abc-def012345678";

describe("input-validation schema builders", () => {
	it("secureString enforces max, non-empty default, optional pattern and allowEmpty", () => {
		expect(secureString().safeParse("ok").success).toBe(true);
		expect(secureString().safeParse("").success).toBe(false);
		expect(secureString({ allowEmpty: true }).safeParse("").success).toBe(true);
		expect(secureString({ max: 3 }).safeParse("toolong").success).toBe(false);
		expect(secureString({ pattern: /^[a-z]+$/ }).safeParse("UPPER").success).toBe(false);
		expect(secureString({ pattern: /^[a-z]+$/ }).safeParse("lower").success).toBe(true);
	});

	it("uuid, tenant, email, and key-id schemas accept valid and reject invalid", () => {
		expect(secureUuid().safeParse(UUID).success).toBe(true);
		expect(secureUuid().safeParse("nope").success).toBe(false);
		expect(secureTenantId().safeParse(UUID).success).toBe(true);
		expect(secureTenantId().safeParse("nope").success).toBe(false);
		expect(secureEmail().safeParse("u@example.com").success).toBe(true);
		expect(secureEmail().safeParse("not-an-email").success).toBe(false);
		expect(
			secureEmail().safeParse(`${"x".repeat(VALIDATION_LIMITS.EMAIL_MAX_LENGTH)}@e.com`).success,
		).toBe(false);
		expect(secureKeyId().safeParse("key_1-A").success).toBe(true);
		expect(secureKeyId().safeParse("bad key!").success).toBe(false);
	});
});

describe("formatValidationError", () => {
	function issuesFor(schema: z.ZodTypeAny, value: unknown): z.ZodError {
		const result = schema.safeParse(value);
		if (result.success) throw new Error("expected failure");
		return result.error;
	}

	it("maps field paths, sanitizes messages, and derives expectations per issue code", () => {
		const schema = z.object({
			name: z.string().min(2).max(4),
			email: z.string().email(),
			id: z.string().uuid(),
			kind: z.enum(["a", "b"]),
			count: z.number(),
			pat: z.string().regex(/^[a-z]+$/),
		});
		const error = issuesFor(schema, {
			name: "toolong!",
			email: "x",
			id: "y",
			kind: "c",
			count: "nope",
			pat: "UPPER",
		});
		const formatted = formatValidationError(error);
		expect(formatted.statusCode).toBe(400);
		expect(formatted.error).toBe("VALIDATION_ERROR");
		expect(formatted.message).toContain("Validation failed:");
		const byField = Object.fromEntries(formatted.violations.map((v) => [v.field, v.expected]));
		expect(byField["name"]).toContain("max length");
		expect(byField["email"]).toBe("valid email address");
		expect(byField["id"]).toBe("valid UUID");
		expect(byField["kind"]).toContain("one of:");
		expect(byField["count"]).toBe("number");
		expect(byField["pat"]).toBe("value matching required pattern");
	});

	it("uses root for empty paths and min-length expectations", () => {
		const error = (() => {
			const r = z.string().min(3).safeParse("x");
			if (r.success) throw new Error("expected failure");
			return r.error;
		})();
		const formatted = formatValidationError(error);
		expect(formatted.violations[0]?.field).toBe("root");
		expect(formatted.violations[0]?.expected).toContain("min length");
	});
});

describe("tier-limits", () => {
	it("grants and denies each feature per the tier matrix", () => {
		// storage/search on all tiers
		expect(() => checkTierAccess("storage", "free")).not.toThrow();
		expect(() => checkTierAccess("search", "free")).not.toThrow();
		// gated features per tier flags
		for (const [tier, limits] of Object.entries(TIER_LIMITS)) {
			const t = tier as keyof typeof TIER_LIMITS;
			expect(isFeatureEnabled("ai-inference", t)).toBe(limits.aiInferenceEnabled);
			expect(isFeatureEnabled("ai-training", t)).toBe(limits.aiTrainingEnabled);
			expect(isFeatureEnabled("enclaves", t)).toBe(limits.enclavesEnabled);
			expect(isFeatureEnabled("vault", t)).toBe(limits.vaultEnabled);
			expect(isFeatureEnabled("sse", t)).toBe(limits.sseEnabled);
		}
	});

	it("throws a descriptive TierError carrying the minimum tier", () => {
		const denyingTier = (Object.entries(TIER_LIMITS).find(([, l]) => !l.enclavesEnabled) ?? [])[0];
		if (!denyingTier) throw new Error("expected at least one tier without enclaves");
		try {
			checkTierAccess("enclaves", denyingTier as never);
			throw new Error("expected TierError");
		} catch (error) {
			expect(error).toBeInstanceOf(TierError);
			const tierError = error as TierError;
			expect(tierError.feature).toBe("enclaves");
			expect(tierError.requiredTier).toBe(FEATURE_REQUIREMENTS.enclaves.minimumTier);
			expect(tierError.message).toContain("Upgrade at");
		}
	});

	it("unknown tiers fail closed and getTierLimits falls back to the platform superset", () => {
		expect(() => checkTierAccess("vault", "made-up-tier" as never)).toThrow(TierError);
		const fallback = getTierLimits("made-up-tier" as never);
		expect(fallback.vaultEnabled).toBe(true);
		expect(getTierLimits("free").vaultEnabled).toBe(TIER_LIMITS.free.vaultEnabled);
		expect(isFeatureEnabled("vault", "made-up-tier" as never)).toBe(false);
	});
});
