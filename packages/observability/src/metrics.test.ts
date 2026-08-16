import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { describe, expect, it } from "vitest";

import {
	createCounter,
	createEnrichedCounter,
	createEnrichedHistogram,
	createHistogram,
	createMeterProvider,
} from "./metrics.js";

describe("metrics", () => {
	it("creates counters and histograms", () => {
		const provider = createMeterProvider({ serviceName: "observability-test" });
		const counter = createCounter(provider, "requests_total", {
			description: "Number of requests",
		});
		const histogram = createHistogram(provider, "request_duration_ms");

		expect(counter).toBeDefined();
		expect(histogram).toBeDefined();
	});

	it("enriched counter and histogram stamp provenance and PQC attributes on real exports", async () => {
		// Real SDK end to end: real reader, real in-memory exporter, collected
		// data points must carry the integrity attributes.
		const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
		const reader = new PeriodicExportingMetricReader({
			exporter,
			exportIntervalMillis: 60_000,
		});
		const provider = createMeterProvider({ serviceName: "observability-test" }, [reader]);

		const counter = createEnrichedCounter(
			provider,
			"enriched_total",
			{ description: "d" },
			{ sourceService: "edge", pqc: { algorithm: "ml-dsa-65", keyId: "k", provider: "liboqs" } },
		);
		const histogram = createEnrichedHistogram(provider, "enriched_ms", undefined, {
			sourceService: "edge",
		});

		counter.add(2, { route: "/x" });
		histogram.record(41, { route: "/x" });

		const { resourceMetrics } = await reader.collect();
		const metrics = resourceMetrics.scopeMetrics.flatMap((s) => s.metrics);
		const counterMetric = metrics.find((m) => m.descriptor.name === "enriched_total");
		const histogramMetric = metrics.find((m) => m.descriptor.name === "enriched_ms");

		const counterAttrs = counterMetric?.dataPoints[0]?.attributes ?? {};
		expect(counterAttrs["route"]).toBe("/x");
		expect(counterAttrs["provenance.source_service"]).toBe("edge");
		expect(counterAttrs["pqc.algorithm"]).toBe("ml-dsa-65");
		expect(counterAttrs["pqc.key_id"]).toBe("k");
		expect(counterAttrs["pqc.provider"]).toBe("liboqs");

		const histogramAttrs = histogramMetric?.dataPoints[0]?.attributes ?? {};
		expect(histogramAttrs["provenance.source_service"]).toBe("edge");

		await provider.shutdown();
	});
});
