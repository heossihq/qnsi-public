---
title: Modes of Operation
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Modes of Operation

How QNSI uses PQC primitives in different contexts.

## Token signing

**Algorithm**: Dilithium (ML-DSA-65)

```
JWT Header: {"alg": "DILITHIUM3", "kid": "key-id"}
JWT Payload: {claims}
Signature: Dilithium.sign(header.payload, privateKey)
```

## TLS key exchange

**Algorithm**: Hybrid X25519 + Kyber-768

```
ClientHello: X25519 + Kyber public keys
ServerHello: X25519 + Kyber ciphertexts
Shared secret: HKDF(X25519_ss || Kyber_ss)
```

## Data encryption

**Algorithm**: AES-256-GCM with Kyber-wrapped DEK

```
1. Generate random DEK (256 bits)
2. Encapsulate DEK with Kyber public key
3. Encrypt data with DEK using AES-256-GCM
4. Store: Kyber ciphertext + AES ciphertext + tag
```

## Document signing

**Algorithm**: Dilithium or SPHINCS+ (configurable)

```
1. Hash document with SHA3-256
2. Sign hash with Dilithium private key
3. Attach signature with algorithm identifier
```

## Key wrapping

**Algorithm**: Kyber + AES-KWP

```
1. Generate ephemeral Kyber keypair
2. Encapsulate to get shared secret
3. Derive wrapping key from shared secret
4. Wrap target key with AES-KWP
```
