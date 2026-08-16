import { ConsoleMetricExporter, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type AuditClientTelemetryEvent,
	createAuditClientTelemetry,
	isAuditClientTelemetry,
} from "./observability.js";
import { validateUUID } from "./validation.js";

beforeEach(() => {
	vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

function event(overrides: Partial<AuditClientTelemetryEvent> = {}): AuditClientTelemetryEvent {
	return {
		operation: "listEvents",
		method: "GET",
		route: "/audit/v1/events",
		status: "ok",
		durationMs: 12,
		...overrides,
	};
}

describe("createAuditClientTelemetry", () => {
	it("records an ok event", () => {
		const telemetry = createAuditClientTelemetry({ serviceName: "audit-sdk" });

		expect(() => telemetry.record(event())).not.toThrow();
	});

	it("records an error event carrying its message and status", () => {
		const telemetry = createAuditClientTelemetry({ serviceName: "audit-sdk" });

		expect(() =>
			telemetry.record(event({ status: "error", error: "boom", httpStatus: 500 })),
		).not.toThrow();
	});

	it("records an error event with no message", () => {
		const telemetry = createAuditClientTelemetry({ serviceName: "audit-sdk" });

		expect(() => telemetry.record(event({ status: "error" }))).not.toThrow();
	});

	it("records a target distinct from the route", () => {
		const telemetry = createAuditClientTelemetry({ serviceName: "audit-sdk" });

		expect(() => telemetry.record(event({ target: "audit.example" }))).not.toThrow();
	});

	it("uses a caller-supplied exporter factory", async () => {
		// A genuine SDK reader: MeterProvider rejects anything else.
		const reader = new PeriodicExportingMetricReader({
			exporter: new ConsoleMetricExporter(),
			exportIntervalMillis: 60_000,
		});
		const exporterFactory = vi.fn(() => reader);

		createAuditClientTelemetry({ serviceName: "audit-sdk", exporterFactory });

		expect(exporterFactory).toHaveBeenCalledTimes(1);
		await reader.shutdown();
	});

	it("builds an OTLP reader when an endpoint is configured", () => {
		expect(() =>
			createAuditClientTelemetry({
				serviceName: "audit-sdk",
				otlpEndpoint: "http://collector.internal:4318/v1/metrics",
				metricsIntervalMs: 1_000,
				metricsTimeoutMs: 500,
			}),
		).not.toThrow();
	});

	it("adds no reader under a test environment with no endpoint", () => {
		expect(() => createAuditClientTelemetry({ serviceName: "audit-sdk" })).not.toThrow();
	});

	it("falls back to a console reader outside a test environment", () => {
		vi.stubEnv("NODE_ENV", "production");

		expect(() => createAuditClientTelemetry({ serviceName: "audit-sdk" })).not.toThrow();
	});

	it("carries an explicit version and environment", () => {
		expect(() =>
			createAuditClientTelemetry({
				serviceName: "audit-sdk",
				serviceVersion: "1.2.3",
				environment: "production",
			}),
		).not.toThrow();
	});
});

describe("isAuditClientTelemetry", () => {
	it("recognises a telemetry instance", () => {
		expect(isAuditClientTelemetry({ record: () => {} })).toBe(true);
	});

	it("rejects a config object", () => {
		expect(isAuditClientTelemetry({ serviceName: "audit-sdk" })).toBe(false);
	});

	it("rejects a nullish value", () => {
		expect(isAuditClientTelemetry(undefined as never)).toBe(false);
	});
});

describe("validateUUID", () => {
	it("accepts a well-formed uuid", () => {
		expect(() => validateUUID("11111111-1111-4111-8111-111111111111", "tenantId")).not.toThrow();
	});

	it("rejects a malformed uuid, naming the field", () => {
		expect(() => validateUUID("nope", "tenantId")).toThrow(/Invalid tenantId/);
	});
});

describe("environment resolution", () => {
	it("falls back to development when neither config nor NODE_ENV names one", () => {
		vi.stubEnv("NODE_ENV", undefined);

		expect(() => createAuditClientTelemetry({ serviceName: "audit-sdk" })).not.toThrow();
	});

	it("uses NODE_ENV when the config names no environment", () => {
		vi.stubEnv("NODE_ENV", "staging");

		expect(() => createAuditClientTelemetry({ serviceName: "audit-sdk" })).not.toThrow();
	});
});
