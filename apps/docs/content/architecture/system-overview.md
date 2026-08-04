---
title: System Overview
version: 0.1.0
last_updated: 2026-04-23
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/edge-gateway/src/config/env.ts
  - /apps/auth-service/src/config/env.ts
  - /apps/kms-service/src/config/env.ts
  - /apps/vault-service/src/config/env.ts
  - /apps/storage-service/src/config/env.ts
  - /apps/audit-service/src/config/env.ts
  - /apps/ai-orchestrator/src/config/env.ts
  - /apps/access-control-service/src/config/env.ts
  - /apps/observability-service/src/config/env.ts
  - /apps/security-monitoring-service/src/config/env.ts
  - /packages/security/src/tenant-crypto-policy-client.ts
---

# System Overview

QNSI is a microservice-based platform exposing tenant-scoped security primitives via an API-first model. All services integrate with tenant-crypto-policy-client for consistent algorithm selection based on tenant billing tiers and custom crypto policies. The platform is migrating from legacy v0 tiers to v1 profiles + tiers (evidence-first model), and the live cloud path now integrates with XIIS for remote-provider trust posture, assurance verification, and release enforcement.

As of March 2026, the platform comprises 13 core services with expanded capabilities including risk-based authentication, just-in-time access, AI orchestration with bias monitoring, dynamic secrets, real-time audit streaming, and comprehensive observability.

## Request Flow

1. Client sends request to edge gateway
2. Edge gateway authenticates, rate-limits, and routes
3. Request reaches target service
4. Service validates authorization and processes request
5. Service queries tenant crypto policy for algorithm selection
6. Response returns through edge gateway

## XIIS Control-Plane Integration

QNSI now integrates with XIIS as an external assurance and trust-verification control plane.

- `apps/cloud` calls XIIS for control-plane health, remote-provider posture, assurance report verification, and release-bundle enforcement.
- XIIS-backed data is surfaced in trust summary and exported evidence packs.
- XIIS verifier routes in the cloud portal accept authenticated verification requests for attestation, environment attestation, and runtime evidence.
- Frontend products consume `XIIS_CONTROL_PLANE_URL` and `XIIS_CONTROL_PLANE_API_TOKEN` to enable live XIIS-backed verification paths.

## Tenant Crypto Policy Integration

Services use the shared `@heossihq/qnsi-security` tenant-crypto-policy-client to:
- Fetch tenant-specific crypto policies from tenant-service
- Select appropriate PQC algorithms based on billing tier (v0 tiers)
- Apply custom algorithm allowlists and forbidden lists
- Cache policies for performance (60s TTL by default)
- Fallback to default policies when tenant-service is unavailable

Tenant-aware policy responses are available at:

```
GET /platform/v1/crypto/policy
```

When `X-Tenant-Id` is provided, edge-gateway returns the tenant’s **v1** policy with ETag headers.

## Core Services

Service ports derived from `apps/*/src/config/env.ts`:

| Service | Default Port | Responsibility | Key Capabilities |
|---------|--------------|----------------|------------------|
| `platform-api` | 8080 | Platform management API | Service orchestration |
| `auth-service` | 8081 | Identity, tokens, WebAuthn, sessions | Risk-based auth, federated audit, PQC JWT signing |
| `vault-service` | 8090 | Secrets storage and injection | Dynamic secrets, leakage detection, versioned secrets |
| `storage-service` | 8092 | Encrypted object storage | Data classification, retention policies, cross-region replication, intelligent tiering |
| `ai-orchestrator` | 8094 | AI/ML workload orchestration | Model registry, cost optimization, bias monitoring, prompt injection detection |
| `kms-service` | 8095 | Key management, HSM/PKCS#11 | BYOHSM, key escrow, usage analytics, crypto agility reports |
| `search-service` | 8101 | Searchable encryption queries | Query analytics, synonym management, index health, multi-tenant isolation |
| `access-control-service` | 8102 | Policy evaluation, RBAC | Policy simulation, JIT access, cross-tenant analysis |
| `audit-service` | 8103 | Event logging, Merkle checkpointing | Real-time streaming, retention automation, conformance results |
| `security-monitoring-service` | 8104 | Threat detection, anomaly analysis | Threat intelligence, automated response, attack paths, compliance mapping |
| `observability-service` | 8105 | Metrics aggregation, OTLP | Cost attribution, anomaly detection, custom dashboards, SLO tracking |
| `billing-service` | 8106 | Subscription, usage metering | Revenue analytics, usage forecasting, dunning automation, credit system |
| `edge-gateway` | 8107 | Ingress, routing, WAF, DDoS protection | PQC-TLS termination, zero-trust ingress |
| `tenant-service` | 8108 | Tenant provisioning, configuration | Health dashboard, quota forecasting, onboarding automation, isolation audit |
| `crypto-inventory-service` | 8115 | Cryptographic asset tracking | Certificate lifecycle, algorithm deprecation, hardware inventory, PQC readiness |

**Crypto Policy Tiers (v0):**
- `default`: Kyber-768, Dilithium-3 (balanced performance)
- `strict`: Kyber-768/1024, Dilithium-3/5, Falcon-1024 (enhanced security)
- `maximum`: Kyber-1024, Dilithium-5, Falcon-1024, SPHINCS+ (maximum security)
- `government`: Kyber-1024, Dilithium-5, SPHINCS+ (government compliance)

**Crypto Policy Profiles + Tiers (v1):**
- Profiles: `gov-high-assurance`, `defense-long-life-data`, `financial-hybrid-pqc`, `research-eval`
- Tiers: `TIER1_APPROVED`, `TIER2_HIGH_ASSURANCE`, `TIER3_DIVERSITY`, `TIER4_EXPERIMENTAL`, `TIER0_LEGACY`

## Edge Gateway Features

From `apps/edge-gateway/src/config/env.ts`:

| Feature | Default | Description |
|---------|---------|-------------|
| Rate limiting | 5,000 RPS | `EDGE_RATE_LIMIT_RPS` |
| WAF | Enabled | SQL injection, XSS, path traversal, SSRF |
| DDoS protection | Enabled | Volume threshold: 100 req/60s |
| Bot protection | Enabled | Challenge threshold: 20 req |
| PQC-TLS | Disabled | Kyber-768 KEM, Dilithium-2 signatures |

## Communication Model

- **External**: HTTPS terminates at the public AWS ALB; ALB forwards HTTP to edge-gateway (port 8107)
- **Internal**: HTTP between services (TLS/mTLS depends on deployment topology)
- **Async**: Event-driven via audit-service
- **Real-time**: WebSocket/SSE streaming for audit events, observability metrics, and health status

In production, `platform-api` is deployed and routed through edge-gateway at `/proxy/platform/*`.

## Service Capability Matrix

### Authentication & Identity

| Capability | Service | Description |
|------------|---------|-------------|
| Risk-Based Auth | `auth-service` | Adaptive MFA based on behavioral analytics, device fingerprinting, geolocation |
| Federated Audit | `auth-service` | Cross-IdP session correlation and unified audit trail |
| Policy Simulation | `access-control-service` | Test policy changes against historical access patterns |
| Just-In-Time Access | `access-control-service` | Time-bound privilege elevation with automatic revocation |
| Cross-Tenant Analysis | `access-control-service` | Permission drift detection and isolation violation alerts |

### Key & Secret Management

| Capability | Service | Description |
|------------|---------|-------------|
| BYOHSM | `kms-service` | External HSM integration via PKCS#11 with attestation |
| Key Escrow | `kms-service` | M-of-N threshold recovery schemes |
| Usage Analytics | `kms-service` | Real-time key operation metrics and trend analysis |
| Crypto Agility | `kms-service` | Algorithm migration readiness and PQC transition planning |
| Dynamic Secrets | `vault-service` | On-demand credential generation for databases/cloud |
| Leakage Detection | `vault-service` | Real-time scanning for exposed secrets |
| Versioned Secrets | `vault-service` | Full version history with point-in-time recovery |

### Data & Storage

| Capability | Service | Description |
|------------|---------|-------------|
| Data Classification | `storage-service` | ML-powered content classification and sensitivity tagging |
| Retention Policies | `storage-service` | Automated lifecycle with legal hold support |
| Cross-Region Replication | `storage-service` | Geo-redundant storage with configurable consistency |
| Intelligent Tiering | `storage-service` | Cost-optimized storage class transitions |

### AI & ML Operations

| Capability | Service | Description |
|------------|---------|-------------|
| Model Registry | `ai-orchestrator` | Versioned model catalog with deployment tracking |
| Cost Optimization | `ai-orchestrator` | Token usage analytics and budget alerts |
| Bias Monitoring | `ai-orchestrator` | Demographic parity tracking and fairness metrics |
| Prompt Injection | `ai-orchestrator` | Real-time attack detection and blocking |

### Observability & Security

| Capability | Service | Description |
|------------|---------|-------------|
| Cost Attribution | `observability-service` | Granular allocation by tenant/service/endpoint |
| Anomaly Detection | `observability-service` | ML-driven baseline deviation alerts |
| Custom Dashboards | `observability-service` | Drag-and-drop builder with real-time streaming |
| SLO Tracking | `observability-service` | Error budgets and burn rate alerts |
| Threat Intelligence | `security-monitoring-service` | External threat feed integration |
| Automated Response | `security-monitoring-service` | SOAR-style playbooks for incident containment |
| Attack Path Analysis | `security-monitoring-service` | Graph-based attack vector visualization |
| Compliance Mapping | `security-monitoring-service` | SOC 2, ISO 27001, NIST control mapping |

### Crypto Inventory

| Capability | Service | Description |
|------------|---------|-------------|
| Certificate Lifecycle | `crypto-inventory-service` | Automated discovery, renewal, rotation |
| Algorithm Deprecation | `crypto-inventory-service` | Deprecation scheduling with migration guidance |
| Hardware Inventory | `crypto-inventory-service` | HSM and hardware tracking with health monitoring |
| PQC Readiness | `crypto-inventory-service` | Quantified migration readiness score |

### Tenant & Billing

| Capability | Service | Description |
|------------|---------|-------------|
| Health Dashboard | `tenant-service` | Consolidated tenant health metrics |
| Quota Forecasting | `tenant-service` | Predictive usage with capacity recommendations |
| Onboarding Automation | `tenant-service` | Self-service provisioning with compliance validation |
| Isolation Audit | `tenant-service` | Continuous verification of data isolation |
| Revenue Analytics | `billing-service` | Real-time dashboards by tenant/product/region |
| Usage Forecasting | `billing-service` | ML-powered consumption predictions |
| Dunning Automation | `billing-service` | Intelligent retry scheduling with escalation |
| Credit System | `billing-service` | Promotional credits and referral rewards |

### Audit & Compliance

| Capability | Service | Description |
|------------|---------|-------------|
| Real-Time Streaming | `audit-service` | WebSocket-based event streaming for SIEM |
| Retention Automation | `audit-service` | Policy-driven log retention with archival |
| Conformance Results | `audit-service` | Automated compliance validation with attestation |
| Query Analytics | `search-service` | Search quality metrics and zero-result analysis |
| Synonym Management | `search-service` | Configurable synonym groups with A/B testing |
| Index Health | `search-service` | Performance monitoring with recommendations |
| Multi-Tenant Isolation | `search-service` | Cryptographic search isolation verification |
