---
title: HSM Integration
version: 0.2.0
description: Qualify customer HSM custody and use HSM-Sealed Post-Quantum Keys without overstating the hardware boundary.
last_updated: 2026-07-20
copyright: © 2025 HEOSSI. All rights reserved.
source_files:
  - /apps/kms-service/src/routes/byohsm.ts
  - /apps/kms-service/src/routes/byohsm-provider.ts
  - /apps/kms-service/src/modules/keys/service.ts
  - /packages/qnsi/src/kms.ts
---
# HSM Integration

QNSI KMS integrates with Hardware Security Modules for root key protection.

## Supported HSMs

| Vendor | Model/service | Interface |
|--------|---------------|-----------|
| AWS | CloudHSM | PKCS#11 |
| Microsoft Azure | Dedicated HSM | PKCS#11 |
| Thales | Luna | PKCS#11 |
| Entrust | nShield | PKCS#11 |
| Utimaco | CryptoServer | PKCS#11 |
| Marvell | LiquidSecurity HSM | PKCS#11 |
| Fortanix | Data Security Manager | REST |
| HashiCorp | Vault HSM / Transit | REST |

The BYOHSM registry therefore exposes eight integrations: six PKCS#11 vendors
and two REST-backed providers.

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
| Sign - classical algorithms, in HSM (ECDSA, Ed25519, RSA) | 5-15 ms |

Some current HSM and cloud-KMS products expose native post-quantum mechanisms. QNSI's
current **HSPK** route is a separate compatibility path for qualified PKCS#11 estates
where the required native mechanism is unavailable or is not approved for the exact
deployment. It supports ML-DSA-44, ML-DSA-65, and ML-DSA-87. QNSI computes the ML-DSA
signature in its software provider (liboqs); the HSM protects the custody root and
performs only the RSA-OAEP content-key wrap/unwrap. The software signature operation is
outside the HSM's validated boundary.

### HSM-Sealed Post-Quantum Keys (HSPK)

The mechanism above has a name and a proof. In the current customer API, an ML-DSA
private key (ML-DSA-44 / ML-DSA-65 / ML-DSA-87) is AES-256-GCM sealed under a random content key; the
content key is **RSA-OAEP-wrapped by a non-extractable HSM key**. Only the HSM can
recover the content key, so the ML-DSA private key gains a hardware root of custody
at rest. Where the exact HSM module, firmware, mode, and RSA-OAEP operation are within
a FIPS 140-3 Level 3 validation, that validation applies to the custody operation-not
to QNSI's software ML-DSA signing. The ML-DSA key exists in plaintext only transiently
in memory during signing, then is
zeroized; a different HSM key cannot unseal it (fail-closed). The custody root can
be rotated (`resealPqcPrivateKey`) without regenerating the PQC keypair.

HSPK provides a practical custody pattern when the qualified HSM does not itself expose
the required PQC mechanism. The unified `@heossihq/qnsi` SDK provides HSPK seal and sign
client methods, and `@heossihq/qnsi-mcp` exposes the same authorized operations to MCP agents.

## Live qualification

QNSI has exercised the HSPK custody path against AWS CloudHSM in FIPS mode, including
non-extractable key behavior and RSA-OAEP content-key transport. That qualification is
deployment-specific: the module certificate belongs to the HSM vendor, not HEOSSI, and a
customer deployment receives a hardware-custody claim only after its exact device,
configuration, failure behavior, and operation path pass live qualification.

## Compliance

When a qualified hardware HSM is provisioned, HSM integration can anchor custody in:
- A FIPS 140-3 Level 3 module (for example, the Marvell LS2 module used by AWS CloudHSM `hsm2m.medium`, under Marvell Semiconductor CMVP certificate #4703), subject to the exact validated configuration and operation
- PCI DSS
- Common Criteria

SoftHSM is a software PKCS#11 module, not a hardware HSM. Platform root keys are
wrapped with AES Key Wrap (RFC 3394) under a durable master key; tenants provision
hardware protection through BYOHSM.
