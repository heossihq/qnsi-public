---
title: SDK Retries
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

# SDK Retries

Some SDKs implement automatic retry with exponential backoff.

## Default behavior

- Max retries: 3
- Initial delay: 1000ms
- Max delay: 30 seconds
- Backoff multiplier: 2

## Retryable conditions

### HTTP status codes
- 429: Rate limited
- 502: Bad gateway
- 503: Service unavailable
- 504: Gateway timeout

### Network errors
- Connection refused
- Connection reset
- DNS resolution failure
- Timeout

## Configuration

### Node.js
```typescript
import { AuthClient } from "@heossihq/qnsi";

const client = new AuthClient({
	baseUrl: "http://localhost:8081",
	apiKey: process.env.QNSI_API_KEY,
	maxRetries: 5,
	retryDelayMs: 1_000,
});
```

## Rate limit handling

When rate limited (429):
1. Check `Retry-After` header
2. Wait specified duration
3. Retry request

SDKs that implement retries will:
1. Read `Retry-After` (if present)
2. Delay and retry up to `maxRetries`

## Disabling retries

```typescript
import { AuthClient } from "@heossihq/qnsi";

const client = new AuthClient({
	baseUrl: "http://localhost:8081",
	apiKey: process.env.QNSI_API_KEY,
	maxRetries: 0,
});
```

## Idempotency

Use idempotency keys at the API layer where supported.
