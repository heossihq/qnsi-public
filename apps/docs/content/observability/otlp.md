---
title: OpenTelemetry (OTLP)
version: 0.0.1
last_updated: 2026-07-28
copyright: 2025 HEOSSI. All rights reserved.
---
# OpenTelemetry (OTLP)

QNSI supports OpenTelemetry Protocol for telemetry export.

Use this integration when a workload already emits OpenTelemetry and you want
QNSI to retain the tenant-scoped ingestion result, forward the payload to the
configured collector, and expose operational status without translating the
signal into a QNSI-specific format.

## OTLP endpoints

OTLP ingestion is exposed by the observability service.

```
POST /otlp/v1/traces
POST /otlp/v1/metrics
POST /otlp/v1/logs
```

When calling through the production edge, start with the QNSI API base URL and
the observability proxy path supplied by your workspace. Do not point a public
collector at an internal service hostname.

The receiver accepts OTLP JSON, protobuf, octet-stream, gRPC and Google
protobuf content types. The body is forwarded byte-for-byte; content
transformation belongs in the collector, not the QNSI receiver.

## Configuration

### Export to QNSI collector
```yaml
exporters:
  otlp:
    endpoint: <qnsi_base_url>
    headers:
      authorization: Bearer ${QNSI_TOKEN}
```

Exporting from QNSI to your collector is deployment-specific.

`QNSI_TOKEN` must be a bearer credential accepted by the deployment. Direct
service calls require either a configured observability token or a QNSI
service JWT with the internal-service audience. A missing token returns `401`;
a valid JWT with the wrong audience returns `403`.

Never put the token directly in a committed collector file. Resolve it from
the runtime's secret manager and rotate it using the same programme as other
service credentials.

## Supported signals

| Signal | Status |
|--------|--------|
| Traces | Stable |
| Metrics | Stable |
| Logs | Beta |

An accepted response proves that the receiver authorized and processed the
request. It does not, by itself, prove that a downstream collector indexed the
signal. Verify both the QNSI response and the destination collector.

## Resource attributes

QNSI adds resource attributes:
```
service.name: qnsi-kms-service
service.version: 1.2.3
deployment.environment: production
cloud.region: ap-southeast-1
qnsi.tenant_id: tenant-uuid
```

## Semantic conventions

QNSI follows OpenTelemetry semantic conventions:
- HTTP: `http.method`, `http.status_code`
- Database: `db.system`, `db.operation`
- Messaging: `messaging.system`

Include `service.name`, `service.version` and
`deployment.environment` on the emitting resource. Tenant identity is derived
from the authenticated context; do not copy a tenant identifier from another
workspace into telemetry.

## Collector configuration

Example OTel Collector config:
```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  batch:

exporters:
  jaeger:
    endpoint: <jaeger_grpc_endpoint>

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [jaeger]
```

## Production verification

1. Send one trace, one metric and one log record with a unique test
   correlation identifier.
2. Confirm the receiver returns a successful status without an authentication
   or unsupported-signal error.
3. Locate the identifier in the configured downstream collector.
4. Confirm the resource carries the expected service, environment and tenant
   attributes.
5. Record the receiver timestamp and downstream timestamp in the deployment
   evidence pack.

Use [Metrics](./metrics), [Tracing](./tracing), [Logs](./logs) and
[Alerts](./alerts) for signal-specific configuration. A documentation example
is not evidence that a particular tenant's collector is configured or that its
retention policy meets a regulatory requirement.
