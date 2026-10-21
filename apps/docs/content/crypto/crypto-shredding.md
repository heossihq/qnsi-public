---
title: Crypto-Shredding
version: 0.0.2
last_updated: 2026-08-18
description: Crypto-shredding renders QNSI data permanently unrecoverable by destroying tenant keys, supporting tenant offboarding, retention expiry, and GDPR erasure.
copyright: © 2025 HEOSSI. All rights reserved.
---
# Crypto-Shredding

Crypto-shredding renders data unrecoverable by destroying encryption keys.

## How it works

1. All data encrypted with tenant-specific keys
2. Keys stored in key hierarchy
3. Delete Tenant Master Key (TMK)
4. All data encrypted under TMK becomes unrecoverable

## Use cases

- **Tenant offboarding**: Complete data deletion
- **Data retention expiry**: Automatic deletion
- **Right to be forgotten**: GDPR compliance
- **Security incident**: Emergency data destruction

## Current implementation status

Tenant data deletion is implemented as an internal, token-gated purge invoked by
the workspace-deletion worker (`DELETE /kms/v1/internal/tenant/{tenantId}`,
guarded by the shared `INTERNAL_TENANT_PURGE_TOKEN`). It irreversibly deletes
all kms-service rows for a tenant in strict foreign-key order and is never
exposed as a user-facing endpoint.

Dedicated user-facing `crypto-shred` endpoints
(`POST /kms/v1/tenants/{tenantId}/crypto-shred`,
`POST /kms/v1/keys/{keyId}/shred`) are **not yet implemented**. Do not build
clients against them. Until they ship, tenant offboarding must go through the
workspace-deletion flow.

## Verification

After shredding:
- Key material overwritten
- Key metadata retained for audit
- Encrypted data remains but is unreadable

## Audit trail

Shredding events include:
- Initiator identity
- Affected keys
- Reason
- Timestamp
- Confirmation token

## Irreversibility

Crypto-shredding is **irreversible**. No recovery is possible. Requires explicit confirmation.