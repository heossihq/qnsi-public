import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configureNodeTracing, createSpan } from "./tracing.js";

afterEach(() => {
	vi.restoreAllMocks();
	// The OpenTelemetry global tracer provider registers once per process;
	// disable it so each test's provider.register() actually takes effect.
	trace.disable();
});

describe("tracing", () => {
	it("creates spans and exports them", async () => {
		const provider = configureNodeTracing({
			serviceName: "observability-test",
			autoShutdown: false,
		});

		expect(() =>
			createSpan(
				"test-span",
				(span) => {
					span.setAttribute("foo", "bar");
					return "done";
				},
				{},
			),
		).not.toThrow();

		await provider.shutdown();
	});

	it("exports spans with kind and attributes through a supplied processor", async () => {
		const exporter = new InMemorySpanExporter();
		const provider = configureNodeTracing({
			serviceName: "observability-test",
			processor: new SimpleSpanProcessor(exporter),
			autoShutdown: false,
		});

		const result = createSpan("attr-span", () => 42, {
			kind: SpanKind.CLIENT,
			attributes: { tenant: "t-1" },
		});
		expect(result).toBe(42);

		const spans = exporter.getFinishedSpans();
		const span = spans.find((s) => s.name === "attr-span");
		expect(span?.kind).toBe(SpanKind.CLIENT);
		expect(span?.attributes["tenant"]).toBe("t-1");

		await provider.shutdown();
	});

	it("records the exception, marks the span errored, and rethrows", async () => {
		const exporter = new InMemorySpanExporter();
		const provider = configureNodeTracing({
			serviceName: "observability-test",
			exporter,
			autoShutdown: false,
		});

		expect(() =>
			createSpan("boom-span", () => {
				throw new Error("boom");
			}),
		).toThrow("boom");

		await provider.forceFlush();
		const span = exporter.getFinishedSpans().find((s) => s.name === "boom-span");
		expect(span?.status.code).toBe(SpanStatusCode.ERROR);
		expect(span?.events.some((e) => e.name === "exception")).toBe(true);

		await provider.shutdown();
	});

	it("registers signal handlers when autoShutdown is on and shuts down on signal", async () => {
		const handlers = new Map<string, () => void>();
		const onceSpy = vi.spyOn(process, "once").mockImplementation(((
			signal: string,
			handler: () => void,
		) => {
			handlers.set(signal, handler);
			return process;
		}) as never);
		const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

		configureNodeTracing({
			serviceName: "observability-test",
			exporter: new InMemorySpanExporter(),
			autoShutdown: true,
		});

		expect([...handlers.keys()]).toEqual(["SIGINT", "SIGTERM"]);
		handlers.get("SIGINT")?.();
		await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));
		expect(onceSpy).toHaveBeenCalledTimes(2);
	});

	it("defaults autoShutdown to on when the option is omitted", () => {
		const onceSpy = vi.spyOn(process, "once").mockImplementation((() => process) as never);

		configureNodeTracing({
			serviceName: "observability-test",
			exporter: new InMemorySpanExporter(),
		});

		expect(onceSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
		expect(onceSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
	});
});
