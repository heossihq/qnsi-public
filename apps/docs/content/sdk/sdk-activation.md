---
title: "SDK Activation"
description: "How QNSI SDKs activate and verify licensing at startup - transparent to end developers, no manual steps required."
version: 0.6.0
last_updated: 2026-07-20
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /packages/qnsi/src/_activation/activation-client.ts
  - /packages/qnsi/src/_activation/types.ts
  - /packages/qnsi/src/_internal.ts
---

> **Note** - As of 2026-04-30, the per-service `@heossihq/qnsi-vault-sdk` package is consolidated into the unified `@heossihq/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossihq/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.vault./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.

# SDK Activation

The unified `@heossihq/qnsi` SDK performs a lightweight activation handshake before its first service operation. Applications can call `ensureActivated()` at startup when they prefer to surface credential or entitlement errors before serving traffic.

This matters operationally because QNSI treats SDK use as part of the migration and consumption path. Activation is how the platform binds SDK traffic to a real tenant, plan, and entitlement set instead of allowing anonymous or untracked trust operations.

## How it works

The activation client bundled inside `@heossihq/qnsi`:

1. Validates the API key format
2. Sends a lightweight activation request to `https://api.qnsi.heossi.com`
3. Receives an opaque activation token with an explicit expiry
4. All subsequent API calls include the activation receipt for entitlement enforcement

Successful activations are cached until shortly before expiry. Network latency depends on the deployment and is not represented as a fixed client-side guarantee.

## Developer experience

No code changes required. The activation is transparent:

```typescript
import { QnsiClient } from "@heossihq/qnsi";

const qnsi = new QnsiClient({
  apiKey: process.env.QNSI_API_KEY!,
});

// Optional eager handshake; service calls also ensure activation.
await qnsi.ensureActivated();
```

## Activation errors

If activation fails, the handshake throws an `SdkActivationError_` with a `code` field:

| Code | Meaning |
|---|---|
| `INVALID_API_KEY` | API key format is invalid or the key does not exist |
| `ACCOUNT_SUSPENDED` | Your QNSI account is suspended - contact support |
| `TIER_INSUFFICIENT` | Your plan does not include the requested capability |
| `RATE_LIMITED` | Activation is temporarily rate limited |
| `SERVICE_UNAVAILABLE` | The activation service could not be reached or returned an invalid response |

```typescript
import { QnsiClient } from "@heossihq/qnsi";
import { SdkActivationError_ } from "@heossihq/qnsi/activation";

try {
  const qnsi = new QnsiClient({ apiKey });
  await qnsi.ensureActivated();
} catch (err) {
  if (err instanceof SdkActivationError_) {
    console.error("Activation failed:", err.code, err.message);
  }
  throw err;
}
```

## Offline / air-gapped environments

Air-gapped activation is deployment-specific and is not enabled by a public static-token constructor option. Use the supported deployment bundle and account-team procedure for your isolated environment; do not copy a cloud API key or activation response into offline configuration.

## Related

- [SDK Overview](./overview)
- [Configuration](./configuration)
- [Error Handling](./error-handling)
- [API Authentication](../api/authentication)
- [Migration Journey](../migration/journey)
