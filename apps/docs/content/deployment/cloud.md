---
title: Cloud Deployment
version: 0.0.1
last_updated: 2026-04-23
description: Deploy QNSI as a managed cloud service across multiple regions with shared, dedicated, and private VPC tiers offering varying isolation and SLA levels.
copyright: © 2025 HEOSSI. All rights reserved.
---
# Cloud Deployment

QNSI is available as a managed cloud service.

## Regions

| Region | Location | Status |
|--------|----------|--------|
| ap-southeast-1 | Singapore | Available |
| us-east-1 | N. Virginia | Available |
| eu-west-1 | Ireland | Available |
| ap-northeast-1 | Tokyo | Coming soon |

## Deployment tiers

### Shared
- Multi-tenant infrastructure
- Cost-effective
- Standard SLAs

### Dedicated
- Single-tenant compute
- Enhanced isolation
- Custom SLAs

### Private
- Customer VPC deployment
- Full network isolation
- Custom compliance

## Getting started

1. Sign up at https://cloud.qnsi.heossi.com
2. Create tenant
3. Configure authentication
4. Start integrating

## Network connectivity

### Public endpoints
```
api.qnsi.heossi.com
api.<region>.qnsi.heossi.com
```

### Private Link (AWS)
Available for dedicated/private tiers.

### VPC Peering
Available for private tier.

## Data residency

Configure data residency per tenant:
- Primary region for data storage
- Allowed regions for processing
- Replication restrictions
