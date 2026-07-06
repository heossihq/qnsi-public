---
title: API Authentication
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/auth-service/src/server.ts
  - /apps/auth-service/src/config/env.ts
  - /packages/shared-kernel/src/constants.ts
---

# API Authentication

Most protected endpoints require authentication via a Bearer token.
In this repo, access tokens are typically PQC-signed JWTs issued by `auth-service`.

## Bearer Token

Include access token in Authorization header:
```http
Authorization: Bearer <access_token>
```

Through the edge-gateway, Bearer tokens may be:
- a PQC-signed JWT (the default)
- a legacy static API token when `EDGE_API_TOKENS` is configured (deployment-specific)

## Tenant Context

Many endpoints require tenant context.
Through the edge-gateway, tenant context can be provided via:
```http
x-qnsp-tenant: <tenant_uuid>
```
or a `tenantId=<tenant_uuid>` query parameter (service-specific).

Some services also require a service-specific tenant header. For example, `storage-service` requires `x-tenant-id` for `/storage/v1/*` routes.

## Admin-scoped tenant operations

Certain endpoints (e.g. tenant membership operations in `auth-service`) require:

- A Bearer JWT with `roles` including `admin`
- A `tenant_id` claim matching the requested tenant

Example membership listing:

```http
GET /auth/tenants/<tenant_uuid>/users
Authorization: Bearer <access_token>
```

## Service Token Authentication

From `apps/auth-service/src/server.ts`:

```http
POST /auth/service-token
Authorization: Bearer <service_secret>
Content-Type: application/json

{
  "serviceId": "<uuid>",
  "audience": "internal-service"  // optional, defaults to first allowed audience (or internal-service)
}
```

Supported audiences:
- `platform`
- `internal-service`
- `external-api`

**Response (201):**
```json
{
  "accessToken": "<jwt>"
}
```

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 | `UNAUTHORIZED` | Missing or invalid Authorization header |
| 401 | `UNAUTHORIZED` | Invalid service credentials |
| 403 | `AUDIENCE_NOT_PERMITTED` | Requested audience not allowed for service |
| 404 | `SERVICE_ACCOUNT_NOT_FOUND` | Service account not found |

## JWT Public Key Endpoint

Retrieve public key for token verification:

```http
GET /auth/jwt/public-key?kid=<key_id>
```

**Response (200):**
```json
{
  "keyId": "<key_id>",
  "algorithm": "dilithium-2",
  "publicKey": "<base64-encoded-public-key>"
}
```

## Token Lifetime

From `apps/auth-service/src/config/env.ts`:

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| Access token TTL | `ACCESS_TOKEN_TTL_SECONDS` | 900 (15 min) |
| Refresh token TTL | `REFRESH_TOKEN_TTL_SECONDS` | 2,592,000 (30 days) |

## Health Endpoint

```http
GET /auth/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "auth-service",
  "environment": "production",
	"pqcProvider": "liboqs",
	"pqcProviderVersion": "0.10.0",
	"pqcProviderRegisteredAt": "2025-01-01T00:00:00.000Z",
	"pqcLastRotationAt": "2025-01-01T00:00:00.000Z",
	"pqcFallbacks": ["liboqs"],
	"pqcAlgorithms": ["kyber-768", "dilithium-2"]
}
```

## Error Response Format

Many auth-related errors follow this structure:
```json
{
  "statusCode": 401,
  "error": "UNAUTHORIZED",
  "message": "Missing or invalid Authorization header"
}
```
