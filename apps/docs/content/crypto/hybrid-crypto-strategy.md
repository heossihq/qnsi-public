---
title: Hybrid Cryptography Strategy
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Hybrid Cryptography Strategy

QNSI uses hybrid cryptography combining classical and post-quantum algorithms.

## Why hybrid

- **Defense in depth**: If one algorithm is broken, the other provides protection
- **Transition period**: Gradual migration from classical to PQC
- **Compliance**: Some standards still require classical algorithms

## Hybrid modes

### Signatures
Dual signatures with both algorithms:
- Classical: Ed25519
- PQC: Dilithium (ML-DSA)

Both must verify for acceptance.

### Key encapsulation
Combined KEM:
- Classical: X25519
- PQC: Kyber (ML-KEM)

Shared secret derived from both.

### Encryption
Layered encryption:
- Outer layer: Classical (AES-256-GCM)
- Inner layer: PQC-derived key

## Configuration

Hybrid mode is default. Pure PQC mode available:
```
CRYPTO_MODE=hybrid  # default
CRYPTO_MODE=pqc     # PQC only
```

## Migration path

1. **Current**: Hybrid mode (classical + PQC)
2. **Transition**: Monitor PQC standardization
3. **Future**: Pure PQC when classical deprecated

## Performance

Hybrid adds overhead:
- Signature size: ~2.5x larger
- Verification time: ~1.5x slower
- Key exchange: ~2x slower

Acceptable for security-critical operations.
