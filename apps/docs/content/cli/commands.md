---
title: CLI Commands
version: 0.0.1
last_updated: 2026-04-23
description: Complete command reference for the QNSI CLI, covering global options plus auth, KMS, vault, and audit commands with service URLs and output format flags.
copyright: 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/cli/src/index.ts
  - /packages/cli/src/commands/auth.ts
  - /packages/cli/src/commands/kms.ts
  - /packages/cli/src/commands/vault.ts
  - /packages/cli/src/commands/audit.ts
---

# CLI Commands

Complete command reference for the QNSI CLI.

## Global Options

From `packages/cli/src/index.ts`:

```bash
--edge-gateway-url <url>    Edge Gateway URL (production entrypoint)
--cloud-portal-url <url>    Cloud Portal URL (for upgrade/add-on links)
--auth-service-url <url>    Auth service URL
--service-id <id>           Service account ID
--service-secret <secret>   Service account secret
--tenant-id <id>            Tenant identifier
--kms-service-url <url>     KMS service URL
--vault-service-url <url>   Vault service URL
--audit-service-url <url>   Audit service URL
--tenant-service-url <url>  Tenant service URL
--billing-service-url <url> Billing service URL
--access-control-service-url <url> Access control service URL
--security-monitoring-service-url <url> Security monitoring service URL
--storage-service-url <url> Storage service URL
--search-service-url <url>  Search service URL
--observability-service-url <url> Observability service URL
--output <format>           Output format: json, table, yaml (default: table)
--verbose                   Enable verbose output
```

## Auth Commands

From `packages/cli/src/commands/auth.ts`:

### Request service token
```bash
qnsi auth token [--service-id <id>] [--service-secret <secret>] [--audience <audience>]
```

**Options:**
- `--service-id` - Service account ID (or use QNSI_SERVICE_ID)
- `--service-secret` - Service account secret (or use QNSI_SERVICE_SECRET)
- `--audience` - Token audience (default: internal-service)

## KMS Commands

From `packages/cli/src/commands/kms.ts`:

### List keys
```bash
qnsi kms keys list [--limit <number>] [--cursor <cursor>]
```

**Options:**
- `--limit` - Number of keys to return (default: 100)
- `--cursor` - Pagination cursor

### Get key
```bash
qnsi kms keys get <keyId>
```

### Create key
```bash
qnsi kms keys create [--name <name>] [--algorithm <algorithm>] [--purpose <purpose>]
```

**Options:**
- `--name` - Key name (default: key-{timestamp})
- `--algorithm` - Key algorithm (default: aes-256-gcm)
- `--purpose` - Key purpose (default: encryption)

## Vault Commands

From `packages/cli/src/commands/vault.ts`:

### List secrets
```bash
qnsi vault secrets list [--limit <number>]
```

**Options:**
- `--limit` - Number of secrets to return (default: 100)

### Get secret
```bash
qnsi vault secrets get <secretId>
```

**Example:**
```bash
qnsi vault secrets get 6f9f1ce1-2c5b-4fb6-b37b-8ffef8f0b6c9
```

## Storage Commands

From `packages/cli/src/commands/storage.ts`:

### List objects
```bash
qnsi storage objects list [--limit <number>] [--cursor <cursor>] [--prefix <prefix>]
```

## Audit Commands

From `packages/cli/src/commands/audit.ts`:

### List events
```bash
qnsi audit events list [options]
```

**Options:**
- `--limit <number>` - Number of events to return (1-200, default: 50)
- `--cursor <cursor>` - Pagination cursor
- `--source-service <service>` - Filter by source service
- `--topic <topic>` - Filter by topic
- `--since <timestamp>` - Filter events since timestamp

**Example:**
```bash
qnsi audit events list --limit 100 --source-service kms-service --since 2025-12-24T00:00:00Z
```

## Search Commands

From `packages/cli/src/commands/search.ts`:

### Query
```bash
qnsi search query --query <query> [--limit <number>]
```

## Tenant Commands

From `packages/cli/src/commands/tenant.ts`:

### Get tenant (strictly tenant-scoped)
```bash
qnsi tenant get <tenantId>
```

`tenant list` and `tenant create` are intentionally disabled in the CLI.

## Billing Commands

From `packages/cli/src/commands/billing.ts`:

### List add-ons
```bash
qnsi billing addons list
```

### Catalog
```bash
qnsi billing addons catalog
```

### Enable add-on
```bash
qnsi billing addons enable --addon-id <id>
```

### Usage
```bash
qnsi billing usage [--start <date>] [--end <date>]
```

## Access Control Commands

From `packages/cli/src/commands/access-control.ts`:

### Policies list
```bash
qnsi access policies list [--limit <number>] [--cursor <cursor>]
```

### Policies get
```bash
qnsi access policies get <policyId>
```

### Policies create
```bash
qnsi access policies create --name <name> --effect <effect> --actions <actions> --resources <resources>
```

## Observability Commands

From `packages/cli/src/commands/observability.ts`:

### List SLOs
```bash
qnsi observability slos list [--limit <number>] [--cursor <cursor>]
```

### OTLP status
```bash
qnsi observability otlp status
```

## Security Commands

From `packages/cli/src/commands/security.ts`:

### Alerts list
```bash
qnsi security alerts list [--severity <severity>] [--status <status>] [--limit <number>] [--cursor <cursor>]
```

### Breaches list
```bash
qnsi security breaches list [--limit <number>] [--cursor <cursor>]

```
