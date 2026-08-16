import { describe, expect, it } from "vitest";
import {
	getRedactionHintsForClassification,
	redactEventForLogging,
	redactPaths,
} from "./redaction.js";
import { createSpineEvent } from "./spine-envelope.js";

describe("event redaction", () => {
	it("returns events unchanged without hints and redacts hinted nested payloads", () => {
		const event = createSpineEvent({
			eventType: "test.entity.created.v1",
			tenantId: "tenant-1",
			subject: "subject-1",
			payload: { password: "secret", nested: { email: "a@example.com" } },
			producer: { service: "test", version: "1" },
			environment: "dev",
			idempotencyKey: "key-1",
		});
		expect(redactEventForLogging(event)).toBe(event);
		const protectedEvent = {
			...event,
			privacy: {
				classification: "RESTRICTED" as const,
				redactionHints: ["password", "$.user.email"],
			},
		};
		expect(redactEventForLogging(protectedEvent).payload).toEqual({
			password: "[REDACTED]",
			nested: { email: "[REDACTED]" },
		});
		expect(redactEventForLogging(protectedEvent, { redactValue: "hidden" }).payload).toEqual({
			password: "hidden",
			nested: { email: "hidden" },
		});
	});

	it("handles nulls, primitives, arrays, partial-key hints, and type preservation", () => {
		expect(redactPaths(null, ["secret"])).toBeNull();
		expect(redactPaths(undefined, ["secret"])).toBeUndefined();
		expect(redactPaths("plain", ["secret"])).toBe("plain");
		const value = {
			apiSecretValue: "x",
			count: 4,
			enabled: true,
			items: [1, 2],
			object: { value: 1 },
			nil: null,
			untouched: "ok",
		};
		expect(
			redactPaths(value, ["secret", "count", "enabled", "items", "object", "nil"], "x", true),
		).toEqual({
			apiSecretValue: "***",
			count: 0,
			enabled: false,
			items: [],
			object: {},
			nil: "[REDACTED]",
			untouched: "ok",
		});
		expect(redactPaths([{ token: "x" }], ["token"])).toEqual([{ token: "[REDACTED]" }]);
	});

	it("selects redaction hints for every classification", () => {
		expect(getRedactionHintsForClassification("PUBLIC")).toEqual([]);
		expect(getRedactionHintsForClassification("INTERNAL")).toContain("password");
		expect(getRedactionHintsForClassification("CONFIDENTIAL")).toContain("cardNumber");
		expect(getRedactionHintsForClassification("RESTRICTED")).toContain("email");
	});
});
