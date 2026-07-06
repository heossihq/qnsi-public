# qnsi — Rust SDK for the Quantum-Native Security Infrastructure

[![Crates.io](https://img.shields.io/crates/v/qnsi.svg)](https://crates.io/crates/qnsi)
[![docs.rs](https://docs.rs/qnsi/badge.svg)](https://docs.rs/qnsi)
[![License](https://img.shields.io/crates/l/qnsi.svg)](./LICENSE)

Typed async Rust client for QNSI — post-quantum cryptography (ML-KEM, ML-DSA, SLH-DSA, Falcon via liboqs), PQC-encrypted vault, server-side KMS, immutable audit trails. Same wire contracts as the official `@heossi/qnsi` TypeScript SDK, the `qnsi` Python SDK, and the `github.com/heossihq/qnsi-public/sdks/go/qnsi` Go SDK — pick whichever language fits your stack and the byte-for-byte outputs round-trip.

> **Free tier available.** Free-forever account at <https://cloud.qnsi.heossi.com/auth> — 60-second signup, no credit card. Includes 10 GB PQC storage, 50 000 API calls/month, 20 KMS keys, 25 vault secrets.

## Install

Base install (HTTP clients for vault, KMS, audit — no native deps):

```bash
cargo add qnsi
```

With local PQC primitives (`qnsi::crypto` — wraps the [`oqs`](https://crates.io/crates/oqs) crate 0.11):

```bash
cargo add qnsi --features crypto
```

The `crypto` feature pulls in [`oqs`](https://crates.io/crates/oqs) which delegates to [`oqs-sys`](https://crates.io/crates/oqs-sys); `oqs-sys` builds [`liboqs`](https://github.com/open-quantum-safe/liboqs) from source via `cmake`. You'll need a C toolchain and `cmake` available at build time. macOS / Linux build out of the box; on Windows you'll want the MSVC toolchain plus a `cmake` install.

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

    // ── Vault — PQC-encrypted secret storage ─────────────────────────
    let secret = c.vault().create_secret(CreateSecretRequest {
        name: "openai-api-key".into(),
        payload_b64: STANDARD.encode(b"sk-..."),
        algorithm: Some("ml-kem-768".into()),
        metadata: None,
    }, None).await?;

    // ── KMS — server-side PQC keys ──────────────────────────────────
    let key = c.kms().create_key(CreateKeyRequest {
        key_id: None,                  // auto-generated UUID if omitted
        algorithm: "ml-dsa-65".into(),
        key_type: Some("data".into()), // root | master | data | byok
        metadata: None,
    }, None).await?;
    let key_id = key["keyId"].as_str().unwrap();
    let signature = c.kms().sign(key_id, b"hello", None).await?;
    assert!(c.kms().verify(key_id, b"hello", &signature).await?);

    // ── Audit — immutable, hash-chained event log ───────────────────
    c.audit().log_event(LogEventRequest {
        event_type: "model.inference".into(),
        payload: serde_json::Map::from_iter([
            ("modelId".to_string(), serde_json::Value::String("gpt-4o".into())),
            ("latencyMs".to_string(), serde_json::Value::from(412)),
        ]),
        tags: None,
    }, None).await?;

    Ok(())
}
```

## Local PQC primitives

`qnsi::crypto` wraps the `oqs` crate so you don't have to write `oqs::kem` / `oqs::sig` calls directly, and so the algorithm-name surface matches the rest of the QNSI ecosystem (TypeScript, Python, Go):

```rust
#[cfg(feature = "crypto")]
{
    use qnsi::crypto::{kem_round_trip, sig_round_trip};

    let (pk, sk, ct, ss) = kem_round_trip("ML-KEM-768")?;
    assert_eq!(ss.len(), 32);

    let (sig_pk, sig_sk, signature) = sig_round_trip("ML-DSA-65", b"hello")?;
}
```

For full lifecycle control (generate once, sign or decapsulate many times), call `oqs::kem::Kem::new(qnsi::crypto::kem_algorithm("ML-KEM-768")?)` directly — the resolver functions are public.

## Verifying inbound webhooks

QNSI signs every webhook with HMAC-SHA-256. Verify the **raw body** before parsing JSON:

```rust
use axum::{extract::Request, http::StatusCode, response::IntoResponse};
use qnsi::{parse_webhook, MAX_WEBHOOK_SKEW};

async fn handle(req: Request) -> Result<impl IntoResponse, (StatusCode, String)> {
    let sig = req.headers().get("x-qnsp-signature")
        .and_then(|h| h.to_str().ok()).unwrap_or("").to_string();
    let ts  = req.headers().get("x-qnsp-timestamp")
        .and_then(|h| h.to_str().ok()).map(String::from);
    let body = axum::body::to_bytes(req.into_body(), 1_000_000).await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let event = parse_webhook(
        &body,
        &sig,
        ts.as_deref(),
        &std::env::var("QNSI_WEBHOOK_SECRET").unwrap(),
        MAX_WEBHOOK_SKEW,
        None,
    ).map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    if event.event_type == "key.rotated" {
        // ...
    }
    Ok(StatusCode::OK)
}
```

The verifier runs HMAC comparison in constant time, rejects timestamps older than 5 minutes by default (replay protection), and refuses payloads missing required fields.

## Error handling

All errors flow through `qnsi::Error`:

| Variant | When |
| --- | --- |
| `qnsi::Error::Network(_)` | DNS, TLS, timeout, or connection failure |
| `qnsi::Error::Auth(_)` | API key rejected at activation |
| `qnsi::Error::Api(_)` | A service returned 4xx/5xx with a structured body |
| `qnsi::Error::Webhook(_)` | HMAC mismatch, expired timestamp, malformed body, etc. |

```rust
match c.vault().get_secret("missing").await {
    Err(qnsi::Error::Api(e)) if e.status_code == 404 => {
        println!("not found");
    }
    Err(e) => return Err(e),
    Ok(secret) => println!("got {secret:?}"),
}
```

## Activation + tier introspection

`qnsi::Client` performs a one-shot handshake against `/billing/v1/sdk/activate` on first use. The result is cached in memory; subsequent calls reuse it until ~1 minute before expiry. You can inspect the current activation:

```rust
let tenant_id = c.tenant_id().await?;
let tier      = c.tier().await?;
let limits    = c.limits().await?;
let sse_on    = c.has_feature("sseEnabled").await?;
```

If the activation token is rotated server-side, the SDK invalidates its cache and retries the originating request once on a 401.

## What's covered today

Customer-facing modules (every QNSI service callable through the edge gateway today):

- `qnsi::vault` — `create_secret`, `get_secret`, `get_secret_version`, `rotate_secret`, `delete_secret`, `list_secret_versions` — wraps `apps/vault-service`
- `qnsi::kms` — `create_key`, `list_keys`, `get_key`, `rotate_key`, `delete_key`, `sign`, `verify`, `wrap`, `unwrap_` — wraps `apps/kms-service`
- `qnsi::audit` — `log_event`, `ingest_events` (batch), `list_events` — wraps `apps/audit-service`
- `qnsi::auth` — `login`, `refresh_token`, `revoke`, `mfa_challenge`/`mfa_verify`, `evaluate_risk`, `list_risk_policies` — wraps `apps/auth-service`
- `qnsi::tenant` — `create_tenant`, `get_tenant`, `update_tenant`, `list_tenants`, `get_crypto_policy`, `upsert_crypto_policy`, `get_current_health`, `get_current_quotas` — wraps `apps/tenant-service`
- `qnsi::access` — `create_role`, `get_role`, `list_roles`, `delete_role`, `assign_role`, `revoke_role_assignment`, `check_permission` — wraps `apps/access-control-service`
- `qnsi::billing` — `get_entitlements`, `ingest_meter`, `ingest_meters`, `list_invoices`, `get_invoice`, `get_credit_balance` — wraps `apps/billing-service`
- `qnsi::crypto_inventory` — `list_assets`, `get_asset`, `get_asset_stats`, `discover_assets`, `get_readiness_score` — wraps `apps/crypto-inventory-service` (CBOM)
- `qnsi::storage` — `put_object`, `get_object`, `delete_object`, `list_objects`, `list_buckets` — wraps `apps/storage-service` (SSE-X)
- `qnsi::search` — `create_index`, `list_indexes`, `delete_index`, `upsert_vectors`, `query` — wraps `apps/search-service` (vector search)
- `qnsi::ai` — `register_model`, model lifecycle, `submit_workload`, `invoke_inference`, `register_artifact` — wraps `apps/ai-orchestrator`

Local primitives + integration:

- `qnsi::crypto` (feature-gated on `crypto`) — ML-KEM (512/768/1024), ML-DSA (44/65/87), SLH-DSA (12 variants), Falcon (512/1024), plus BIKE, FrodoKEM, Classic-McEliece, MAYO, CROSS — every FIPS 203/204/205 finalist exposed by `oqs` 0.11
- `qnsi::parse_webhook` / `qnsi::verify_webhook_signature` — HMAC-SHA-256 signature verification + typed `qnsi::WebhookEvent`
- `qnsi::Client::new` — API-key activation against `/billing/v1/sdk/activate` with caching and 401 retry

## What's coming

- Async streaming for `Storage::get_object` on large objects
- Pre-built `qnsi::test_support` helper that mocks the QNSI API for tests
- Generated typed responses (currently `serde_json::Value`) for every method

## License

Apache-2.0. See [LICENSE](../../../LICENSE).
