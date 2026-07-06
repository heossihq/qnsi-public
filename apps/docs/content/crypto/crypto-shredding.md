---
title: Crypto-Shredding
version: 0.0.1
last_updated: 2026-04-23
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

## Process

### Tenant-level shredding
```
POST /kms/v1/tenants/{tenantId}/crypto-shred
{
  "confirmation": "SHRED-{tenantId}",
  "reason": "tenant_offboarding"
}
```

### Resource-level shredding
```
POST /kms/v1/keys/{keyId}/shred
{
  "confirmation": "SHRED-{keyId}"
}
```

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
