---
title: Encryption in Transit
version: 0.0.1
last_updated: 2026-04-23
description: QNSI encrypts all data in transit with TLS 1.3, hybrid PQC key exchange, mTLS between services, strong cipher suites, and automatic certificate rotation.
copyright: © 2025 HEOSSI. All rights reserved.
---
# Encryption in Transit

All data transfers are encrypted in transit.

## TLS configuration

### External connections
- TLS 1.3 required
- Hybrid PQC key exchange (X25519 + Kyber)
- Strong cipher suites only

### Internal connections
- mTLS between services
- Certificate-based authentication
- Short-lived certificates

## Cipher suites

Supported (in preference order):
1. `TLS_AES_256_GCM_SHA384`
2. `TLS_CHACHA20_POLY1305_SHA256`
3. `TLS_AES_128_GCM_SHA256`

## Certificate management

- Automatic certificate rotation
- ACME integration for public certs
- Internal CA for service certs

## Upload/download

### Chunked uploads
- Each chunk encrypted in transit
- Integrity verified per chunk
- Resumable with chunk verification

### Streaming downloads
- Decrypted on-the-fly
- Range requests supported
- Integrity verified on completion

## End-to-end encryption

For maximum security:
1. Client encrypts before upload (CSE)
2. TLS protects in transit
3. SSE provides at-rest encryption

Data never in plaintext on server.

### Browser-side PQC encryption

Browser-side PQC uses `@noble/post-quantum` directly (pure JavaScript, zero native dependencies). This enables true end-to-end encryption where data is encrypted before it leaves the browser. QNSI does not currently publish a separate browser SDK package.

Supported algorithms (18 FIPS-standardized):
- **ML-KEM** (FIPS 203): kyber-512, kyber-768, kyber-1024 - key encapsulation
- **ML-DSA** (FIPS 204): dilithium-2, dilithium-3, dilithium-5 - digital signatures
- **SLH-DSA** (FIPS 205): 12 parameter sets (SHA2/SHAKE × 128/192/256 × f/s) - hash-based signatures

CSE workflow:
1. Generate ML-KEM key pair via `generateEncryptionKeyPair("kyber-768")`
2. Encrypt data with `encryptBeforeUpload(data, publicKey, "kyber-768")` - uses ML-KEM + AES-256-GCM
3. Upload encrypted envelope to QNSI storage
4. Download and decrypt with `decryptAfterDownload(envelope, privateKey)`

See the [`@noble/post-quantum` package](https://www.npmjs.com/package/@noble/post-quantum) for the primitive API. Keep private keys in browser-controlled storage and upload only the encrypted envelope to QNSI storage.
