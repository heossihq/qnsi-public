---
title: Distributed Tracing
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Distributed Tracing

QNSI implements distributed tracing for request flow visibility.

## Trace propagation

W3C Trace Context headers:
```
traceparent: 00-<trace-id>-<span-id>-<flags>
tracestate: qnsi=<context>
```

## Trace structure

```
Trace: abc123
├── Span: edge-gateway (root)
│   ├── Span: auth-validation
│   ├── Span: rate-limit-check
│   └── Span: proxy-request
│       └── Span: kms-service
│           ├── Span: key-lookup
│           └── Span: encrypt-operation
```

## Span attributes

| Attribute | Description |
|-----------|-------------|
| `service.name` | Service identifier |
| `http.method` | HTTP method |
| `http.url` | Request URL |
| `http.status_code` | Response status |
| `qnsi.tenant_id` | Tenant identifier |
| `qnsi.operation` | Operation type |

## Sampling

### Head-based sampling
Decision at trace start:
- 100% for errors
- 10% for normal requests
- Configurable per tenant

### Tail-based sampling
Decision after trace complete:
- Keep interesting traces
- Sample based on duration
- Sample based on errors

## Integration

### Jaeger
```yaml
tracing:
  exporter: jaeger
  endpoint: <jaeger_endpoint>
```

### OTLP
```yaml
tracing:
  exporter: otlp
  endpoint: <otlp_endpoint>
```

## Trace search

Trace search is not shipped in this repo.
Querying and UI-based exploration depends on your configured upstream (for example Jaeger, Tempo, Honeycomb).
