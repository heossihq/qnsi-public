import { describe, expect, it } from "vitest";

import {
	type AccessControlClientTelemetry,
	type AccessControlClientTelemetryConfig,
	isAccessControlClientTelemetry,
} from "./observability.js";
import { uuidSchema, validateUUID } from "./validation.js";

describe("@heossihq/qnsi-access-control-sdk validation", () => {
	it("accepts valid UUIDs", () => {
		const value = "00000000-0000-0000-0000-000000000000";

		expect(() => validateUUID(value, "tenantId")).not.toThrow();
		expect(uuidSchema.parse(value)).toBe(value);
	});

	it("throws on invalid UUIDs", () => {
		expect(() => validateUUID("not-a-uuid", "tenantId")).toThrow(/Invalid tenantId/);
	});
});

describe("@heossihq/qnsi-access-control-sdk observability type guard", () => {
	it("isAccessControlClientTelemetry distinguishes config from implementation", () => {
		const telemetry: AccessControlClientTelemetry = {
			record() {
				// no-op for test
			},
		};
		const config: AccessControlClientTelemetryConfig = {
			serviceName: "test-service",
		};

		expect(isAccessControlClientTelemetry(telemetry)).toBe(true);
		expect(isAccessControlClientTelemetry(config)).toBe(false);
	});
});
