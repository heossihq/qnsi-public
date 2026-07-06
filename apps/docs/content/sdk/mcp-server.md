---
title: MCP Server (@heossi/qnsi-mcp)
version: 0.1.3
last_updated: 2026-04-30
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/mcp-server/package.json
  - /packages/mcp-server/src/index.ts
  - /packages/mcp-server/src/tools.ts
  - /apps/cloud/app/api/mcp/route.ts
---

# MCP Server (`@heossi/qnsi-mcp`)

QNSI ships an official Model Context Protocol server for AI assistants. It exposes tenant-scoped tools for KMS, vault, audit, crypto posture, search, billing, and platform health using the same billing-backed entitlement model as the rest of the platform.

The MCP server is not just a convenience wrapper. It is one of the supported consumption surfaces for moving agentic workflows onto QNSI during migration and steady-state operations.

## Package

- npm package: `@heossi/qnsi-mcp`
- binary: `qnsi-mcp`
- current version: `0.1.3`
- runtime: Node.js `>= 24.12.0`

## Supported deployment modes

### 1. Local stdio server

Use this when connecting a local MCP-compatible client such as Codex, Claude Desktop, Cursor, or other MCP-capable tooling.

```bash
pnpm add -g @heossi/qnsi-mcp

export QNSI_API_KEY="qnsi_pqc_api_..."
export QNSI_PLATFORM_URL="https://api.qnsi.heossi.com"

qnsi-mcp
```

Required environment variables:

- `QNSI_API_KEY`

Optional environment variables:

- `QNSI_PLATFORM_URL`
  Default: `https://api.qnsi.heossi.com`

### 2. Hosted Streamable HTTP endpoint

QNSI Cloud also exposes the MCP server over HTTP:

```text
https://cloud.qnsi.heossi.com/api/mcp
```

This is the right choice when your MCP client supports remote HTTP transports instead of local stdio.

## Tool surface

The MCP server currently registers **15 tenant-scoped tools**. All tools live under the `qnsi_` namespace prefix so they never collide with other MCP servers an agent may have enabled simultaneously.

| Tool | Area | Description | Minimum tier |
|---|---|---|---|
| `qnsi_kms_generate_key` | KMS | Generate a PQC keypair (ML-KEM, ML-DSA, SLH-DSA, Falcon) from the 93-algorithm catalog. | Dev |
| `qnsi_kms_list_keys` | KMS | List keys in the current tenant. | Dev |
| `qnsi_kms_get_key` | KMS | Retrieve a key's public metadata. | Dev |
| `qnsi_kms_rotate_key` | KMS | Rotate a key; previous version retained for verification. | Dev |
| `qnsi_vault_create_secret` | Vault | Store a secret under PQC envelope encryption. | Pro |
| `qnsi_vault_get_secret` | Vault | Retrieve a vault secret. | Pro |
| `qnsi_vault_list_secrets` | Vault | List secrets in the tenant. | Pro |
| `qnsi_crypto_scan` | Crypto posture | Trigger a cryptographic discovery job (CBOM). | Dev |
| `qnsi_crypto_inventory` | Crypto posture | List recent inventory jobs and results. | Dev |
| `qnsi_crypto_readiness` | Crypto posture | PQC-readiness scorecard for the tenant. | Dev |
| `qnsi_audit_query` | Audit | Query the immutable, hash-chained audit log. | Dev |
| `qnsi_search_query` | Search | Searchable symmetric-encryption (SSE-X) query. | Business |
| `qnsi_tenant_info` | Tenant | Show current tenant configuration. | Dev |
| `qnsi_billing_status` | Billing | Show tier, limits, and upgrade URL. | Any |
| `qnsi_platform_health` | Platform | Platform liveness and regional posture. | Any |

If the tenant's plan does not include the feature the tool needs, the call returns a structured "upgrade required" message with a deep link to `https://cloud.qnsi.heossi.com/billing` — the same billing gate that protects the portal and SDKs. The edge-gateway enforces entitlements server-side as well, so the client-side check is a UX optimization and not the security boundary.

## Where MCP fits in the customer journey

The migration journey is:

**Connect → Discover → Analyze → Govern → Migrate → Validate → Operate**

The MCP server primarily sits in **Migrate**, **Validate**, and **Operate**:

- agents can consume QNSI trust services directly through MCP tools
- migration workflows can inspect crypto posture and inventory from agent frameworks
- post-cutover operations can query audit, health, readiness, and governed trust services through one assistant-facing surface

The MCP server does not replace discovery connectors or host agents. It complements them by giving AI assistants a governed interface into the same tenant-scoped QNSI platform.

## Authentication and entitlements

The MCP server activates against QNSI using your API key before serving tool calls.

During activation it resolves:

- tenant identity
- billing tier
- entitlements
- effective limits

That means tool availability follows billing as the source of truth. For example, search tools remain tier-gated the same way they are in the portal and SDKs.

Recommended credentials:

- **Tenant API key** for assistant or workload automation
- **User PAT** for local human-operated testing and debugging

For shared or durable enterprise automation, prefer a service-account-backed or tenant-owned machine identity instead of a personal token.

## Example MCP client configuration

### Local stdio

```json
{
  "mcpServers": {
    "qnsi": {
      "command": "qnsi-mcp",
      "env": {
        "QNSI_API_KEY": "qnsi_pqc_api_...",
        "QNSI_PLATFORM_URL": "https://api.qnsi.heossi.com"
      }
    }
  }
}
```

### Hosted HTTP

Use the hosted endpoint if your client supports remote MCP transports:

```text
https://cloud.qnsi.heossi.com/api/mcp
```

Authentication is still tenant-scoped and must use a valid QNSI API key or session-backed MCP auth flow, depending on the client integration.

## Operational notes

- The MCP server sends canonical tenant headers to the platform.
- Tool behavior is aligned with the cloud-hosted `/api/mcp` route.
- Search and other premium capabilities remain billing-gated.
- The package uses the same API contract shape as the portal proxy endpoints.

## Validation

Build and test the MCP package locally:

```bash
pnpm --filter @heossi/qnsi-mcp build
pnpm --filter @heossi/qnsi-mcp test
```

## Related docs

- [SDK Overview](./overview)
- [Quickstart](/quickstart)
- [API Overview](/api/overview)
- [SDK Activation](./sdk-activation)
