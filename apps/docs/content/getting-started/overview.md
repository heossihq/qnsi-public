---
title: Getting Started Overview
version: 0.0.4
last_updated: 2026-07-20
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0 (SDK packages) / BSL-1.1 (core platform)
source_files:
  - /package.json
  - /apps/*/src/config/env.ts
---

# Overview

QNSI is an API-first platform providing tenant-scoped security primitives: identity, key management, secrets, encrypted storage, audit, and crypto posture workflows.

QNSI was conceived, architected, and engineered starting in Dec 2020. The current monorepo was bootstrapped in Nov 2025.

> **Monorepo**: `@heossihq/qnsi-monorepo` v0.0.1
> **Node.js**: ≥24.18.0 | **pnpm**: ≥10.25.0

## What QNSI Provides

- **Identity & Auth**: PQC-signed JWTs (ML-DSA), refresh tokens, service accounts, RBAC, WebAuthn passkeys, social OAuth (GitHub, Google, LinkedIn, Microsoft), enterprise OIDC/SAML federation, linked external identities
- **KMS**: Key generation, rotation, BYOK import, BYOH HSM, and HSM-Sealed Post-Quantum Keys
- **Secrets**: Secure storage with TTL and rotation
- **Storage**: Encryption at rest
- **Audit**: Immutable event logs and Merkle checkpointing
- **Crypto Posture**: Cloud, host, TLS, and local source-code discovery; CBOM; exposure analysis; governed migration waves; readiness; and evidence workflows

## How customers typically start

There are two common starting paths:

- **Build-first**: create a tenant, generate credentials, and integrate QNSI SDKs or APIs into a new workload
- **Migration-first**: connect external sources, run discovery, analyze exposure, then cut production trust dependencies over to QNSI

The migration path is documented in [Migration Journey to QNSI](/migration/journey).

## Service Map

Ports derived from `apps/*/src/config/env.ts`:

| Service | Default Port | Purpose |
|---------|--------------|---------|
| `platform-api` | 8080 | Platform management API |
| `auth-service` | 8081 | Token issuance, WebAuthn, identity |
| `vault-service` | 8090 | Secrets management |
| `storage-service` | 8092 | Encrypted object storage |
| `ai-orchestrator` | 8094 | AI/ML workload orchestration |
| `kms-service` | 8095 | Key management, HSM integration |
| `search-service` | 8101 | Searchable encryption queries |
| `access-control-service` | 8102 | Policy evaluation, RBAC |
| `audit-service` | 8103 | Event logging, Merkle checkpointing |
| `security-monitoring-service` | 8104 | Threat detection |
| `observability-service` | 8105 | Metrics, OTLP |
| `billing-service` | 8106 | Subscription, usage metering |
| `edge-gateway` | 8107 | Ingress, WAF, DDoS, rate limiting |
| `tenant-service` | 8108 | Tenant provisioning |
| `crypto-inventory-service` | 8115 | Cryptographic asset tracking |

## Next Steps

- [Authentication Prerequisites](./authentication-prerequisites)
- [Quickstart with curl](./quickstart-curl)
- [API Reference](/api/overview)
- [Migration Journey](/migration/journey)
- [Source-Code Cryptography Scanning](/crypto/source-code-scanning)
- [Governed Migration Execution](/migration/governed-execution)
