---
title: Falcon (FN-DSA)
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /packages/cryptography/src/provider.ts
  - /packages/cryptography/src/providers/liboqs.ts
---
# Falcon (FN-DSA)

Falcon is a lattice-based signature scheme with compact signatures.

## Algorithm Identifiers

From `packages/cryptography/src/provider.ts`:

```typescript
type PqcSignatureAlgorithm = 
  | "falcon-512"
  | "falcon-1024";
```

## liboqs Implementation

From `packages/cryptography/src/providers/liboqs.ts`:

```typescript
const ALGORITHM_MAP = {
  "falcon-512": ["Falcon512", "Falcon-512"],
  "falcon-1024": ["Falcon1024", "Falcon-1024"],
};
```

## Parameter Sets

| Variant | QNSI Identifier | liboqs Name | Security Level |
|---------|----------------|-------------|----------------|
| Falcon-512 | `falcon-512` | `Falcon-512` | NIST Level 1 |
| Falcon-1024 | `falcon-1024` | `Falcon-1024` | NIST Level 5 |

## Overview

- **Type**: Digital Signature Algorithm
- **Standard**: FN-DSA (NIST selected)
- **Security basis**: NTRU lattices

## QNSI Usage

Falcon is supported but **not the default** signature algorithm. From codebase analysis:

- **Default**: Dilithium-2 (for JWT signing)
- **Falcon availability**: Supported via liboqs provider
- **Test coverage**: Integration tests in `providers/liboqs.integration.test.ts`

## Code Examples

From integration tests:

```typescript
// Falcon-512 operations
const { keyPair } = await provider.generateKeyPair({ 
  algorithm: "falcon-512" 
});

const { signature } = await provider.sign({
  algorithm: "falcon-512",
  data: message,
  privateKey: keyPair.privateKey,
});

const isValid = await provider.verify({
  algorithm: "falcon-512",
  data: message,
  signature,
  publicKey: keyPair.publicKey,
});
```

## PQC-TLS Support

From `packages/cryptography/src/tls/pqc-tls.ts`:

```typescript
const OQS_ALGORITHM_MAP = {
  "falcon-512": "falcon512",
  "falcon-1024": "falcon1024",
};
```
