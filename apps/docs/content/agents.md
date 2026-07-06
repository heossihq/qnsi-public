---
title: "Host Agents"
description: "Deploy the QNSI Host Agent to discover cryptographic assets across your server fleet and report them to the QNSI platform."
version: 0.1.0
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/qnsi-agent/src/index.ts
  - /apps/qnsi-agent/src/config.ts
  - /apps/qnsi-agent/src/scanner.ts
  - /apps/qnsi-agent/src/reporter.ts
  - /apps/crypto-inventory-service/src/routes/agents.ts
  - /apps/crypto-inventory-service/src/services/agent-auth.ts
---

# Host Agents

The QNSI Host Agent is a lightweight CLI daemon that discovers cryptographic assets on your servers — SSH keys, TLS certificates, PKCS#12/JKS keystores, and active TLS endpoints — and reports them to the QNSI platform for inventory, exposure analysis, and PQC migration planning.

Host Agents are one of the two primary discovery modes in QNSI:

- **Cloud/API connectors** for managed providers with usable APIs
- **QNSI agents** for private, self-hosted, host-local, cluster-local, and on-prem environments

Use agents when the assets are not fully reachable through provider APIs or when you need evidence from inside the customer environment.

## Prerequisites

- Node.js 20 or later
- An active QNSI tenant
- `host-agent-ingestion` feature enabled for your tenant (contact your account team if not enabled)
- `tenant_admin` role to register agents

## Quick Start

In the migration journey, agents support the **Connect** and **Discover** stages. They do not replace application cutover. Migration is only complete once production trust dependencies are consumed from QNSI services and continuously validated by QNSI.

### 1. Register an agent

In the QNSI portal, navigate to **Crypto Posture → Host Agents → Register Agent**.

Give the agent a name (e.g. `web-01-prod`) and click **Register Agent**. You will receive:

- **Agent ID** — a UUID identifying this agent
- **Agent Secret** — a 64-character hex string shown **once only**. Store it securely.

Alternatively, register via the API:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-qnsp-tenant-id: $TENANT_ID" \
  -d '{"name": "web-01-prod"}' \
  https://api.qnsi.heossi.com/proxy/crypto/v1/agents
```

Response:

```json
{
  "agent": {
    "id": "<agent-uuid>",
    "name": "web-01-prod",
    "status": "active",
    "labels": {},
    "lastSeenAt": null,
    "createdAt": "2026-03-06T00:00:00.000Z",
    "updatedAt": "2026-03-06T00:00:00.000Z"
  },
  "secret": "<64-char-hex-secret>",
  "warning": "Store this secret securely. It will not be shown again."
}
```

### 2. Install the agent

```bash
npm install -g @heossi/qnsi-agent
```

Requires Node.js 20+. The package installs the `qnsi-agent` binary globally.

### 3. Configure the agent

Run the interactive setup wizard:

```bash
qnsi-agent configure
```

Or set environment variables directly:

```bash
export QNSI_AGENT_ID=<agent-uuid>
export QNSI_AGENT_SECRET=<64-char-hex-secret>
export QNSI_ENDPOINT=https://api.qnsi.heossi.com
export QNSI_TENANT_ID=<tenant-uuid>
```

Or create a config file at `~/.qnsi-agent/config.env`:

```env
QNSI_AGENT_ID=<agent-uuid>
QNSI_AGENT_SECRET=<64-char-hex-secret>
QNSI_ENDPOINT=https://api.qnsi.heossi.com
QNSI_TENANT_ID=<tenant-uuid>
```

### 4. Run a scan

```bash
# Run once and exit
qnsi-agent run

# Run continuously on the configured interval (default: 5 minutes)
qnsi-agent daemon
```

## Configuration Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `QNSI_AGENT_ID` | ✅ | — | Agent UUID from the QNSI portal |
| `QNSI_AGENT_SECRET` | ✅ | — | 64-char hex secret from registration |
| `QNSI_ENDPOINT` | ✅ | — | `https://api.qnsi.heossi.com` |
| `QNSI_TENANT_ID` | ✅ | — | Your tenant UUID |
| `QNSI_SCAN_PATHS` | ❌ | `/etc/ssl,/etc/pki,/etc/ssh,/home,/root,...` | Comma-separated paths to scan |
| `QNSI_INTERVAL_SECS` | ❌ | `300` | Report interval in daemon mode (30–86400) |
| `QNSI_LOG_LEVEL` | ❌ | `info` | `silent`, `error`, `warn`, `info`, `debug` |
| `QNSI_HOSTNAME` | ❌ | `os.hostname()` | Override the reported hostname |

## What the Agent Discovers

| Asset Type | Examples |
|---|---|
| SSH private keys | `id_rsa`, `id_ecdsa`, `id_ed25519`, `*.key` |
| X.509 certificates | `*.pem`, `*.crt`, `*.cer`, `*.der` |
| PKCS#12 keystores | `*.p12`, `*.pfx` |
| JKS keystores | `*.jks`, `*.keystore` |
| JWT signing keys | Files matching `jwt*.pem`, `signing*.pem` |
| TLS endpoints | Active TLS listeners on common ports (443, 8443, etc.) |

For each asset, the agent reports: type, file path, algorithm, key size (where applicable), expiry date (for certificates), subject/issuer (for certificates), and a SHA-256 fingerprint.

## Running as a System Service

### systemd (Linux)

```ini
[Unit]
Description=QNSI Host Agent
After=network.target

[Service]
ExecStart=/usr/local/bin/qnsi-agent daemon
EnvironmentFile=/etc/qnsi-agent/config.env
Restart=always
RestartSec=30
User=qnsi-agent

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now qnsi-agent
```

### launchd (macOS)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>io.heossi.qnsi-agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/qnsi-agent</string>
    <string>daemon</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>QNSI_AGENT_ID</key>     <string>YOUR_AGENT_ID</string>
    <key>QNSI_AGENT_SECRET</key> <string>YOUR_AGENT_SECRET</string>
    <key>QNSI_ENDPOINT</key>     <string>https://api.qnsi.heossi.com</string>
    <key>QNSI_TENANT_ID</key>    <string>YOUR_TENANT_ID</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

## Agent Status Values

| Status | Meaning |
|---|---|
| `active` | Agent is registered and can submit reports |
| `disabled` | Agent is temporarily suspended — reports will be rejected |
| `revoked` | Agent access is permanently revoked — cannot be re-activated |

## Security Model

The agent authenticates each report using HMAC-SHA256:

1. The bootstrap secret is never stored in plaintext on the server. The server stores `SHA-256(secret)` as the HMAC key.
2. For each report, the agent computes: `HMAC-SHA256(SHA-256(secret), timestamp + "." + nonce + "." + SHA-256(body))`
3. The server verifies the signature, checks the timestamp is within ±300 seconds, and enforces nonce uniqueness (anti-replay).
4. Reports are rejected if the agent is `disabled` or `revoked`.

The agent secret is shown **once** at registration. If lost, rotate it via **Crypto Posture → Host Agents → Rotate Secret** or the API:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-qnsp-tenant-id: $TENANT_ID" \
  https://api.qnsi.heossi.com/proxy/crypto/v1/agents/<agent-id>/rotate
```

## CLI Commands

```
qnsi-agent run         Scan the host and submit a report, then exit
qnsi-agent daemon      Run continuously on the configured interval
qnsi-agent configure   Interactive setup wizard
qnsi-agent status      Print current configuration (no secrets printed)
qnsi-agent version     Print version
qnsi-agent help        Print help
```

## Troubleshooting

**`Invalid agent configuration`** — One or more required environment variables are missing or invalid. Run `qnsi-agent status` to see the current config (secrets are not printed).

**`Report rejected (401)`** — The agent secret is wrong or the agent ID does not exist. Re-register or rotate the secret.

**`Report rejected (403)`** — The `host-agent-ingestion` feature is not enabled for your tenant, or the agent belongs to a different tenant.

**`Agent is not active`** — The agent has been `disabled` or `revoked`. Re-enable it in the portal or register a new agent.

**`Nonce already used (replay detected)`** — The same request was submitted twice within 10 minutes. This is a no-op — the first submission was accepted.

**`Timestamp outside acceptable range`** — The system clock on the agent host is more than 5 minutes out of sync. Sync the clock with NTP.
