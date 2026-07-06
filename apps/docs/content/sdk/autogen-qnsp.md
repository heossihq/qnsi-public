---
title: AutoGen Integration (@heossi/qnsi-autogen-qnsp)
version: 0.2.5
last_updated: 2026-04-30
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/autogen-qnsp/package.json
  - /packages/autogen-qnsp/src/index.ts
  - /packages/autogen-qnsp/src/executor.ts
---

# AutoGen Integration (`@heossi/qnsi-autogen-qnsp`)

QNSI provides an AutoGen-oriented executor that submits code workloads to QNSI AI orchestration endpoints with tenant-scoped activation.

## Install

```bash
pnpm add @heossi/qnsi-autogen-qnsp autogen
```

## Usage

```ts
import { QnsiExecutor } from "@heossi/qnsi-autogen-qnsp";

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
