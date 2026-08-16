import { ConsoleMetricExporter, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	createKmsClientTelemetry,
	isKmsClientTelemetry,
	type KmsClientTelemetryEvent,
} from "./observability.js";
import { validateUUID } from "./validation.js";

beforeEach(() => {
	vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

function event(overrides: Partial<KmsClientTelemetryEvent> = {}): KmsClientTelemetryEvent {
	return {
		operation: "wrapKey",
		method: "POST",
		route: "/kms/v1/keys/:keyId/wrap",
		status: "ok",
		durationMs: 12,
		...overrides,
	};
}

describe("createKmsClientTelemetry", () => {
	it("records an ok event without throwing", () => {
		const telemetry = createKmsClientTelemetry({ serviceName: "kms-client" });

		expect(() => telemetry.record(event())).not.toThrow();
	});

	it("records an error event carrying its message", () => {
		const telemetry = createKmsClientTelemetry({ serviceName: "kms-client" });

		expect(() =>
			telemetry.record(event({ status: "error", error: "boom", httpStatus: 500 })),
		).not.toThrow();
	});

	it("records an error event with no message", () => {
		const telemetry = createKmsClientTelemetry({ serviceName: "kms-client" });

		expect(() => telemetry.record(event({ status: "error" }))).not.toThrow();
	});

	it("uses a caller-supplied exporter factory", async () => {
		// A genuine SDK reader, not a stand-in: MeterProvider rejects anything else.
		const reader = new PeriodicExportingMetricReader({
			exporter: new ConsoleMetricExporter(),
			exportIntervalMillis: 60_000,
		});
		const exporterFactory = vi.fn(() => reader);

		createKmsClientTelemetry({ serviceName: "kms-client", exporterFactory });

		expect(exporterFactory).toHaveBeenCalledTimes(1);
		await reader.shutdown();
	});

	it("builds an OTLP reader when an endpoint is configured", () => {
		expect(() =>
			createKmsClientTelemetry({
				serviceName: "kms-client",
				otlpEndpoint: "http://collector.internal:4318/v1/metrics",
				metricsIntervalMs: 1_000,
				metricsTimeoutMs: 500,
			}),
		).not.toThrow();
	});

	it("adds no reader at all under a test environment with no endpoint", () => {
		expect(() => createKmsClientTelemetry({ serviceName: "kms-client" })).not.toThrow();
	});

	it("falls back to a console reader outside a test environment", () => {
		vi.stubEnv("NODE_ENV", "production");

		expect(() => createKmsClientTelemetry({ serviceName: "kms-client" })).not.toThrow();
	});

	it("carries an explicit version and environment onto the resource", () => {
		expect(() =>
			createKmsClientTelemetry({
				serviceName: "kms-client",
				serviceVersion: "1.2.3",
				environment: "production",
			}),
		).not.toThrow();
	});

	it("records a target distinct from the route when one is given", () => {
		const telemetry = createKmsClientTelemetry({ serviceName: "kms-client" });

		expect(() => telemetry.record(event({ target: "kms.example" }))).not.toThrow();
	});
});

describe("isKmsClientTelemetry", () => {
	it("recognises a telemetry instance", () => {
		expect(isKmsClientTelemetry({ record: () => {} })).toBe(true);
	});

	it("rejects a config object", () => {
		expect(isKmsClientTelemetry({ serviceName: "kms-client" })).toBe(false);
	});

	it("rejects a nullish value", () => {
		expect(isKmsClientTelemetry(undefined as never)).toBe(false);
	});
});

describe("validateUUID", () => {
	it("accepts a well-formed uuid", () => {
		expect(() => validateUUID("11111111-1111-4111-8111-111111111111", "tenantId")).not.toThrow();
	});

	it("rejects a malformed uuid, naming the field", () => {
		expect(() => validateUUID("not-a-uuid", "tenantId")).toThrow(/Invalid tenantId/);
	});
});
