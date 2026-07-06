---
title: Logs
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Logs

QNSI services emit structured logs for debugging and analysis.

## Log format

JSON structured logs:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "service": "kms-service",
  "message": "Key created",
  "traceId": "abc123",
  "spanId": "def456",
  "tenantId": "tenant-uuid",
  "requestId": "request-uuid",
  "attributes": {
    "keyId": "key-uuid",
    "algorithm": "aes-256-gcm"
  }
}
```

## Log levels

| Level | Description |
|-------|-------------|
| `error` | Errors requiring attention |
| `warn` | Warnings, potential issues |
| `info` | Normal operations |
| `debug` | Detailed debugging |
| `trace` | Very detailed tracing |

## Log categories

### Request logs
Every request logged with:
- Method, path, status
- Duration
- Request/response size
- Client info

### Security logs
Security-relevant events:
- Authentication attempts
- Authorization decisions
- Policy evaluations

### Operational logs
System operations:
- Service startup/shutdown
- Configuration changes
- Health check results

## Log access

 Log query APIs are not shipped in this repo.

### Export
Configure log export to external systems:
- CloudWatch Logs
- Datadog
- Elastic
- Splunk
