---
title: Audit Log Immutability
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Audit Log Immutability

QNSI audit logs are immutable and tamper-evident.

## Immutability guarantees

- Events cannot be modified after creation
- Events cannot be deleted (except by retention policy)
- All modifications are logged as new events
- Cryptographic verification available

## Implementation

### Write-once storage
- Append-only log structure
- No update or delete operations
- Separate retention management

### Cryptographic binding
- Each event signed at creation
- Hash chain links events
- Merkle tree for batch verification

## Verification

### Single event
```
GET /audit/v1/events/{eventId}/verify
```

Returns:
```json
{
  "eventId": "uuid",
  "verified": true,
  "signature": "base64...",
  "hashChain": {
    "previous": "hash...",
    "current": "hash..."
  }
}
```

### Batch verification
```
POST /audit/v1/verify
{
  "startTime": "2024-01-01T00:00:00Z",
  "endTime": "2024-01-31T23:59:59Z"
}
```

## Tampering detection

If tampering is detected:
- Verification fails
- Alert generated
- Incident response triggered

## Compliance

Immutability supports:
- SOC 2 audit trail requirements
- PCI DSS log integrity
- HIPAA audit controls
- GDPR accountability
