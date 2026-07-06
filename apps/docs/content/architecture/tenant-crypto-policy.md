---
title: Tenant Crypto Policy System
version: 1.1.0
last_updated: 2026-04-23
copyright: © 2025–2026 HEOSSI (PTE.) LTD All rights reserved.
license: BSL-1.1
source_files:
  - /packages/security/src/tenant-crypto-policy-client.ts
  - /packages/security/src/crypto-policy-profiles.ts
  - /packages/tenant-sdk/src/index.ts
  - /apps/tenant-service/src/routes/tenants.ts
---

# Tenant Crypto Policy System

The tenant crypto policy system ensures consistent algorithm selection across all QNSI services based on tenant billing tiers, custom policies, and compliance requirements.

## Overview

Every tenant has a crypto policy that determines:
- Which PQC algorithms are allowed for encryption and signatures
- Default algorithms for new cryptographic operations
- Custom algorithm allowlists and forbidden lists
- HSM requirements for root keys
- Maximum key age before rotation

QNSI currently supports **two policy models**:
- **v0 tiers** (legacy): default/strict/maximum/government
- **v1 profiles + tiers** (evidence-first): profile constraints plus tier gates

Services still use the v0 policy via `@heossi/qnsi-security` tenant-crypto-policy-client while migration completes. The v1 policy is stored in `tenant_crypto_policy` and is returned by `/platform/v1/crypto/policy` when an `X-Tenant-Id` header is supplied.

## Crypto Policy V1 (Profiles + Tiers)

V1 policies focus on **profiles** (policy intent) and **tiers** (evidence/gating). Profiles define which tiers are allowed and set default KEM/signature algorithms.

### V1 Profiles

| Profile | Summary | Allowed Tiers |
|---------|---------|---------------|
| `gov-high-assurance` | Procurement-safe baseline | `TIER1_APPROVED` |
| `defense-long-life-data` | High assurance + stateful options | `TIER1_APPROVED`, `TIER2_HIGH_ASSURANCE` |
| `financial-hybrid-pqc` | Migration/hybrid posture | `TIER1_APPROVED`, `TIER0_LEGACY`, `TIER3_DIVERSITY` |
| `research-eval` | Gated non-compliant research | `TIER1_APPROVED`, `TIER3_DIVERSITY`, `TIER4_EXPERIMENTAL` |

### V1 Tier Gates

- `TIER0_LEGACY` requires an expiry (`tier0Expiry`) and explicit enablement.
- `TIER4_EXPERIMENTAL` requires an acknowledgement (`tier4Acknowledgement`).
- `TIER2_HIGH_ASSURANCE` requires stateful lifecycle guards.
- `TIER3_DIVERSITY` is only allowed for hybrid/alternate risk models.

### Tenant Defaults (Examples)

Defaults are derived from tenant plan → tenant type mapping:

- `FREE_FOREVER` → `gov-high-assurance`
- `DEV_PRO` / `DEV_ELITE` → `financial-hybrid-pqc`
- `ENTERPRISE_PRO` / `ENTERPRISE_ELITE` → `defense-long-life-data`

## Legacy Policy Tiers (v0)

### Policy Tiers

### Default Tier
**Target**: Standard business customers
**Algorithms**:
- KEM: Kyber-512, Kyber-768, Kyber-1024 (default: Kyber-768)
- Signatures: Dilithium-2, Dilithium-3, Dilithium-5 (default: Dilithium-3)
**Performance**: Balanced security and performance

### Strict Tier
**Target**: Security-conscious organizations
**Algorithms**:
- KEM: Kyber-768, Kyber-1024 (default: Kyber-768)
- Signatures: Dilithium-3, Dilithium-5, Falcon-1024 (default: Dilithium-3)
**Performance**: Enhanced security with moderate performance impact

### Maximum Tier
**Target**: High-security environments
**Algorithms**:
- KEM: Kyber-1024 (default: Kyber-1024)
- Signatures: Dilithium-5, Falcon-1024, SPHINCS-SHAKE-256f (default: Dilithium-5)
**Performance**: Maximum security, higher computational cost

### Government Tier
**Target**: Government and military customers
**Algorithms**:
- KEM: Kyber-1024 (default: Kyber-1024)
- Signatures: Dilithium-5, SPHINCS-SHAKE-256f (default: Dilithium-5)
**Performance**: Government-approved algorithms only

## Algorithm Naming

The system supports both internal and NIST standardized algorithm names:

### Internal Names (used in code)
- `kyber-512`, `kyber-768`, `kyber-1024`
- `dilithium-2`, `dilithium-3`, `dilithium-5`
- `falcon-512`, `falcon-1024`
- `sphincs-shake-128f-simple`, `sphincs-shake-256f-simple`

### NIST Names (for display/compliance)
- `ML-KEM-512`, `ML-KEM-768`, `ML-KEM-1024`
- `ML-DSA-44`, `ML-DSA-65`, `ML-DSA-87`
- `FN-DSA-512`, `FN-DSA-1024`
- `SLH-DSA-SHAKE-128f`, `SLH-DSA-SHAKE-256f`

## Service Integration

### Client Creation

Services create a crypto policy client from environment variables:

```typescript
import { createTenantCryptoPolicyClientFromEnv } from '@heossi/qnsi-security';

const cryptoPolicyClient = createTenantCryptoPolicyClientFromEnv();
```

### Environment Variables

```bash
TENANT_SERVICE_URL=https://tenant-service:8108
TENANT_SERVICE_API_TOKEN=<static-token>
# OR service token flow:
AUTH_SERVICE_URL=https://auth-service:8081
SERVICE_ID=kms-service
SERVICE_SECRET=<service-secret>

# Optional failure mode for tenant-service outages (default: fail_open)
TENANT_CRYPTO_POLICY_FAILURE_MODE=fail_open
```

### Algorithm Selection

```typescript
// Get default algorithms for new operations
const kemAlgorithm = await cryptoPolicyClient.getDefaultKemAlgorithm(tenantId);
const signatureAlgorithm = await cryptoPolicyClient.getDefaultSignatureAlgorithm(tenantId);

// Get all allowed algorithms
const allowedKem = await cryptoPolicyClient.getAllowedKemAlgorithms(tenantId);
const allowedSig = await cryptoPolicyClient.getAllowedSignatureAlgorithms(tenantId);

// Validate algorithm is allowed
const isKemAllowed = await cryptoPolicyClient.isAlgorithmAllowed(tenantId, 'kyber-1024', 'kem');
const isSigAllowed = await cryptoPolicyClient.isAlgorithmAllowed(tenantId, 'dilithium-5', 'signature');
```

### Caching and Performance

- **Cache TTL**: 60 seconds by default (configurable)
- **Fallback (fail_open)**: Returns default policy if tenant-service is unavailable
- **Failure (fail_closed)**: Throws a 503 error (CRYPTO_POLICY_UNAVAILABLE) to prevent silent policy bypass
- **Service Tokens**: Automatic token refresh for service-to-service auth
- **Error Handling**: Graceful degradation to avoid blocking requests

## API Endpoints

### Get Tenant Crypto Policy (v0)
```http
GET /tenant/v1/tenants/{tenantId}/crypto-policy
Authorization: Bearer <token>
```

**Response:**
```json
{
  "tenantId": "tenant-123",
  "policyTier": "strict",
  "customAllowedKemAlgorithms": null,
  "customAllowedSignatureAlgorithms": ["dilithium-5", "falcon-1024"],
  "customForbiddenAlgorithms": ["dilithium-2"],
  "requireHsmForRootKeys": true,
  "maxKeyAgeDays": 180,
  "enforcementMode": "enforce",
  "cryptoEntropySource": "csprng",
  "createdAt": "2026-01-04T10:00:00Z",
  "updatedAt": "2026-01-04T10:00:00Z"
}
```

### cryptoEntropySource

Declarative entropy-source contract for the tenant. Added 2026-05-13.
See [https://qnsi.heossi.com/trust/entropy](https://qnsi.heossi.com/trust/entropy)
for the auditable end-to-end chain (NIST SP 800-90A/B/C citations,
OpenSSL DRBG, Linux getrandom + CPU TRNG, HSM DRBGs).

| Value | Where | Default for tiers |
|---|---|---|
| `csprng` | OpenSSL SP 800-90A AES-CTR-DRBG seeded from Linux `getrandom` + RDRAND / RDSEED / Nitro TRNG. | `default`, `strict` |
| `hsm-byo` | Customer-managed FIPS 140-3 L3 HSM DRBG via PKCS#11 (AWS CloudHSM, Azure Managed HSM, Thales Luna, Entrust nShield, Utimaco, Marvell LiquidHSM, Fortanix DSM, HashiCorp Vault HSM). | `maximum`, `government` |
| `qrng-mixin` | Customer-supplied QRNG (Qrypt / Quantum Dice / ID Quantique Quantis / Quantum-Origin) mixed into HSM DRBG seed per NIST SP 800-90C RBG3 prediction-resistance reseed. Sales-assisted add-on (`byoh-qrng-mixin`). | Optional on Maximum/Government tiers |

The field is currently a **declarative contract** surfaced through the
audit trail and billing layer; per-tenant entropy-source routing is on
the platform roadmap. Today every backend service draws from the
platform CSPRNG except for root-key operations on tiers that route
through the BYOH HSM channel.

### Get Tenant Crypto Policy (v1)
```http
GET /tenant/v1/tenants/{tenantId}/crypto-policy-v1
Authorization: Bearer <token>
```

### List Policy History (v1)
```http
GET /tenant/v1/tenants/{tenantId}/crypto-policy-v1/history?limit=50
Authorization: Bearer <token>
```

### Update Policy (v1)
```http
PUT /tenant/v1/tenants/{tenantId}/crypto-policy-v1
Authorization: Bearer <token>
If-Match: <etag>
Content-Type: application/json

{
  "policy": { ... }
}
```

### Tier Gates + Rollback (v1)
```http
POST /tenant/v1/tenants/{tenantId}/crypto-policy-v1/tier0/enable
POST /tenant/v1/tenants/{tenantId}/crypto-policy-v1/tier0/disable
POST /tenant/v1/tenants/{tenantId}/crypto-policy-v1/tier4/enable
POST /tenant/v1/tenants/{tenantId}/crypto-policy-v1/rollback
```

### Create/Update Crypto Policy (v0)
```http
PUT /tenant/v1/tenants/{tenantId}/crypto-policy
Authorization: Bearer <token>
Content-Type: application/json

{
  "policyTier": "maximum",
  "customAllowedSignatureAlgorithms": ["dilithium-5", "sphincs-shake-256f-simple"],
  "requireHsmForRootKeys": true,
  "maxKeyAgeDays": 90,
  "enforcementMode": "enforce",
  "cryptoEntropySource": "hsm-byo"
}
```

## Service-Specific Usage

### KMS Service
Uses crypto policy for:
- Key generation algorithm selection
- Key rotation algorithm upgrades
- HSM requirement enforcement

### Storage Service
Uses crypto policy for:
- File encryption algorithm selection
- Metadata encryption
- Search index encryption

### Auth Service
Uses crypto policy for:
- JWT signing algorithm selection
- Session token encryption
- WebAuthn credential protection

### Vault Service
Uses crypto policy for:
- Secret encryption algorithms
- Lease token signing
- Backup encryption

## Compliance and Auditing

### Enforcement Modes
- **audit**: Log policy violations but allow operations
- **enforce**: Block operations that violate policy

### Audit Events
All crypto policy decisions are logged to audit-service:
- Algorithm selection events
- Policy violations
- Fallback to default policy
- Cache hits/misses

### Compliance Mapping
- **FIPS 140-3**: Government tier uses FIPS-approved algorithms
- **Common Criteria**: Maximum tier provides CC-evaluated algorithms
- **NIST Guidelines**: All tiers follow NIST PQC recommendations

## Troubleshooting

### Common Issues

**Policy not found (404)**
- Tenant has no custom policy, using default tier
- Normal behavior for new tenants

**Service unavailable fallback**
- tenant-service is down or unreachable
- If `TENANT_CRYPTO_POLICY_FAILURE_MODE=fail_open`, client automatically uses default policy
- If `TENANT_CRYPTO_POLICY_FAILURE_MODE=fail_closed`, services return `503 CRYPTO_POLICY_UNAVAILABLE`
- Check service health and network connectivity

**Algorithm not allowed**
- Requested algorithm not in tenant's allowed list
- Check tenant's policy tier and custom restrictions
- Use `isAlgorithmAllowed()` to validate before operations

**Cache inconsistency**
- Policy updated but service still using cached version
- Wait for cache TTL (60s) or call `clearCache(tenantId)`
- Consider reducing cache TTL for frequently changing policies

### Monitoring

Key metrics to monitor:
- `tenant_crypto_policy_requests_total`
- `tenant_crypto_policy_cache_hits_total`
- `tenant_crypto_policy_fallback_total`
- `tenant_crypto_policy_errors_total`

### Debugging

Enable debug logging:
```typescript
const client = new TenantCryptoPolicyClient({
  tenantServiceUrl: 'https://tenant-service:8108',
  logLevel: 'debug'
});
```

## Migration and Upgrades

### Algorithm Migration
When new PQC algorithms are standardized:
1. Add algorithms to tier configurations
2. Update tenant policies to include new algorithms
3. Services automatically use new algorithms for new operations
4. Background re-encryption migrates existing data

### Policy Tier Upgrades
Tenants can upgrade their policy tier through billing:
1. Purchase crypto policy add-on
2. tenant-service updates policy tier
3. Services pick up new policy within cache TTL
4. New operations use upgraded algorithms

### Backward Compatibility
- Old algorithms remain supported for decryption
- New encryptions use current policy algorithms
- Gradual migration prevents breaking existing data