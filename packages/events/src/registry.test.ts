import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	getAllEventTypes,
	getEventTypeDefinition,
	isRegisteredEventType,
	registerEventType,
} from "./registry.js";

describe("event registry", () => {
	it("enumerates built-in definitions and reports missing entries", () => {
		expect(getAllEventTypes().length).toBeGreaterThanOrEqual(8);
		expect(getEventTypeDefinition("missing.event.type.v1")).toBeUndefined();
		expect(isRegisteredEventType("missing.event.type.v1")).toBe(false);
	});

	it("registers a new definition and rejects duplicates", () => {
		const definition = {
			eventType: "test.entity.created.v1",
			description: "test event",
			payloadSchema: z.object({ id: z.string() }),
			defaultPrivacy: "PUBLIC" as const,
			producers: ["test"],
			consumers: [],
		};
		registerEventType(definition);
		expect(getEventTypeDefinition(definition.eventType)).toBe(definition);
		expect(() => registerEventType(definition)).toThrow(/already registered/);
	});
});
