---
title: LangChain Integration (@heossihq/qnsi/langchain)
version: 0.6.0
last_updated: 2026-07-20
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/qnsi/package.json
  - /packages/qnsi/src/langchain/index.ts
  - /packages/qnsi/src/langchain/toolkit.ts
---

# LangChain Integration (`@heossihq/qnsi/langchain`)

QNSI provides a LangChain toolkit that wraps tenant-scoped vault, KMS, and audit operations behind billing-backed SDK activation.

## Install

```bash
pnpm add @heossihq/qnsi @langchain/core
```

## Usage

```ts
import { QnsiToolkit } from "@heossihq/qnsi/langchain";

const toolkit = new QnsiToolkit({
	apiKey: process.env.QNSI_API_KEY!,
});

const tools = toolkit.getTools();
```

## What it exposes

- vault read/write/rotate tools
- KMS sign and verify tools
- audit logging helpers for agent actions

## Authentication

The toolkit uses the activation client bundled in `@heossihq/qnsi`, resolves tenant context from the API key, and respects billing entitlements before tools are used.

## Related docs

- [SDK Overview](./overview)
- [SDK Activation](./sdk-activation)
- [Vault SDK](./vault-sdk)
- [KMS Client](./kms-client)
- [Audit SDK](./audit-sdk)
