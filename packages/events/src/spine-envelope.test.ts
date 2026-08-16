import { describe, expect, it } from "vitest";
import {
	createIdempotencyKey,
	createSpineEvent,
	isValidEventType,
	parseEventType,
	spineEventEnvelopeSchema,
} from "./spine-envelope.js";

const BASE = {
	eventType: "tenant.policy.updated.v2",
	tenantId: "tenant-1",
	subject: "policy-1",
	payload: { version: 2 },
	producer: { service: "tenant-service", version: "1.0.0" },
	environment: "prod" as const,
	idempotencyKey: "tenant-1:policy-1:2",
};

describe("spine event envelope", () => {
	it("creates UUIDv7-like defaults and accepts every override", () => {
		const generated = createSpineEvent(BASE);
		expect(generated.eventId).toMatch(/^[0-9a-f-]{36}$/);
		expect(generated.eventVersion).toBe("1");
		expect(generated.privacy.classification).toBe("INTERNAL");

		const full = createSpineEvent({
			...BASE,
			eventVersion: "2",
			correlationId: "00000000-0000-4000-8000-000000000001",
			causationId: "00000000-0000-4000-8000-000000000002",
			occurredAt: "2026-08-14T00:00:00.000Z",
			privacy: { classification: "CONFIDENTIAL", redactionHints: ["token"] },
		});
		expect(full).toMatchObject({
			eventVersion: "2",
			correlationId: "00000000-0000-4000-8000-000000000001",
			causationId: "00000000-0000-4000-8000-000000000002",
			occurredAt: "2026-08-14T00:00:00.000Z",
			privacy: { classification: "CONFIDENTIAL", redactionHints: ["token"] },
		});
		expect(spineEventEnvelopeSchema.safeParse(full).success).toBe(true);
	});

	it("applies every schema-level default when parsing a minimal raw envelope", () => {
		const parsed = spineEventEnvelopeSchema.parse({
			eventType: BASE.eventType,
			producer: BASE.producer,
			environment: BASE.environment,
			tenantId: BASE.tenantId,
			subject: BASE.subject,
			idempotencyKey: BASE.idempotencyKey,
			payload: BASE.payload,
		});
		expect(parsed.eventId).toHaveLength(36);
		expect(parsed.correlationId).toHaveLength(36);
		expect(parsed.occurredAt).toBeTruthy();
		expect(parsed.emittedAt).toBeTruthy();
		expect(parsed.privacy).toEqual({ classification: "INTERNAL" });
	});

	it("parses valid event types and rejects malformed types", () => {
		expect(parseEventType("tenant.policy.updated.v12")).toEqual({
			domain: "tenant",
			entity: "policy",
			action: "updated",
			version: 12,
		});
		expect(parseEventType("Tenant.policy.updated.v1")).toBeNull();
		expect(isValidEventType("tenant.policy.updated.v1")).toBe(true);
		expect(isValidEventType("invalid")).toBe(false);
		expect(createIdempotencyKey("tenant", "policy", "2")).toBe("tenant:policy:2");
	});
});
