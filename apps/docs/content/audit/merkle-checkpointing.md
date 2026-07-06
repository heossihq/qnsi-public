---
title: Merkle Checkpointing
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Merkle Checkpointing

Cryptographic verification of audit log integrity.

## How it works

### Event hashing
Each event is hashed:
```
H(event) = SHA3-256(canonical_json(event))
```

### Merkle tree construction
Events are organized into a Merkle tree:
```
        Root Hash
       /         \
    H(1,2)      H(3,4)
    /    \      /    \
  H(1)  H(2)  H(3)  H(4)
```

### Checkpoints
Periodic checkpoints capture:
- Merkle root hash
- Timestamp
- Event count
- Previous checkpoint hash

## Checkpoint structure

```json
{
  "checkpointId": "uuid",
  "timestamp": "2024-01-15T00:00:00Z",
  "merkleRoot": "sha3-256-hash",
  "eventCount": 10000,
  "firstEventId": "uuid",
  "lastEventId": "uuid",
  "previousCheckpoint": "uuid",
  "signature": "dilithium-signature"
}
```

## Verification

### Verify checkpoint
```
GET /audit/v1/checkpoints/{checkpointId}/verify
```

### Verify event inclusion
```
GET /audit/v1/events/{eventId}/proof
```

Returns Merkle proof:
```json
{
  "eventId": "uuid",
  "eventHash": "hash",
  "proof": ["hash1", "hash2", "hash3"],
  "checkpointId": "uuid",
  "verified": true
}
```

## Checkpoint frequency

- Default: Every 1 hour
- Configurable per tenant
- Minimum: 15 minutes
- Maximum: 24 hours

## External anchoring

Checkpoint hashes can be anchored to:
- Public blockchain
- Trusted timestamping service
- Customer's audit system
