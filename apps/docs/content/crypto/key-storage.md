---
title: Key Storage
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Key Storage

QNSI stores keys securely with multiple protection layers.

## Storage locations

### HSM storage
- Root keys: Never leave HSM
- High-value keys: HSM-resident

### Encrypted storage
- Wrapped keys stored in database
- Encryption key in HSM
- Additional application-layer encryption

## Key wrapping

Keys at rest are wrapped:
1. DEK wrapped by KEK
2. KEK wrapped by TMK
3. TMK wrapped by root key (in HSM)

## Access controls

Key access requires:
- Valid authentication
- Appropriate permissions
- Audit logging

## Key states

| State | Description |
|-------|-------------|
| `active` | Available for all operations |
| `suspended` | Decrypt only, no new encryptions |
| `deactivated` | No operations, pending deletion |
| `destroyed` | Cryptographically shredded |

## Backup and recovery

- HSM keys: HSM-native backup mechanisms
- Wrapped keys: Encrypted database backups
- Recovery requires quorum of key custodians

## BYOK/HYOK

Customers can:
- **BYOK**: Bring Your Own Key (import wrapped)
- **HYOK**: Hold Your Own Key (key never leaves customer HSM)
