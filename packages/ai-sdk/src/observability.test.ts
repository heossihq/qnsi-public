import type { MetricReader } from "@opentelemetry/sdk-metrics";
import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { afterEach, describe, expect, it } from "vitest";
import {
	type AiClientTelemetryEvent,
	createAiClientTelemetry,
	isAiClientTelemetry,
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
});

function event(overrides: Partial<AiClientTelemetryEvent> = {}): AiClientTelemetryEvent {
	return { operation: "op", method: "GET", route: "/r", status: "ok", durationMs: 5, ...overrides };
}

describe("createAiClientTelemetry", () => {
	it("records every metric arm through the injected reader", () => {
		const telemetry = createAiClientTelemetry({
			serviceName: "svc",
			serviceVersion: "1.0.0",
			environment: "production",
			exporterFactory: stubReader,
		});
		telemetry.record(event({ httpStatus: 200, target: "ai.example" }));
		telemetry.record(event({ status: "error", error: "HTTP 500", httpStatus: 500 }));
		telemetry.record(event({ status: "error" }));
	});

	it("defaults version/environment and selects OTLP, console, or no exporter", () => {
		const otlp = createAiClientTelemetry({
			serviceName: "svc",
			otlpEndpoint: "https://otlp.example/v1/metrics",
			metricsIntervalMs: 2 ** 30,
			metricsTimeoutMs: 1000,
		});
		expect(isAiClientTelemetry(otlp)).toBe(true);

		process.env["NODE_ENV"] = "production";
		createAiClientTelemetry({ serviceName: "svc", metricsIntervalMs: 2 ** 30 }).record(event());

		process.env["NODE_ENV"] = "test";
		createAiClientTelemetry({ serviceName: "svc" }).record(event());
	});
});

describe("isAiClientTelemetry", () => {
	it("distinguishes a recorder from a config", () => {
		expect(isAiClientTelemetry({ record: () => {} })).toBe(true);
		expect(isAiClientTelemetry({ serviceName: "svc" })).toBe(false);
	});
});
