---
title: Health Checks
version: 0.0.2
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Health Checks

QNSI services expose health endpoints for monitoring.

## Endpoints

### Service Health via Edge Gateway

All services expose health endpoints through edge-gateway:

```
GET /proxy/<service>/health
GET /edge/<service>/health
```

Example health checks:
```bash
# Check platform-api health
curl https://api.qnsi.heossi.com/proxy/platform/health

# Check all services health
curl https://api.qnsi.heossi.com/proxy/health
```

**Note**: Health check endpoints (GET/HEAD) bypass bot protection and rate limiting to allow monitoring systems to probe services reliably.

### Direct Service Health

```
GET /health
```

Returns 200 if service is running:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Readiness
```
GET /health/ready
```

Returns 200 if service can handle requests:
```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "cache": "ok",
    "hsm": "ok"
  }
}
```

### Detailed health
```
GET /health/detailed
```

Requires authentication:
```json
{
  "status": "healthy",
  "version": "1.2.3",
  "uptime": "72h15m",
  "checks": {
    "database": {
      "status": "ok",
      "latency": "5ms"
    },
    "cache": {
      "status": "ok",
      "hitRate": "0.95"
    }
  }
}
```

## Health status codes

| Status | HTTP Code | Meaning |
|--------|-----------|---------|
| ok | 200 | Fully healthy |
| degraded | 200 | Partially healthy |
| unhealthy | 503 | Not healthy |

## Kubernetes probes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Dependency health

Services check dependencies:
- Database connectivity
- Cache availability
- HSM connectivity
- Upstream services
