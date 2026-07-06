---
title: API Errors
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/auth-service/src/server.ts
  - /apps/edge-gateway/src/routes/proxy.ts
---

# API Errors

Error responses across QNSI APIs.

## Error Format

Many services return errors in this structure:

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Human-readable description",
  "details": { ... }
}
```

## Auth Service Error Codes

From `apps/auth-service/src/server.ts`:

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 | `UNAUTHORIZED` | Missing or invalid Authorization header |
| 401 | `UNAUTHORIZED` | Invalid service credentials |
| 403 | `AUDIENCE_NOT_PERMITTED` | Requested audience not allowed |
| 404 | `SERVICE_ACCOUNT_NOT_FOUND` | Service account not found |
| 404 | `NOT_FOUND` | Public key not found |
| 500 | `Internal Server Error` | Unhandled auth-service error |

## Edge Gateway Error Codes

From `apps/edge-gateway/src/routes/proxy.ts`:

| Status | Error Code | Description |
|--------|------------|-------------|
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded |

Rate limit response includes details:
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

## Token Service Error Codes

From `apps/auth-service/src/modules/tokens/service.ts`:

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `TENANT_REQUIRED` | tenantId is required |

## Standard HTTP Error Codes

| Status | Error Code | Retryable |
|--------|------------|-----------|
| 400 | `BAD_REQUEST` | No |
| 401 | `UNAUTHORIZED` | No |
| 403 | `FORBIDDEN` | No |
| 404 | `NOT_FOUND` | No |
| 409 | `CONFLICT` | No |
| 429 | `TOO_MANY_REQUESTS` | Yes (after `Retry-After`) |
| 500 | `INTERNAL_ERROR` | No (report to support) |
| 502 | `BAD_GATEWAY` | Yes (exponential backoff) |
| 503 | `SERVICE_UNAVAILABLE` | Yes (exponential backoff) |
| 504 | `GATEWAY_TIMEOUT` | Yes (exponential backoff) |

## Request ID

Request IDs are deployment-specific.
If your deployment includes a request identifier header, include it when contacting support.
