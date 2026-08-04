---
title: LlamaIndex Integration (@heossihq/qnsi/llamaindex)
version: 0.6.0
last_updated: 2026-07-20
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/qnsi/package.json
  - /packages/qnsi/src/llamaindex/index.ts
  - /packages/qnsi/src/llamaindex/vector-store.ts
---

# LlamaIndex Integration (`@heossihq/qnsi/llamaindex`)

QNSI exposes an encrypted vector-store adapter for LlamaIndex backed by QNSI search and storage services.

## Install

```bash
pnpm add @heossihq/qnsi llamaindex
```

## Usage

```ts
import { QnsiVectorStore } from "@heossihq/qnsi/llamaindex";

const store = new QnsiVectorStore({
	apiKey: process.env.QNSI_API_KEY!,
});
```

## What it provides

- vector insertion and deletion
- encrypted search queries through QNSI search
- document persistence through QNSI storage

## Authentication

The adapter uses the activation client bundled in `@heossihq/qnsi`, derives tenant identity from the API key, and uses billing as the source of truth for availability and limits.

## Related docs

- [SDK Overview](./overview)
- [SDK Activation](./sdk-activation)
- [Search SDK](./search-sdk)
- [Storage SDK](./storage-sdk)
