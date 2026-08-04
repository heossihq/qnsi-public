---
title: Cryptographic Trust Model
version: 0.0.1
last_updated: 2026-07-28
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/kms-service/src/config/env.ts
  - /apps/vault-service/src/config/env.ts
---

# Cryptographic Trust Model

QNSI's cryptographic trust model defines what is trusted, what is verified by
software and what remains deployment-specific. A configured provider name is
not equivalent to a qualified hardware boundary.

## Root of Trust

Managed software custody, customer-managed HSM custody and enclave-backed
deployments have different roots of trust. When HSM or enclave protection is
selected, the exact device, firmware, mechanism, attestation chain and
deployment must be qualified. QNSI must not claim that all keys are
hardware-protected merely because the connector exists.

## Trust hierarchy

```
HSM Root Key
    ↓
Tenant Master Key (TMK)
    ↓
Data Encryption Keys (DEK)
```

This hierarchy illustrates an HSM-backed profile. Software-backed profiles
still use tenant and data-key separation, but their root custody boundary is
the configured KMS provider rather than a customer HSM.

## Trust assumptions

### What we trust
- The selected and qualified KMS or HSM provider
- Attestation verifiers and pinned trust anchors, when configured
- Cryptographic primitives (post-quantum and classical)
- Authenticated tenant and policy context supplied to the operation

### What we don't trust
- Application input without authentication and authorization
- Network (encrypted in transit)
- Storage (encrypted at rest)
- Operator assertions without an auditable control or returned evidence

Operator plaintext access depends on the selected custody and deployment
profile. Verify the exact profile rather than making a universal
zero-knowledge claim.

## Verification

Trust is verified via:
- HSM metadata or attestation reports where the selected device exposes them
- Enclave quotes where an enclave deployment is actually configured
- Certificate chains
- Key identifiers, policy decisions and signed audit evidence

Provider metadata, health responses and configuration flags are operational
telemetry. They are not independent proof that a private key remained inside a
particular certified boundary. Customer-HSM and native-PQC claims require
qualification of the exact product and mechanism.

## Compromise recovery

If a key is compromised:
1. Revoke affected keys
2. Re-encrypt with new keys
3. Audit access during exposure window
4. Rotate dependent credentials

Recovery must also identify data encrypted or signed during the exposure
window, dependent certificates and tokens, and any evidence that must be
preserved for incident reporting.

## Trust-boundary review

For each production key class, document:

| Question | Required evidence |
|---|---|
| Who controls the root credential? | Provider and tenant configuration |
| Where can plaintext key material exist? | Mechanism and data-flow review |
| Which policy authorizes use? | Versioned policy and decision record |
| How is the provider authenticated? | Pinned endpoint and credential source |
| What proves the operation occurred? | Returned record and audit event |
| How is compromise contained? | Revocation, rotation and recovery procedure |

Run the review again after provider, firmware, mechanism or deployment changes.
See [Key Hierarchy](./key-hierarchy), [Key Storage](./key-storage),
[Key Rotation](./key-rotation) and [Crypto Attestation](../security/crypto-attestation).
