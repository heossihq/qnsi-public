---
title: Audit Event Model
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/audit-service/src/config/env.ts
---

# Audit Event Model

QNSI Audit Service captures all security-relevant events with cryptographic integrity.

## Service Configuration

From `apps/audit-service/src/config/env.ts`:

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| Port | `PORT` | 8103 |
| Signing algorithm | `AUDIT_SIGNING_ALGORITHM` | `dilithium-3` |
| Max batch size | `AUDIT_MAX_BATCH_SIZE` | 100 |
| Max payload | `AUDIT_MAX_PAYLOAD_BYTES` | 512 KB |
| Retention | `AUDIT_RETENTION_DAYS` | 2555 (7 years) |
| Chain context | `AUDIT_CHAIN_CONTEXT` | `qnsi:audit` |
| Verify signatures | `AUDIT_VERIFY_SIGNATURES` | `true` |

## Merkle Checkpointing

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| Interval (events) | `AUDIT_CHECKPOINT_INTERVAL_EVENTS` | 10,000 |
| Interval (time) | `AUDIT_CHECKPOINT_INTERVAL_MS` | 300,000 (5 min) |
| Min events | `AUDIT_CHECKPOINT_MIN_EVENTS` | 100 |

## Event Structure

```json
{
  "eventId": "uuid",
  "eventType": "kms.key.created",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "tenantId": "tenant-uuid",
  "actor": {
    "type": "user",
    "id": "user-uuid",
    "email": "user@example.com",
    "ip": "192.168.1.100"
  },
  "resource": {
    "type": "key",
    "id": "key-uuid",
    "name": "my-encryption-key"
  },
  "action": "create",
  "result": "success",
  "context": {
    "requestId": "request-uuid",
    "userAgent": "QNSI-SDK/1.0.0",
    "source": "api"
  },
  "changes": {
    "before": null,
    "after": {"algorithm": "aes-256-gcm"}
  }
}
```

## Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `eventId` | UUID | Unique event identifier |
| `eventType` | string | Hierarchical event type |
| `timestamp` | ISO 8601 | Event occurrence time |
| `tenantId` | UUID | Tenant scope |
| `actor` | object | Who performed the action |
| `resource` | object | What was affected |
| `action` | string | What was done |
| `result` | string | success/failure |

## Actor Types

- `user`: Human user
- `service`: Service account
- `system`: Platform automation
- `workload`: Workload identity

## Signing Algorithms

Supported PQC algorithms for event signing:

| Algorithm | Description |
|-----------|-------------|
| `dilithium-2` | NIST Level 2 |
| `dilithium-3` | NIST Level 3 (default) |
| `dilithium-5` | NIST Level 5 |
| `falcon-512` | NIST Level 1 |
| `falcon-1024` | NIST Level 5 |
| `sphincs-shake-128f-simple` | Hash-based, Level 1 |
| `sphincs-shake-256f-simple` | Hash-based, Level 5 |
