---
title: HSM Integration
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# HSM Integration

QNSI KMS integrates with Hardware Security Modules for root key protection.

## Supported HSMs

| Vendor | Model | Interface |
|--------|-------|-----------|
| AWS | CloudHSM | PKCS#11 |
| Thales | Luna | PKCS#11 |
| Utimaco | CryptoServer | PKCS#11 |
| Entrust | nShield | PKCS#11 |

## HSM-protected operations

### Root key storage
- Tenant Master Keys wrapped by HSM root
- Root key never leaves HSM
- All unwrap operations in HSM

### Key generation
- Optional HSM-based RNG
- Key material generated in HSM
- Exported wrapped

## Configuration

```yaml
hsm:
  provider: "cloudhsm"
  clusterId: "cluster-xxx"
  credentials:
    customerCa: "/path/to/ca.crt"
    clientCert: "/path/to/client.crt"
    clientKey: "/path/to/client.key"
```

## High availability

- HSM cluster with multiple nodes
- Automatic failover
- Synchronous replication

## Performance

| Operation | Latency |
|-----------|---------|
| Unwrap key | 5-10 ms |
| Generate key | 10-20 ms |
| Sign — classical algorithms, in HSM (ECDSA, Ed25519, RSA) | 5-15 ms |

Post-quantum signatures (ML-DSA, Falcon, SPHINCS+) are **not** executed inside the HSM:
PKCS#11 HSMs do not expose PQC signing mechanisms. QNSI performs PQC signing in the
service's PQC provider (liboqs), with the signing key sealed at rest under an
HSM-wrapped key-encryption key — so the HSM protects the key material, but the PQC
signature itself is computed outside the HSM and its latency depends on the algorithm,
not the HSM round-trip.

## Compliance

When a hardware HSM is provisioned, HSM integration supports:
- FIPS 140-3 Level 3 (e.g. AWS CloudHSM `hsm2m.medium` — CMVP certificate #4703)
- PCI DSS
- Common Criteria

The default baseline uses a software PKCS#11 module (SoftHSM); a hardware HSM is
provisioned per tenant on an enterprise engagement or via BYOHSM (bring-your-own HSM).
