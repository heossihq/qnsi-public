import { context, trace } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type RequestContextValue, withRequestContext } from "./context.js";

// The real OpenTelemetry API needs a real context manager for context.with to
// propagate values. Registering a real NodeTracerProvider installs one - the
// exact wiring services get from configureNodeTracing().
let provider: NodeTracerProvider;
beforeAll(() => {
	provider = new NodeTracerProvider();
	provider.register();
});
afterAll(async () => {
	await provider.shutdown();
	trace.disable();
	context.disable();
});

import {
	createPqcSignatureAttributes,
	enrichLogMetadata,
	enrichMetricAttributes,
	extractProvenanceAttributes,
} from "./integrity.js";

describe("observability integrity", () => {
	it("extracts provenance attributes with source service", () => {
		const attributes = extractProvenanceAttributes("test-service");

		expect(attributes["provenance.source_service"]).toBe("test-service");
		// Trace/span IDs may or may not be present depending on active OpenTelemetry context
	});

	it("captures trace and span ids from a real active span", () => {
		trace.getTracer("integrity-test").startActiveSpan("op", (span) => {
			const attributes = extractProvenanceAttributes("test-service");
			expect(attributes["provenance.trace_id"]).toBe(span.spanContext().traceId);
			expect(attributes["provenance.span_id"]).toBe(span.spanContext().spanId);
			span.end();
		});
	});

	it("extracts provenance attributes from request context", () => {
		const requestContext: RequestContextValue = {
			requestId: "req-123",
			tenantId: "tenant-456",
			userId: "user-789",
		};

		withRequestContext(requestContext, () => {
			const attributes = extractProvenanceAttributes("test-service");

			expect(attributes["provenance.request_id"]).toBe("req-123");
			expect(attributes["provenance.tenant_id"]).toBe("tenant-456");
			expect(attributes["provenance.user_id"]).toBe("user-789");
			expect(attributes["provenance.source_service"]).toBe("test-service");
		});
	});

	it("enriches metric attributes with provenance and PQC fields", () => {
		const requestContext: RequestContextValue = {
			requestId: "req-123",
			tenantId: "tenant-456",
		};

		withRequestContext(requestContext, () => {
			const enriched = enrichMetricAttributes(
				{ existing: "value" },
				{
					sourceService: "test-service",
					requestContext,
					pqc: {
						algorithm: "dilithium-2",
						keyId: "key-1",
						provider: "liboqs",
					},
				},
			);

			expect(enriched["existing"]).toBe("value");
			expect(enriched["provenance.request_id"]).toBe("req-123");
			expect(enriched["provenance.tenant_id"]).toBe("tenant-456");
			expect(enriched["provenance.source_service"]).toBe("test-service");
			expect(enriched["pqc.algorithm"]).toBe("dilithium-2");
			expect(enriched["pqc.key_id"]).toBe("key-1");
			expect(enriched["pqc.provider"]).toBe("liboqs");
		});
	});

	it("enriches log metadata with provenance and PQC fields", () => {
		const requestContext: RequestContextValue = {
			requestId: "req-123",
			tenantId: "tenant-456",
		};

		withRequestContext(requestContext, () => {
			const enriched = enrichLogMetadata(
				{ existing: "value" },
				{
					sourceService: "test-service",
					requestContext,
					pqc: {
						algorithm: "dilithium-2",
						provider: "liboqs",
					},
				},
			);

			expect(enriched["existing"]).toBe("value");
			expect(enriched["provenance"]).toBeDefined();
			expect((enriched["provenance"] as { requestId?: string })?.requestId).toBe("req-123");
			expect((enriched["provenance"] as { tenantId?: string })?.tenantId).toBe("tenant-456");
			expect((enriched["provenance"] as { sourceService?: string })?.sourceService).toBe(
				"test-service",
			);
			expect(enriched["pqc"]).toBeDefined();
			expect((enriched["pqc"] as Record<string, unknown>)?.["pqc.algorithm"]).toBe("dilithium-2");
			expect((enriched["pqc"] as Record<string, unknown>)?.["pqc.provider"]).toBe("liboqs");
		});
	});

	it("covers sparse options and span-active log enrichment", () => {
		// No sourceService; PQC with only a key id.
		expect(extractProvenanceAttributes()["provenance.source_service"]).toBeUndefined();
		expect(createPqcSignatureAttributes({ keyId: "only-key" })).toEqual({
			"pqc.key_id": "only-key",
		});

		// Defaulted (undefined) existing attributes and metadata.
		expect(enrichMetricAttributes(undefined, { sourceService: "svc" })).toMatchObject({
			"provenance.source_service": "svc",
		});

		// Log enrichment inside a REAL active span, without userId/sourceService.
		trace.getTracer("integrity-test").startActiveSpan("op2", (span) => {
			const meta = enrichLogMetadata(undefined, {
				requestContext: { requestId: "r1", tenantId: "t1" },
			});
			const prov = meta["provenance"] as Record<string, unknown>;
			expect(prov["traceId"]).toBe(span.spanContext().traceId);
			expect(prov["spanId"]).toBe(span.spanContext().spanId);
			expect(prov["userId"]).toBeUndefined();
			expect(prov["sourceService"]).toBeUndefined();
			span.end();
		});

		// And the userId-present side of the log enrichment.
		const withUser = enrichLogMetadata(undefined, {
			requestContext: { requestId: "r2", userId: "u-9" },
		});
		expect((withUser["provenance"] as Record<string, unknown>)["userId"]).toBe("u-9");
	});

	it("handles missing context gracefully", () => {
		const enriched = enrichMetricAttributes(
			{ existing: "value" },
			{
				sourceService: "test-service",
			},
		);

		expect(enriched["existing"]).toBe("value");
		expect(enriched["provenance.source_service"]).toBe("test-service");
		// Other provenance fields may or may not be present depending on active context
	});
});
