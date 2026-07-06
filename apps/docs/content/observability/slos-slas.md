---
title: SLOs and SLAs
version: 1.0.0
last_updated: 2026-04-23
copyright: © 2025–2026 HEOSSI (PTE.) LTD All rights reserved.
---
# SLOs and SLAs

Service Level Objectives (SLOs) and Service Level Agreements (SLAs) for QNSI Cloud services provided by HEOSSI (PTE.) LTD

## Overview

- **SLOs** are internal operational targets that we monitor and optimize against. They are not contractual commitments.
- **SLAs** are contractual commitments with defined remedies (Service Credits) for eligible subscription tiers.

For the full SLA document with availability commitments, credit schedules, and exclusions, see [Service Level Agreement](/legal/sla).

## Service Level Objectives (SLOs)

SLO targets below reflect current operational targets for QNSI Cloud hosted production. These are engineering goals, not contractual guarantees.

### Availability Targets

| Service | SLO Target | Notes |
|---------|------------|-------|
| Edge Gateway | 99.99% | Primary ingress point |
| Auth Service | 99.9% | Authentication and token issuance |
| KMS Service | 99.9% | Key management operations |
| Vault Service | 99.9% | Secrets management |
| Storage Service | 99.9% | Encrypted object storage |
| Search Service | 99.9% | Searchable encryption |
| Audit Service | 99.9% | Audit log ingestion |

### Latency Targets (P99)

| Operation | Target | Notes |
|-----------|--------|-------|
| Authentication | < 200ms | Initial login |
| Token refresh | < 100ms | Token renewal |
| KMS encrypt/decrypt | < 100ms | Single operation |
| Secret read | < 150ms | Single secret |
| Storage GET (< 1MB) | < 300ms | Small object retrieval |
| Storage GET (< 100MB) | < 2s | Medium object retrieval |
| Search query | < 500ms | SSE-X encrypted search |

### Error Rate Targets

| Service | Target |
|---------|--------|
| All services | < 0.1% (5xx errors) |

## SLO Monitoring

### Error Budget

The error budget represents the acceptable amount of unreliability:

```
error_budget = 1 - SLO_target
error_budget_remaining = error_budget - actual_error_rate
```

Example: For a 99.9% SLO, the monthly error budget is 0.1% (~43 minutes of downtime).

### Burn Rate Alerting

Burn rate measures how quickly the error budget is being consumed:

```
burn_rate = actual_error_rate / (1 - SLO_target)
```

| Burn Rate | Alert Level | Action |
|-----------|-------------|--------|
| > 14.4× | Critical | Page on-call, immediate response |
| > 6× | High | Alert, investigate within 1 hour |
| > 1× | Warning | Monitor, investigate within 4 hours |

### SLO Dashboard

Real-time SLO metrics are available via API:

```
GET /observability/v1/slos/summary
GET /observability/v1/slos
GET /observability/v1/slos/{service}/history
```

## Service Level Agreements (SLAs)

SLAs provide contractual availability commitments with Service Credits for eligible tiers.

### SLA Eligibility by Tier

| Tier | SLA Coverage |
|------|--------------|
| Free, Dev Starter | No SLA |
| Dev Pro, Dev Elite | Monitoring only (no credits) |
| Business Team, Business Advanced, Business Elite | 99.9% SLA with credits |
| Enterprise Standard, Enterprise Pro | 99.95% SLA with credits |
| Enterprise Elite, Specialized | Custom SLA per agreement |

### Service Credit Schedule

See the [full SLA document](/legal/sla) for:
- Detailed credit percentages
- SLA exclusions
- Credit request procedures
- Measurement methodology

## Incident Response

When an SLO breach occurs:

1. **Detection**: Automated alerting triggers
2. **Response**: On-call engineer engaged
3. **Communication**: Status page updated within 15 minutes
4. **Resolution**: Issue mitigated
5. **Post-Incident**: Root cause analysis published
6. **Credits**: Service Credits processed (if SLA applies)

For details on incident classification and response times, see [Incident Response](/security/incident-response).

## Related Documentation

- [Service Level Agreement](/legal/sla) — Contractual SLA with credit schedules
- [Support Policy](/support/support-policy) — Support tiers and response times
- [Maintenance Policy](/support/maintenance-policy) — Scheduled maintenance windows
- [Status Page](/support/status-page) — Real-time service status
- [Incident Response](/security/incident-response) — Security incident handling
