---
title: OpenTelemetry (OTLP)
version: 0.0.1
last_updated: 2026-04-23
copyright: 2025 HEOSSI. All rights reserved.
---
# OpenTelemetry (OTLP)

QNSI supports OpenTelemetry Protocol for telemetry export.

## OTLP endpoints

OTLP ingestion is exposed by the observability service.

```
POST /otlp/v1/traces
POST /otlp/v1/metrics
POST /otlp/v1/logs
```

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

## Supported signals

| Signal | Status |
|--------|--------|
| Traces | Stable |
| Metrics | Stable |
| Logs | Beta |

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
