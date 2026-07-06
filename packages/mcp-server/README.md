# @heossi/qnsi-mcp

[![npm version](https://img.shields.io/npm/v/@heossi/qnsi-mcp.svg)](https://www.npmjs.com/package/@heossi/qnsi-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@heossi/qnsi-mcp.svg)](https://www.npmjs.com/package/@heossi/qnsi-mcp)
[![license](https://img.shields.io/npm/l/@heossi/qnsi-mcp.svg)](./LICENSE)

**Official QNSP Model Context Protocol server** — give Claude, Cursor, Windsurf,
and any MCP-compatible agent first-class access to a production post-quantum
cryptography platform: FIPS 203 / 204 / 205 key management, a quantum-safe
vault, a cryptographic bill of materials (CBOM), searchable encrypted storage,
and immutable audit trails — tenant-scoped and tier-gated end-to-end.

> **Free tier available.** Get an API key at
> <https://cloud.qnsi.heossi.com/signup?src=mcp> — no credit card.

---

## Why install this?

Your agent can now:

- Generate and rotate NIST-standardised PQC keys (ML-KEM, ML-DSA, SLH-DSA, Falcon).
- Store secrets in a quantum-safe vault with per-tenant envelope encryption.
- Scan your infrastructure's cryptographic posture (CBOM) and score PQC readiness.
- Query an immutable, hash-chained audit log for any tenant action.
- Run searchable symmetric-encryption (SSE-X) queries over encrypted documents.
- Report tenant tier, quota, and billing status without leaving the chat.

Every call is tenant-scoped, entitlement-enforced on the server, and billable
against your QNSP plan.

---

## Install

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "qnsp": {
      "command": "npx",
      "args": ["-y", "@heossi/qnsi-mcp"],
      "env": {
        "QNSP_API_KEY": "qnsp_pqc_api_..."
      }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "qnsp": {
      "command": "npx",
      "args": ["-y", "@heossi/qnsi-mcp"],
      "env": { "QNSP_API_KEY": "qnsp_pqc_api_..." }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "qnsp": {
      "command": "npx",
      "args": ["-y", "@heossi/qnsi-mcp"],
      "env": { "QNSP_API_KEY": "qnsp_pqc_api_..." }
    }
  }
}
```

### VS Code (GitHub Copilot / Continue)

Add to `.vscode/mcp.json` (workspace) or the user-level MCP config:

```json
{
  "servers": {
    "qnsp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@heossi/qnsi-mcp"],
      "env": { "QNSP_API_KEY": "qnsp_pqc_api_..." }
    }
  }
}
```

### CLI (any MCP client)

```bash
npm install -g @heossi/qnsi-mcp
export QNSP_API_KEY="qnsp_pqc_api_..."
qnsp-mcp
```

---

## Tools exposed

All tools are registered with the `qnsp_` namespace prefix so they never
collide with tools from other MCP servers an agent may have enabled.

| Tool | Description | Tier |
|---|---|---|
| `qnsp_kms_generate_key` | Generate a PQC keypair (ML-KEM, ML-DSA, SLH-DSA, Falcon). | Dev+ |
| `qnsp_kms_list_keys` | List keys in the current tenant. | Dev+ |
| `qnsp_kms_get_key` | Retrieve a key's public metadata. | Dev+ |
| `qnsp_kms_rotate_key` | Rotate a key; previous version retained for verification. | Dev+ |
| `qnsp_vault_create_secret` | Store a secret under PQC envelope encryption. | Pro+ |
| `qnsp_vault_get_secret` | Retrieve a vault secret. | Pro+ |
| `qnsp_vault_list_secrets` | List secrets in the tenant. | Pro+ |
| `qnsp_crypto_scan` | Trigger a cryptographic discovery job (CBOM). | Dev+ |
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
| `QNSP_API_KEY` | yes | — | Tenant-scoped API key. Create one at <https://cloud.qnsi.heossi.com/api-keys>. |
| `QNSP_PLATFORM_URL` | no | `https://api.qnsi.heossi.com` | Point at a staging or self-hosted edge gateway. |

---

## How it works

On start, the server calls `@heossi/qnsi-sdk-activation` to resolve the API key into a
tenant, tier, and feature-flag set. Every tool invocation is:

1. **Gated client-side** by the resolved tier (fails fast with a human-readable
   upgrade prompt instead of a raw 402/403).
2. **Enforced server-side** by the QNSP edge gateway and PDP — the client-side
   gate is a UX optimization, not the security boundary.
3. **Audited** as an immutable hash-chained event in the QNSP audit log.

No data is cached locally; every call is a round-trip to your tenant.

---

## Security

- API keys are transmitted over TLS 1.3 (hybrid-PQC negotiation where
  supported) to `api.qnsi.heossi.com` and never logged.
- Tool output is JSON — the server never embeds raw secret material into
  natural-language responses unless the tool semantics require it.
- Report vulnerabilities to <security@heossi.com>.

---

## Links

- **Docs:** <https://docs.qnsi.heossi.com/sdk/mcp-server>
- **Cloud console:** <https://cloud.qnsi.heossi.com>
- **Pricing:** <https://qnsi.heossi.com/pricing>
- **Issues:** <https://github.com/heossihq/qnsi-public/issues>

Apache-2.0 © HEOSSI (PTE.) LTD.
