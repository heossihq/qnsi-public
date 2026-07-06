---
title: Encryption at Rest
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/storage-service/src/config/env.ts
  - /apps/kms-service/src/config/env.ts
---

# Encryption at Rest

All data in QNSI Storage (port 8092) is encrypted at rest.

## Default Encryption

Every object is encrypted with:
- Algorithm: AES-256-GCM
- Key: Per-object DEK wrapped by tenant KEK

## Encryption process

### Upload
1. Generate random DEK
2. Encrypt object with DEK
3. Wrap DEK with tenant KEK
4. Store encrypted object + wrapped DEK

### Download
1. Retrieve wrapped DEK
2. Unwrap DEK using tenant KEK
3. Decrypt object with DEK
4. Return plaintext to client

## Key hierarchy

```
Tenant Master Key (TMK)
    ↓
Storage Key Encryption Key (KEK)
    ↓
Per-Object Data Encryption Key (DEK)
```

## Encryption context

Objects encrypted with context binding:
```json
{
  "tenant": "tenant-id",
  "bucket": "bucket-name",
  "object": "object-key"
}
```

Context must match on decryption.

## Key rotation

When storage KEK rotates:
- New objects use new KEK
- Existing objects re-encrypted on access (lazy)
- Bulk re-encryption available

## Verification

Encryption verified via:
- Integrity tags (GCM authentication)
- Checksums in metadata
- Audit logging
