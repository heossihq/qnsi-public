---
title: Audit Log Formats
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Audit Log Formats

Supported formats for audit log export.

## JSON (default)

```json
{
  "eventId": "uuid",
  "eventType": "kms.key.created",
  "timestamp": "2024-01-15T10:30:00.000Z",
  ...
}
```

## JSON Lines (JSONL)

One event per line:
```
{"eventId":"uuid1","eventType":"kms.key.created",...}
{"eventId":"uuid2","eventType":"vault.secret.read",...}
```

## CEF (Common Event Format)

For SIEM integration:
```
CEF:0|QNSI|AuditService|1.0|kms.key.created|Key Created|5|
  src=192.168.1.100 suser=user@example.com 
  cs1=tenant-uuid cs1Label=tenantId
  cs2=key-uuid cs2Label=resourceId
```

## LEEF (Log Event Extended Format)

For QRadar:
```
LEEF:2.0|QNSI|AuditService|1.0|kms.key.created|
  src=192.168.1.100
  usrName=user@example.com
  tenantId=tenant-uuid
```

## Syslog

RFC 5424 format:
```
<134>1 2024-01-15T10:30:00.000Z qnsi audit-service - kms.key.created 
  [meta tenantId="tenant-uuid" actor="user@example.com"] Key created
```

## Format selection

Specify format in export:
```
GET /audit/v1/events/export?format=jsonl
```

Or in webhook configuration:
```json
{
  "url": "https://siem.example.com/events",
  "format": "cef"
}
```
