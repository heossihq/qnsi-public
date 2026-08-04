---
title: Resilience Utilities (internal - not published)
version: 0.1.1
last_updated: 2026-04-23
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/resilience/package.json
  - /packages/resilience/src/index.ts
  - /packages/resilience/src/circuit-breaker.ts
---

# Resilience Utilities (`internal - not published`)

`@heossihq/qnsi-resilience` is the small shared utility package QNSI's own services and client
layers use for fault handling.

## This is an internal package - it is not on npm

It is **not published**, and there is nothing to install. It ships inside the platform and
is readable in the [public mirror](https://github.com/heossihq/qnsi-public). The page below
documents its behaviour because that behaviour is what backs the retry and timeout semantics
you get from the published SDK.

As an SDK consumer you get this behaviour for free - `@heossihq/qnsi` applies timeouts and
retries on every call, and you configure them on the client:

```typescript
import { QnsiClient } from "@heossihq/qnsi";

const qnsi = new QnsiClient({
  apiKey: process.env.QNSI_API_KEY!,
  timeoutMs: 15_000, // per-request timeout; defaults to 15 000
});
```

## Features

- circuit breakers
- timeout controls
- retry orchestration
- fault-isolation helpers used by shared client layers

## Usage

```ts
// Internal platform source (public mirror) - not an npm import for SDK consumers.
// packages/resilience/src/circuit-breaker.ts
import { CircuitBreaker } from "../../packages/resilience/src/index.js";
```

## Related docs

- [SDK Overview](./overview)
