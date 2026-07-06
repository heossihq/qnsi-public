---
title: KMS Access Control
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# KMS Access Control

Access to KMS operations is controlled by policies and permissions.

## Permission model

### Key-level permissions
- `kms:keys:create` - Create new keys
- `kms:keys:read` - Read key metadata
- `kms:keys:use` - Use key for crypto operations
- `kms:keys:rotate` - Rotate key versions
- `kms:keys:delete` - Delete/destroy keys

### Operation permissions
- `kms:encrypt` - Encrypt data
- `kms:decrypt` - Decrypt data
- `kms:sign` - Create signatures
- `kms:verify` - Verify signatures
- `kms:wrap` - Wrap keys
- `kms:unwrap` - Unwrap keys

## Policy structure

```json
{
  "version": "1",
  "statements": [
    {
      "effect": "allow",
      "actions": ["kms:encrypt", "kms:decrypt"],
      "resources": ["keys/storage-*"],
      "conditions": {
        "tenant": "${token.tenant_id}"
      }
    }
  ]
}
```

## Key policies

Each key can have an attached policy:
- Overrides default permissions
- Scoped to specific key
- Supports conditions

## Conditions

Supported condition keys:
- `tenant`: Tenant ID match
- `ip`: Source IP range
- `time`: Time-based restrictions
- `mfa`: MFA requirement

## Audit

All access decisions are logged:
- Requester identity
- Requested action
- Resource
- Decision (allow/deny)
- Timestamp
