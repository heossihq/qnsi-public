/**
 * Tier-Limits Drift Guard
 *
 * Proves the inlined SDK-facing tier catalogue in `tier-limits.ts` is
 * byte-exact with the 7-field projection of the internal
 * `@heossihq/qnsi-pricing`'s TIER_PRICING source of truth.
 *
 * This test is the sole reason `@heossihq/qnsi-pricing` is a devDependency of
 * @heossihq/qnsi-shared-kernel. At publish time the resolved package.json drops
 * devDependencies, so nothing from `@heossihq/qnsi-pricing` ever reaches consumers
 * installing from npm.
 *
 * If this test fails, either:
 *   1. The internal pricing model changed → update `tier-limits.ts` to match.
 *   2. The SDK projection was edited directly → update `@heossihq/qnsi-pricing` or
 *      revert the SDK change.
 *
 * Either way, the two catalogues must stay in lockstep at build time.
 */

import { type PricingTier, TIER_PRICING } from "@heossihq/qnsi-pricing";
import { describe, expect, it } from "vitest";

import { TIER_LIMITS, type TierLimits } from "./tier-limits.js";

/** Fields shared-kernel exposes to SDK consumers. Kept narrow on purpose. */
const SDK_FIELDS = [
	"storageGB",
	"apiCalls",
	"enclavesEnabled",
	"aiTrainingEnabled",
	"aiInferenceEnabled",
	"sseEnabled",
	"vaultEnabled",
] as const satisfies ReadonlyArray<keyof TierLimits>;

describe("tier-limits drift guard", () => {
	it("covers every PricingTier present in @heossihq/qnsi-pricing", () => {
		const pricingTiers = Object.keys(TIER_PRICING) as PricingTier[];
		for (const tier of pricingTiers) {
			expect(TIER_LIMITS, `TIER_LIMITS is missing tier '${tier}'`).toHaveProperty(tier);
		}
	});

	it.each(
		Object.keys(TIER_PRICING) as PricingTier[],
	)("projects @heossihq/qnsi-pricing -> TIER_LIMITS byte-exact for tier '%s'", (tier) => {
		const pricingLimits = TIER_PRICING[tier].limits;
		const sdkLimits = TIER_LIMITS[tier];

		for (const field of SDK_FIELDS) {
			expect(
				sdkLimits[field],
				`drift detected: TIER_LIMITS['${tier}'].${field} (${sdkLimits[field]}) ` +
					`!= @heossihq/qnsi-pricing TIER_PRICING['${tier}'].limits.${field} (${pricingLimits[field]}). ` +
					`Update packages/shared-kernel/src/tier-limits.ts to match.`,
			).toBe(pricingLimits[field]);
		}
	});

	it("'platform' is an SDK-only tier not present in the commercial catalogue", () => {
		expect(TIER_LIMITS).toHaveProperty("platform");
		expect(TIER_PRICING).not.toHaveProperty("platform");
	});
});
