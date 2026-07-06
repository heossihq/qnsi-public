import { describe, expect, it } from "vitest";

import { createEventEnvelope, eventEnvelopeSchema } from "./envelope.js";

describe("@heossi/qnsi-events", () => {
	it("creates a strongly typed envelope", () => {
		const envelope = createEventEnvelope({
			topic: "auth.user.created",
			payload: { userId: "user-1" },
			metadata: {
				correlationId: "00000000-0000-0000-0000-000000000000",
				timestamp: new Date().toISOString(),
			},
		});

		expect(envelope.topic).toBe("auth.user.created");
		expect(envelope.payload).toEqual({ userId: "user-1" });
		expect(eventEnvelopeSchema.parse(envelope)).toBeTruthy();
	});

	it("defaults metadata fields", () => {
		const envelope = createEventEnvelope({
			topic: "system.ping",
			payload: { status: "ok" },
		});

		expect(envelope.metadata.timestamp).toBeDefined();
		expect(envelope.id).toHaveLength(36);
	});

	it("defaults metadata.timestamp when metadata is provided without it", () => {
		const envelope = createEventEnvelope({
			topic: "system.ping",
			payload: { status: "ok" },
			metadata: { correlationId: "00000000-0000-0000-0000-000000000000" } as any,
		});

		expect(envelope.metadata.correlationId).toBe("00000000-0000-0000-0000-000000000000");
		expect(envelope.metadata.timestamp).toBeDefined();
	});
});
