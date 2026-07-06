---
title: Migration from HashiCorp Vault
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Migration from HashiCorp Vault

Migrate secrets from HashiCorp Vault to QNSI.

## Overview

QNSI provides tools to migrate secrets while maintaining security.

## Prerequisites

- Vault CLI access
- QNSI CLI configured
- Appropriate permissions in both systems

## Migration steps

### 1. Export from Vault
```bash
# List secrets
vault kv list secret/

# Export to file (encrypted)
vault kv get -format=json secret/my-secret > secret.json
```

### 2. Transform format
Transform exported values into the payload format your application expects to store.

### 3. Import to QNSI
Import secrets by creating them via the Vault API or the Vault SDK.

## Automated migration

Automated migration tooling is not shipped in this repo.

## Path mapping

HashiCorp Vault typically uses path-based secret identifiers.
QNSI vault-service secrets are identified by UUID and have a `name` field.

When migrating, treat the Vault path as application metadata (for example store it in the secret `metadata`) and choose a stable QNSI secret `name`.

## Considerations

- Vault KV version 2 metadata not migrated
- Dynamic secrets require reconfiguration
- Policies need manual recreation
- Test thoroughly before cutover
