import { randomUUID } from "node:crypto";
import { getRequestContext } from "@heossi/qnsi-observability";
import { trace } from "@opentelemetry/api";
import type { EventMetadata } from "./envelope.js";

export interface ProvenanceOptions {
	readonly sourceService: string;
	readonly correlationId?: string;
	readonly causationId?: string;
	readonly tenantId?: string;
	readonly userId?: string;
	readonly requestId?: string;
}

/**
 * Extracts provenance information from OpenTelemetry context and request context.
 * This creates a standardized audit trail that links events across services.
 */
export function extractProvenance(options: ProvenanceOptions): EventMetadata {
	const activeSpan = trace.getActiveSpan();
	const spanContext = activeSpan?.spanContext();
	const requestContext = getRequestContext();

	// Generate correlationId if not provided (use requestId or generate new)
	const correlationId =
		options.correlationId ??
		requestContext?.requestId ??
		(options.requestId ? options.requestId : randomUUID());

	// Extract trace and span IDs from OpenTelemetry
	const traceId = spanContext?.traceId;
	const spanId = spanContext?.spanId;

	// Use request context values if available, otherwise use options
	const tenantId = options.tenantId ?? requestContext?.tenantId;
	const userId = options.userId ?? requestContext?.userId;
	const requestId = options.requestId ?? requestContext?.requestId;

	return {
		correlationId,
		causationId: options.causationId,
		tenantId,
		timestamp: new Date().toISOString(),
		requestId,
		sourceService: options.sourceService,
		traceId: traceId ? traceId : undefined,
		spanId: spanId ? spanId : undefined,
		userId,
	};
}

/**
 * Creates provenance for a new event that was caused by another event.
 * The causationId is set to the source event's ID, and correlationId is preserved.
 */
export function createCausationProvenance(
	sourceEvent: { id: string; metadata?: EventMetadata },
	options: ProvenanceOptions,
): EventMetadata {
	const baseProvenance = extractProvenance(options);
	return {
		...baseProvenance,
		causationId: sourceEvent.id,
		correlationId: sourceEvent.metadata?.correlationId ?? baseProvenance.correlationId,
	};
}
