---
title: Cryptographic Algorithm Sunset
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Cryptographic Algorithm Sunset

Schedule for deprecating cryptographic algorithms.

## Current status

### Active algorithms

| Algorithm | Type | Status |
|-----------|------|--------|
| AES-256-GCM | Symmetric | Active |
| ChaCha20-Poly1305 | Symmetric | Active |
| Dilithium | Signature | Active (default) |
| Falcon | Signature | Active |
| SPHINCS+ | Signature | Active |
| Kyber | KEM | Active (default) |
| Ed25519 | Signature | Active (hybrid) |
| X25519 | Key exchange | Active (hybrid) |

### Deprecated algorithms

| Algorithm | Deprecated | End of life |
|-----------|------------|-------------|
| RSA-2048 | 2024-01-01 | 2025-01-01 |
| RSA-4096 | 2024-01-01 | 2025-01-01 |
| ECDSA P-256 | 2024-06-01 | 2025-06-01 |

### Removed algorithms

| Algorithm | Removed | Reason |
|-----------|---------|--------|
| 3DES | 2023-01-01 | Weak |
| SHA-1 | 2023-01-01 | Collision attacks |

## Migration timeline

### RSA deprecation
1. **2024-01-01**: Deprecation notice
2. **2024-07-01**: No new RSA keys
3. **2025-01-01**: RSA operations disabled

### ECDSA deprecation
1. **2024-06-01**: Deprecation notice
2. **2024-12-01**: No new ECDSA keys
3. **2025-06-01**: ECDSA operations disabled

## Migration guidance

### From RSA to Dilithium
```bash
# Create new Dilithium key
qnsi kms keys create --algorithm dilithium-3

# Re-sign with new key
qnsi kms sign --key-id $NEW_KEY --input data.bin
```

### From ECDSA to Dilithium
Similar process - create Dilithium key and update signing.

## Notifications

Deprecation warnings in:
- API responses (`Deprecation` header)
- Console alerts
- Email notifications
