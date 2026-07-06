---
title: Key Generation
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Key Generation

QNSI generates cryptographic keys using secure random sources.

## Random sources

- HSM hardware RNG (primary)
- OS entropy pool (fallback)
- Additional entropy mixing

## Generation process

1. Request key generation with parameters
2. Generate random bytes from HSM
3. Derive key material using KDF
4. Wrap key for storage
5. Return key ID (not key material)

## Key types

### Symmetric keys
- AES-256 for encryption
- HMAC-SHA3-256 for authentication

### Asymmetric keys (classical)
- Ed25519 for signatures
- X25519 for key exchange

### Asymmetric keys (PQC)
- Dilithium for signatures
- Kyber for key encapsulation
- Falcon for size-constrained signatures
- SPHINCS+ for stateless signatures

## Generation parameters

```json
{
  "algorithm": "aes-256-gcm",
  "purpose": "encryption",
  "extractable": false,
  "rotationPeriod": "90d"
}
```

## Key metadata

Generated keys include:
- Key ID (UUID)
- Algorithm and parameters
- Creation timestamp
- Expiry/rotation schedule
- Usage constraints
