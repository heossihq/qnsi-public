---
title: Key Types
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/kms-service/src/config/env.ts
  - /packages/cryptography/src/provider.ts
---

# Key Types

QNSI KMS (port 8095) supports multiple key types for different use cases.

## Symmetric Keys

### AES keys
- `aes-128-gcm`: 128-bit AES-GCM
- `aes-256-gcm`: 256-bit AES-GCM (default)
- `aes-256-cbc`: 256-bit AES-CBC (legacy)

### ChaCha20 keys
- `chacha20-poly1305`: ChaCha20-Poly1305 AEAD

### HMAC keys
- `hmac-sha256`: HMAC-SHA256
- `hmac-sha3-256`: HMAC-SHA3-256

## Asymmetric keys (classical)

### Signing
- `ed25519`: Ed25519 signatures
- `ecdsa-p256`: ECDSA with P-256
- `ecdsa-p384`: ECDSA with P-384

### Key exchange
- `x25519`: X25519 ECDH
- `ecdh-p256`: ECDH with P-256

## Asymmetric keys (PQC)

### Signing
- `dilithium-2`: Dilithium Level 2
- `dilithium-3`: Dilithium Level 3 (default)
- `dilithium-5`: Dilithium Level 5
- `falcon-512`: Falcon-512
- `falcon-1024`: Falcon-1024
- `sphincs-128s`: SPHINCS+-128s

### Key encapsulation
- `kyber-512`: Kyber-512
- `kyber-768`: Kyber-768 (default)
- `kyber-1024`: Kyber-1024

## Key purposes

Keys are constrained by purpose:
- `encrypt`: Encryption operations
- `decrypt`: Decryption operations
- `sign`: Signature creation
- `verify`: Signature verification
- `wrap`: Key wrapping
- `derive`: Key derivation
