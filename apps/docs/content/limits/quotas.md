---
title: Quotas
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Quotas

Resource quotas and limits.

## Default quotas

| Resource | Default limit |
|----------|---------------|
| Keys per tenant | 1,000 |
| Secrets per tenant | 10,000 |
| Storage per tenant | 100 GB |
| Service accounts | 100 |
| Policies | 500 |
| Audit retention | 90 days |

## Tier-based quotas

| Resource | Free | Developer | Business | Enterprise |
|----------|------|-----------|----------|------------|
| KMS keys | 20 | 30-125 | 300-1K | 2K-5K |
| Vault secrets | 25 | 75-500 | 1K-4K | 8K-20K |
| Storage | 10 GB | 100-500 GB | 5-15 TB | 20-25 TB |
| API calls/month | 50K | 100K-750K | 1.5M-10M | 15M-30M |

## Checking quotas

```
GET /tenant/v1/quotas
```

Returns:
```json
{
  "quotas": {
    "keys": {"used": 50, "limit": 1000},
    "secrets": {"used": 500, "limit": 10000},
    "storage": {"used": "5GB", "limit": "100GB"}
  }
}
```

## Quota exceeded

When quota exceeded:
```json
{
  "statusCode": 403,
  "error": "QUOTA_EXCEEDED",
  "message": "Key quota exceeded",
  "details": {
    "resource": "keys",
    "used": 1000,
    "limit": 1000
  }
}
```

## Increasing quotas

Contact support or upgrade tier:
- Self-service tier upgrade
- Custom quota requests
- Enterprise agreements
