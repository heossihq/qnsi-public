import { describe, expect, it } from "vitest";

import { isUnlimitedLimit, parseEntitlementLimits } from "./entitlement-limits.js";

/**
 * Regression for the 2026-08-15 schema-drift incident: pricing TierLimits
 * grew three codeScan* fields, this schema stayed strict with 13 - so every
 * limits payload billing served parsed to NULL, and fail-closed count-gates
 * denied paid-sensitive requests with ENTITLEMENTS_UNAVAILABLE.
 *
 * The 16-key literal below mirrors packages/pricing/src/tiers.ts TierLimits
 * (free tier). If pricing grows another field, this test must fail until the
 * schema learns it - that is the point.
 */
const FREE_TIER_LIMITS_16_KEYS = {
	storageGB: 10,
	apiCalls: 50_000,
	enclavesEnabled: false,
	aiTrainingEnabled: false,
	aiInferenceEnabled: true,
	sseEnabled: false,
	vaultEnabled: true,
	vaultSecretsCount: 25,
	vaultSecretVersionsCount: 100,
	kmsKeysCount: 20,
	kmsOpsPerMonth: 20_000,
	apiKeysCount: 3,
	cryptoPolicyTier: "default",
	codeScanRepos: 1,
	codeScanFindingsStored: 500,
	codeScanUploadsPerRepoPerDay: 4,
};

describe("parseEntitlementLimits", () => {
	it("parses the CURRENT 16-key pricing TierLimits shape (schema-drift regression)", () => {
		const parsed = parseEntitlementLimits(FREE_TIER_LIMITS_16_KEYS);
		expect(parsed).not.toBeNull();
		expect(parsed?.kmsKeysCount).toBe(20);
		expect(parsed?.codeScanRepos).toBe(1);
	});

	it("parses the pre-drift 13-key shape, defaulting codeScan limits to unlimited", () => {
		const {
			codeScanRepos: _r,
			codeScanFindingsStored: _f,
			codeScanUploadsPerRepoPerDay: _u,
			...thirteenKeys
		} = FREE_TIER_LIMITS_16_KEYS;
		const parsed = parseEntitlementLimits(thirteenKeys);
		expect(parsed).not.toBeNull();
		expect(parsed?.codeScanRepos).toBe(-1);
		expect(isUnlimitedLimit(parsed?.codeScanRepos as number)).toBe(true);
	});

	it("normalizes null limits to -1 (unlimited); Infinity is rejected by z.number()", () => {
		const parsed = parseEntitlementLimits({
			...FREE_TIER_LIMITS_16_KEYS,
			kmsKeysCount: null,
		});
		expect(parsed?.kmsKeysCount).toBe(-1);
		// zod's z.number() rejects Infinity before the transform runs, so an
		// Infinity limit fails the whole parse - pinned as actual behavior.
		expect(
			parseEntitlementLimits({ ...FREE_TIER_LIMITS_16_KEYS, apiCalls: Number.POSITIVE_INFINITY }),
		).toBeNull();
	});

	it("still rejects unknown keys (strict) and malformed values", () => {
		expect(parseEntitlementLimits({ ...FREE_TIER_LIMITS_16_KEYS, surprise: 1 })).toBeNull();
		expect(parseEntitlementLimits({ ...FREE_TIER_LIMITS_16_KEYS, kmsKeysCount: "20" })).toBeNull();
		expect(parseEntitlementLimits(null)).toBeNull();
	});
});
