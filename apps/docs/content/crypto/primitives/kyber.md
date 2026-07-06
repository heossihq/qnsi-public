---
title: Kyber (ML-KEM)
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Kyber (ML-KEM)

Kyber is a lattice-based key encapsulation mechanism standardized as ML-KEM.

## Overview

- **Type**: Key Encapsulation Mechanism (KEM)
- **Standard**: FIPS 203 (ML-KEM)
- **Security basis**: Module Learning With Errors (MLWE)

## Parameter sets

| Variant | Security level | Public key | Ciphertext | Shared secret |
|---------|---------------|------------|------------|---------------|
| Kyber-512 | Level 1 | 800 bytes | 768 bytes | 32 bytes |
| Kyber-768 | Level 3 | 1184 bytes | 1088 bytes | 32 bytes |
| Kyber-1024 | Level 5 | 1568 bytes | 1568 bytes | 32 bytes |

## QNSI usage

- **Default**: Kyber-768 (ML-KEM-768)
- **Use cases**: TLS key exchange, key wrapping, hybrid encryption

## Operations

### Key generation
Generate public/private keypair for encapsulation.

### Encapsulation
Given public key, produce ciphertext and shared secret.

### Decapsulation
Given private key and ciphertext, recover shared secret.

## Hybrid mode

Combined with X25519:
1. X25519 key exchange → shared secret 1
2. Kyber encapsulation → shared secret 2
3. HKDF(secret1 || secret2) → final key

## Performance

| Operation | Time (typical) |
|-----------|---------------|
| KeyGen | ~50 μs |
| Encaps | ~60 μs |
| Decaps | ~70 μs |
