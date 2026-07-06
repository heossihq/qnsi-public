---
title: Key Revocation
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Key Revocation

QNSI supports immediate key revocation for security incidents.

## Revocation vs rotation

| Aspect | Rotation | Revocation |
|--------|----------|------------|
| Timing | Scheduled | Immediate |
| Old key | Decrypt-only | Disabled |
| Data access | Maintained | May be lost |
| Use case | Normal lifecycle | Security incident |

## Revocation process

1. Key marked as `revoked`
2. All operations fail immediately
3. Dependent keys identified
4. Cascade revocation if configured
5. Audit trail generated

## Revocation API

```
POST /kms/v1/keys/{keyId}/revoke
{
  "reason": "suspected_compromise",
  "cascade": true
}
```

## Revocation reasons

- `suspected_compromise`: Key may be exposed
- `policy_violation`: Usage policy violated
- `end_of_life`: Planned decommissioning
- `crypto_weakness`: Algorithm weakness discovered

## Recovery

Revoked keys cannot be recovered. If revocation was in error:
1. Generate new key
2. Re-encrypt data from backups
3. Update key references

## Cascade revocation

When a parent key is revoked:
- Child keys can be automatically revoked
- Or marked for manual review
- Configurable per key policy
