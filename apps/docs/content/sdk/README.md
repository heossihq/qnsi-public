---
title: SDK Reference
description: Per-language SDKs (TypeScript, Python, Go, Rust, JVM/Android) and SDK-level guides covering authentication, retries, and error handling.
---

> **Note** — As of 2026-04-30, the per-service `@heossi/qnsi-auth-sdk` package is consolidated into the unified `@heossi/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossi/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.auth./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# SDK Reference

Per-language SDKs (TypeScript, Python, Go, Rust, JVM/Android) and SDK-level guides covering authentication, retries, and error handling.

## Pages

- [Access Control SDK (@heossi/qnsi-access-control-sdk)](./access-control-sdk)
- [AI SDK (@heossi/qnsi-ai-sdk)](./ai-sdk)
- [Audit SDK (@heossi/qnsi-audit-sdk)](./audit-sdk)
- [Auth SDK (@heossi/qnsi-auth-sdk)](./auth-sdk)
- [SDK Authentication](./authentication)
- [AutoGen Integration (@heossi/qnsi-autogen-qnsp)](./autogen-qnsp)
- [Billing SDK (@heossi/qnsi-billing-sdk)](./billing-sdk)
- [Browser SDK (@heossi/qnsi-browser)](./browser-sdk)
- [SDK Compatibility](./compatibility)
- [SDK Configuration](./configuration)
- [Crypto Attestation API](./crypto-attestation-api)
- [Crypto Inventory SDK (@heossi/qnsi-crypto-inventory-sdk)](./crypto-inventory-sdk)
- [SDK Error Handling](./error-handling)
- [KMS Client (@heossi/qnsi-kms-client)](./kms-client)
- [LangChain Integration (@heossi/qnsi-langchain-qnsp)](./langchain-qnsp)
- [Supported Languages](./languages)
- [LlamaIndex Integration (@heossi/qnsi-llamaindex-qnsp)](./llamaindex-qnsp)
- [MCP Server (@heossi/qnsi-mcp)](./mcp-server)
- [Memory Zeroization](./memory-zeroization)
- [SDK Overview](./overview)
- [Resilience Utilities (@heossi/qnsi-resilience)](./resilience)
- [SDK Retries](./retries)
- [SDK Activation](./sdk-activation)
- [Search SDK (@heossi/qnsi-search-sdk)](./search-sdk)
- [Storage SDK (@heossi/qnsi-storage-sdk)](./storage-sdk)
- [Tenant SDK (@heossi/qnsi-tenant-sdk)](./tenant-sdk)
- [Thread Safety](./thread-safety)
- [Vault SDK (@heossi/qnsi-vault-sdk)](./vault-sdk)

## Sections

- [Go](./go)
- [Java](./java)
- [Node](./node)
- [Python](./python)
- [Rust](./rust)

