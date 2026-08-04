---
title: Development Environment
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

# Development Environment

Configure QNSI for local development.

## Local setup

### Containers (OrbStack)

Local development expects Docker-compatible containers (OrbStack on macOS).

Required containers:
```
qnsi-postgres
qnsi-redis
qnsi-clamav
```

Network:
```
qnsi-net
```

### Start backend services
From the repo root:
```bash
node scripts/dev/start-backend-cluster.mjs
```

### Environment variables
```bash
export QNSI_EDGE_GATEWAY_URL=http://localhost:8107
export QNSI_TENANT_ID=<tenant_uuid>
export QNSI_SERVICE_ID=<service_id>
export QNSI_SERVICE_SECRET=<service_secret>
export QNSI_VERBOSE=true
```

## Development features

### Relaxed validation
- Longer token TTLs
- Relaxed rate limits
- Verbose error messages

### Test data
Pre-seeded test data:
- Create a test tenant via `node scripts/dev/create-dev-tenant.mjs` and export the returned tenant UUID.

### Mock HSM
Development uses software HSM:
```yaml
hsm:
  provider: softhsm
  slot: 0
```

## SDK configuration

```typescript
import { AuthClient, VaultClient } from "@heossihq/qnsi";

const auth = new AuthClient({
	baseUrl: process.env["QNSI_EDGE_GATEWAY_URL"] ?? "http://localhost:8107",
});

const token = await auth.login({
	email: "user@example.com",
	password: "<password>",
	tenantId: "<tenant_uuid>",
});

const vault = new VaultClient({
	baseUrl: process.env["QNSI_EDGE_GATEWAY_URL"] ?? "http://localhost:8107",
	apiKey: token.accessToken,
});

await vault.createSecret({
	tenantId: "<tenant_uuid>",
	name: "example-secret",
	payload: "<base64_payload>",
});
```

## Debugging

Enable verbose CLI logging:
```bash
export QNSI_VERBOSE=true
```

If you see HTTPS validation errors in development, set:
```bash
export NODE_ENV=development
```

## Limitations

Development environment:
- Not for production data
- Single-node deployment
- No HSM security
- Limited persistence
