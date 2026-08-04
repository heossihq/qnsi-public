---
title: SDK Configuration
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---

> **Note** - As of 2026-04-30, the per-service `@heossihq/qnsi-auth-sdk` package is consolidated into the unified `@heossihq/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossihq/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.auth./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.

# SDK Configuration

Configure QNSI SDKs for your environment.

## Configuration options

SDK configuration is per-service. QNSI publishes separate SDK packages (for example `@heossihq/qnsi-auth-sdk`, `@heossihq/qnsi-vault-sdk`, `@heossihq/qnsi-storage-sdk`).

Most SDKs share these common options:

| Option | Required | Description |
|--------|----------|-------------|
| `baseUrl` | Yes | Service base URL (for example `https://api.qnsi.heossi.com`) |
| `apiKey` | No | Bearer token used for `Authorization: Bearer <token>` |
| `timeoutMs` | No | Request timeout in ms |

Some SDKs also require tenant context (for example `@heossihq/qnsi-storage-sdk` sends `x-tenant-id` based on the configured `tenantId`).

## Node.js configuration

```typescript
import { AuthClient, StorageClient, VaultClient } from "@heossihq/qnsi";

const authClient = new AuthClient({
  baseUrl: "https://api.qnsi.heossi.com",
  apiKey: process.env.QNSI_API_KEY,
});

const vaultClient = new VaultClient({
  baseUrl: "https://api.qnsi.heossi.com/proxy/vault",
  apiKey: process.env.QNSI_API_KEY,
});

const storageClient = new StorageClient({
  baseUrl: "https://api.qnsi.heossi.com/proxy/storage",
  apiKey: process.env.QNSI_API_KEY,
  tenantId: process.env.QNSI_TENANT_ID,
});
```
