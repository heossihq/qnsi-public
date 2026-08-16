import { describe, expect, it } from "vitest";
import {
	cryptoPolicyTransitionedPayloadSchema,
	getEventTypeDefinition,
	isRegisteredEventType,
} from "./registry.js";

const EVENT_TYPE = "tenant.crypto_policy.transitioned.v1";

const VALID = {
	previousTier: "default",
	newTier: "maximum",
	direction: "promotion",
	reattestationRequired: true,
	reattestationScope: "all",
	staleAttestationProperties: ["secondary", "crossVerificationRequired"],
	assuranceReduced: false,
	analysisDigest: "a".repeat(64),
	actor: "billing-service",
	reason: "billing_tier_change",
	effectiveAt: "2026-08-08T00:00:00.000Z",
} as const;

describe(EVENT_TYPE, () => {
	it("is registered with tenant-service as producer and audit-service as a consumer", () => {
		expect(isRegisteredEventType(EVENT_TYPE)).toBe(true);
		const def = getEventTypeDefinition(EVENT_TYPE);
		expect(def).toBeDefined();
		expect(def?.producers).toContain("tenant-service");
		// The audit leg is the point of the event: without this consumer the transition is
		// never recorded on the chain, which was the original defect.
		expect(def?.consumers).toContain("audit-service");
		expect(def?.consumers).toContain("kms-service");
		expect(def?.defaultPrivacy).toBe("INTERNAL");
	});

	it("accepts a well-formed transition payload", () => {
		expect(cryptoPolicyTransitionedPayloadSchema.safeParse(VALID).success).toBe(true);
	});

	it("rejects a tier outside the known set", () => {
		const r = cryptoPolicyTransitionedPayloadSchema.safeParse({ ...VALID, newTier: "platinum" });
		expect(r.success).toBe(false);
	});

	it("rejects a malformed analysis digest, so the decision stays re-derivable", () => {
		for (const bad of ["", "abc", "z".repeat(64), "A".repeat(64)]) {
			const r = cryptoPolicyTransitionedPayloadSchema.safeParse({ ...VALID, analysisDigest: bad });
			expect(r.success, `digest ${JSON.stringify(bad)} must be rejected`).toBe(false);
		}
	});

	it("requires a non-empty actor", () => {
		expect(cryptoPolicyTransitionedPayloadSchema.safeParse({ ...VALID, actor: "" }).success).toBe(
			false,
		);
	});

	it("requires an offset-bearing timestamp", () => {
		expect(
			cryptoPolicyTransitionedPayloadSchema.safeParse({ ...VALID, effectiveAt: "2026-08-08" })
				.success,
		).toBe(false);
	});

	it("carries no key-count field, because attestations are not persisted per key", () => {
		const shape = Object.keys(cryptoPolicyTransitionedPayloadSchema.shape);
		for (const key of shape) expect(key).not.toMatch(/count|keysAffected|numKeys/i);
	});
});
