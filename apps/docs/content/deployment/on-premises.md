---
title: On-Premises Deployment
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# On-Premises Deployment

Deploy QNSI in your own data center.

## Requirements

### Hardware
- Kubernetes cluster (1.28+)
- HSM (PKCS#11 compatible)
- Storage (S3-compatible or local)
- Load balancer

### Minimum resources
| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| Edge gateway | 4 | 8GB | 10GB |
| Auth service | 2 | 4GB | 10GB |
| KMS service | 4 | 8GB | 20GB |
| Vault service | 2 | 4GB | 20GB |
| Storage service | 4 | 8GB | 100GB+ |
| Database | 4 | 16GB | 100GB+ |

## Installation

Kubernetes deployment artifacts (charts/manifests) are not shipped in this repo.

For on-prem deployments, contact support for the supported deployment bundle and installation runbook.

### Configuration
Configuration examples below are illustrative and depend on your deployment bundle.
```yaml
# values.yaml
global:
  domain: qnsi.internal.example.com
  tls:
    enabled: true
    certManager: true

hsm:
  provider: cloudhsm
  clusterId: cluster-xxx

database:
  host: postgres.internal
  name: qnsi

storage:
  type: s3
  endpoint: minio.internal:9000
```

## Add-on required

On-premises deployment licensing is deployment-specific.

## Support

On-premises includes:
- Installation assistance
- Configuration review
- Upgrade support
