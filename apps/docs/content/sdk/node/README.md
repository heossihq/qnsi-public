---
title: Node.js SDK
version: 0.1.0
last_updated: 2026-05-05
copyright: © 2026 HEOSSI. All rights reserved.
---

> **Note** — As of 2026-04-30, the per-service `@heossi/qnsi-vault-sdk` package is consolidated into the unified `@heossi/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossi/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.vault./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.

# Node.js SDK

The official QNSI TypeScript / Node.js SDK ships as a single package — `@heossi/qnsi` — covering vault, kms, audit, auth, tenant, access-control, billing, crypto-inventory, storage, search, and ai-orchestrator, plus webhook signature verification. It mirrors the `qnsi` Python / Go / Rust / JVM SDKs byte-for-byte over the same wire contracts.

## Installation

```bash
pnpm add @heossi/qnsi
```

npm and yarn are also supported:

```bash
npm install @heossi/qnsi
# or
yarn add @heossi/qnsi
```

## Requirements

- Node.js 22 or later (the workspace is pinned to 24.14.0 via Volta)
- TypeScript 5.0+ (optional but recommended)

## Quick start

```typescript
import { QnsiClient } from "@heossi/qnsi";

const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

// Vault — store a PQC-encrypted secret
const secret = await qnsi.vault.createSecret({
  name: "openai-api-key",
  payloadB64: Buffer.from("sk-...").toString("base64"),
  algorithm: "ml-kem-768",
});

// KMS — generate a signing key and sign
const key = await qnsi.kms.createKey({ algorithm: "ml-dsa-65", purpose: "signing" });
const signature = await qnsi.kms.sign(key.keyId, new TextEncoder().encode("hello"));

// Audit — emit a tamper-evident event
await qnsi.audit.logEvent({
  eventType: "model.inference",
  payload: { modelId: "gpt-4o", latencyMs: 412 },
});
```

Get a free API key at <https://cloud.qnsi.heossi.com/auth>.

## TypeScript support

The package ships full TypeScript types; no separate `@types/*` install is needed.

```typescript
import type { QnsiClientOptions, CreateSecretRequest } from "@heossi/qnsi";
```

## ESM and CommonJS

`@heossi/qnsi` is published as ESM. CommonJS consumers can use a dynamic import:

```javascript
// ESM
import { QnsiClient } from "@heossi/qnsi";

// CommonJS — dynamic import only
const { QnsiClient } = await import("@heossi/qnsi");
```

## Sub-clients

`QnsiClient` exposes one sub-client per backend service:

| Sub-client            | Surface                                                |
|-----------------------|--------------------------------------------------------|
| `qnsi.vault`          | Secret storage, versioning, rotation                   |
| `qnsi.kms`            | PQC key generation, sign, verify, wrap, unwrap         |
| `qnsi.audit`          | Append events, query the chain, fetch evidence packs   |
| `qnsi.auth`           | Login, refresh, revoke, WebAuthn, PAT                  |
| `qnsi.tenant`         | Provision tenants, manage crypto policy                |
| `qnsi.access`         | RBAC roles, permissions, assignments                   |
| `qnsi.billing`        | Subscriptions, entitlements, meters                    |
| `qnsi.cryptoInventory`| CBOM / cryptographic asset inventory                   |
| `qnsi.storage`        | PQC-encrypted object storage                           |
| `qnsi.search`         | Vector search with SSE-X                               |
| `qnsi.ai`             | AI orchestration, enclave inference                    |

All sub-clients share the same `apiKey`, telemetry, and retry configuration.

## Webhook signature verification

```typescript
import { verifyWebhookSignature } from "@heossi/qnsi";

const isValid = verifyWebhookSignature({
  payload: rawBody,
  signature: req.headers["x-qnsp-signature"]!,
  secret: process.env.QNSI_WEBHOOK_SECRET!,
});
```

## Migration from per-service SDKs

Earlier releases shipped per-service packages (`@heossi/qnsi-vault-sdk`, `@heossi/qnsi-kms-sdk`, etc.). Those are deprecated on npm; `@heossi/qnsi` is the single canonical entry point. The wire contract is unchanged — only the import surface and field names have been unified across languages (`payloadB64`, `payload_b64`, `PayloadB64`).
