---
title: CLI Authentication
version: 0.0.1
last_updated: 2026-04-23
description: Configure QNSI CLI authentication with service account credentials, covering service-token requests, bearer secrets, token caching, and edge gateway routing.
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/cli/src/commands/auth.ts
  - /packages/cli/src/utils/auth.ts
  - /packages/cli/src/config.ts
---
# CLI Authentication

Configure authentication for the QNSI CLI.

## Service Token Authentication

From `packages/cli/src/commands/auth.ts`, the CLI uses service account authentication:

```bash
qnsi auth token --service-id <id> --service-secret <secret>
```

**Implementation**: The CLI requests a service token from auth-service via `POST /auth/service-token` (see `packages/cli/src/utils/auth.ts`).

The request uses:
- `Authorization: Bearer <serviceSecret>`
- JSON body with `serviceId`

Tokens are cached per `serviceId` to avoid re-requesting on every command.

## Configuration

From `packages/cli/src/config.ts`, configuration is loaded from environment variables:

If you set `QNSI_EDGE_GATEWAY_URL`, the CLI will default to routing service requests through:
```
${QNSI_EDGE_GATEWAY_URL}/proxy/<service>
```

Examples:
- KMS: `/proxy/kms`
- Vault: `/proxy/vault`
- Audit: `/proxy/audit`

## Environment Variables

From `packages/cli/src/config.ts`:

| Variable | Description | Default |
|----------|-------------|----------|
| `QNSI_EDGE_GATEWAY_URL` | Edge Gateway base URL (preferred) | `null` |
| `QNSI_AUTH_SERVICE_URL` | Auth service URL | `http://localhost:8081` |
| `QNSI_SERVICE_ID` | Service account ID | `null` |
| `QNSI_SERVICE_SECRET` | Service account secret | `null` |
| `QNSI_TENANT_ID` | Tenant identifier | `null` |
| `QNSI_KMS_SERVICE_URL` | KMS service URL | `http://localhost:8095` |
| `QNSI_VAULT_SERVICE_URL` | Vault service URL | `http://localhost:8090` |
| `QNSI_AUDIT_SERVICE_URL` | Audit service URL | `http://localhost:8103` |
| `QNSI_TENANT_SERVICE_URL` | Tenant service URL | `http://localhost:8108` |
| `QNSI_BILLING_SERVICE_URL` | Billing service URL | `http://localhost:8106` |
| `QNSI_ACCESS_CONTROL_SERVICE_URL` | Access control service URL | `http://localhost:8102` |
| `QNSI_SECURITY_MONITORING_SERVICE_URL` | Security monitoring service URL | `http://localhost:8104` |
| `QNSI_STORAGE_SERVICE_URL` | Storage service URL | `http://localhost:8092` |
| `QNSI_SEARCH_SERVICE_URL` | Search service URL | `http://localhost:8101` |
| `QNSI_OBSERVABILITY_SERVICE_URL` | Observability service URL | `http://localhost:8105` |
| `QNSI_OUTPUT_FORMAT` | Output format (json/table/yaml) | `table` |
| `QNSI_VERBOSE` | Enable verbose output | `false` |

## Non-interactive usage

If `QNSI_SERVICE_SECRET` is not set:
- In an interactive shell, the CLI will prompt for it.
- In non-interactive mode, the CLI exits with an auth error.

## Usage Example

```bash
export QNSI_EDGE_GATEWAY_URL="http://localhost:8107"
export QNSI_SERVICE_ID="your-service-id"
export QNSI_SERVICE_SECRET="your-service-secret"
export QNSI_TENANT_ID="your-tenant-uuid"

qnsi kms keys list
```
