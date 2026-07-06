---
title: Failure Domains
version: 0.0.2
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/*/src/config/env.ts
---

# Failure Domains

QNSI is designed with isolated failure domains to contain blast radius.

## Service Isolation

Each service can fail independently:
- Separate process/container
- Independent health checks
- Circuit breakers on dependencies

## Service Ports & Health Endpoints

| Service | Port | Health Endpoint |
|---------|------|-----------------|
| edge-gateway | 8107 | `GET /health`, `GET /proxy/health` |
| platform-api | 8080 | `GET /proxy/platform/health`, `GET /edge/platform/health` |
| auth-service | 8081 | `GET /proxy/auth/health`, `GET /edge/auth/health` |
| vault-service | 8090 | `GET /proxy/vault/health`, `GET /edge/vault/health` |
| kms-service | 8095 | `GET /proxy/kms/health`, `GET /edge/kms/health` |
| storage-service | 8092 | `GET /proxy/storage/health`, `GET /edge/storage/health` |
| audit-service | 8103 | `GET /proxy/audit/health`, `GET /edge/audit/health` |

## Failure Modes

### Edge Gateway Failure
- **Impact**: All external traffic blocked
- **Mitigation**: Multi-instance deployment, health-based routing

### Auth Service Failure
- **Impact**: No new tokens issued
- **Mitigation**: Cached token validation, graceful degradation

### KMS Service Failure
- **Impact**: No new encrypt/decrypt operations
- **Mitigation**: Cached keys (TTL: 600s default), queue pending operations

### Storage Service Failure
- **Impact**: No data read/write
- **Mitigation**: Retry with backoff, client-side caching

## Graceful Degradation

Services implement:
- Timeouts on all external calls
- Circuit breakers (open after N failures)
- Fallback responses where safe
- Health endpoint for orchestrator
