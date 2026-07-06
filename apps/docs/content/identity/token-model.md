---
title: Token Model
version: 0.0.1
last_updated: 2026-04-23
description: QNSI uses a two-token model with PQC-signed JWT access tokens and refresh tokens, spanning platform, internal-service, and external-api token audiences.
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /packages/shared-kernel/src/constants.ts
  - /packages/shared-kernel/src/auth.ts
  - /packages/shared-kernel/src/jwt.ts
  - /apps/auth-service/src/config/env.ts
---

# Token Model

QNSI uses a two-token model: access tokens and refresh tokens.

## Token Audiences

From `packages/shared-kernel/src/constants.ts`:

```typescript
export const TOKEN_AUDIENCES = {
  PLATFORM: "platform",
  INTERNAL_SERVICE: "internal-service",
  EXTERNAL_API: "external-api",
} as const;
```

| Audience | Use Case |
|----------|----------|
| `platform` | General platform access (default) |
| `internal-service` | Service-to-service communication |
| `external-api` | External API integrations |

## Access Tokens (JWT)

Access tokens are issued as PQC-signed JWTs for API authentication.
In this repo, `auth-service` uses a JWT key manager and signs tokens by default.

### JWT Claims

From `packages/shared-kernel/src/auth.ts`:

```typescript
// JWT payload structure
interface JwtPayload {
  jti: string;      // Token ID (UUID)
  sub: string;      // Subject ID (user/service UUID)
  iat: number;      // Issued at (Unix timestamp)
  exp: number;      // Expiration (Unix timestamp)
  aud: TokenAudience;  // Audience
  iss?: string;     // Issuer (optional)
  tenant_id?: string;  // Tenant ID (optional)
  roles?: string[]; // Roles (optional)
}
```

### Token Lifetime

From `apps/auth-service/src/config/env.ts`:

| Setting | Default | Description |
|---------|---------|-------------|
| `ACCESS_TOKEN_TTL_SECONDS` | 900 (15 min) | Access token lifetime |
| `REFRESH_TOKEN_TTL_SECONDS` | 2,592,000 (30 days) | Refresh token lifetime |
| `DEFAULT_TOKEN_TTL_SECONDS` | 900 (15 min) | Fallback from constants.ts |

### JWT Signing Algorithms

From `packages/shared-kernel/src/jwt.ts`:

JWT signing uses a signature algorithm (default `dilithium-2`).
The JWT `alg` header is derived from the configured PQC algorithm.

## Refresh Tokens

Opaque tokens for obtaining new access tokens.

### Format

From `packages/shared-kernel/src/auth.ts`:

```typescript
const REFRESH_TOKEN_SECRET_BYTES = 48;
const REFRESH_TOKEN_DELIMITER = ".";

// Format: <tokenId>.<base64url-secret>
// Example: 550e8400-e29b-41d4-a716-446655440000.dGhpcyBpcyBhIHNlY3JldA...
```

### Rotation

Refresh tokens rotate on use:
1. Client presents refresh token
2. Server validates and issues new access + refresh tokens
3. Old refresh token is revoked

## Revocation

```http
POST /auth/token/revoke
Content-Type: application/json

{"refreshToken": "<token>"}
```

Or by token ID:
```http
POST /auth/token/revoke
Content-Type: application/json

{"tokenId": "<uuid>"}
```
