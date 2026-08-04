---
title: Supported Languages
version: 0.3.0
last_updated: 2026-07-20
copyright: © 2025-2026 HEOSSI. All rights reserved.
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

# Supported Languages

QNSI ships first-party SDKs for **TypeScript / Node.js**, **Python**, **Go**, **Rust**, and **JVM / Android** (Kotlin + Java). All five share the same wire contracts, the same algorithm names, and the same FIPS 203 / 204 / 205 posture - pick whichever fits your stack and the byte-for-byte outputs round-trip.

| Language | Package | Where it lives | Activation SDK ID |
|---|---|---|---|
| TypeScript / Node.js | `@heossihq/qnsi` (single package) | [`packages/qnsi/`](https://github.com/heossihq/qnsi-public/tree/main/packages/qnsi) | `qnsi` |
| Python | `qnsi` (single package) | [`sdks/python/qnsi/`](https://github.com/heossihq/qnsi-public/tree/main/sdks/python/qnsi) | `qnsi-python` |
| Go | `github.com/heossihq/qnsi-public/sdks/go/qnsi` | [`sdks/go/qnsi/`](https://github.com/heossihq/qnsi-public/tree/main/sdks/go/qnsi) | `qnsi-go` |
| Rust | `qnsi` on crates.io | [`sdks/rust/qnsi/`](https://github.com/heossihq/qnsi-public/tree/main/sdks/rust/qnsi) | `qnsi-rust` |
| JVM / Android (Kotlin + Java) | `com.heossi:qnsi` on Maven Central | [`sdks/jvm/`](https://github.com/heossihq/qnsi-public/tree/main/sdks/jvm) | `qnsi-jvm` |

> **TypeScript SDK consolidated 2026-04-30.** The previous 11 per-service `@heossihq/qnsi-*-sdk` packages on npm are deprecated in favour of `@heossihq/qnsi`. They continue to install and work, but new code should use the unified package. See [migration guide](https://github.com/heossihq/qnsi-public/blob/main/packages/qnsi/README.md#migration-from-per-service-sdks).

## Node.js / TypeScript

Single `@heossihq/qnsi` package on npm:

```bash
pnpm add @heossihq/qnsi
```

```typescript
import { QnsiClient } from "@heossihq/qnsi";

const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
await qnsi.vault.createSecret({ name: "openai-key", payloadB64: "..." });
const key = await qnsi.kms.createKey({ algorithm: "ml-dsa-65", purpose: "signing" });
await qnsi.audit.logEvent({ eventType: "model.inference", payload: { modelId: "gpt-4o" } });
```

- TypeScript native, strict mode
- ESM (CommonJS consumers can `await import("@heossihq/qnsi")`)
- Node.js ≥ 22.0.0
- One activation handshake on first call, shared across all 11 sub-clients
- One `npm install` line, one version, one CHANGELOG, one telemetry surface

`@heossihq/qnsi` targets Node.js. For browser-side PQC, integrate the audited pure-JavaScript primitive provider documented in the [encryption-in-transit guide](../storage/encryption-in-transit.md); QNSI does not currently advertise a separate public browser npm package. The per-service `@heossihq/qnsi-*-sdk` packages on npm are deprecated as of 2026-04-30 - they continue to install but are no longer the recommended entry point. See the [Node.js page](/sdk/node) for full quick-start and migration details.

## Python

Single `qnsi` package on PyPI ([changelog](https://github.com/heossihq/qnsi-public/blob/main/sdks/python/qnsi/CHANGELOG.md)):

```bash
pip install qnsi
# with local PQC primitives:
pip install 'qnsi[crypto]'
```

```python
from qnsi import QnsiClient
with QnsiClient(api_key=os.environ["QNSI_API_KEY"]) as q:
    secret = q.vault.create_secret(name="my-secret", payload_b64=...)
    key    = q.kms.create_key(algorithm="ml-dsa-65", purpose="signing")
    q.audit.log_event(event_type="model.inference", payload={...})
```

The `qnsi[crypto]` extra wraps `liboqs-python` 0.12.0 - same algorithm-name surface as the rest of the QNSI ecosystem.

See the [Python page](/sdk/python) for full quick-start.

## Go

Module path is `github.com/heossihq/qnsi-public/sdks/go/qnsi`:

```bash
go get github.com/heossihq/qnsi-public/sdks/go/qnsi@latest
```

```go
import "github.com/heossihq/qnsi-public/sdks/go/qnsi"

c, _ := qnsp.NewClient(qnsp.ClientOptions{APIKey: os.Getenv("QNSI_API_KEY")})
defer c.Close()
secret, _ := c.Vault().CreateSecret(ctx, vault.CreateSecretRequest{...}, "")
```

The `qnsi/crypto` subpackage wraps `liboqs-go` 0.12.0 - pure-Go base, native crypto requires liboqs at link time.

See the [Go page](/sdk/go) for full quick-start.

## Rust

`qnsi` on crates.io:

```bash
cargo add qnsi
# with local PQC primitives:
cargo add qnsi --features crypto
```

```rust
use qnsi::{Client, ClientOptions};
use qnsi::vault::CreateSecretRequest;

let c = Client::new(ClientOptions::with_api_key(env::var("QNSI_API_KEY")?))?;
let secret = c.vault().create_secret(CreateSecretRequest { ... }, None).await?;
```

`tokio`-based async; the `crypto` feature delegates to the [`oqs`](https://crates.io/crates/oqs) 0.11 crate.

See the [Rust page](/sdk/rust) for full quick-start.

## JVM / Android

`com.heossi:qnsi` on Maven Central - one artifact for server-side JVM (Spring / Java / Kotlin) and native Android (API 21+):

```kotlin
// Gradle (Kotlin DSL)
dependencies {
    implementation("com.heossi:qnsi:0.4.0")
}
```

```kotlin
val qnsi = QnsiClient(System.getenv("QNSI_API_KEY"))
val secret = qnsi.vault.createSecret(
    CreateSecretRequest(name = "db-password", payloadB64 = payloadB64),
)
```

Built on OkHttp; Java-interop-clean API (from Java: `qnsi.getVault()...`). On-device PQC via Bouncy Castle or OS-native (Android Keystore PQC). See the [JVM / Android page](/sdk/java) for the full quick-start.

## Feature matrix

All SDKs cover the same set of customer-facing services. Module names differ slightly per language (snake_case vs camelCase vs PascalCase) but the wire contract is identical.

| Service | TypeScript | Python | Go | Rust | JVM / Android |
|---|---|---|---|---|---|
| Vault (`/vault/v1`) | `@heossihq/qnsi-vault-sdk` | `qnsi.vault` | `qnsi/vault` | `qnsi::vault` | `qnsi.vault` |
| KMS (`/kms/v1`) | `@heossihq/qnsi-kms-client` | `qnsi.kms` | `qnsi/kms` | `qnsi::kms` | `qnsi.kms` |
| Audit (`/audit/v1`) | `@heossihq/qnsi-audit-sdk` | `qnsi.audit` | `qnsi/audit` | `qnsi::audit` | `qnsi.audit` |
| Auth (`/auth/v1`) | `@heossihq/qnsi-auth-sdk` | `qnsi.auth` | `qnsi/auth` | `qnsi::auth` | `qnsi.auth` |
| Tenant (`/tenant/v1`) | `@heossihq/qnsi-tenant-sdk` | `qnsi.tenant` | `qnsi/tenant` | `qnsi::tenant` | `qnsi.tenant` |
| Access (`/access/v1`) | `@heossihq/qnsi-access-control-sdk` | `qnsi.access` | `qnsi/access` | `qnsi::access` | `qnsi.access` |
| Billing (`/billing/v1`) | `@heossihq/qnsi-billing-sdk` | `qnsi.billing` | `qnsi/billing` | `qnsi::billing` | `qnsi.billing` |
| Crypto Inventory (`/crypto/v1`) | `@heossihq/qnsi-crypto-inventory-sdk` | `qnsi.crypto_inventory` | `qnsi/cryptoinventory` | `qnsi::crypto_inventory` | `qnsi.cryptoInventory` |
| Storage (`/storage/storage/v1`) | `@heossihq/qnsi-storage-sdk` | `qnsi.storage` | `qnsi/storage` | `qnsi::storage` | `qnsi.storage` |
| Search (`/search/v1`) | `@heossihq/qnsi-search-sdk` | `qnsi.search` | `qnsi/search` | `qnsi::search` | `qnsi.search` |
| AI Orchestrator (`/ai/v1`) | `@heossihq/qnsi-ai-sdk` | `qnsi.ai` | `qnsi/ai` | `qnsi::ai` | `qnsi.ai` |
| Local PQC primitives | `@heossihq/qnsi-cryptography` (via `@heossihq/liboqs-native`) | `qnsi.crypto` (via `liboqs-python`) | `qnsi/crypto` (via `liboqs-go`) | `qnsi::crypto` (via `oqs` 0.11) | Bouncy Castle / OS-native |
| Webhook signature verify + parse | per-service | `qnsi.parse_qnsi_webhook` | `qnsi.ParseWebhook` | `qnsi::parse_webhook` | `QnsiWebhooks` |

All SDKs ship the same **11 customer-facing service modules** plus local PQC primitives and webhook verification. Current published releases are tracked in [SDK Overview](./overview); registry verification is run before customer-facing version claims are updated.

## Activation

Every customer-facing SDK calls `/billing/v1/sdk/activate` on first use to validate the API key, resolve the tenant + tier, and cache the result. The SDK identifier reported in the handshake matches the third column of the table at the top of this page; see [SDK Activation](./sdk-activation.md) for protocol details.

## Community SDKs

QNSI does not currently host community-maintained SDKs. If you build one, open a PR against [`docs/sdks/community.md`](https://github.com/heossihq/qnsi-public/tree/main/docs/sdks) on the public mirror to add it to this list.
