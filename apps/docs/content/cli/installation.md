---
title: Install the QNSI CLI
version: 0.6.0
last_updated: 2026-07-31
description: Install and verify the QNSI command-line interface, authenticate a workspace, run a local cryptography scan, and upgrade the unified package.
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/qnsi/package.json
  - /packages/qnsi/src/cli/index.ts
---

# Install the QNSI CLI

Install the QNSI command-line interface.

The `qnsi` executable is included in the same public package as the TypeScript
SDK. A separate legacy CLI package is not required.

## Package Information

The CLI ships in the unified TypeScript package:

```json
{
  "name": "@heossihq/qnsi",
  "version": "0.6.0",
  "license": "Apache-2.0",
  "bin": {
    "qnsi": "./dist/cli/index.js"
  }
}
```

## Installation Methods

### pnpm (recommended)
```bash
corepack enable
pnpm add -g @heossihq/qnsi
```

### Verify installation
```bash
qnsi --version
# Output: 0.6.0

qnsi --help
```

The installed version should match the package version selected by your lock
or global package manager. Treat the literal version above as the version of
this documentation release, not as an instruction to downgrade a newer
published package.

## Authenticate

For a customer workspace, use an API key and let the CLI resolve its tenant:

```bash
export QNSI_API_KEY="<workspace_api_key>"
qnsi tenant get
```

Internal operators can instead provide a service account and explicit tenant
using `QNSI_SERVICE_ID`, `QNSI_SERVICE_SECRET` and `QNSI_TENANT_ID`. Do not
distribute service-account credentials as a customer quick-start.

The CLI defaults to `https://api.qnsi.heossi.com`. Set
`QNSI_EDGE_GATEWAY_URL` only for an approved alternate or local deployment.
Production service URLs must use HTTPS.

## Run a local cryptography scan

The source scanner runs locally and does not require repository upload:

```bash
qnsi crypto scan . --output json
```

Use `--upload` only when you intentionally want to send the findings to the
tenant inventory and have configured the required scanner-agent credentials.
Review exclusions and generated evidence before uploading.

## Upgrade

```bash
pnpm update -g @heossihq/qnsi
```

After upgrading, run `qnsi --version` and one read-only command before using
the CLI for a production mutation. Pin the package version in controlled build
environments.

## Uninstall

```bash
pnpm remove -g @heossihq/qnsi
```

Uninstalling the executable does not revoke API keys, cached service
credentials or previously uploaded evidence. Revoke credentials separately
and remove local configuration according to your workstation policy.

## Troubleshooting

- `401` means the credential was missing or rejected.
- `403` means the authenticated identity or tenant lacks the required
  permission.
- A tenant error with a customer API key usually means activation or tenant
  resolution did not complete.
- A connection to `localhost` means an explicit local service URL is present;
  inspect the resolved `QNSI_*_SERVICE_URL` variables.

Use `--verbose` for endpoint and request diagnostics, but never share output
until it has been checked for tenant identifiers and operational metadata.
