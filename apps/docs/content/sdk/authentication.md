---
title: SDK Authentication
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---

> **Note** — As of 2026-04-30, the per-service `@heossi/qnsi-auth-sdk` package is consolidated into the unified `@heossi/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossi/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.auth./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.

# SDK Authentication

SDKs authenticate by sending `Authorization: Bearer <token>`.

## Credential types

### User login (auth-service)
Use `@heossi/qnsi-auth-sdk` to obtain an access token.

```typescript
import { AuthClient } from "@heossi/qnsi-auth-sdk";

const auth = new AuthClient({
	baseUrl: "http://localhost:8081",
	apiKey: process.env.QNSI_API_KEY,
});

const token = await auth.login({
	email: "user@example.com",
	password: "<password>",
	tenantId: "<tenant_uuid>",
});
```

### Tenant API keys
Use tenant API keys for workload and data-plane access only: SDKs, CI jobs, agents, and backend
services calling product APIs such as Vault, KMS, Storage, Audit, Search, and AI. Do not use
tenant API keys for billing, identity, or tenant administration.

### Personal access tokens (PATs)
Use PATs when a human is acting programmatically as themselves from the CLI, local scripts, or
debugging workflows. PATs are user-scoped, revocable, auditable, and should be short-lived.

### Service token (service accounts)
For server-to-server integrations that need a durable machine identity, request a service token and
use it as a Bearer token.

```typescript
import { requestServiceToken } from "@heossi/qnsi-auth-sdk";

const token = await requestServiceToken({
	authServiceUrl: "http://localhost:8081",
	serviceId: "<service_id>",
	serviceSecret: "<service_secret>",
	audience: "internal-service",
});
```

### Using a token with other SDKs

```typescript
import { VaultClient } from "@heossi/qnsi-vault-sdk";

const vault = new VaultClient({
	baseUrl: "http://localhost:8090",
	apiKey: token.accessToken,
});
```

## Refresh tokens

If you use refresh tokens, call `auth.refreshToken(...)` and update the `apiKey` you pass to other clients.

## Recommended credential model

- Tenant API keys: tenant-scoped workload access to product APIs
- PATs: user-scoped programmatic access for CLI and debugging
- Service accounts: durable machine identities for enterprise automation
- Ops/control credentials: internal QNSI-only control-plane access, never customer-facing
