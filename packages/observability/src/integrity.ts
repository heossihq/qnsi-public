import type { Attributes } from "@opentelemetry/api";
import { trace } from "@opentelemetry/api";
import type { RequestContextValue } from "./context.js";
import { getRequestContext } from "./context.js";

// Re-export for convenience
export type { RequestContextValue } from "./context.js";

export interface ProvenanceAttributes {
	"provenance.request_id"?: string;
	"provenance.trace_id"?: string;
	"provenance.span_id"?: string;
	"provenance.tenant_id"?: string;
	"provenance.user_id"?: string;
	"provenance.source_service"?: string;
}

export interface PqcSignatureAttributes {
	"pqc.algorithm"?: string;
	"pqc.key_id"?: string;
	"pqc.provider"?: string;
}

// IntegrityAttributes is the union of ProvenanceAttributes and PqcSignatureAttributes
export type IntegrityAttributes = ProvenanceAttributes & PqcSignatureAttributes;

/**
 * Extracts provenance attributes from OpenTelemetry context and request context.
 * These attributes link metrics/logs to the originating request and trace.
 */
export function extractProvenanceAttributes(
	sourceService?: string,
	requestContext?: RequestContextValue,
): ProvenanceAttributes {
	// The real OpenTelemetry API never throws here: getActiveSpan and
	// context.getValue return undefined when nothing is registered, so the
	// old defensive try/catch guards were unreachable and are removed.
	const spanContext = trace.getActiveSpan()?.spanContext();
	const reqCtx = requestContext ?? getRequestContext();

	const attributes: ProvenanceAttributes = {};

	if (spanContext?.traceId) {
		attributes["provenance.trace_id"] = spanContext.traceId;
	}

	if (spanContext?.spanId) {
		attributes["provenance.span_id"] = spanContext.spanId;
	}

	if (reqCtx?.requestId) {
		attributes["provenance.request_id"] = reqCtx.requestId;
	}

	if (reqCtx?.tenantId) {
		attributes["provenance.tenant_id"] = reqCtx.tenantId;
	}

	if (reqCtx?.userId) {
		attributes["provenance.user_id"] = reqCtx.userId;
	}

	if (sourceService) {
		attributes["provenance.source_service"] = sourceService;
	}

	return attributes;
}

/**
 * Creates PQC signature attributes from PQC provider information.
 * These attributes indicate which PQC algorithm and key were used.
 */
export function createPqcSignatureAttributes(options: {
	algorithm?: string;
	keyId?: string;
	provider?: string;
}): PqcSignatureAttributes {
	const attributes: PqcSignatureAttributes = {};

	if (options.algorithm) {
		attributes["pqc.algorithm"] = options.algorithm;
	}

	if (options.keyId) {
		attributes["pqc.key_id"] = options.keyId;
	}

	if (options.provider) {
		attributes["pqc.provider"] = options.provider;
	}

	return attributes;
}

/**
 * Merges provenance and PQC signature attributes with existing metric attributes.
 * This ensures all metrics include integrity metadata.
 */
export function enrichMetricAttributes(
	existingAttributes?: Attributes,
	options?: {
		sourceService?: string;
		requestContext?: RequestContextValue;
		pqc?: {
			algorithm?: string;
			keyId?: string;
			provider?: string;
		};
	},
): Attributes {
	const provenance = extractProvenanceAttributes(options?.sourceService, options?.requestContext);
	const pqc = options?.pqc ? createPqcSignatureAttributes(options.pqc) : {};

	return {
		...(existingAttributes ?? {}),
		...provenance,
		...pqc,
	};
}

/**
 * Enriches log metadata with provenance and PQC signature fields.
 */
export function enrichLogMetadata(
	existingMetadata?: Record<string, unknown>,
	options?: {
		sourceService?: string;
		requestContext?: RequestContextValue;
		pqc?: {
			algorithm?: string;
			keyId?: string;
			provider?: string;
		};
	},
): Record<string, unknown> {
	const provenance = extractProvenanceAttributes(options?.sourceService, options?.requestContext);
	const pqc = options?.pqc ? createPqcSignatureAttributes(options.pqc) : {};

	return {
		...(existingMetadata ?? {}),
		provenance: {
			...(provenance["provenance.request_id"]
				? { requestId: provenance["provenance.request_id"] }
				: {}),
			...(provenance["provenance.trace_id"] ? { traceId: provenance["provenance.trace_id"] } : {}),
			...(provenance["provenance.span_id"] ? { spanId: provenance["provenance.span_id"] } : {}),
			...(provenance["provenance.tenant_id"]
				? { tenantId: provenance["provenance.tenant_id"] }
				: {}),
			...(provenance["provenance.user_id"] ? { userId: provenance["provenance.user_id"] } : {}),
			...(provenance["provenance.source_service"]
				? { sourceService: provenance["provenance.source_service"] }
				: {}),
		},
		...(Object.keys(pqc).length > 0 ? { pqc } : {}),
	};
}
