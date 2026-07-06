---
title: Hybrid Handshakes
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Hybrid Handshakes

QNSI implements hybrid key exchange combining classical and PQC algorithms.

## Why hybrid

- Defense against classical and quantum attacks
- Transition compatibility
- Regulatory compliance

## TLS 1.3 hybrid

QNSI supports hybrid key exchange in TLS 1.3:

### Supported groups
- `x25519_kyber768` (recommended)
- `secp384r1_kyber768`
- `x25519_kyber512`

### Handshake flow

```
Client                              Server
  |                                   |
  |--- ClientHello (hybrid groups) -->|
  |                                   |
  |<-- ServerHello (selected group) --|
  |<-- EncryptedExtensions ----------|
  |<-- Certificate ------------------|
  |<-- CertificateVerify ------------|
  |<-- Finished ---------------------|
  |                                   |
  |--- Finished -------------------->|
  |                                   |
  [Application Data]
```

### Key derivation

```
classical_ss = X25519(client_priv, server_pub)
pqc_ss = Kyber.Decaps(ciphertext, client_priv)
combined_ss = classical_ss || pqc_ss
master_secret = HKDF-Extract(combined_ss)
```

## API key exchange

For non-TLS contexts:

```
POST /kms/v1/key-exchange
{
  "clientPublicKey": {
    "x25519": "base64...",
    "kyber": "base64..."
  }
}
```

Returns server public keys and encapsulated secrets.

## Performance impact

Hybrid adds ~1-2ms to handshake latency.
