---
title: Key Rotation
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/kms-service/src/config/env.ts
  - /apps/storage-service/src/config/env.ts
---

# Key Rotation

QNSI supports automatic and manual key rotation.

## Rotation Triggers

- **Scheduled**: Based on rotation period
- **Manual**: Admin-initiated
- **Policy**: Usage count exceeded
- **Security**: Suspected compromise

## Rotation process

1. Generate new key version
2. Mark old version as `decrypt-only`
3. New encryptions use new version
4. Gradual re-encryption of existing data (optional)
5. Old version deactivated after grace period

## Key versions

Keys maintain version history:
```json
{
  "keyId": "key-uuid",
  "currentVersion": 3,
  "versions": [
    {"version": 1, "state": "destroyed"},
    {"version": 2, "state": "deactivated"},
    {"version": 3, "state": "active"}
  ]
}
```

## Automatic rotation

Configure rotation schedule:
```json
{
  "rotationPeriod": "90d",
  "autoRotate": true,
  "retainVersions": 3
}
```

## Re-encryption

After rotation, existing ciphertext can be re-encrypted:
```
POST /kms/v1/reencrypt
{
  "keyId": "key-uuid",
  "ciphertext": "old-ciphertext"
}
```

Returns ciphertext encrypted with current version.

## Rotation audit

Rotation events are logged:
- Old version ID
- New version ID
- Trigger reason
- Initiator
