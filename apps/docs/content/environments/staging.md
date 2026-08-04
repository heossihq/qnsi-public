---
title: Staging Environment
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

# Staging Environment

Pre-production environment for testing.

## Purpose

- Integration testing
- Performance testing
- Pre-release validation
- Training and demos

## Access

```
Base URL: provided per deployment
```

## Configuration

### SDK
```typescript
import { VaultClient, requestServiceToken } from "@heossihq/qnsi";

const baseUrl = process.env["QNSI_BASE_URL"] ?? "";
const token = await requestServiceToken({
  authServiceUrl: baseUrl,
  serviceId: process.env["QNSI_SERVICE_ID"] ?? "",
  serviceSecret: process.env["QNSI_SERVICE_SECRET"] ?? "",
  audience: "internal-service",
});
if (!token) {
  throw new Error("Failed to obtain service token");
}

const vault = new VaultClient({ baseUrl, apiKey: token.accessToken });
await vault.createSecret({ tenantId: "<tenant_uuid>", name: "example-secret", payload: "<base64_payload>" });
```

### CLI
```bash
export QNSI_EDGE_GATEWAY_URL=<staging_base_url>
export QNSI_TENANT_ID=<tenant_uuid>
export QNSI_SERVICE_ID=<service_id>
export QNSI_SERVICE_SECRET=<service_secret>
```

## Characteristics

### Similar to production
- Same API versions
- Same authentication
- Same rate limits (reduced)
- Real HSM (shared)

### Differences from production
- Separate data
- Lower SLAs
- More frequent updates
- Test data allowed

## Data management

- Data reset weekly (Sundays)
- No production data allowed
- Test fixtures available

## Rate limits

Staging has reduced limits:
| Endpoint | Production | Staging |
|----------|------------|---------|
| Auth | 100/s | 10/s |
| KMS | 50/s | 5/s |
| Vault | 50/s | 5/s |

## Monitoring

Staging telemetry endpoints are provided separately per deployment.
