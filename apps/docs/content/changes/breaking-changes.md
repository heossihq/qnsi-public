---
title: Breaking Changes
version: 0.0.1
last_updated: 2026-04-23
copyright: 2025 HEOSSI. All rights reserved.
---
# Breaking Changes

History of breaking changes and migration guides.

## API versions

This repo ships v1 APIs (for example `/kms/v1`, `/vault/v1`, `/audit/v1`).
Newer API versions are not shipped in this repo.

## Previous breaking changes

### 2024-01-01: PQC defaults

Cryptographic defaults may evolve over time.

### 2023-06-01: Tenant scoping

Many endpoints are tenant-scoped (for example via `tenantId` query parameters).

### 2023-01-01: Auth endpoint changes

**Change**: `/auth/token` split into `/auth/login` and `/auth/service-token`

**Impact**: Old endpoint returns 404

**Migration**:
- Use `/auth/login` for user auth
- Use `/auth/service-token` for service auth

## Avoiding breaks

- Subscribe to changelog
- Test in staging first
- Use SDK (handles changes)
- Monitor deprecation headers
