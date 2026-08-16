import { ConsoleMetricExporter, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type CryptoInventoryTelemetryEvent,
	createCryptoInventoryTelemetry,
	isCryptoInventoryTelemetry,
} from "./observability.js";

beforeEach(() => {
	vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

function event(
	overrides: Partial<CryptoInventoryTelemetryEvent> = {},
): CryptoInventoryTelemetryEvent {
	return {
		operation: "listAssets",
		method: "GET",
		route: "/crypto/v1/assets",
		status: "ok",
		durationMs: 12,
		...overrides,
	};
}

describe("createCryptoInventoryTelemetry", () => {
	it("records an ok event", () => {
		const telemetry = createCryptoInventoryTelemetry({ serviceName: "crypto-inventory-sdk" });

		expect(() => telemetry.record(event())).not.toThrow();
	});

	it("records an error event with and without a message", () => {
		const telemetry = createCryptoInventoryTelemetry({ serviceName: "crypto-inventory-sdk" });

		expect(() =>
			telemetry.record(event({ status: "error", error: "boom", httpStatus: 500 })),
		).not.toThrow();
		expect(() => telemetry.record(event({ status: "error" }))).not.toThrow();
	});

	it("records a target distinct from the route", () => {
		const telemetry = createCryptoInventoryTelemetry({ serviceName: "crypto-inventory-sdk" });

		expect(() => telemetry.record(event({ target: "crypto.example" }))).not.toThrow();
	});

	it("uses a caller-supplied exporter factory", async () => {
		// A genuine SDK reader: MeterProvider rejects anything else.
		const reader = new PeriodicExportingMetricReader({
			exporter: new ConsoleMetricExporter(),
			exportIntervalMillis: 60_000,
		});
		const exporterFactory = vi.fn(() => reader);

		createCryptoInventoryTelemetry({ serviceName: "crypto-inventory-sdk", exporterFactory });

		expect(exporterFactory).toHaveBeenCalledTimes(1);
		await reader.shutdown();
	});

	it("builds an OTLP reader when an endpoint is configured", () => {
		expect(() =>
			createCryptoInventoryTelemetry({
				serviceName: "crypto-inventory-sdk",
				otlpEndpoint: "http://collector.internal:4318/v1/metrics",
				metricsIntervalMs: 1_000,
				metricsTimeoutMs: 500,
			}),
		).not.toThrow();
	});

	it("adds no reader under a test environment with no endpoint", () => {
		expect(() =>
			createCryptoInventoryTelemetry({ serviceName: "crypto-inventory-sdk" }),
		).not.toThrow();
	});

	it("falls back to a console reader outside a test environment", () => {
		vi.stubEnv("NODE_ENV", "production");

		expect(() =>
			createCryptoInventoryTelemetry({ serviceName: "crypto-inventory-sdk" }),
		).not.toThrow();
	});

	it("carries an explicit version and environment when supplied", () => {
		expect(() =>
			createCryptoInventoryTelemetry({
				serviceName: "crypto-inventory-sdk",
				serviceVersion: "1.2.3",
				environment: "production",
			}),
		).not.toThrow();
	});

	it("omits the version and defaults the environment when neither is supplied", () => {
		expect(() =>
			createCryptoInventoryTelemetry({ serviceName: "crypto-inventory-sdk" }),
		).not.toThrow();
	});
});

describe("isCryptoInventoryTelemetry", () => {
	it("recognises a telemetry instance", () => {
		expect(isCryptoInventoryTelemetry({ record: () => {} })).toBe(true);
	});

	it("rejects a config object", () => {
		expect(isCryptoInventoryTelemetry({ serviceName: "crypto-inventory-sdk" })).toBe(false);
	});

	it("rejects a nullish value", () => {
		expect(isCryptoInventoryTelemetry(undefined as never)).toBe(false);
	});
});
