---
title: MCP Server (@heossihq/qnsi-mcp)
version: 0.2.0
last_updated: 2026-07-26
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/mcp-server/package.json
  - /packages/mcp-server/src/index.ts
  - /packages/mcp-server/src/tools.ts
  - /apps/cloud/app/api/mcp/route.ts
---

# MCP Server (`@heossihq/qnsi-mcp`)

QNSI ships an official Model Context Protocol server for AI assistants. It exposes tenant-scoped tools for KMS, vault, audit, crypto posture, search, billing, and platform health using the same billing-backed entitlement model as the rest of the platform.

The MCP server is not just a convenience wrapper. It is one of the supported consumption surfaces for moving agentic workflows onto QNSI during migration and steady-state operations.

## Package

- npm package: `@heossihq/qnsi-mcp`
- binary: `qnsi-mcp`
- current version: `0.2.0`
- runtime: Node.js `>= 22.0.0`

## Supported deployment modes

### 1. Local stdio server

Use the installed binary with Kiro, Claude Desktop, VS Code, or another
MCP-compatible client.

```bash
pnpm add --global @heossihq/qnsi-mcp@0.2.0
export QNSP_API_KEY="YOUR_API_KEY"
export QNSP_PLATFORM_URL="https://api.qnsi.heossi.com"
qnsi-mcp
```

Configure `qnsi-mcp` in Kiro at `~/.kiro/settings/mcp.json`, in Claude Desktop's
`mcpServers` configuration, or in VS Code at `.vscode/mcp.json`. Keep real API
keys out of committed workspace files.

Required environment variables:

- `QNSP_API_KEY`

Optional environment variables:

- `QNSP_PLATFORM_URL`
  Default: `https://api.qnsi.heossi.com`

### 2. Hosted Streamable HTTP endpoint

QNSI Cloud also exposes the MCP server over HTTP:

```text
https://cloud.qnsi.heossi.com/api/mcp
```

Use this when the MCP client supports remote HTTP transport.

## Tool surface

The MCP server currently registers **17 tenant-scoped tools**. Tool names retain the `qnsp_` namespace for wire compatibility with existing MCP clients; the package, product, and current API-key prefix use the QNSI name.

| Tool | Area | Description | Minimum tier |
|---|---|---|---|
| `qnsp_kms_generate_key` | KMS | Generate a PQC keypair from QNSI's 87-algorithm policy catalog. | Dev |
| `qnsp_kms_list_keys` | KMS | List keys in the current tenant. | Dev |
| `qnsp_kms_get_key` | KMS | Retrieve a key's public metadata. | Dev |
| `qnsp_kms_rotate_key` | KMS | Rotate a key; previous version retained for verification. | Dev |
| `qnsp_kms_hspk_seal` | KMS / HSPK | Generate an ML-DSA-44/65/87 keypair and seal its private key under a qualified PKCS#11 HSM RSA-OAEP custody key. | Enterprise |
| `qnsp_kms_hspk_sign` | KMS / HSPK | Unseal transiently through the HSM and sign with ML-DSA in QNSI software outside the module. | Enterprise |
| `qnsp_vault_create_secret` | Vault | Store a secret under PQC envelope encryption. | Pro |
| `qnsp_vault_get_secret` | Vault | Retrieve a vault secret. | Pro |
| `qnsp_vault_list_secrets` | Vault | List secrets in the tenant. | Pro |
| `qnsp_crypto_scan` | Crypto posture | Run configured discovery connectors and return the resulting discovery runs; accepts no input. | Dev |
| `qnsp_crypto_inventory` | Crypto posture | List recent inventory jobs and results. | Dev |
| `qnsp_crypto_readiness` | Crypto posture | Return the tenant's PQC-readiness scorecard. | Dev |
| `qnsp_audit_query` | Audit | Query the immutable, hash-chained audit log. | Dev |
| `qnsp_search_query` | Search | Run a searchable symmetric-encryption (SSE-X) query. | Business |
| `qnsp_tenant_info` | Tenant | Show current tenant configuration. | Dev |
| `qnsp_billing_status` | Billing | Show tier, limits, and upgrade URL. | Any |
| `qnsp_platform_health` | Platform | Show platform liveness and regional posture. | Any |

If the tenant's plan does not include the feature the tool needs, the call returns a structured "upgrade required" message with a deep link to `https://cloud.qnsi.heossi.com/billing` - the same billing gate that protects the portal and SDKs. The edge-gateway enforces entitlements server-side as well, so the client-side check is a UX optimization and not the security boundary.

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
        "QNSP_API_KEY": "qnsi_pqc_api_...",
        "QNSP_PLATFORM_URL": "https://api.qnsi.heossi.com"
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
- `qnsp_crypto_scan` invokes configured discovery connectors and accepts no scope input.

## Transport boundary

The local and hosted MCP surfaces use QNSI's public HTTPS endpoints. Native-only or hybrid-PQC negotiation at the public AWS ALB boundary is **NOT VERIFIED**. MCP availability and PQC operation semantics do not prove end-to-end PQC transport.

## Validation

Build and test the MCP package locally:

```bash
pnpm --filter @heossihq/qnsi-mcp build
pnpm --filter @heossihq/qnsi-mcp test
```

## Related docs

- [SDK Overview](./overview)
- [Quickstart](/quickstart)
- [API Overview](/api/overview)
- [SDK Activation](./sdk-activation)
