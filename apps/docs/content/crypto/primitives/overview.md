---
title: PQC Primitives Overview
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /packages/cryptography/src/provider.ts
  - /packages/shared-kernel/src/jwt.ts
---

# PQC Primitives Overview

QNSI implements NIST-standardized post-quantum cryptographic primitives via the `@heossihq/qnsi-cryptography` package.

## Supported Algorithms

The `PqcAlgorithm` type defines all supported algorithms:

```typescript
// Source: packages/cryptography/src/provider.ts
type PqcAlgorithm =
  | "kyber-512" | "kyber-768" | "kyber-1024"      // KEM
  | "dilithium-2" | "dilithium-3" | "dilithium-5" // Signatures
  | "falcon-512" | "falcon-1024"                   // Signatures
  | "sphincs-shake-128f-simple"                    // Hash-based
  | "sphincs-shake-256f-simple";
```

## Signature Algorithms

| Algorithm | JWT Header | NIST Level | Use Case |
|-----------|------------|------------|----------|
| `dilithium-2` | `Dilithium2` | 2 | JWT signing (default) |
| `dilithium-3` | `Dilithium3` | 3 | High-security tokens |
| `dilithium-5` | `Dilithium5` | 5 | Maximum security |
| `falcon-512` | `Falcon512` | 1 | Size-constrained |
| `falcon-1024` | `Falcon1024` | 5 | Size-constrained, high security |
| `sphincs-shake-128f-simple` | `SPHINCS+-SHAKE-128f-simple` | 1 | Stateless hash-based |
| `sphincs-shake-256f-simple` | `SPHINCS+-SHAKE-256f-simple` | 5 | Stateless hash-based |

## Key Encapsulation (KEM)

| Algorithm | NIST Level | Use Case |
|-----------|------------|----------|
| `kyber-512` | 1 | Development/testing |
| `kyber-768` | 3 | Production default |
| `kyber-1024` | 5 | Maximum security |

## QNSI Defaults

From `apps/auth-service/src/config/env.ts`:

| Setting | Default Value |
|---------|---------------|
| `JWT_SIGNING_ALGORITHM` | `dilithium-2` |
| `AUTH_PQC_TLS_KEM_ALGORITHM` | `kyber-768` |
| `AUTH_PQC_TLS_SIGNATURE_ALGORITHM` | `dilithium-2` |

## Provider Interface

```typescript
// Source: packages/cryptography/src/provider.ts
interface PqcProvider {
  readonly name: string;
  generateKeyPair(options: GenerateKeyPairOptions): Promise<{ keyPair: PqcKeyPair }>;
  encapsulate(options: EncapsulateOptions): Promise<EncapsulationResult>;
  decapsulate(options: DecapsulateOptions): Promise<Uint8Array>;
  sign(options: SignOptions): Promise<SignatureResult>;
  verify(options: VerifyOptions): Promise<boolean>;
  hash(data: Uint8Array, algorithm?: string): Promise<HashResult>;
}
```

## Implementation

- **Production**: `liboqs` provider via `@heossihq/liboqs-native` 0.15.1 (Open Quantum Safe liboqs 0.15.0, custom-built with `cmake -GNinja -DOQS_USE_OPENSSL=ON -DOQS_BUILD_SHARED_LIBS=OFF`; statically linked, served from ECR `qnsi/liboqs-builder-base:0.15.0` and recompiled on every backend Docker build)
- **Cross-verification secondary**: `@noble/post-quantum` 0.6.0 (pure-JS) registered alongside liboqs in `kms-service` + `audit-service` for dual-provider attestation on Maximum / Government policy tiers
- **Browser SDK**: `@noble/post-quantum` (pure-JS, no native bindings)
- **Testing**: `deterministic-pqc` provider for reproducible tests; NIST ACVP test-vector harness at `apps/web/scripts/run-nist-acvp-conformance.ts`
- Constant-time implementations
- Side-channel resistance

## NIST ACVP conformance evidence

- **noble** (cross-verification reference): 435/435 ACVP test cases passed - full coverage of FIPS 203 (ML-KEM keyGen + encapDecap including §7.2/§7.3 input validation), FIPS 204 (ML-DSA keyGen), FIPS 205 (SLH-DSA keyGen, all 12 parameter sets).
- **liboqs** (primary production engine): 240/240 ML-KEM ACVP test cases passed via `OQS_KEM_keypair_derand` and `OQS_KEM_encaps_derand` bindings shipped in `@heossihq/liboqs-native` 0.15.1. The remaining 195 signature-keyGen tests (ML-DSA + SLH-DSA) are deferred upstream because liboqs C library 0.15.0 does not yet expose `OQS_SIG_keypair_derand` - a PR is pending against [open-quantum-safe/liboqs](https://github.com/open-quantum-safe/liboqs).
- Live evidence renders at [https://qnsi.heossi.com/verify/conformance](https://qnsi.heossi.com/verify/conformance) with a SHA-3-256 tamper digest binding the evidence JSON.

## Entropy chain

- **CSPRNG path (default + strict tiers)**: OpenSSL SP 800-90A AES-CTR-DRBG seeded from Linux `getrandom(2)` which mixes Intel RDRAND/RDSEED (x86_64) / ARM TRNG (Graviton) / AWS Nitro Security Chip TRNG. liboqs is built with `OQS_USE_OPENSSL=ON` so `randombytes()` calls route through the same OpenSSL DRBG.
- **HSM-DRBG path (maximum + government tiers)**: customer-managed FIPS 140-3 L3 HSM via PKCS#11 (8 supported vendors).
- **QRNG mix-in path (sales-assisted add-on `byoh-qrng-mixin`)**: customer-supplied QRNG mixed into the HSM DRBG seed per NIST SP 800-90C RBG3 prediction-resistance reseed.
- Full chain documentation at [https://qnsi.heossi.com/trust/entropy](https://qnsi.heossi.com/trust/entropy).
