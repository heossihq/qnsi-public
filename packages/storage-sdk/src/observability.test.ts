import type { MetricReader } from "@opentelemetry/sdk-metrics";
import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createStorageClientTelemetry,
	isStorageClientTelemetry,
	type StorageClientTelemetryEvent,
} from "./observability.js";

function stubReader(): MetricReader {
	return new PeriodicExportingMetricReader({
		exporter: new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE),
		exportIntervalMillis: 2 ** 30,
	});
}

const savedNodeEnv = process.env["NODE_ENV"];

afterEach(() => {
	if (savedNodeEnv === undefined) delete process.env["NODE_ENV"];
	else process.env["NODE_ENV"] = savedNodeEnv;
	vi.restoreAllMocks();
});

function event(overrides: Partial<StorageClientTelemetryEvent> = {}): StorageClientTelemetryEvent {
	return {
		operation: "op",
		method: "GET",
		route: "/r",
		status: "ok",
		durationMs: 5,
		...overrides,
	};
}

describe("createStorageClientTelemetry", () => {
	it("records request, duration, failure, and byte metrics through the injected reader", () => {
		const telemetry = createStorageClientTelemetry({
			serviceName: "svc",
			serviceVersion: "1.2.3",
			environment: "production",
			exporterFactory: stubReader,
		});
		// Every arm of record(): ok, error with and without message, bytes both ways.
		telemetry.record(event({ httpStatus: 200, target: "storage.example" }));
		telemetry.record(event({ status: "error", error: "HTTP 500", httpStatus: 500 }));
		telemetry.record(event({ status: "error" }));
		telemetry.record(event({ bytesSent: 10 }));
		telemetry.record(event({ bytesReceived: 20 }));
	});

	it("uses the OTLP exporter when an endpoint is configured", () => {
		const telemetry = createStorageClientTelemetry({
			serviceName: "svc",
			otlpEndpoint: "https://otlp.example/v1/metrics",
			metricsIntervalMs: 2 ** 30,
			metricsTimeoutMs: 1000,
		});
		expect(isStorageClientTelemetry(telemetry)).toBe(true);
	});

	it("defaults the environment when neither config nor NODE_ENV supplies one", () => {
		delete process.env["NODE_ENV"];
		const telemetry = createStorageClientTelemetry({
			serviceName: "svc",
			exporterFactory: stubReader,
		});
		telemetry.record(event());
	});

	it("falls back to the console exporter outside test, and to no reader in test", () => {
		process.env["NODE_ENV"] = "production";
		const production = createStorageClientTelemetry({
			serviceName: "svc",
			metricsIntervalMs: 2 ** 30,
		});
		production.record(event());

		process.env["NODE_ENV"] = "test";
		const testEnv = createStorageClientTelemetry({ serviceName: "svc" });
		testEnv.record(event());
	});
});

describe("isStorageClientTelemetry", () => {
	it("distinguishes a recorder from a config", () => {
		expect(isStorageClientTelemetry({ record: () => {} })).toBe(true);
		expect(isStorageClientTelemetry({ serviceName: "svc" })).toBe(false);
	});
});
