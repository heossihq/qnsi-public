---
title: LlamaIndex Integration (@heossi/qnsi-llamaindex-qnsp)
version: 0.2.5
last_updated: 2026-04-30
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/llamaindex-qnsp/package.json
  - /packages/llamaindex-qnsp/src/index.ts
  - /packages/llamaindex-qnsp/src/vector-store.ts
---

# LlamaIndex Integration (`@heossi/qnsi-llamaindex-qnsp`)

QNSI exposes an encrypted vector-store adapter for LlamaIndex backed by QNSI search and storage services.

## Install

```bash
pnpm add @heossi/qnsi-llamaindex-qnsp llamaindex
```

## Usage

```ts
import { QnsiVectorStore } from "@heossi/qnsi-llamaindex-qnsp";

const store = new QnsiVectorStore({
	apiKey: process.env.QNSI_API_KEY!,
});
```

## What it provides

- vector insertion and deletion
- encrypted search queries through QNSI search
- document persistence through QNSI storage

## Authentication

The adapter activates through `@heossi/qnsi-sdk-activation`, derives tenant identity from the API key, and uses billing as the source of truth for availability and limits.

## Related docs

- [SDK Overview](./overview)
- [SDK Activation](./sdk-activation)
- [Search SDK](./search-sdk)
- [Storage SDK](./storage-sdk)
