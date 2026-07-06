---
title: Key Hierarchy
version: 0.0.1
last_updated: 2026-04-23
description: QNSI uses a four-level key hierarchy of root keys, tenant master keys, key encryption keys, and data encryption keys for defense in depth and key derivation.
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/kms-service/src/config/env.ts
  - /apps/vault-service/src/config/env.ts
---

# Key Hierarchy

QNSI uses a hierarchical key structure for defense in depth.

## Hierarchy Levels

### Level 0: Root keys
- Stored in HSM
- Never exported
- Used only to wrap Level 1 keys

### Level 1: Tenant Master Keys (TMK)
- One per tenant
- Wrapped by root key
- Used to derive/wrap Level 2 keys

### Level 2: Key Encryption Keys (KEK)
- Purpose-specific (storage, secrets, etc.)
- Wrapped by TMK
- Used to wrap Level 3 keys

### Level 3: Data Encryption Keys (DEK)
- Per-object or per-operation
- Wrapped by KEK
- Used for actual data encryption

## Key derivation

Keys are derived using:
- HKDF with SHA3-256
- Context-specific info strings
- Tenant and purpose binding

## Key wrapping

Keys are wrapped using:
- AES-256-KWP (classical)
- Kyber-wrapped AES key (hybrid)

## Benefits

- **Blast radius**: Compromised DEK affects only that object
- **Rotation**: Rotate at any level without re-encrypting all data
- **Audit**: Track key usage at each level
- **Crypto-shred**: Delete TMK to render all tenant data unrecoverable
