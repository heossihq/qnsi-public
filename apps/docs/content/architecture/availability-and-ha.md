---
title: Availability and High Availability
version: 0.0.2
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Availability and High Availability

QNSI is designed for high availability across all tiers.

## Availability targets

| Component | Target | Notes |
|-----------|--------|-------|
| Edge gateway | 99.99% | Multi-AZ, health-based routing |
| Auth service | 99.9% | Stateless, horizontally scaled |
| KMS service | 99.9% | HSM-backed, cached operations |
| Storage service | 99.9% | Replicated storage backend |

## HA architecture

### Stateless services
- Multiple replicas per service
- Load balancer distributes traffic
- Any replica can handle any request

### Stateful components
- Database: Multi-AZ with automatic failover
- HSM: Clustered with replication
- Cache: Redis cluster mode

## Health checks

All services expose health endpoints through edge-gateway:
- `GET /proxy/<service>/health` — basic liveness
- `GET /edge/<service>/health` — alternative health path

Health check endpoints (GET/HEAD) bypass bot protection and rate limiting for reliable monitoring.

## Failover

- Automatic failover within region
- Cross-region failover requires `failover-region` add-on
- RTO: < 5 minutes (within region)
- RPO: 0 (synchronous replication)
