import type { Attributes } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import type { MetricReader } from "@opentelemetry/sdk-metrics";
import {
	ConsoleMetricExporter,
	MeterProvider,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";

type TelemetryResourceOptions = {
	// The only caller (createStorageClientTelemetry) always resolves all three.
	readonly serviceName: string;
	readonly serviceVersion: string;
	readonly environment: string;
};

function createMeterProvider(
	options: TelemetryResourceOptions,
	readers: readonly MetricReader[] = [],
): MeterProvider {
	const attributes: Record<string, string | number | boolean> = {
		"service.name": options.serviceName,
		"service.version": options.serviceVersion,
		"deployment.environment": options.environment,
	};

	return new MeterProvider({
		resource: resourceFromAttributes(attributes),
		readers: [...readers],
	});
}

function createCounter(
	provider: MeterProvider,
	name: string,
	options?: Parameters<ReturnType<MeterProvider["getMeter"]>["createCounter"]>[1],
) {
	return provider.getMeter("qnsp").createCounter(name, options);
}

function createHistogram(
	provider: MeterProvider,
	name: string,
	options?: Parameters<ReturnType<MeterProvider["getMeter"]>["createHistogram"]>[1],
) {
	return provider.getMeter("qnsp").createHistogram(name, options);
}

export interface StorageClientTelemetryConfig {
	readonly serviceName: string;
	readonly serviceVersion?: string;
	readonly environment?: string;
	readonly otlpEndpoint?: string;
	readonly metricsIntervalMs?: number;
	readonly metricsTimeoutMs?: number;
	readonly exporterFactory?: () => MetricReader;
}

export interface StorageClientTelemetryEvent {
	readonly operation: string;
	readonly method: string;
	readonly route: string;
	readonly status: "ok" | "error";
	readonly durationMs: number;
	readonly httpStatus?: number;
	readonly target?: string;
	readonly error?: string;
	readonly bytesSent?: number;
	readonly bytesReceived?: number;
}

export interface StorageClientTelemetry {
	record(event: StorageClientTelemetryEvent): void;
}

export function createStorageClientTelemetry(
	config: StorageClientTelemetryConfig,
): StorageClientTelemetry {
	const interval = config.metricsIntervalMs ?? 60_000;
	const timeout = config.metricsTimeoutMs ?? 15_000;
	const readers: MetricReader[] = [];

	if (typeof config.exporterFactory === "function") {
		readers.push(config.exporterFactory());
	} else if (config.otlpEndpoint) {
		readers.push(
			new PeriodicExportingMetricReader({
				exporter: new OTLPMetricExporter({
					url: config.otlpEndpoint,
				}),
				exportIntervalMillis: interval,
				exportTimeoutMillis: timeout,
			}),
		);
	} else if (process.env["NODE_ENV"] !== "test") {
		readers.push(
			new PeriodicExportingMetricReader({
				exporter: new ConsoleMetricExporter(),
				exportIntervalMillis: interval,
				exportTimeoutMillis: timeout,
			}),
		);
	}

	const provider = createMeterProvider(
		{
			serviceName: config.serviceName,
			serviceVersion: config.serviceVersion ?? "0.0.0",
			environment: config.environment ?? process.env["NODE_ENV"] ?? "development",
		},
		readers,
	);

	const requestCounter = createCounter(provider, "storage_sdk_requests_total", {
		description: "Count of Storage SDK HTTP requests",
	});
	const failureCounter = createCounter(provider, "storage_sdk_request_failures_total", {
		description: "Count of failed Storage SDK HTTP requests",
	});
	const durationHistogram = createHistogram(provider, "storage_sdk_request_duration_ms", {
		description: "Latency of Storage SDK HTTP requests",
		unit: "ms",
	});
	const bytesCounter = createCounter(provider, "storage_sdk_bytes_total", {
		description: "Bytes sent or received by the Storage SDK",
		unit: "By",
	});

	return {
		record(event) {
			const baseAttributes: Attributes = {
				service: config.serviceName,
				operation: event.operation,
				method: event.method,
				route: event.route,
				target: event.target ?? event.route,
				status: event.status,
				...(event.httpStatus ? { http_status: event.httpStatus } : {}),
			};

			requestCounter.add(1, baseAttributes);
			durationHistogram.record(event.durationMs, baseAttributes);

			if (event.status === "error") {
				failureCounter.add(1, {
					...baseAttributes,
					error: event.error ?? "unknown",
				});
			}

			if (typeof event.bytesSent === "number") {
				bytesCounter.add(event.bytesSent, {
					...baseAttributes,
					direction: "sent",
				});
			}

			if (typeof event.bytesReceived === "number") {
				bytesCounter.add(event.bytesReceived, {
					...baseAttributes,
					direction: "received",
				});
			}
		},
	};
}

export function isStorageClientTelemetry(
	value: StorageClientTelemetry | StorageClientTelemetryConfig,
): value is StorageClientTelemetry {
	return typeof (value as StorageClientTelemetry)?.record === "function";
}
