/**
 * Tier Limits - Shared across all SDKs
 *
 * Defines the tier-gated capabilities surfaced through the @qnsp SDK surface.
 * SDKs use this to fail fast with clear, typed errors before making API calls.
 *
 * Architecture note:
 *   This catalogue is deliberately **inlined** rather than imported from the
 *   internal `@heossihq/qnsi-pricing` package. `@heossihq/qnsi-pricing` is a private workspace
 *   package that contains the full commercial model (Stripe product ids,
 *   per-cycle prices in cents, add-on SKUs, sales-motion signals) which must
 *   NOT leak onto the public npm registry.
 *
 *   Drift with `@heossihq/qnsi-pricing` is prevented at build time by
 *   `tier-limits.drift.test.ts`, which imports `@heossihq/qnsi-pricing` as a
 *   devDependency and asserts every value in `TIER_LIMITS` matches the
 *   internal source of truth. If marketing tweaks a tier flag there, the
 *   drift test fails until this file is updated in lockstep.
 */

export type BillingPricingTier =
	| "free"
	| "dev-starter"
	| "dev-pro"
	| "dev-elite"
	| "dev-team"
	| "business-team"
	| "business-advanced"
	| "business-elite"
	| "enterprise-standard"
	| "enterprise-pro"
	| "enterprise-elite"
	| "specialized";

export type PricingTier = BillingPricingTier | "platform";

export interface TierLimits {
	readonly storageGB: number;
	readonly apiCalls: number;
	readonly enclavesEnabled: boolean;
	readonly aiTrainingEnabled: boolean;
	readonly aiInferenceEnabled: boolean;
	readonly sseEnabled: boolean;
	readonly vaultEnabled: boolean;
}

/**
 * Inlined projection of the internal `@heossihq/qnsi-pricing` TIER_PRICING catalogue.
 * Only the 7 fields SDK consumers need to reason about feature availability.
 * Drift-guarded by `tier-limits.drift.test.ts` at build time.
 */
const BILLING_TIER_LIMITS: Record<BillingPricingTier, TierLimits> = {
	free: {
		storageGB: 10,
		apiCalls: 50_000,
		enclavesEnabled: false,
		aiTrainingEnabled: false,
		aiInferenceEnabled: false,
		sseEnabled: false,
		vaultEnabled: true,
	},
	"dev-starter": {
		storageGB: 100,
		apiCalls: 100_000,
		enclavesEnabled: false,
		aiTrainingEnabled: false,
		aiInferenceEnabled: false,
		sseEnabled: false,
		vaultEnabled: true,
	},
	"dev-pro": {
		storageGB: 250,
		apiCalls: 500_000,
		enclavesEnabled: false,
		aiTrainingEnabled: false,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
	"dev-elite": {
		storageGB: 500,
		apiCalls: 750_000,
		enclavesEnabled: false,
		aiTrainingEnabled: false,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
	"dev-team": {
		storageGB: 1_000,
		apiCalls: 1_000_000,
		enclavesEnabled: false,
		aiTrainingEnabled: false,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
	"business-team": {
		storageGB: 5_000,
		apiCalls: 1_500_000,
		enclavesEnabled: false,
		aiTrainingEnabled: false,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
	"business-advanced": {
		storageGB: 10_000,
		apiCalls: 7_500_000,
		enclavesEnabled: false,
		aiTrainingEnabled: false,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
	"business-elite": {
		storageGB: 15_000,
		apiCalls: 10_000_000,
		enclavesEnabled: false,
		aiTrainingEnabled: false,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
	"enterprise-standard": {
		storageGB: 20_000,
		apiCalls: 15_000_000,
		enclavesEnabled: true,
		aiTrainingEnabled: false,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
	"enterprise-pro": {
		storageGB: 25_000,
		apiCalls: 30_000_000,
		enclavesEnabled: true,
		aiTrainingEnabled: true,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
	"enterprise-elite": {
		storageGB: -1,
		apiCalls: -1,
		enclavesEnabled: true,
		aiTrainingEnabled: true,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
	specialized: {
		storageGB: -1,
		apiCalls: -1,
		enclavesEnabled: true,
		aiTrainingEnabled: true,
		aiInferenceEnabled: true,
		sseEnabled: true,
		vaultEnabled: true,
	},
};

/**
 * Internal QNSP platform tier - for QNSP staff, ops admins, and super admins only.
 * Never exposed to customers. Superset of enterprise-elite + specialized.
 */
const PLATFORM_TIER_LIMITS: TierLimits = {
	storageGB: -1,
	apiCalls: -1,
	enclavesEnabled: true,
	aiTrainingEnabled: true,
	aiInferenceEnabled: true,
	sseEnabled: true,
	vaultEnabled: true,
};

export const TIER_LIMITS: Record<PricingTier, TierLimits> = {
	...BILLING_TIER_LIMITS,
	platform: PLATFORM_TIER_LIMITS,
};

export type FeatureName =
	| "storage"
	| "search"
	| "ai-inference"
	| "ai-training"
	| "enclaves"
	| "vault"
	| "sse";

export interface FeatureRequirement {
	readonly feature: FeatureName;
	readonly minimumTier: PricingTier;
	readonly description: string;
}

export const FEATURE_REQUIREMENTS: Record<FeatureName, FeatureRequirement> = {
	storage: {
		feature: "storage",
		minimumTier: "free",
		description: "Quantum-secure storage",
	},
	search: {
		feature: "search",
		minimumTier: "free",
		description: "Full-text and vector search",
	},
	"ai-inference": {
		feature: "ai-inference",
		minimumTier: "dev-pro",
		description: "AI inference (non-enclave)",
	},
	"ai-training": {
		feature: "ai-training",
		minimumTier: "enterprise-pro",
		description: "Encrypted AI training and fine-tuning",
	},
	enclaves: {
		feature: "enclaves",
		minimumTier: "enterprise-standard",
		description: "Secure enclave execution",
	},
	vault: {
		feature: "vault",
		minimumTier: "free",
		description: "Secrets management with envelope encryption",
	},
	sse: {
		feature: "sse",
		minimumTier: "dev-pro",
		description: "Server-side encryption for search",
	},
};

export class TierError extends Error {
	constructor(
		public readonly feature: FeatureName,
		public readonly currentTier: PricingTier,
		public readonly requiredTier: PricingTier,
	) {
		super(
			`Feature "${feature}" requires ${requiredTier} tier or higher. ` +
				`Current tier: ${currentTier}. ` +
				`Upgrade at https://cloud.qnsi.heossi.com/billing`,
		);
		this.name = "TierError";
	}
}

export function checkTierAccess(feature: FeatureName, currentTier: PricingTier): void {
	const limits = TIER_LIMITS[currentTier];
	if (!limits) {
		throw new TierError(feature, currentTier, "free");
	}

	const requirement = FEATURE_REQUIREMENTS[feature];
	let hasAccess = false;

	switch (feature) {
		case "storage":
		case "search":
			hasAccess = true; // Available on all tiers
			break;
		case "ai-inference":
			hasAccess = limits.aiInferenceEnabled;
			break;
		case "ai-training":
			hasAccess = limits.aiTrainingEnabled;
			break;
		case "enclaves":
			hasAccess = limits.enclavesEnabled;
			break;
		case "vault":
			hasAccess = limits.vaultEnabled;
			break;
		case "sse":
			hasAccess = limits.sseEnabled;
			break;
	}

	if (!hasAccess) {
		throw new TierError(feature, currentTier, requirement.minimumTier);
	}
}

export function getTierLimits(tier: PricingTier): TierLimits {
	return TIER_LIMITS[tier] ?? PLATFORM_TIER_LIMITS;
}

export function isFeatureEnabled(feature: FeatureName, tier: PricingTier): boolean {
	try {
		checkTierAccess(feature, tier);
		return true;
	} catch {
		return false;
	}
}
