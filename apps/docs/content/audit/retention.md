---
title: Audit Log Retention
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/audit-service/src/config/env.ts
  - /apps/billing-service/src/pricing/config.ts
---

# Audit Log Retention

Configure how long audit logs are retained via Audit Service (port 8103).

## Default Retention

From `apps/audit-service/src/config/env.ts`:

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| Retention days | `AUDIT_RETENTION_DAYS` | 2555 (7 years) |

## Retention Add-ons

From `apps/billing-service/src/pricing/config.ts`:

| Add-on | Retention Period |
|--------|------------------|
| `audit-trails-retention-90` | 90 days |
| `audit-trails-retention-180` | 180 days |
| `audit-trails-retention-1yr` | 1 year |
| `audit-trails-retention-7yr` | 7 years |

## Configuration

Set retention per event type:
```json
{
  "retention": {
    "default": "90d",
    "overrides": {
      "auth.*": "1y",
      "kms.decrypt": "7y",
      "vault.secret.read": "1y"
    }
  }
}
```

## Retention behavior

### Before expiry
- Events fully accessible
- Searchable and exportable
- Included in reports

### At expiry
- Events marked for deletion
- 7-day grace period
- Final export opportunity

### After deletion
- Event data removed
- Metadata may be retained
- Checkpoints preserved

## Legal hold

Override retention for legal requirements:
```
POST /audit/v1/legal-hold
{
  "query": {"eventType": "kms.*"},
  "startTime": "2024-01-01",
  "endTime": "2024-06-30",
  "reason": "litigation-2024-001"
}
```

## Compliance considerations

- GDPR: Balance retention with data minimization
- PCI DSS: Minimum 1 year retention
- HIPAA: 6 years for covered entities
- SOX: 7 years for financial records
