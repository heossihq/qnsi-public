---
title: Error Codes
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Error Codes

Complete reference of QNSI error codes.

## Error format

```json
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Human-readable message",
  "details": {...},
  "requestId": "uuid"
}
```

## Authentication errors

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `TOKEN_EXPIRED` | 401 | Access token expired |
| `INVALID_TOKEN` | 401 | Token validation failed |
| `INVALID_CREDENTIALS` | 401 | Wrong username/password |
| `MFA_REQUIRED` | 401 | MFA verification needed |

## Authorization errors

| Code | HTTP | Description |
|------|------|-------------|
| `FORBIDDEN` | 403 | Insufficient permissions |
| `POLICY_DENIED` | 403 | Policy evaluation denied |
| `QUOTA_EXCEEDED` | 403 | Resource quota exceeded |
| `TENANT_MISMATCH` | 403 | Token tenant doesn't match |

## Validation errors

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_REQUEST` | 400 | Malformed request |
| `MISSING_FIELD` | 400 | Required field missing |
| `INVALID_FORMAT` | 400 | Field format invalid |

## Resource errors

| Code | HTTP | Description |
|------|------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `ALREADY_EXISTS` | 409 | Resource already exists |
| `CONFLICT` | 409 | Conflicting operation |
| `GONE` | 410 | Resource deleted |

## Rate limiting

| Code | HTTP | Description |
|------|------|-------------|
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |

## Server errors

| Code | HTTP | Description |
|------|------|-------------|
| `INTERNAL_ERROR` | 500 | Unexpected error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily down |
| `GATEWAY_TIMEOUT` | 504 | Upstream timeout |
