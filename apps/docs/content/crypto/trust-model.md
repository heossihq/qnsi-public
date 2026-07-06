---
title: Cryptographic Trust Model
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/kms-service/src/config/env.ts
  - /apps/vault-service/src/config/env.ts
---

# Cryptographic Trust Model

QNSI's cryptographic trust model defines what is trusted and how trust is established.

## Root of Trust

The root of trust is established via:
- HSM-protected root keys
- Hardware attestation (enclaves)
- Secure boot chain

## Trust hierarchy

```
HSM Root Key
    ↓
Tenant Master Key (TMK)
    ↓
Data Encryption Keys (DEK)
```

## Trust assumptions

### What we trust
- HSM hardware and firmware
- Enclave attestation
- Cryptographic primitives (post-quantum and classical)

### What we don't trust
- Application code (verified via attestation)
- Network (encrypted in transit)
- Storage (encrypted at rest)
- Operators (no access to plaintext)

## Verification

Trust is verified via:
- HSM attestation reports
- Enclave quotes
- Certificate chains
- Cryptographic proofs

## Compromise recovery

If a key is compromised:
1. Revoke affected keys
2. Re-encrypt with new keys
3. Audit access during exposure window
4. Rotate dependent credentials
