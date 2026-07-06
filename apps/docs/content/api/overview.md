---
title: API Overview
version: 0.0.6
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/edge-gateway/src/config/env.ts
  - /packages/security/src/tenant-crypto-policy-client.ts
---

# API Overview

QNSI exposes RESTful APIs for all platform capabilities. All cryptographic operations use tenant-specific algorithm selection based on crypto policies managed through the tenant-service.

## Base URL

| Environment | Base URL |
|-------------|----------|
| Production | `https://api.qnsi.heossi.com` |

Staging endpoints (if available) are provided separately per deployment.

## Service Ports

From `apps/*/src/config/env.ts`:

| Service | Port | Path Prefix | Crypto Policy Integration |
|---------|------|-------------|---------------------------|
| edge-gateway | 8107 | `/` (entry point) | ✅ Request logging signatures |
| auth-service | 8081 | `/auth` | ✅ JWT signing with PQC |
| kms-service | 8095 | `/kms/v1` | ✅ Key generation algorithms |
| vault-service | 8090 | `/vault/v1` | ✅ Secret encryption |
| storage-service | 8092 | `/storage/v1` | ✅ File encryption |
| audit-service | 8103 | `/audit/v1` | ✅ Audit log signing |
| search-service | 8101 | `/search/v1` | ✅ Search index encryption |
| tenant-service | 8108 | `/tenant/v1` | ✅ Tenant metadata signing |
| crypto-inventory-service | 8115 | `/crypto/v1` | ✅ Asset metadata signing |
| access-control-service | 8102 | `/access/v1` | ✅ Capability token signing |
| security-monitoring-service | 8104 | `/security/v1` | ✅ Detection signature verification |
| observability-service | 8105 | `/observability/v1` | ✅ Metrics signing |

In production, clients should treat **edge-gateway** as the single entrypoint.

- Most internal services are reached via `GET/POST /proxy/<service>/v1/*`.
- Example: crypto inventory routes are exposed through edge as `GET /proxy/crypto/v1/assets`.
- Health checks for all services are available via `GET /proxy/<service>/health` and `GET /edge/<service>/health`.

`platform-api` is deployed in production and routed through edge-gateway at `/proxy/platform/*`.

For C2 organization access, edge-gateway also exposes public onboarding routes (no auth required):

```
POST /public/join-requests
```

## Crypto Policy APIs

Tenant crypto policies are managed through the tenant-service and consumed by all services with cryptographic operations:

### Tenant Crypto Policy Management (v0)

```
GET /tenant/v1/tenants/{tenantId}/crypto-policy
PUT /tenant/v1/tenants/{tenantId}/crypto-policy
```

### Tenant Crypto Policy Management (v1)

```
GET /tenant/v1/tenants/{tenantId}/crypto-policy-v1
GET /tenant/v1/tenants/{tenantId}/crypto-policy-v1/history?limit=50
PUT /tenant/v1/tenants/{tenantId}/crypto-policy-v1
POST /tenant/v1/tenants/{tenantId}/crypto-policy-v1/tier0/enable
POST /tenant/v1/tenants/{tenantId}/crypto-policy-v1/tier0/disable
POST /tenant/v1/tenants/{tenantId}/crypto-policy-v1/tier4/enable
POST /tenant/v1/tenants/{tenantId}/crypto-policy-v1/rollback
```

### Algorithm Selection

Services automatically select algorithms based on:
1. Tenant's billing tier (default crypto policy)
2. Custom algorithm allowlists/forbidden lists
3. Crypto policy add-ons purchased by tenant

**Policy Tiers (v0):**
- `default`: Balanced performance (Kyber-768, Dilithium-3)
- `strict`: Enhanced security (Kyber-768/1024, Dilithium-3/5, Falcon-1024)
- `maximum`: Maximum security (Kyber-1024, Dilithium-5, Falcon-1024, SPHINCS+)
- `government`: Government compliance (Kyber-1024, Dilithium-5, SPHINCS+)

**Policy Profiles + Tiers (v1):**
- Profiles: `gov-high-assurance`, `defense-long-life-data`, `financial-hybrid-pqc`, `research-eval`
- Tiers: `TIER1_APPROVED`, `TIER2_HIGH_ASSURANCE`, `TIER3_DIVERSITY`, `TIER4_EXPERIMENTAL`, `TIER0_LEGACY`

**Algorithm Naming:**
- Internal names: `kyber-768`, `dilithium-3`, `falcon-1024`, `sphincs-shake-256f-simple`
- NIST names: `ML-KEM-768`, `ML-DSA-65`, `FN-DSA-1024`, `SLH-DSA-SHAKE-256f`

### Platform Crypto Policy Endpoint

```
GET /platform/v1/crypto/policy
```

- Without tenant context, returns the platform-wide policy attestation.
- With `X-QNSI-Tenant-Id` or `X-Tenant-Id` header, returns the tenant’s **v1** policy (ETag in response headers).

## Request format

All requests use JSON:
```
Content-Type: application/json
```

## Response format

Response bodies are service-specific.

Error responses:
```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Validation failed",
  "details": { ... }
}
```

## OpenAPI specification

Machine-readable API spec available at:
```
GET /openapi.json
GET /v1/openapi.json
```

Swagger UI is available at:
```
GET /explorer
```

## Alert Endpoints: Read-Only Policy

**All alert and enforcement status endpoints are read-only by design.**

- `GET /security/v1/alerts` - Read-only alert query (no state mutation)
- No POST/PATCH/DELETE endpoints for alert state
- No verbs like `/resolve`, `/ack`, `/dismiss`, `/mute` in alert paths
- Admin portal displays alerts in read-only format

See [Alerts Read-Only Policy](../../../docs/api/ALERTS-READ-ONLY-POLICY.md) for full details.
