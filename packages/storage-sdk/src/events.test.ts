import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEventEnvelope } from "./event-envelope.js";
import { StorageEventsClient } from "./events.js";
import type { StorageClientTelemetryEvent } from "./observability.js";
import { validateUUID } from "./validation.js";

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
		...init,
	});
}

describe("StorageEventsClient", () => {
	it("fetches and normalizes envelopes, preserving provided metadata fields", async () => {
		const events: StorageClientTelemetryEvent[] = [];
		const client = new StorageEventsClient({
			baseUrl: "https://storage.qnsp.example/",
			apiKey: "events-key",
			telemetry: { record: (e) => events.push(e) },
		});
		fetchMock.mockResolvedValueOnce(
			jsonResponse(
				[
					{
						topic: "storage.usage",
						version: "2",
						payload: { tenantId: "t", operation: "upload", sizeBytes: 3, tier: "hot" },
						metadata: {
							timestamp: "2026-08-16T00:00:00.000Z",
							correlationId: "11111111-1111-4111-a111-111111111111",
							causationId: "22222222-2222-4222-a222-222222222222",
							tenantId: "t",
						},
					},
					{
						topic: "storage.usage",
						version: "1",
						payload: {},
						metadata: { timestamp: 42 },
					},
					{ topic: "storage.usage", version: "1", payload: {} },
				],
				{ headers: { "Content-Length": "512" } },
			),
		);

		const result = await client.fetchEvents("storage.usage", {
			since: "2026-08-15T00:00:00.000Z",
			limit: 10,
		});
		expect(result).toHaveLength(3);
		expect(result[0]?.metadata).toMatchObject({
			timestamp: "2026-08-16T00:00:00.000Z",
			correlationId: "11111111-1111-4111-a111-111111111111",
			causationId: "22222222-2222-4222-a222-222222222222",
			tenantId: "t",
		});
		// Non-string timestamp and absent metadata both fall back to a fresh timestamp.
		expect(typeof result[1]?.metadata.timestamp).toBe("string");
		expect(typeof result[2]?.metadata.timestamp).toBe("string");

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toContain("/storage/internal/events/storage.usage?");
		expect(url).toContain("since=");
		expect(url).toContain("limit=10");
		expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer events-key");
		expect(events[0]).toMatchObject({
			operation: "fetchEvents(storage.usage)",
			status: "ok",
			httpStatus: 200,
			bytesReceived: 512,
		});
	});

	it("omits auth without an api key and builds a bare URL without options", async () => {
		const client = new StorageEventsClient({ baseUrl: "https://storage.qnsp.example" });
		fetchMock.mockResolvedValueOnce(jsonResponse([]));
		await client.fetchEvents("storage.billing");
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://storage.qnsp.example/storage/internal/events/storage.billing");
		expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
	});

	it("falls back to a generic target for an unparseable base URL", async () => {
		const events: StorageClientTelemetryEvent[] = [];
		const client = new StorageEventsClient({
			baseUrl: "https://exa mple",
			telemetry: { record: (e) => events.push(e) },
		});
		fetchMock.mockResolvedValueOnce(jsonResponse([]));
		await client.fetchEvents("t");
		expect(events[0]?.target).toBe("storage-service");
	});

	it("surfaces server errors with body text, tolerating unreadable bodies", async () => {
		const client = new StorageEventsClient({ baseUrl: "https://storage.qnsp.example" });
		fetchMock.mockResolvedValueOnce(
			new Response("backend exploded", { status: 502, statusText: "Bad Gateway" }),
		);
		await expect(client.fetchEvents("t")).rejects.toThrow(
			"Event fetch failed: 502 Bad Gateway - backend exploded",
		);

		fetchMock.mockResolvedValueOnce({
			ok: false,
			status: 500,
			statusText: "Internal",
			text: async () => {
				throw new Error("stream destroyed");
			},
			headers: new Headers(),
		} as unknown as Response);
		await expect(client.fetchEvents("t")).rejects.toThrow(
			"Event fetch failed: 500 Internal - unknown error",
		);
	});

	it("maps timeouts and non-Error throws, wrapping a telemetry config", async () => {
		const client = new StorageEventsClient({
			baseUrl: "https://storage.qnsp.example",
			timeoutMs: 100,
			telemetry: {
				serviceName: "events-arm",
				exporterFactory: () =>
					new PeriodicExportingMetricReader({
						exporter: new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE),
						exportIntervalMillis: 2 ** 30,
					}),
			},
		});
		const abort = new Error("aborted");
		abort.name = "AbortError";
		fetchMock.mockRejectedValueOnce(abort);
		await expect(client.fetchEvents("t")).rejects.toThrow("Event request timeout after 100ms");

		fetchMock.mockRejectedValueOnce("raw event failure");
		await expect(client.fetchEvents("t")).rejects.toBe("raw event failure");
	});
});

describe("createEventEnvelope", () => {
	it("applies identifiers and defaults, keeping explicit values", () => {
		const defaulted = createEventEnvelope({ topic: "storage.usage", payload: { a: 1 } });
		expect(defaulted.version).toBe("1");
		expect(defaulted.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(typeof defaulted.metadata.timestamp).toBe("string");

		const explicit = createEventEnvelope({
			topic: "storage.usage",
			version: "3",
			payload: { a: 1 },
			metadata: { timestamp: "2026-08-16T00:00:00.000Z", tenantId: "t" },
		});
		expect(explicit.version).toBe("3");
		expect(explicit.metadata.tenantId).toBe("t");
	});

	it("rejects an empty topic", () => {
		expect(() => createEventEnvelope({ topic: "", payload: {} })).toThrow();
	});
});

describe("event metadata defaults", () => {
	it("stamps a timestamp when provided metadata lacks one", () => {
		const envelope = createEventEnvelope({
			topic: "storage.usage",
			payload: {},
			metadata: { tenantId: "t" } as never,
		});
		expect(envelope.metadata.tenantId).toBe("t");
		expect(typeof envelope.metadata.timestamp).toBe("string");
	});
});

describe("validateUUID", () => {
	it("accepts a valid UUID and names the field in failures", () => {
		expect(() => validateUUID("11111111-1111-4111-a111-111111111111", "documentId")).not.toThrow();
		expect(() => validateUUID("nope", "documentId")).toThrow("Invalid documentId:");
	});
});
