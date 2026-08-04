# @heossihq/qnsi-agent

QNSI Host Agent - discovers cryptographic assets on your servers and reports them to the QNSI platform for inventory, exposure analysis, and PQC migration planning.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
npm install -g @heossihq/qnsi-agent
```

Requires Node.js 20+. Installs the `qnsp-agent` binary globally.

## Quick Start

### 1. Create a QNSI account

Sign up in one click at [cloud.qnsi.heossi.com/auth](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email.

### 2. Register an agent

In the QNSI portal, go to **Crypto Posture → Host Agents → Register Agent**. Copy the **Agent ID** and **Agent Secret** (shown once only).

Or via API:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-qnsp-tenant-id: $TENANT_ID" \
  -d '{"name": "web-01-prod"}' \
  https://api.qnsi.heossi.com/proxy/crypto/v1/agents
```

### 3. Configure and run

```bash
export QNSP_AGENT_ID=<agent-uuid>
export QNSP_AGENT_SECRET=<64-char-hex-secret>
export QNSP_ENDPOINT=https://api.qnsi.heossi.com
export QNSP_TENANT_ID=<tenant-uuid>

qnsp-agent run      # scan once and exit
qnsp-agent daemon   # run continuously (default: every 5 minutes)
```

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `QNSP_AGENT_ID` | ✅ | - | Agent UUID from the QNSI portal |
| `QNSP_AGENT_SECRET` | ✅ | - | 64-char hex secret from registration |
| `QNSP_ENDPOINT` | ✅ | - | `https://api.qnsi.heossi.com` |
| `QNSP_TENANT_ID` | ✅ | - | Your tenant UUID |
| `QNSP_SCAN_PATHS` | ❌ | `/etc/ssl,/etc/pki,/etc/ssh,/home,/root,...` | Comma-separated paths to scan |
| `QNSP_INTERVAL_SECS` | ❌ | `300` | Daemon report interval in seconds (30-86400) |
| `QNSP_LOG_LEVEL` | ❌ | `info` | `silent`, `error`, `warn`, `info`, `debug` |
| `QNSP_HOSTNAME` | ❌ | `os.hostname()` | Override the reported hostname |

## What the Agent Discovers

| Asset Type | Examples |
|---|---|
| SSH private keys | `id_rsa`, `id_ecdsa`, `id_ed25519`, `*.key` |
| X.509 certificates | `*.pem`, `*.crt`, `*.cer`, `*.der` |
| PKCS#12 keystores | `*.p12`, `*.pfx` |
| JKS keystores | `*.jks`, `*.keystore` |
| JWT signing keys | `jwt*.pem`, `signing*.pem` |
| TLS endpoints | Active listeners on ports 443, 8443, etc. |

## CLI Commands

```
qnsp-agent run         Scan the host once and exit
qnsp-agent daemon      Run continuously on the configured interval
qnsp-agent configure   Interactive setup wizard
qnsp-agent status      Print current config (secrets redacted)
qnsp-agent version     Print version
qnsp-agent help        Print help
```

## Documentation

- [Host Agents Guide](https://docs.qnsi.heossi.com/agents)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 20.0.0
- An active QNSI tenant - [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email
- `host-agent-ingestion` feature enabled (contact your account team if not enabled)

## License

[Apache-2.0](../../LICENSE.md)

© 2026 QNSI - HEOSSI, Singapore
