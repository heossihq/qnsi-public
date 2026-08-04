# @heossihq/qnsi-mcp

[![npm version](https://img.shields.io/npm/v/@heossihq/qnsi-mcp.svg)](https://www.npmjs.com/package/@heossihq/qnsi-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@heossihq/qnsi-mcp.svg)](https://www.npmjs.com/package/@heossihq/qnsi-mcp)
[![license](https://img.shields.io/npm/l/@heossihq/qnsi-mcp.svg)](./LICENSE)

**Official QNSI Model Context Protocol server** for Kiro, Claude Desktop, VS Code,
and other MCP-compatible clients. It exposes tenant-scoped QNSI tools for KMS,
HSPK custody, vault, cryptographic inventory, audit, encrypted search, billing,
and platform health. Authentication, tenant binding, and entitlements are enforced
by the platform.

> **Free tier available.** Get an API key at
> <https://cloud.qnsi.heossi.com/signup?src=mcp> - no credit card.

---

## Why install this?

Your agent can now:

- Generate and rotate NIST-standardised PQC keys (ML-KEM, ML-DSA, SLH-DSA, Falcon).
- Seal ML-DSA-44/65/87 private keys under a qualified customer HSM and sign through HSPK custody flows; ML-DSA executes in QNSI software outside the module.
- Store secrets in a quantum-safe vault with per-tenant envelope encryption.
- Run configured cryptographic discovery connectors and inspect their discovery runs.
- Query an immutable, hash-chained audit log for any tenant action.
- Run searchable symmetric-encryption (SSE-X) queries over encrypted documents.
- Report tenant tier, quota, and billing status without leaving the client.

Every call is tenant-scoped, entitlement-enforced on the server, and billable
against your QNSI plan.

---

## Install

Install the pinned package globally with pnpm:

```bash
pnpm add --global @heossihq/qnsi-mcp@0.2.0
```

Configure the installed `qnsi-mcp` binary. Keep real API keys out of committed
workspace files and use protected client or operating-system environment storage.

### Kiro

Add to `~/.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "qnsi": {
      "command": "qnsi-mcp",
      "args": [],
      "env": { "QNSP_API_KEY": "YOUR_API_KEY" },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Claude Desktop

Add the same `mcpServers.qnsi` entry to
`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS.

### VS Code

Add to `.vscode/mcp.json` or the corresponding user-level MCP configuration:

```json
{
  "servers": {
    "qnsi": {
      "type": "stdio",
      "command": "qnsi-mcp",
      "args": [],
      "env": { "QNSP_API_KEY": "YOUR_API_KEY" }
    }
  }
}
```

Restart or reconnect the MCP server after changing configuration.

---

## Tools exposed

Version 0.2.0 exposes 17 tools. Tools retain the `qnsp_` namespace prefix for
compatibility, so existing MCP configurations continue to work and names do not
collide with tools from other MCP servers an agent may have enabled.

| Tool | Description | Tier |
|---|---|---|
| `qnsp_kms_generate_key` | Generate a PQC keypair (ML-KEM, ML-DSA, SLH-DSA, Falcon). | Dev+ |
| `qnsp_kms_list_keys` | List keys in the current tenant. | Dev+ |
| `qnsp_kms_get_key` | Retrieve a key's public metadata. | Dev+ |
| `qnsp_kms_rotate_key` | Rotate a key; previous version retained for verification. | Dev+ |
| `qnsp_kms_hspk_seal` | Generate an ML-DSA-44/65/87 keypair and seal the private key under a qualified PKCS#11 HSM custody key. | Enterprise+ |
| `qnsp_kms_hspk_sign` | Sign with ML-DSA in QNSI software while the HSM-unsealed private key exists only transiently in memory. | Enterprise+ |
| `qnsp_vault_create_secret` | Store a secret under PQC envelope encryption. | Pro+ |
| `qnsp_vault_get_secret` | Retrieve a vault secret. | Pro+ |
| `qnsp_vault_list_secrets` | List secrets in the tenant. | Pro+ |
| `qnsp_crypto_scan` | Run the tenant's configured discovery connectors and return the resulting discovery runs; accepts no input. | Dev+ |
| `qnsp_crypto_inventory` | List recent inventory jobs and results. | Dev+ |
| `qnsp_crypto_readiness` | PQC-readiness scorecard for the tenant. | Dev+ |
| `qnsp_audit_query` | Query the immutable, hash-chained audit log. | Dev+ |
| `qnsp_search_query` | Searchable symmetric-encryption (SSE-X) query. | Business+ |
| `qnsp_tenant_info` | Show current tenant configuration. | Dev+ |
| `qnsp_billing_status` | Show tier, limits, and upgrade URL. | Any |
| `qnsp_platform_health` | Platform liveness and regional posture. | Any |

If your tier does not include a feature, the tool returns a clear upgrade
message with a deep link to <https://cloud.qnsi.heossi.com/billing>.

---

## Configuration

| Env var | Required | Default | Purpose |
|---|---|---|---|
| `QNSP_API_KEY` | yes | - | Tenant-scoped API key. Create one at <https://cloud.qnsi.heossi.com/api-keys>. |
| `QNSP_PLATFORM_URL` | no | `https://api.qnsi.heossi.com` | Point at a staging or self-hosted edge gateway. |

---

## How it works

On start, the server uses the activation client bundled in `@heossihq/qnsi` to resolve
the API key into a tenant, tier, and feature set. Every tool invocation is:

1. **Gated client-side** by the resolved tier (fails fast with a human-readable
   upgrade prompt instead of a raw 402/403).
2. **Enforced server-side** by the QNSI edge gateway and PDP - the client-side
   gate is a UX optimization, not the security boundary.
3. **Audited** as an immutable hash-chained event in the QNSI audit log.

No data is cached locally; every call is a round-trip to your tenant.

---

## Security

- API keys are sent only to the configured QNSI HTTPS endpoint and are never intentionally logged by the MCP server.
- Native-only or hybrid-PQC negotiation at the public AWS ALB boundary is **NOT VERIFIED**. MCP availability and PQC operation semantics do not prove end-to-end PQC transport.
- Tool output is JSON - the server never embeds raw secret material into natural-language responses unless the tool semantics require it.
- Report vulnerabilities to <security@heossi.com>.

---

## Links

- **Docs:** <https://docs.qnsi.heossi.com/sdk/mcp-server>
- **Cloud console:** <https://cloud.qnsi.heossi.com>
- **Pricing:** <https://qnsi.heossi.com/pricing>
- **Issues:** <https://github.com/heossihq/qnsi-public/issues>

Apache-2.0 © HEOSSI (PTE.) LTD.
