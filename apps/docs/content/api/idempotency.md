---
title: Idempotency
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/edge-gateway/src/routes/proxy.ts
  - /apps/platform-api/src/config/env.ts
---
# Idempotency

Idempotency is supported on a limited set of endpoints that accept an `Idempotency-Key` header.

## Current behavior

Idempotency is implemented by individual services where applicable. The edge gateway does not provide a global idempotency layer.

## Request Header

```
Idempotency-Key: <unique-uuid>
```

## Supported endpoints

Examples in this repo:
- `POST /auth/email/addon-request` (header is accepted and logged; replay semantics are not implemented here)
- AI Orchestrator endpoints (e.g., `POST /ai/v1/workloads`, `POST /ai/v1/inference`) support replay and may return `200` with `x-idempotency-replayed: true`

## Notes

- Treat `Idempotency-Key` as opaque and unique per logical operation.
- When an endpoint does not support idempotency, clients should implement careful retry logic.

## Current Workarounds

- Use unique identifiers in request body where applicable
- Implement client-side deduplication
- Query for resource existence before creation
- Use conditional requests where supported
