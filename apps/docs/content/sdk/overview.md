---
title: SDK Overview
version: 0.3.6
last_updated: 2026-04-30
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/auth-sdk/package.json
  - /packages/vault-sdk/package.json
  - /packages/kms-client/package.json
  - /packages/storage-sdk/package.json
  - /packages/crypto-inventory-sdk/package.json
  - /packages/browser-sdk/package.json
  - /packages/mcp-server/package.json
  - /sdks/python/qnsi/pyproject.toml
  - /sdks/go/qnsi/go.mod
  - /sdks/rust/qnsi/Cargo.toml
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


# SDK Overview

QNSI provides official SDKs in **five languages** — TypeScript/Node.js, Python, Go, Rust, and JVM/Android (Kotlin + Java) — all built on the same wire contracts, the same algorithm names, and the same FIPS 203 / 204 / 205 posture. Pick whichever fits your stack and the byte-for-byte outputs round-trip across languages.

All language families ship as a **single package per language** with the same 11-service surface. The 11 per-service `@heossi/qnsi-*-sdk` packages on npm are deprecated in favour of `@heossi/qnsi` (they continue to install but are no longer the recommended entry point). See [Supported Languages](./languages) for the full feature matrix and [the @heossi/qnsi README](https://github.com/heossihq/qnsi-public/blob/main/packages/qnsi/README.md#migration-from-per-service-sdks) for the import-by-import migration guide.

The SDKs include tenant crypto policy integration, NIST algorithm name utilities, and support for the latest platform capabilities including risk-based authentication, JIT access, AI orchestration, and real-time streaming.

For migration work, the SDKs are the application cutover surface. Discovery typically starts with cloud/API connectors or QNSI agents, but migration is only complete when production trust calls move onto QNSI SDKs, APIs, or governed platform services.

## Single-package SDKs (recommended for all languages)

| Language | Package | Version | Source | Activation `sdkId` |
|---|---|---|---|---|
| TypeScript / Node.js | [`@heossi/qnsi`](https://www.npmjs.com/package/@heossi/qnsi) | 0.1.0 | [`packages/qnsi/`](https://github.com/heossihq/qnsi-public/tree/main/packages/qnsi) | `qnsi` |
| Python | [`qnsi`](https://pypi.org/project/qnsi/) | 0.3.0 | [`sdks/python/qnsi/`](https://github.com/heossihq/qnsi-public/tree/main/sdks/python/qnsi) | `qnsi-python` |
| Go | `github.com/heossihq/qnsi-public/sdks/go/qnsi` | 0.2.0 | [`sdks/go/qnsi/`](https://github.com/heossihq/qnsi-public/tree/main/sdks/go/qnsi) | `qnsi-go` |
| Rust | [`qnsi`](https://crates.io/crates/qnsi) | 0.2.0 | [`sdks/rust/qnsi/`](https://github.com/heossihq/qnsi-public/tree/main/sdks/rust/qnsi) | `qnsi-rust` |
| JVM / Android (Kotlin + Java) | [`io.heossi:qnsi`](https://central.sonatype.com/artifact/io.heossi/qnsi) | 0.1.0 | [`sdks/jvm/`](https://github.com/heossihq/qnsi-public/tree/main/sdks/jvm) | `qnsi-jvm` |

Each package exposes the same 11 service modules — vault, kms, audit, auth, tenant, access, billing, crypto-inventory, storage, search, ai — plus webhook signature verification and (where the language supports it) local PQC primitives via the language's liboqs binding.

## Deprecated TypeScript per-service packages

These were the original split before consolidation. They remain installable for transitional purposes; new code should use `@heossi/qnsi` directly.

| Package | Last version | Status |
|---------|---|---|
| `@heossi/qnsi-auth-sdk` | 0.3.6 | Deprecated → `@heossi/qnsi.auth` |
| `@heossi/qnsi-vault-sdk` | 0.3.9 | Deprecated → `@heossi/qnsi.vault` |
| `@heossi/qnsi-kms-client` | 0.2.6 | Deprecated → `@heossi/qnsi.kms` |
| `@heossi/qnsi-storage-sdk` | 0.3.6 | Deprecated → `@heossi/qnsi.storage` |
| `@heossi/qnsi-audit-sdk` | 0.3.6 | Deprecated → `@heossi/qnsi.audit` |
| `@heossi/qnsi-access-control-sdk` | 0.3.6 | Deprecated → `@heossi/qnsi.access` |
| `@heossi/qnsi-billing-sdk` | 0.2.6 | Deprecated → `@heossi/qnsi.billing` |
| `@heossi/qnsi-search-sdk` | 0.2.10 | Deprecated → `@heossi/qnsi.search` |
| `@heossi/qnsi-tenant-sdk` | 0.3.6 | Deprecated → `@heossi/qnsi.tenant` |
| `@heossi/qnsi-ai-sdk` | 0.1.11 | Deprecated → `@heossi/qnsi.ai` |
| `@heossi/qnsi-crypto-inventory-sdk` | 0.3.6 | Deprecated → `@heossi/qnsi.cryptoInventory` |
| `@heossi/qnsi-browser` | 0.1.4 | **Not deprecated** — browser-side PQC primitives, distinct purpose from `@heossi/qnsi` (which is Node.js-only) |

## Developer tooling

These packages are part of the public integration surface, but they are not the per-service SDK clients listed above:

| Package | Version | Description |
|---------|---------|-------------|
| `@heossi/qnsi-cli` | 0.1.12 | Command-line automation and CI/CD workflows |
| `@heossi/qnsi-mcp` | 0.1.3 | Official MCP server for AI assistants using QNSI tools |
| `@heossi/qnsi-sdk-activation` | 0.1.5 | Shared activation and entitlement bootstrap used by SDK packages |
| `@heossi/qnsi-langchain-qnsp` | 0.1.7 | LangChain integration package |
| `@heossi/qnsi-llamaindex-qnsp` | 0.2.5 | LlamaIndex integration package |
| `@heossi/qnsi-autogen-qnsp` | 0.2.5 | AutoGen integration package |

## How SDKs fit into the migration journey

The platform journey is:

**Connect → Discover → Analyze → Govern → Migrate → Validate → Operate**

SDKs matter in the **Migrate** stage. They are how application traffic actually switches from legacy trust systems to QNSI.

- **Connect / Discover**: use source connectors and QNSI agents to identify what exists today
- **Analyze / Govern**: use crypto posture, policy, and readiness workflows to define the target state
- **Migrate**: update workloads, services, CI jobs, and internal tools to call QNSI SDKs, REST APIs, or the MCP server
- **Validate / Operate**: prove cutover with readiness evidence, CBOM, QBOM, SBOM, and continuous monitoring

If workloads are still calling the old KMS, old secret store, or old certificate path, the migration is not complete even if the inventory is visible in QNSI.

## Individual SDK docs

- [`@heossi/qnsi-auth-sdk`](./auth-sdk) — Risk-based auth, federated audit, WebAuthn
- [`@heossi/qnsi-vault-sdk`](./vault-sdk) — Dynamic secrets, leakage detection, versioned secrets
- [`@heossi/qnsi-storage-sdk`](./storage-sdk) — Data classification, retention, cross-region replication
- [`@heossi/qnsi-kms-client`](./kms-client) — BYOHSM, key escrow, usage analytics
- [`@heossi/qnsi-search-sdk`](./search-sdk) — Query analytics, synonym management, isolation
- [`@heossi/qnsi-audit-sdk`](./audit-sdk) — Real-time streaming, retention automation
- [`@heossi/qnsi-access-control-sdk`](./access-control-sdk) — Policy simulation, JIT access
- [`@heossi/qnsi-billing-sdk`](./billing-sdk) — Revenue analytics, dunning, credits
- [`@heossi/qnsi-tenant-sdk`](./tenant-sdk) — Health dashboard, quota forecasting
- [`@heossi/qnsi-ai-sdk`](./ai-sdk) — Model registry, bias monitoring, prompt injection
- [`@heossi/qnsi-crypto-inventory-sdk`](./crypto-inventory-sdk) — Certificate lifecycle, PQC readiness
- [`@heossi/qnsi-browser`](./browser-sdk) — Browser-side PQC operations
- [`@heossi/qnsi-mcp`](./mcp-server) — MCP integration for AI assistants
- [`@heossi/qnsi-langchain-qnsp`](./langchain-qnsp) — LangChain toolkit for vault, KMS, and audit
- [`@heossi/qnsi-llamaindex-qnsp`](./llamaindex-qnsp) — LlamaIndex vector-store adapter for encrypted search
- [`@heossi/qnsi-autogen-qnsp`](./autogen-qnsp) — AutoGen executor for QNSI AI orchestration
- [`@heossi/qnsi-resilience`](./resilience) — Shared resilience primitives used by QNSI clients

## Requirements

- **Node.js**: 24.12.0
- **License**: Apache-2.0

## Features

SDKs provide type-safe interfaces and consistent error handling. All SDKs include:

- **Retry/backoff** for rate limiting and transient failures
- **Tenant crypto policy** integration for algorithm selection
- **Real-time streaming** support via WebSocket/SSE where applicable
- **Comprehensive TypeScript types** for all API responses
- **PQC algorithm support** with NIST standardized names

## Installation

### Node.js
```bash
pnpm add @heossi/qnsi
```

### Python
```bash
pip install qnsi                # base
pip install 'qnsi[crypto]'      # with local PQC primitives via liboqs-python
```

### Go
```bash
go get github.com/heossihq/qnsi-public/sdks/go/qnsi@latest
```

### Rust
```bash
cargo add qnsi                  # base
cargo add qnsi --features crypto   # with local PQC primitives via oqs 0.11
```

### JVM / Android
```kotlin
// Gradle (Kotlin DSL) — JVM (Spring/Java/Kotlin) + Android (API 21+)
implementation("io.heossi:qnsi:0.1.0")
```

## Quick start

```typescript
import { QnsiClient } from "@heossi/qnsi";

const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

// One activation handshake on first call, shared across all 11 sub-clients

await qnsi.auth.login({
	email: "user@example.com",
	password: "<password>",
	tenantId: "<tenant_uuid>",
});

await qnsi.vault.createSecret({
	name: "example-secret",
	payloadB64: Buffer.from("<plaintext>").toString("base64"),
});

await qnsi.kms.createKey({ algorithm: "ml-dsa-65", purpose: "signing" });
await qnsi.audit.logEvent({ eventType: "model.inference", payload: { modelId: "gpt-4o" } });
```

Same shape in Python, Go, Rust, and JVM/Android:

```python
# Python
from qnsi import QnsiClient
with QnsiClient(api_key=os.environ["QNSI_API_KEY"]) as q:
    q.vault.create_secret(name="example-secret", payload_b64="...")
```

```go
// Go
c, _ := qnsp.NewClient(qnsp.ClientOptions{APIKey: os.Getenv("QNSI_API_KEY")})
c.Vault().CreateSecret(ctx, vault.CreateSecretRequest{Name: "example-secret", PayloadB64: "..."}, "")
```

```rust
// Rust
let c = qnsi::Client::new(qnsi::ClientOptions::with_api_key(std::env::var("QNSI_API_KEY")?))?;
c.vault().create_secret(qnsi::vault::CreateSecretRequest { name: "example-secret".into(), payload_b64: "...".into(), algorithm: None, metadata: None }, None).await?;
```

```kotlin
// JVM / Android (Kotlin)
val qnsi = QnsiClient(System.getenv("QNSI_API_KEY"))
qnsi.vault.createSecret(CreateSecretRequest(name = "example-secret", payloadB64 = "..."))
```

## Authentication model for SDK consumers

Use the credential type that matches the caller:

- **Tenant API keys** for workload and service data-plane access
- **User PATs** for human CLI and local scripting
- **Service accounts / machine identities** for durable enterprise automation

Tenant API keys are the normal choice for SDK integrations. PATs are useful for local development and operator workflows, but they should not be the long-lived shared credential for production automation.

## Smoke testing SDKs

The monorepo includes an SDK smoke test runner that exercises the public SDK clients against a configured environment.

```bash
pnpm smoke:sdk
```

This runs `scripts/monitoring/sdk-smoke.mjs`.

### Required environment variables

- `QNSI_SMOKE_AUTH_SERVICE_URL`
- `QNSI_SMOKE_SERVICE_ID`
- `QNSI_SMOKE_SERVICE_SECRET`
- `QNSI_SMOKE_TENANT_ID`
- `QNSI_SMOKE_TENANT_BASE_URL`
- `QNSI_SMOKE_AUDIT_BASE_URL`
- `QNSI_SMOKE_BILLING_BASE_URL`
- `QNSI_SMOKE_ACCESS_CONTROL_BASE_URL`
- `QNSI_SMOKE_SEARCH_BASE_URL`
- `QNSI_SMOKE_AI_ORCHESTRATOR_BASE_URL`
- `QNSI_SMOKE_SEARCH_QUERY`

### Optional environment variables

- `QNSI_SMOKE_VAULT_BASE_URL` (requires `QNSI_SMOKE_VAULT_SECRET_ID`)
- `QNSI_SMOKE_VAULT_SECRET_ID`
- `QNSI_SMOKE_STORAGE_BASE_URL` (requires `QNSI_SMOKE_STORAGE_UPLOAD_ID`)
- `QNSI_SMOKE_STORAGE_UPLOAD_ID`

## SDK vs REST API

| Aspect | SDK | REST API |
|--------|-----|----------|
| Auth handling | Provided by caller | Manual |
| Retries | Built-in | Manual |
| Type safety | Yes | No |
| Complexity | Lower | Higher |

## Crypto Policy Integration

All SDKs now support tenant crypto policy integration. This allows services to:

1. Query allowed algorithms based on tenant policy tier
2. Convert internal algorithm names to NIST standardized names
3. Enforce algorithm restrictions at the SDK level

### Algorithm Name Conversion

All SDKs export the NIST name mapping covering 13 PQC families: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205), FN-DSA (FIPS 206 draft), BIKE, Classic McEliece, FrodoKEM, NTRU, NTRU-Prime, MAYO, CROSS, UOV, and SNOVA.

```typescript
import { toNistAlgorithmName, ALGORITHM_TO_NIST } from "@heossi/qnsi-tenant-sdk";

// Convert internal name to NIST name
const nistName = toNistAlgorithmName("kyber-768"); // "ML-KEM-768"
const sigName = toNistAlgorithmName("dilithium-3"); // "ML-DSA-65"

// Full mapping covers all 87 PQC algorithms. Representative entries:
console.log(ALGORITHM_TO_NIST);
// {
//   "kyber-512": "ML-KEM-512",        // FIPS 203
//   "kyber-768": "ML-KEM-768",
//   "kyber-1024": "ML-KEM-1024",
//   "dilithium-2": "ML-DSA-44",       // FIPS 204
//   "dilithium-3": "ML-DSA-65",
//   "dilithium-5": "ML-DSA-87",
//   "sphincs-sha2-128f-simple": "SLH-DSA-SHA2-128f",  // FIPS 205
//   "sphincs-shake-256f-simple": "SLH-DSA-SHAKE-256f",
//   "falcon-512": "FN-DSA-512",       // FIPS 206 (draft)
//   "falcon-1024": "FN-DSA-1024",
//   "bike-l1": "BIKE-L1",             // NIST Round 4
//   "mceliece-348864": "Classic-McEliece-348864",  // ISO standard
//   "frodokem-640-aes": "FrodoKEM-640-AES",        // ISO standard
//   "ntru-hps-2048-509": "NTRU-HPS-2048-509",      // liboqs 0.15
//   "sntrup761": "sntrup761",          // NTRU-Prime
//   "mayo-1": "MAYO-1",               // NIST Additional Signatures
//   "cross-rsdp-128-balanced": "CROSS-RSDP-128-balanced",
//   "ov-Is": "UOV-Is",
//   "snova-24-5-4": "SNOVA-24-5-4",
//   ... // 87 algorithms total
// }
```

### Policy Tiers

| Tier | KEM Algorithms | Signature Algorithms |
|------|----------------|---------------------|
| `default` | kyber-512, kyber-768, kyber-1024 | dilithium-2, dilithium-3, dilithium-5 |
| `strict` | kyber-768, kyber-1024 | dilithium-3, dilithium-5, falcon-1024 |
| `maximum` | kyber-1024 | dilithium-5, falcon-1024, sphincs-shake-256f-simple |
| `government` | kyber-1024 | dilithium-5, sphincs-shake-256f-simple |

See the [Tenant Crypto Policy Guide](/architecture/tenant-crypto-policy) for detailed documentation.

## New Capabilities (March 2026)

### Authentication & Access

- **Risk-Based Auth** (`@heossi/qnsi-auth-sdk`): Adaptive MFA based on behavioral analytics, device fingerprinting, and geolocation
- **Federated Audit** (`@heossi/qnsi-auth-sdk`): Cross-IdP session correlation and unified audit trails
- **JIT Access** (`@heossi/qnsi-access-control-sdk`): Time-bound privilege elevation with automatic revocation
- **Policy Simulation** (`@heossi/qnsi-access-control-sdk`): Test policy changes against historical patterns

### Key & Secret Management

- **BYOHSM** (`@heossi/qnsi-kms-client`): Connect external HSMs via PKCS#11
- **Key Escrow** (`@heossi/qnsi-kms-client`): M-of-N threshold recovery schemes
- **Dynamic Secrets** (`@heossi/qnsi-vault-sdk`): On-demand credential generation
- **Leakage Detection** (`@heossi/qnsi-vault-sdk`): Real-time scanning for exposed secrets

### AI & ML Operations

- **Model Registry** (`@heossi/qnsi-ai-sdk`): Versioned model catalog with deployment tracking
- **Bias Monitoring** (`@heossi/qnsi-ai-sdk`): Fairness metrics and incident reporting
- **Cost Optimization** (`@heossi/qnsi-ai-sdk`): Token usage analytics and budget alerts
- **Prompt Injection** (`@heossi/qnsi-ai-sdk`): Real-time attack detection and blocking

### AI Tooling & Automation

- **MCP Server** (`@heossi/qnsi-mcp`): Expose tenant-scoped QNSI tools to AI assistants
- **CLI Automation** (`@heossi/qnsi-cli`): Script CI/CD workflows and operational tasks
- **Framework Integrations** (`@heossi/qnsi-langchain-qnsp`, `@heossi/qnsi-llamaindex-qnsp`, `@heossi/qnsi-autogen-qnsp`): Connect QNSI services into agent frameworks

### Billing & Tenant Management

- **Revenue Analytics** (`@heossi/qnsi-billing-sdk`): Real-time dashboards by tenant/product
- **Usage Forecasting** (`@heossi/qnsi-billing-sdk`): ML-powered consumption predictions
- **Health Dashboard** (`@heossi/qnsi-tenant-sdk`): Consolidated tenant health metrics
- **Isolation Audit** (`@heossi/qnsi-tenant-sdk`): Continuous verification of data isolation
