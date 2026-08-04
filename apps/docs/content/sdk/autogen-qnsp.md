---
title: AutoGen Integration (@heossihq/qnsi/autogen)
version: 0.6.0
last_updated: 2026-07-20
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/qnsi/package.json
  - /packages/qnsi/src/autogen/index.ts
  - /packages/qnsi/src/autogen/executor.ts
---

# AutoGen Integration (`@heossihq/qnsi/autogen`)

QNSI provides an AutoGen-oriented executor that submits code workloads to QNSI AI orchestration endpoints with tenant-scoped activation.

## Install

```bash
pnpm add @heossihq/qnsi autogen
```

## Usage

```ts
import { QnsiExecutor } from "@heossihq/qnsi/autogen";

const executor = new QnsiExecutor({
	apiKey: process.env.QNSI_API_KEY!,
});
```

## What it provides

- code execution job submission
- execution status polling
- activation-backed tenant resolution and entitlement checks

## Related docs

- [SDK Overview](./overview)
- [SDK Activation](./sdk-activation)
- [AI SDK](./ai-sdk)
