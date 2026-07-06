---
title: Rate Limits
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Rate Limits

Detailed rate limit information.

## Default limits

| Endpoint category | Requests/second | Burst |
|-------------------|-----------------|-------|
| Authentication | 100 | 200 |
| KMS operations | 50 | 100 |
| Vault operations | 50 | 100 |
| Storage operations | 100 | 200 |
| Search operations | 20 | 40 |
| Audit queries | 10 | 20 |

## Rate limit headers

When rate limiting is enabled and a route has a configured limit, responses include:
```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705312800
```

## Rate limit response

When exceeded (HTTP 429):
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

## Rate limit scope

Limits apply per:
- Tenant
- Route/endpoint
- Time window (1 second)

## Handling rate limits

### SDK (automatic)
SDKs handle rate limits automatically with retry.

### Manual handling
```javascript
try {
  await api.request();
} catch (error) {
  if (error.statusCode === 429) {
    await sleep(error.details.retryAfter * 1000);
    await api.request();  // Retry
  }
}
```

## Monitoring usage

Rate limit observability depends on your deployment.
