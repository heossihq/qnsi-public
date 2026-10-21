---
title: Algorithm Agility
version: 0.0.1
last_updated: 2026-09-15
copyright: © 2025 HEOSSI. All rights reserved.
---
# Algorithm Agility

QNSI is designed for algorithm agility to adapt to cryptographic advances.

Algorithm agility is a capability, not a permanent 100% state. QNSI reports a
measured PQC-readiness score from the current tenant inventory. A score of 100
requires every inventoried asset to be classified as pure PQC and no open
policy violations. Hybrid assets receive transitional credit, unassessed assets
remain in the denominator, and an empty inventory scores zero.

## Why algorithm agility

- New attacks may weaken algorithms
- Standards evolve
- Compliance requirements change
- Quantum computing advances

## Implementation

### Algorithm identifiers
All cryptographic operations include algorithm ID:
```json
{
  "algorithm": "aes-256-gcm",
  "keyId": "key-uuid"
}
```

### Ciphertext format
Ciphertext includes metadata:
```
[version][algorithm][key-id][iv][ciphertext][tag]
```

### Key metadata
Keys store algorithm information:
```json
{
  "keyId": "uuid",
  "algorithm": "dilithium-3",
  "parameters": {...}
}
```

## Migration process

1. Add support for new algorithm
2. Generate new keys with new algorithm
3. Re-encrypt/re-sign with new keys
4. Deprecate old algorithm
5. Remove old algorithm support

Policy evaluation covers the complete tenant inventory. Rotation requests
require a verified internal-service identity, a configured rotation token, or a
valid request signature. External systems remain customer-controlled until
their connectors provide an authenticated, verifiable rotation path.

## Supported algorithms

### Current
- AES-256-GCM, ChaCha20-Poly1305
- Ed25519, Dilithium, Falcon
- X25519, Kyber

### Deprecated
- Listed in `/changes/crypto-sunset.md`

## Configuration

Algorithm preferences configurable:
```
PREFERRED_SYMMETRIC=aes-256-gcm
PREFERRED_SIGNATURE=dilithium-3
PREFERRED_KEM=kyber-768
```
