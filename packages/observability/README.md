# @heossi/qnsi-observability

Observability primitives for the Quantum-Native Security Infrastructure (QNSI), including metrics, tracing, context helpers, and integrity hooks.

## Features

- **OpenTelemetry Integration**: Metrics and tracing via OpenTelemetry SDK
- **Provenance Tracking**: Automatic attachment of trace/span/request context to metrics and logs
- **PQC Signature Fields**: Support for attaching PQC algorithm/provider metadata to telemetry
- **Request Context**: Helpers for propagating request context across async boundaries
- **Integrity Hooks**: Automatic enrichment of metrics and logs with provenance and PQC signature fields

## Integrity Hooks

The observability package provides integrity hooks that automatically attach provenance labels and PQC signature fields to all metrics and logs.

### Provenance Attributes

All metrics automatically include the following provenance attributes when available:

- `provenance.request_id`: Unique request identifier
- `provenance.trace_id`: OpenTelemetry trace ID
- `provenance.span_id`: OpenTelemetry span ID
- `provenance.tenant_id`: Tenant identifier
- `provenance.user_id`: User identifier
- `provenance.source_service`: Service name that generated the metric/log

### PQC Signature Attributes

Services can optionally include PQC signature metadata:

- `pqc.algorithm`: PQC algorithm used (e.g., `dilithium-2`)
- `pqc.key_id`: Key identifier for key rotation scenarios
- `pqc.provider`: PQC provider name (e.g., `liboqs`)

### Usage

**Automatic Enrichment (Recommended):**

Services automatically enrich metrics when using wrapped counters/histograms:

```typescript
import { enrichMetricAttributes } from "@heossi/qnsi-observability";

function wrapCounter(counter) {
  return {
    add: (value, attributes) => {
      const enriched = enrichMetricAttributes(attributes, {
        sourceService: "my-service",
        pqc: {
          algorithm: "dilithium-2",
          provider: "liboqs",
        },
      });
      counter.add(value, enriched);
    },
  };
}
```

**Log Enrichment:**

```typescript
import { createIntegrityLogger } from "@heossi/qnsi-observability";

const logger = createIntegrityLogger(fastifyLogger, {
  sourceService: "my-service",
  pqc: {
    algorithm: "dilithium-2",
    provider: "liboqs",
  },
});
```

## Exports

- `createMeterProvider`, `createCounter`, `createHistogram` — Metric creation helpers
- `createEnrichedCounter`, `createEnrichedHistogram` — Metrics with automatic provenance enrichment
- `enrichMetricAttributes`, `enrichLogMetadata` — Manual enrichment helpers
- `extractProvenanceAttributes`, `createPqcSignatureAttributes` — Attribute extraction utilities
- `createIntegrityLogger` — Logger wrapper with automatic enrichment
- `getRequestContext`, `withRequestContext` — Request context propagation
- `configureNodeTracing`, `createSpan` — Tracing helpers

## Scripts

```bash
pnpm build     # Compile TypeScript to dist/
pnpm lint      # Run Biome checks
pnpm test      # Execute Vitest test suites
pnpm typecheck # Run TypeScript without emitting output
```


© 2025 QNSI - HEOSSI, Singapore
