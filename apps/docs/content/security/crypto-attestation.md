# Cryptographic Attestation

QNSI provides **forensic-grade cryptographic attestation** that goes beyond simple discovery scans. Every cryptographic operation produces verifiable evidence that can be audited, replayed, and used for compliance reporting.

## Overview

Cryptographic attestation in QNSI includes:

- **Algorithm Lifecycle Tracking** - NIST status (Final/Draft/Deprecated) for every algorithm
- **Policy Enforcement** - Hard gates that block non-compliant cryptographic operations
- **CBOM Export** - Machine-verifiable Cryptographic Bill of Materials
- **Compliance Assessment** - Automated CNSA 2.0 and FIPS 140-3 compliance checks
- **Merkle-rooted Audit Logs** - Tamper-evident audit trails with signed checkpoints
- **Dual-provider NIST ACVP conformance** - Live evidence at [/verify/conformance](https://qnsi.heossi.com/verify/conformance) showing both PQC providers passing the official NIST ACVP test vectors. `@noble/post-quantum`: 435/435 across FIPS 203/204/205. `@heossihq/liboqs-native` 0.15.1: 240/240 ML-KEM ACVP tests via `OQS_KEM_keypair_derand` + `OQS_KEM_encaps_derand` bindings. SHA-3-256 tamper digest binds every evidence file.
- **Auditable entropy chain** - End-to-end documentation at [/trust/entropy](https://qnsi.heossi.com/trust/entropy) citing NIST SP 800-90A/B/C, OpenSSL DRBG, Linux `getrandom`, CPU TRNG (RDRAND/RDSEED/Nitro), and per-vendor HSM FIPS 140-3 DRBG records.

## Crypto Policy Engine

The Crypto Policy Engine enforces cryptographic policies at the edge gateway level, providing hard gates for algorithm allowlists/blocklists.

### Policy Modes

| Mode | Description |
|------|-------------|
| `audit` | Log violations but allow operations |
| `enforce` | Block non-compliant operations |

### Configuration Options

```typescript
interface CryptoPolicyConfig {
  enabled: boolean;
  mode: "audit" | "enforce";
  allowedKemAlgorithms: string[];
  allowedSignatureAlgorithms: string[];
  allowedSymmetricAlgorithms: string[];
  forbiddenAlgorithms: string[];
  minimumSecurityLevel: number;
  requireNistFinal: boolean;
  allowClassicalFallback: boolean;
  hybridModeRequired: boolean;
}
```

### Policy Presets

QNSI provides four policy presets:

**Default Policy** - PQC preferred, classical fallback allowed
- All NIST-final PQC algorithms allowed
- Classical algorithms allowed for migration
- Minimum security level: 1

**Strict Policy** - PQC required, no classical algorithms
- Only high-security PQC algorithms (Kyber-768+, Dilithium-3+)
- Classical algorithms forbidden
- NIST-final status required
- Minimum security level: 3

**Maximum Policy** - Highest-security PQC only
- Level-5 PQC algorithms only
- Classical algorithms forbidden
- NIST-final status required
- Minimum security level: 5

**Government Policy** - FIPS-finalized level-5 PQC with hybrid transport
- Level-5 FIPS-finalized PQC algorithms only
- Classical algorithms forbidden
- Hybrid transport required
- Minimum security level: 5

## Algorithm Registry

QNSI maintains a comprehensive registry of cryptographic algorithms with lifecycle status:

### NIST-Final Algorithms (FIPS 203/204/205)

| Algorithm | NIST Name | Type | Security Level |
|-----------|-----------|------|----------------|
| kyber-512 | ML-KEM-512 | KEM | 1 |
| kyber-768 | ML-KEM-768 | KEM | 3 |
| kyber-1024 | ML-KEM-1024 | KEM | 5 |
| dilithium-2 | ML-DSA-44 | Signature | 2 |
| dilithium-3 | ML-DSA-65 | Signature | 3 |
| dilithium-5 | ML-DSA-87 | Signature | 5 |
| sphincs-shake-128f-simple | SLH-DSA-SHAKE-128f | Signature | 1 |
| sphincs-shake-256f-simple | SLH-DSA-SHAKE-256f | Signature | 5 |

### Draft Algorithms (Pending Standardization)

| Algorithm | Type | Security Level |
|-----------|------|----------------|
| falcon-512 | Signature | 1 |
| falcon-1024 | Signature | 5 |

### Deprecated Algorithms

| Algorithm | Replacement | Deprecation Date |
|-----------|-------------|------------------|
| rsa-2048 | dilithium-2 | 2030-01-01 |
| rsa-4096 | dilithium-3 | 2030-01-01 |
| ecdsa-p256 | dilithium-2 | 2030-01-01 |
| ecdsa-p384 | dilithium-3 | 2030-01-01 |

## API Endpoints

### Get Crypto Policy

```bash
GET /platform/v1/crypto/policy
```

Returns the current crypto policy configuration and attestation.

### Check Algorithm

```bash
GET /platform/v1/crypto/policy/check?algorithm=kyber-768&context=kem
```

Check if an algorithm is allowed by the current policy.

### List Algorithms

```bash
GET /platform/v1/crypto/algorithms
GET /platform/v1/crypto/algorithms?status=NIST_FINAL
GET /platform/v1/crypto/algorithms?type=signature
```

List all algorithms in the registry with optional filtering.

### Get CBOM

```bash
GET /platform/v1/crypto/cbom
```

Generate and return the Cryptographic Bill of Materials.

### Get Compliance Status

```bash
GET /platform/v1/crypto/compliance
```

Get compliance status summary for all frameworks.

### Get Attestation

```bash
GET /platform/v1/crypto/attestation
```

Generate a comprehensive cryptographic attestation document.

## Cloud Portal

Access crypto attestation in the Cloud Portal:

1. Navigate to **Security** → **Crypto Attestation**
2. View compliance status for CNSA 2.0 and FIPS 140-3
3. See algorithms in use across all services
4. Download CBOM for compliance reporting

## Admin Portal

Manage crypto policies in the Admin Portal:

1. Navigate to **Crypto** → **Policy**
2. View current policy configuration
3. See algorithm registry with lifecycle status
4. Monitor enforcement decisions

## Best Practices

1. **Start in Audit Mode** - Enable policy enforcement in audit mode first to identify violations without blocking operations.

2. **Use NIST-Final Algorithms** - Prefer algorithms with NIST-final status for production workloads.

3. **Regular CBOM Export** - Export CBOM regularly for compliance documentation.

4. **Monitor Deprecated Algorithms** - Track deprecated algorithm usage and plan migrations.

5. **Set Minimum Security Level** - Configure minimum security level based on data classification.
