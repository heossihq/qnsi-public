---
title: Authentication Prerequisites
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Authentication Prerequisites

Most protected QNSI endpoints require authentication via a Bearer token.
Some endpoints are public (for example health checks).

## Obtaining credentials

### Service accounts

For server-to-server integration:

1. Create a service account via the admin portal or API
2. Store the service secret securely
3. Exchange the secret for an access token via `POST /auth/service-token`

### User tokens

For user-facing applications:

1. Authenticate the user via `POST /auth/login`
2. Receive access token + refresh token
3. Use access token for API calls
4. Rotate via `POST /auth/token/refresh` before expiry

## Token format

Access tokens are typically PQC-signed JWTs containing:

- `sub`: Subject identifier
- `aud`: Token audience (`platform`, `internal-service`, `external-api`)
- `exp`: Expiry timestamp
- `tenant_id`: Tenant scope (when applicable)

## Required headers

For tenant-scoped API calls through the edge-gateway:
```
Authorization: Bearer <access_token>
x-qnsp-tenant: <tenant_uuid>
Content-Type: application/json
```

Tenant scoping is service-specific. Through the edge-gateway, many routes also accept `tenantId` as a query parameter.

Some services also require a service-specific tenant header. For example, `storage-service` expects:
```
x-tenant-id: <tenant_uuid>
```
