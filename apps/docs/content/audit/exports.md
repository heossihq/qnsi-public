---
title: Audit Log Exports
version: 0.0.1
last_updated: 2026-04-23
copyright: 2025 HEOSSI. All rights reserved.
---
# Audit Log Exports

Export audit logs for external analysis and archival.

## Export methods

Audit export job APIs are not shipped in this repo.

For bulk export, page through audit events:
```
GET /audit/v1/events?tenantId=<tenant_uuid>&limit=50
```

## Scheduled exports

Scheduled exports are deployment-specific.

Export destinations are deployment-specific.

## Export formats

- `json`: Single JSON array
- `jsonl`: JSON Lines (recommended for large exports)
- `csv`: Comma-separated values
- `parquet`: Apache Parquet (for analytics)
