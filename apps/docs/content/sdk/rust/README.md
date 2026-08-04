---
title: Rust SDK
version: 0.3.0
last_updated: 2026-07-20
copyright: © 2025-2026 HEOSSI. All rights reserved.
---
# Rust SDK

`qnsi` on crates.io ([source](https://github.com/heossihq/qnsi-public/tree/main/sdks/rust/qnsi), [changelog](https://github.com/heossihq/qnsi-public/blob/main/sdks/rust/qnsi/CHANGELOG.md)).

## Installation

Base install (HTTP clients, no native dependency):

```bash
cargo add qnsi
```

With local PQC primitives (`qnsi::crypto`, wrapping the [`oqs`](https://crates.io/crates/oqs) crate 0.11):

```bash
cargo add qnsi --features crypto
```

The `crypto` feature delegates to `oqs-sys`, which builds `liboqs` from source via `cmake`. You'll need a C toolchain and `cmake` available at build time.

Tested on Rust 1.75+. The crate is `tokio`-based on the async side.

## Quick start

```rust
use qnsi::{Client, ClientOptions};
use qnsi::vault::CreateSecretRequest;
use qnsi::kms::CreateKeyRequest;
use qnsi::audit::LogEventRequest;
use base64::{engine::general_purpose::STANDARD, Engine};

#[tokio::main]
async fn main() -> Result<(), qnsi::Error> {
    let c = Client::new(ClientOptions::with_api_key(std::env::var("QNSI_API_KEY").unwrap()))?;

    // Vault
    c.vault().create_secret(CreateSecretRequest {
        name: "openai-api-key".into(),
        payload_b64: STANDARD.encode(b"sk-..."),
        algorithm: Some("ml-kem-768".into()),
        metadata: None,
    }, None).await?;

    // KMS
    let key = c.kms().create_key(CreateKeyRequest {
        algorithm: "ml-dsa-65".into(),
        purpose: "signing".into(),
        metadata: None,
    }, None).await?;
    let key_id = key["keyId"].as_str().unwrap();
    let signature = c.kms().sign(key_id, b"hello", None).await?;
    assert!(c.kms().verify(key_id, b"hello", &signature).await?);

    // Audit
    c.audit().log_event(LogEventRequest {
        event_type: "model.inference".into(),
        payload: serde_json::Map::new(),
        tags: None,
    }, None).await?;

    Ok(())
}
```

## Modules

| Module | Source | What it wraps |
|---|---|---|
| `qnsi::vault` | [src/vault.rs](https://github.com/heossihq/qnsi-public/blob/main/sdks/rust/qnsi/src/vault.rs) | `apps/vault-service` (`/vault/v1`) |
| `qnsi::kms` | [src/kms.rs](https://github.com/heossihq/qnsi-public/blob/main/sdks/rust/qnsi/src/kms.rs) | `apps/kms-service` (`/kms/v1`) |
| `qnsi::audit` | [src/audit.rs](https://github.com/heossihq/qnsi-public/blob/main/sdks/rust/qnsi/src/audit.rs) | `apps/audit-service` (`/audit/v1`) |
| `qnsi::tenant` | [src/tenant.rs](https://github.com/heossihq/qnsi-public/blob/main/sdks/rust/qnsi/src/tenant.rs) | `apps/tenant-service` (`/tenant/v1`) |
| `qnsi::access` | [src/access.rs](https://github.com/heossihq/qnsi-public/blob/main/sdks/rust/qnsi/src/access.rs) | `apps/access-control-service` (`/access/v1`) |
| `qnsi::billing` | [src/billing.rs](https://github.com/heossihq/qnsi-public/blob/main/sdks/rust/qnsi/src/billing.rs) | `apps/billing-service` (`/billing/v1`) |
| `qnsi::crypto_inventory` | [src/crypto_inventory.rs](https://github.com/heossihq/qnsi-public/blob/main/sdks/rust/qnsi/src/crypto_inventory.rs) | `apps/crypto-inventory-service` (`/crypto/v1`) |
| `qnsi::storage` | [src/storage.rs](https://github.com/heossihq/qnsi-public/blob/main/sdks/rust/qnsi/src/storage.rs) | `apps/storage-service` (`/storage/storage/v1`) |
| `qnsi::search` | [src/search.rs](https://github.com/heossihq/qnsi-public/blob/main/sdks/rust/qnsi/src/search.rs) | `apps/search-service` (`/search/v1`) |
| `qnsi::crypto` (feature `crypto`) | [src/crypto.rs](https://github.com/heossihq/qnsi-public/blob/main/sdks/rust/qnsi/src/crypto.rs) | `oqs` 0.11 (local PQC primitives) |

## Webhook verification

```rust
use qnsi::{parse_webhook, MAX_WEBHOOK_SKEW};

let event = parse_webhook(
    body,
    &signature_header,
    Some(&timestamp_header),
    &std::env::var("QNSI_WEBHOOK_SECRET")?,
    MAX_WEBHOOK_SKEW,
    None,
)?;
```

## Error handling

```rust
match c.vault().get_secret("missing").await {
    Err(qnsi::Error::Api(e)) if e.status_code == 404 => println!("not found"),
    Err(e) => return Err(e),
    Ok(secret) => println!("{secret:?}"),
}
```

## Activation + introspection

```rust
let tenant_id = c.tenant_id().await?;
let tier      = c.tier().await?;
let limits    = c.limits().await?;
let sse       = c.has_feature("sseEnabled").await?;
```
