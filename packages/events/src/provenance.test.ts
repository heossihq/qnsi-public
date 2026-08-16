import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	request: undefined as { requestId?: string; tenantId?: string; userId?: string } | undefined,
	span: undefined as { traceId: string; spanId: string } | undefined,
}));

vi.mock("@heossihq/qnsi-observability", () => ({
	getRequestContext: () => state.request,
}));
vi.mock("@opentelemetry/api", () => ({
	trace: {
		getActiveSpan: () => (state.span ? { spanContext: () => state.span } : undefined),
	},
}));

import { createCausationProvenance, extractProvenance } from "./provenance.js";

describe("event provenance", () => {
	beforeEach(() => {
		state.request = undefined;
		state.span = undefined;
	});

	it("uses explicit values and active trace context", () => {
		state.span = { traceId: "trace-1", spanId: "span-1" };
		const result = extractProvenance({
			sourceService: "api",
			correlationId: "correlation-1",
			causationId: "cause-1",
			tenantId: "tenant-1",
			userId: "user-1",
			requestId: "request-1",
		});
		expect(result).toMatchObject({
			correlationId: "correlation-1",
			causationId: "cause-1",
			tenantId: "tenant-1",
			userId: "user-1",
			requestId: "request-1",
			traceId: "trace-1",
			spanId: "span-1",
		});
	});

	it("falls back through request context, request option, and generated IDs", () => {
		state.request = {
			requestId: "context-request",
			tenantId: "context-tenant",
			userId: "context-user",
		};
		expect(extractProvenance({ sourceService: "api" })).toMatchObject({
			correlationId: "context-request",
			requestId: "context-request",
			tenantId: "context-tenant",
			userId: "context-user",
		});
		state.request = undefined;
		expect(
			extractProvenance({ sourceService: "api", requestId: "explicit-request" }).correlationId,
		).toBe("explicit-request");
		expect(extractProvenance({ sourceService: "api" }).correlationId).toHaveLength(36);
	});

	it("binds causation and preserves or generates correlation", () => {
		expect(
			createCausationProvenance(
				{
					id: "event-1",
					metadata: { correlationId: "correlation-1", timestamp: "2026-08-14T00:00:00Z" },
				},
				{ sourceService: "api" },
			),
		).toMatchObject({ causationId: "event-1", correlationId: "correlation-1" });
		expect(
			createCausationProvenance({ id: "event-2" }, { sourceService: "api", correlationId: "base" }),
		).toMatchObject({ causationId: "event-2", correlationId: "base" });
	});
});
