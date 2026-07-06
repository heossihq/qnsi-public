---
title: Organization Access (C2)
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/tenant-service/src/services/tenant-service.ts
  - /apps/tenant-service/src/routes/tenants.ts
  - /apps/cloud/app/settings/settings-client.tsx
  - /apps/cloud/app/api/auth/join-request/route.ts
  - /apps/cloud/app/api/settings/tenant/join-requests/[requestId]/review/route.ts
  - /apps/auth-service/src/server.ts
---

# Organization Access (C2)

QNSI uses a **C2 organization access model**:

- A tenant is **claimed** by verifying control of a domain via DNS.
- Users with emails on a verified domain can submit a **request to join**.
- Tenant admins **approve/deny** join requests.
- Tenant membership is stored in **auth-service** (`auth_users`).

## 1) Claiming a tenant via domain verification

### Start verification

Tenant admins start a challenge. The tenant-service returns a DNS TXT record name/value.

- `POST /tenant/v1/tenants/:tenantId/domains/verification/start`

Response includes:

- `txtName` (example: `_qnsi-verify.example.com`)
- `txtValue` (example: `qnsi-domain-verification=<token>`)

### Verify

After publishing the TXT record, the admin verifies it:

- `POST /tenant/v1/tenants/:tenantId/domains/verification/verify`

In **production**, tenant-service performs a real DNS TXT lookup.

On success, tenant-service:

- Adds/updates `tenant_domains` (verified=true)
- Updates tenant metadata:
  - `tenantType = "organization"`
  - `claimed = true`
  - `claimedAt`
  - `claimedByUserId` (from `X-User-ID`)
  - `joinRequestsEnabled = true`

### List verified domains

- `GET /tenant/v1/tenants/:tenantId/domains`

## 2) Request-to-join flow

### Submit join request (public)

Unauthenticated users submit join requests through edge-gateway:

- `POST /public/join-requests`

Input:

- `tenant` (slug or tenant UUID, deployment-specific)
- `email`
- `requestedRole` (defaults to `Developer`)

Tenant-service enforces:

- `joinRequestsEnabled` must be true
- Email domain must match a verified domain in `tenant_domains`

### Admin review (approve/deny)

Tenant admins list and review requests:

- `GET /tenant/v1/tenants/:tenantId/join-requests?status=pending`
- `POST /tenant/v1/tenants/:tenantId/join-requests/:requestId/review`

On **approve**, Cloud provisions membership in auth-service.

## 3) Membership is stored in auth-service

### List members

- `GET /auth/tenants/:tenantId/users`

This endpoint is **admin-protected** and tenant-scoped.

### Invite acceptance model

Invites are implemented as:

- Create user in auth-service with `status = "locked"`
- Trigger password reset email (`/auth/forgot-password`)
- When the invited user completes `/auth/reset-password`, auth-service automatically flips:

- `locked → active`

This makes the password reset link act as the invite acceptance link.

## Authorization model (high level)

- **Edge Gateway** is the primary entrypoint in production.
- Public join requests go through edge-gateway `POST /public/join-requests`.
- Admin actions require a Bearer JWT with `admin` role and correct `tenant_id`.

## Related docs

- `/api/authentication`
- `/identity/authentication-flows`
- `/identity/rbac-and-policies`
