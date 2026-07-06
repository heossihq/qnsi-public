/**
 * QNSP Audit — immutable, hash-chained event log. Wraps
 * `apps/audit-service` (`/audit/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";

const PATH_PREFIX = "/proxy/audit/v1";

export interface LogEventRequest {
	readonly eventType: string;
	readonly payload: Record<string, unknown>;
	readonly tags?: readonly string[];
}

/**
 * Translate the ergonomic SDK event into the wire shape the audit-service
 * actually accepts. This is the contract-translation boundary — callers keep
 * passing `{ eventType, payload, tags }` unchanged.
 *
 * `normalizeBatch` (`apps/audit-service/src/services/audit-service.ts`) matches
 * one of three strict schemas. The `_internal` client injects a top-level
 * `tenantId` into every body, which **fails** the `legacyAttestation` schema
 * (`{ eventType, timestamp?, severity?, payload? }`, `.strict()` → rejects
 * `tenantId` → 0 events → HTTP 400). The only path that tolerates the injected
 * `tenantId` is `legacySecurityAuditClientEventSchema`, which carries
 * `{ eventType?, source?, tenantId?, details?, … }` and maps `details` → the
 * stored event `payload` (and honours `tenantId` for tenant-scoping). So the
 * caller's `payload` goes into `details`, and `tags` rides alongside as
 * `details.tags`. Verified live: `{tenantId,eventType,source,details}` → 202;
 * `{tenantId,eventType,payload}` → 400.
 */
function toWireEvent(req: LogEventRequest): {
	eventType: string;
	source: string;
	details: Record<string, unknown>;
} {
	const details: Record<string, unknown> = { ...req.payload };
	if (req.tags && req.tags.length > 0) {
		details["tags"] = [...req.tags];
	}
	return { eventType: req.eventType, source: "qnsi-sdk", details };
}

export class AuditClient {
	constructor(private readonly internal: Internal) {}

	logEvent(req: LogEventRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/events`, toWireEvent(req), opts);
	}

	ingestEvents(events: readonly LogEventRequest[], opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request(
			"POST",
			`${PATH_PREFIX}/events/batch`,
			{ events: events.map(toWireEvent) },
			opts,
		);
	}

	listEvents(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/events`, undefined, { query });
	}
}
