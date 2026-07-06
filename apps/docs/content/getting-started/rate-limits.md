---
title: Rate Limits Overview
version: 0.0.1
last_updated: 2026-04-23
description: How QNSI enforces rate limits at the edge gateway using per-tenant, per-route token buckets, default RPS settings, and standard rate-limit response headers.
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/edge-gateway/src/config/env.ts
  - /apps/edge-gateway/src/routes/proxy.ts
---

# Rate Limits Overview

QNSI enforces rate limits at the edge gateway to protect platform stability.

## Default Rate Limit

From `apps/edge-gateway/src/config/env.ts`:

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| Global rate limit | `EDGE_RATE_LIMIT_RPS` | 5,000 RPS |

## How Rate Limiting Works

From `apps/edge-gateway/src/routes/proxy.ts`:

- Limits are **per-tenant, per-route**
- Algorithm: Token bucket
- Key format: `tenant:<tenantId>:route:<routeId>`

## Response Headers

When rate limiting is applied, responses include rate limit headers:

```http
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1703424900
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Configured RPS for this route |
| `X-RateLimit-Remaining` | Tokens remaining in bucket |
| `X-RateLimit-Reset` | Unix timestamp when bucket refills |

## Rate Limited Response

HTTP `429 Too Many Requests`:

```json
{
  "statusCode": 429,
  "error": "TOO_MANY_REQUESTS",
  "message": "Rate limit exceeded",
  "details": {
    "routeId": "<route-id>",
    "limit": 50,
    "retryAfter": 2
  }
}
```

The `Retry-After` header indicates seconds to wait before retrying.

## Metrics

Rate limit events are tracked via telemetry:

```typescript
// From edge-gateway/src/routes/proxy.ts
telemetry.metrics.blockedRequestsTotal.add(1, {
  tenant_id: effectiveTenantId,
  reason: "rate_limit_exceeded",
  route_id: matchingRoute.id,
});
```

## Increasing Limits

Contact support for limit increases. See [Limit Upgrades](/limits/upgrades).
