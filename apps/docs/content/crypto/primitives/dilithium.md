---
title: Dilithium (ML-DSA)
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /packages/cryptography/src/provider.ts
  - /apps/auth-service/src/config/env.ts
---

# Dilithium (ML-DSA)

Dilithium is a lattice-based digital signature algorithm standardized as ML-DSA.

## Overview

- **Type**: Digital Signature Algorithm
- **Standard**: FIPS 204 (ML-DSA)
- **Security basis**: Module Learning With Errors (MLWE)

## QNSI Algorithm Identifiers

From `packages/cryptography/src/provider.ts`:

```typescript
type PqcAlgorithm =
  | "dilithium-2"  // NIST Level 2
  | "dilithium-3"  // NIST Level 3 (default)
  | "dilithium-5"; // NIST Level 5
```

## Parameter Sets

| Variant | Security Level | Public Key | Signature | Secret Key |
|---------|---------------|------------|-----------|------------|
| `dilithium-2` | Level 2 | 1312 bytes | 2420 bytes | 2560 bytes |
| `dilithium-3` | Level 3 | 1952 bytes | 3293 bytes | 4032 bytes |
| `dilithium-5` | Level 5 | 2592 bytes | 4595 bytes | 4896 bytes |

## QNSI Defaults

From `apps/auth-service/src/config/env.ts`:

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| JWT signing | `JWT_SIGNING_ALGORITHM` | `dilithium-2` |
| Audit signing | `AUDIT_SIGNING_ALGORITHM` | `dilithium-3` |
| Manifest signing | `STORAGE_MANIFEST_SIGNATURE_ALGORITHM` | `dilithium-3` |

**Use cases**: JWT signing, audit event signing, document signatures, code signing

## Operations

### Key generation
Generate signing keypair.

### Sign
Create signature over message using private key.

### Verify
Verify signature using public key.

## Deterministic signatures

Dilithium produces deterministic signatures:
- Same message + key = same signature
- No random nonce required
- Simplifies testing and debugging

## Performance

| Operation | Time (typical) |
|-----------|---------------|
| KeyGen | ~100 μs |
| Sign | ~200 μs |
| Verify | ~100 μs |

## Comparison to classical

| Aspect | Ed25519 | Dilithium3 |
|--------|---------|------------|
| Public key | 32 bytes | 1952 bytes |
| Signature | 64 bytes | 3293 bytes |
| Sign time | ~50 μs | ~200 μs |
