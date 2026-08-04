import { describe, expect, it } from "vitest";

import {
	type AuditClientTelemetry,
	type AuditClientTelemetryConfig,
	isAuditClientTelemetry,
} from "./observability.js";
import { uuidSchema, validateUUID } from "./validation.js";

describe("@heossihq/qnsi-audit-sdk validation", () => {
	it("accepts valid UUIDs", () => {
		const value = "00000000-0000-0000-0000-000000000000";

		expect(() => validateUUID(value, "tenantId")).not.toThrow();
		expect(uuidSchema.parse(value)).toBe(value);
	});

	it("throws on invalid UUIDs", () => {
		expect(() => validateUUID("not-a-uuid", "tenantId")).toThrow(/Invalid tenantId/);
	});
});

describe("@heossihq/qnsi-audit-sdk observability type guard", () => {
	it("isAuditClientTelemetry distinguishes config from implementation", () => {
		const telemetry: AuditClientTelemetry = {
			record() {
				// no-op for test
			},
		};
		const config: AuditClientTelemetryConfig = {
			serviceName: "test-service",
		};

		expect(isAuditClientTelemetry(telemetry)).toBe(true);
		expect(isAuditClientTelemetry(config)).toBe(false);
	});
});
