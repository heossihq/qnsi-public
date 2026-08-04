---
title: SDK Reference
description: Per-language SDKs (TypeScript, Python, Go, Rust, JVM/Android) and SDK-level guides covering authentication, retries, and error handling.
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


# SDK Reference

Per-language SDKs (TypeScript, Python, Go, Rust, JVM/Android) and SDK-level guides covering authentication, retries, and error handling.

## Pages

The pages below document each service's client **shape** - the methods, request bodies and
error codes. They are accurate at the wire level. They are **not** separate npm packages:
every client below ships **inside `@heossihq/qnsi`** and is reached as `qnsi.<service>` (or
imported by name from `@heossihq/qnsi`). There are exactly two public npm packages -
`@heossihq/qnsi` and `@heossihq/qnsi-mcp`.

- [Access Control client](./access-control-sdk) - `qnsi.access`
- [AI client](./ai-sdk) - `qnsi.ai`
- [Audit client](./audit-sdk) - `qnsi.audit`
- [Auth client](./auth-sdk) - `qnsi.auth`
- [SDK Authentication](./authentication)
- [AutoGen Integration](./autogen-qnsp)
- [Billing client](./billing-sdk) - `qnsi.billing`
- [Browser SDK](./browser-sdk)
- [SDK Compatibility](./compatibility)
- [SDK Configuration](./configuration)
- [Crypto Attestation API](./crypto-attestation-api)
- [Crypto Inventory client](./crypto-inventory-sdk) - `qnsi.cryptoInventory`
- [SDK Error Handling](./error-handling)
- [KMS client](./kms-client) - `qnsi.kms`
- [LangChain Integration](./langchain-qnsp)
- [Supported Languages](./languages)
- [LlamaIndex Integration](./llamaindex-qnsp)
- [MCP Server (@heossihq/qnsi-mcp)](./mcp-server)
- [Memory Zeroization](./memory-zeroization)
- [SDK Overview](./overview)
- [Resilience Utilities](./resilience)
- [SDK Retries](./retries)
- [SDK Activation](./sdk-activation)
- [Search client](./search-sdk) - `qnsi.search`
- [Storage client](./storage-sdk) - `qnsi.storage`
- [Tenant client](./tenant-sdk) - `qnsi.tenant`
- [Thread Safety](./thread-safety)
- [Vault client](./vault-sdk) - `qnsi.vault`

## Sections

- [Go](./go)
- [Java](./java)
- [Node](./node)
- [Python](./python)
- [Rust](./rust)

