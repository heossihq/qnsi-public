---
title: LangChain Integration (@heossi/qnsi-langchain-qnsp)
version: 0.1.7
last_updated: 2026-04-30
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/langchain-qnsp/package.json
  - /packages/langchain-qnsp/src/index.ts
  - /packages/langchain-qnsp/src/toolkit.ts
---

# LangChain Integration (`@heossi/qnsi-langchain-qnsp`)

QNSI provides a LangChain toolkit that wraps tenant-scoped vault, KMS, and audit operations behind billing-backed SDK activation.

## Install

```bash
pnpm add @heossi/qnsi-langchain-qnsp @langchain/core
```

## Usage

```ts
import { QnsiToolkit } from "@heossi/qnsi-langchain-qnsp";

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

The toolkit activates with `@heossi/qnsi-sdk-activation`, resolves tenant context from the API key, and respects billing entitlements before tools are used.

## Related docs

- [SDK Overview](./overview)
- [SDK Activation](./sdk-activation)
- [Vault SDK](./vault-sdk)
- [KMS Client](./kms-client)
- [Audit SDK](./audit-sdk)
