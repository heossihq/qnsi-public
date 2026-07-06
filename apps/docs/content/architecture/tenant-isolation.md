---
title: Tenant Isolation
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/edge-gateway/src/config/env.ts
  - /packages/shared-kernel/src/constants.ts
---

# Tenant Isolation

QNSI enforces strict tenant isolation at multiple layers.

## Isolation Model

Every request is scoped to a tenant via:
- Tenant context (`x-qnsp-tenant` header or `tenantId` query parameter)
- Token claims (`tenant_id`)

## Enforcement points

### Edge gateway
- Validates tenant context presence
- Rejects requests without tenant context (except public routes)

### Services
- Validate tenant in token matches request context
- Scope all database queries to tenant
- Tenant ID in all audit events

### Data layer
- Tenant-prefixed keys in KMS
- Tenant-scoped storage buckets
- Separate encryption keys per tenant

## Cross-tenant access

Cross-tenant access is not supported. Each tenant operates in complete isolation.

## Tenant identification

Tenants are identified by UUID. Slug-based lookup available via:
```
GET /public/tenant-by-slug/<slug>
```
