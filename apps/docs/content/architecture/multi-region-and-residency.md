---
title: Multi-Region and Data Residency
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Multi-Region and Data Residency

QNSI supports multi-region deployment with data residency controls.

## Region model

- Each region operates independently
- Cross-region replication is opt-in
- Data residency enforced at tenant level

## Data residency

Tenants can configure:
- Primary region for data storage
- Allowed regions for processing
- Replication restrictions

## Residency enforcement

- Storage service respects region constraints
- KMS keys bound to region
- Audit logs stored in designated region

## Add-ons

Region-related add-ons:
- `region-residency-enforcement`: Strict residency controls
- `failover-region`: Cross-region failover capability

## Configuration

Set via tenant configuration:
```json
{
  "dataResidency": {
    "primaryRegion": "ap-southeast-1",
    "allowedRegions": ["ap-southeast-1", "ap-northeast-1"]
  }
}
```
