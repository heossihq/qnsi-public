---
title: "SDK Activation"
description: "How QNSI SDKs activate and verify licensing at startup — transparent to end developers, no manual steps required."
version: 0.1.5
last_updated: 2026-04-30
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
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

# SDK Activation

All `@heossi/qnsi-*` SDKs perform a lightweight activation handshake when first initialised. This ties SDK usage to a registered QNSI account and enforces entitlement checks without requiring any additional code from the developer.

This matters operationally because QNSI treats SDK use as part of the migration and consumption path. Activation is how the platform binds SDK traffic to a real tenant, plan, and entitlement set instead of allowing anonymous or untracked trust operations.

## How it works

When you call `new VaultClient(config)` (or any other SDK constructor), the SDK internally calls `activateSdk()` from `@heossi/qnsi-sdk-activation`:

1. Validates the API key format
2. Sends a lightweight activation request to `https://api.qnsi.heossi.com`
3. Receives a signed activation receipt valid for the session
4. All subsequent API calls include the activation receipt for entitlement enforcement

This happens **once per SDK instance** and adds less than 50 ms on a cold start.

## Developer experience

No code changes required. The activation is transparent:

```typescript
import { VaultClient } from "@heossi/qnsi-vault-sdk";

// Activation happens here automatically
const vault = new VaultClient({
  apiKey: process.env.QNSI_API_KEY!,
  tenantId: process.env.QNSI_TENANT_ID!,
});

// All subsequent calls are already activated
const secret = await vault.createSecret({ name: "db-password", value: "s3cr3t" });
```

## Activation errors

If activation fails, the SDK constructor throws an `ActivationError` with a `code` field:

| Code | Meaning |
|---|---|
| `INVALID_API_KEY` | API key format is invalid or the key does not exist |
| `TENANT_SUSPENDED` | Your QNSI tenant has been suspended — contact support |
| `ENTITLEMENT_MISSING` | Your plan does not include this SDK — upgrade at [cloud.qnsi.heossi.com](https://cloud.qnsi.heossi.com) |
| `ACTIVATION_TIMEOUT` | Could not reach the QNSI platform within the timeout — check connectivity |
| `ACTIVATION_FAILED` | Unexpected activation failure — retry or contact support |

```typescript
import { ActivationError } from "@heossi/qnsi-sdk-activation";

try {
  const vault = new VaultClient({ apiKey, tenantId });
} catch (err) {
  if (err instanceof ActivationError) {
    console.error("Activation failed:", err.code, err.message);
  }
  throw err;
}
```

## Offline / air-gapped environments

For air-gapped deployments where outbound calls to `api.qnsi.heossi.com` are not permitted, contact your QNSI account team to obtain a **static activation token**. Pass it via the `activationToken` option:

```typescript
const vault = new VaultClient({
  apiKey: process.env.QNSI_API_KEY!,
  tenantId: process.env.QNSI_TENANT_ID!,
  activationToken: process.env.QNSI_ACTIVATION_TOKEN,
});
```

Static tokens are cryptographically signed and have a fixed expiry date agreed with your account team.

## Related

- [SDK Overview](./overview)
- [Configuration](./configuration)
- [Error Handling](./error-handling)
- [API Authentication](../api/authentication)
- [Migration Journey](../migration/journey)
