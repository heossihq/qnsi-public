---
title: PKCS#11 Interface
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# PKCS#11 Interface

QNSI KMS uses PKCS#11 for HSM communication.

## Overview

PKCS#11 is the standard cryptographic token interface used by HSMs.

## Supported mechanisms

### Symmetric
- `CKM_AES_KEY_GEN`
- `CKM_AES_GCM`
- `CKM_AES_KEY_WRAP`

### Asymmetric (classical)
- `CKM_EC_KEY_PAIR_GEN`
- `CKM_ECDSA`
- `CKM_ECDH1_DERIVE`

### Key management
- `CKM_SHA256_HMAC`
- `CKM_GENERIC_SECRET_KEY_GEN`

## Session management

- Long-lived sessions for performance
- Automatic reconnection
- Session pooling

## Object attributes

Keys stored with attributes:
- `CKA_EXTRACTABLE`: false (for root keys)
- `CKA_SENSITIVE`: true
- `CKA_TOKEN`: true (persistent)

## Error handling

| PKCS#11 Error | QNSI Response |
|---------------|---------------|
| `CKR_KEY_NOT_FOUND` | 404 Key not found |
| `CKR_DEVICE_ERROR` | 503 HSM unavailable |
| `CKR_SESSION_CLOSED` | Retry with new session |

## Vendor extensions

Some HSMs provide extensions:
- Audit logging
- Key backup
- Cluster management

QNSI uses standard PKCS#11 where possible.
