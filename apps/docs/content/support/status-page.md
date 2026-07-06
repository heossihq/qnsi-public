---
title: Status Page
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Status Page

Monitor QNSI service status.

## Cloud status dashboard

QNSI Cloud service health is displayed on the QNSI website ("Cloud Status (Production)").

- QNSI website: https://qnsi.heossi.com#overview

The dashboard data is fetched from the website's status endpoint:

```
GET /api/status
```

## Components monitored

| Component | Description |
|-----------|-------------|
| API Gateway | Edge gateway availability |
| Authentication | Auth service |
| Key Management | KMS service |
| Secrets | Vault service |
| Storage | Storage service |
| Search | Search service |
| Audit | Audit service |

## Status levels

| Status | Description |
|--------|-------------|
| Operational | All systems normal |
| Degraded | Partial functionality |
| Partial outage | Some features unavailable |
| Major outage | Service unavailable |
| Maintenance | Planned maintenance |

## Incident updates

During incidents:
- Initial report within 15 minutes
- Updates every 30 minutes
- Resolution summary

## Notes

- The public dashboard reflects QNSI Cloud (hosted production) only.
- Private/VPC/sovereign and air-gapped deployments are monitored within customer-controlled environments.
