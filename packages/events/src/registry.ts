import { z } from "zod";

export interface EventTypeDefinition {
	readonly eventType: string;
	readonly description: string;
	readonly payloadSchema: z.ZodType;
	readonly defaultPrivacy: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
	readonly producers: readonly string[];
	readonly consumers: readonly string[];
}

const eventTypeRegistry = new Map<string, EventTypeDefinition>();

export function registerEventType(definition: EventTypeDefinition): void {
	if (eventTypeRegistry.has(definition.eventType)) {
		throw new Error(`Event type already registered: ${definition.eventType}`);
	}
	eventTypeRegistry.set(definition.eventType, definition);
}

export function getEventTypeDefinition(eventType: string): EventTypeDefinition | undefined {
	return eventTypeRegistry.get(eventType);
}

export function getAllEventTypes(): readonly EventTypeDefinition[] {
	return [...eventTypeRegistry.values()];
}

export function isRegisteredEventType(eventType: string): boolean {
	return eventTypeRegistry.has(eventType);
}

export const tenantTierChangedPayloadSchema = z.object({
	previousTier: z.string(),
	newTier: z.string(),
	reason: z.enum(["upgrade", "downgrade", "trial_end", "admin_override"]),
	effectiveAt: z.string().datetime({ offset: true }),
});

export const tenantAlgorithmPolicyProvisionedPayloadSchema = z.object({
	policyTier: z.enum(["default", "strict", "maximum", "government"]),
	allowedKemAlgorithms: z.array(z.string()),
	allowedSignatureAlgorithms: z.array(z.string()),
	requireHsmForRootKeys: z.boolean(),
	maxKeyAgeDays: z.number().int().positive(),
});

/**
 * Crypto policy tier transition.
 *
 * Emitted when a tenant's crypto policy tier changes, carrying the assurance DECISION and
 * not merely the tier names: whether existing attestations are staled by the change, over
 * what scope, and which strategy properties moved. An auditor reading this event can tell
 * whether the tenant's prior cryptographic evidence still supports the tier they now hold.
 *
 * There is deliberately no key count. Provider attestations are constructed per operation
 * and are not persisted per key, so any "keys affected" number would be invented rather
 * than measured. Absent beats fabricated.
 */
export const cryptoPolicyTransitionedPayloadSchema = z.object({
	previousTier: z.enum(["default", "strict", "maximum", "government"]),
	newTier: z.enum(["default", "strict", "maximum", "government"]),
	direction: z.enum(["promotion", "demotion", "lateral"]),
	reattestationRequired: z.boolean(),
	reattestationScope: z.enum(["none", "signature", "all"]),
	staleAttestationProperties: z.array(z.string()),
	assuranceReduced: z.boolean(),
	/** SHA3-256 over the transition analysis, so the recorded decision is re-derivable. */
	analysisDigest: z.string().regex(/^[0-9a-f]{64}$/),
	/** Who or what caused the transition. */
	actor: z.string().min(1),
	reason: z.enum(["billing_tier_change", "admin_override", "compliance_requirement"]),
	effectiveAt: z.string().datetime({ offset: true }),
});

export const cryptoCompliancePolicyChangedPayloadSchema = z.object({
	policyId: z.string(),
	policyName: z.string(),
	action: z.enum(["created", "updated", "deleted", "enabled", "disabled"]),
	rules: z.array(
		z.object({
			type: z.string(),
			config: z.record(z.string(), z.unknown()),
		}),
	),
});

export const cryptoAssetDiscoveredPayloadSchema = z.object({
	assetId: z.string(),
	assetType: z.enum(["certificate", "key", "secret", "tls_endpoint", "ssh_key", "jwt_key"]),
	source: z.string(),
	algorithm: z.string().optional(),
	cryptoGeneration: z.enum(["pqc", "hybrid", "classical"]).optional(),
	expiresAt: z.string().datetime({ offset: true }).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const securityThreatDetectedPayloadSchema = z.object({
	threatId: z.string(),
	severity: z.enum(["critical", "high", "medium", "low", "info"]),
	category: z.string(),
	description: z.string(),
	affectedResources: z.array(z.string()),
	recommendedActions: z.array(z.string()),
	detectedAt: z.string().datetime({ offset: true }),
});

export const serviceHealthDegradedPayloadSchema = z.object({
	serviceName: z.string(),
	status: z.enum(["degraded", "unhealthy", "recovered"]),
	healthScore: z.number().min(0).max(100),
	failingChecks: z.array(z.string()),
	lastHealthyAt: z.string().datetime({ offset: true }).optional(),
});

export const aiRecommendationIssuedPayloadSchema = z.object({
	recommendationId: z.string(),
	category: z.enum(["security", "performance", "cost", "compliance", "crypto_migration"]),
	priority: z.enum(["critical", "high", "medium", "low"]),
	title: z.string(),
	description: z.string(),
	suggestedActions: z.array(
		z
			.object({
				action: z.string(),
				automated: z.boolean(),
				estimatedImpact: z.string().optional(),
			})
			.strict(),
	),
	confidence: z.number().min(0).max(1),
	expiresAt: z.string().datetime({ offset: true }).optional(),
});

registerEventType({
	eventType: "tenant.tier.changed.v1",
	description: "Emitted when a tenant's billing tier changes",
	payloadSchema: tenantTierChangedPayloadSchema,
	defaultPrivacy: "INTERNAL",
	producers: ["billing-service"],
	consumers: ["ai-orchestrator", "crypto-inventory-service", "edge-gateway", "audit-service"],
});

registerEventType({
	eventType: "tenant.crypto_policy.transitioned.v1",
	description:
		"Emitted when a tenant's crypto policy tier changes, carrying the re-attestation determination",
	payloadSchema: cryptoPolicyTransitionedPayloadSchema,
	defaultPrivacy: "INTERNAL",
	producers: ["tenant-service"],
	consumers: ["audit-service", "kms-service", "edge-gateway", "crypto-inventory-service"],
});

registerEventType({
	eventType: "tenant.algorithm_policy.provisioned.v1",
	description: "Emitted when a tenant's algorithm policy is provisioned or updated",
	payloadSchema: tenantAlgorithmPolicyProvisionedPayloadSchema,
	defaultPrivacy: "INTERNAL",
	producers: ["tenant-service"],
	consumers: ["edge-gateway", "crypto-inventory-service", "ai-orchestrator"],
});

registerEventType({
	eventType: "crypto.compliance_policy.changed.v1",
	description: "Emitted when a crypto compliance policy is created, updated, or deleted",
	payloadSchema: cryptoCompliancePolicyChangedPayloadSchema,
	defaultPrivacy: "INTERNAL",
	producers: ["crypto-inventory-service"],
	consumers: ["ai-orchestrator", "audit-service"],
});

registerEventType({
	eventType: "crypto.asset.discovered.v1",
	description: "Emitted when a new crypto asset is discovered during scanning",
	payloadSchema: cryptoAssetDiscoveredPayloadSchema,
	defaultPrivacy: "INTERNAL",
	producers: ["crypto-inventory-service"],
	consumers: ["ai-orchestrator", "security-monitoring-service"],
});

registerEventType({
	eventType: "security.threat.detected.v1",
	description: "Emitted when a security threat is detected",
	payloadSchema: securityThreatDetectedPayloadSchema,
	defaultPrivacy: "CONFIDENTIAL",
	producers: ["security-monitoring-service"],
	consumers: ["ai-orchestrator", "audit-service", "edge-gateway"],
});

registerEventType({
	eventType: "service.health.degraded.v1",
	description: "Emitted when a service health status changes",
	payloadSchema: serviceHealthDegradedPayloadSchema,
	defaultPrivacy: "INTERNAL",
	producers: ["observability-service"],
	consumers: ["ai-orchestrator"],
});

registerEventType({
	eventType: "ai.recommendation.issued.v1",
	description: "Emitted when the AI issues a recommendation",
	payloadSchema: aiRecommendationIssuedPayloadSchema,
	defaultPrivacy: "INTERNAL",
	producers: ["ai-orchestrator"],
	consumers: [],
});

export type TenantTierChangedPayload = z.infer<typeof tenantTierChangedPayloadSchema>;
export type TenantAlgorithmPolicyProvisionedPayload = z.infer<
	typeof tenantAlgorithmPolicyProvisionedPayloadSchema
>;
export type CryptoCompliancePolicyChangedPayload = z.infer<
	typeof cryptoCompliancePolicyChangedPayloadSchema
>;
export type CryptoAssetDiscoveredPayload = z.infer<typeof cryptoAssetDiscoveredPayloadSchema>;
export type SecurityThreatDetectedPayload = z.infer<typeof securityThreatDetectedPayloadSchema>;
export type ServiceHealthDegradedPayload = z.infer<typeof serviceHealthDegradedPayloadSchema>;
export type AiRecommendationIssuedPayload = z.infer<typeof aiRecommendationIssuedPayloadSchema>;
