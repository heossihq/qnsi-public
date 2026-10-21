# qnsi - Rust SDK for the Quantum-Native Security Infrastructure

[![Crates.io](https://img.shields.io/crates/v/qnsi.svg)](https://crates.io/crates/qnsi)
[![docs.rs](https://docs.rs/qnsi/badge.svg)](https://docs.rs/qnsi)
[![License](https://img.shields.io/crates/l/qnsi.svg)](./LICENSE)

Async Rust client for QNSI with service convenience APIs, optional local PQC
primitives through liboqs, and webhook verification. Language SDKs are independently
versioned; complete wire-schema parity and production acceptance require separate
evidence.

> **Free tier available.** Free-forever account at <https://cloud.qnsi.heossi.com/auth> - 60-second signup, no credit card. Includes 10 GB PQC storage, 50 000 API calls/month, 20 KMS keys, 25 vault secrets.

## Manifest operation access (unreleased source)

`qnsi::surface::operations()` returns the bundled catalog of 880 manifest
declarations across 15 services. `client.call_operation(operation_id,
&path_parameters, body, query, idempotency_key).await` uses the shared activation,
tenant binding and retry transport. Path parameters are encoded; missing and
dot-segment parameters fail before HTTP. Existing service methods are preserved.

Catalog presence is not typed payload-schema parity or live availability.
Backend schemas, permissions and endpoint-specific authentication still apply.
Publication, full-source coverage and production acceptance of these additions
are **NOT VERIFIED**.

## Install

Base install (HTTP clients for vault, KMS, audit - no native deps):

```bash
cargo add qnsi
```

With local PQC primitives (`qnsi::crypto` - wraps the [`oqs`](https://crates.io/crates/oqs) crate 0.11):

```bash
cargo add qnsi --features crypto
```

The `crypto` feature pulls in [`oqs`](https://crates.io/crates/oqs) which delegates to [`oqs-sys`](https://crates.io/crates/oqs-sys); the latest upstream Rust binding release available on 2026-09-01 is `oqs` 0.11.0 / `oqs-sys` 0.11.0+liboqs-0.13.0, so the Rust SDK intentionally lags the Node and Go 0.16.0 runtime bindings until liboqs-rust publishes a 0.16-aligned release. You'll need a C toolchain and `cmake` available at build time. macOS / Linux build out of the box; on Windows you'll want the MSVC toolchain plus a `cmake` install.

The source enables the upstream KEM/signature feature families and vendored
native build explicitly, without enabling the optional OpenSSL dependency.
Availability still depends on upstream platform support; names alone do not
prove byte-level standards conformance or cross-language interoperability.
The local ML-KEM/ML-DSA round-trip and tamper tests are recorded in
`docs/quality/client-operation-surface-2026-10-04.md`; distribution and platform
acceptance remain NOT VERIFIED.

The manifest declares Rust 1.75 as its minimum version. The current local checks
use the installed nightly toolchain; minimum-version and distribution-matrix
acceptance remain NOT VERIFIED. The async client uses `tokio`.

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

    // ── Vault - PQC-encrypted secret storage ─────────────────────────
    let secret = c.vault().create_secret(CreateSecretRequest {
        name: "openai-api-key".into(),
        payload_b64: STANDARD.encode(b"sk-..."),
        algorithm: Some("ml-kem-768".into()),
        metadata: None,
    }, None).await?;

    // ── KMS - server-side PQC keys ──────────────────────────────────
    let key = c.kms().create_key(CreateKeyRequest {
        key_id: None,                  // auto-generated UUID if omitted
        algorithm: "ml-dsa-65".into(),
        key_type: Some("data".into()), // root | master | data | byok
        metadata: None,
        exportable: Some(false),
        custody_enforcement: Some("service".into()),
    }, None).await?;
    let key_id = key["keyId"].as_str().unwrap();
    let signature = c.kms().sign(key_id, b"hello", None).await?;
    assert!(c.kms().verify(key_id, b"hello", &signature).await?);

    // ── Audit - immutable, hash-chained event log ───────────────────
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

For full lifecycle control (generate once, sign or decapsulate many times), call `oqs::kem::Kem::new(qnsi::crypto::kem_algorithm("ML-KEM-768")?)` directly - the resolver functions are public.

## Verifying inbound webhooks

This SDK's compatibility verifier accepts HMAC-SHA-256 webhooks. It does not
implement PQC webhook-signature verification, nor prove which scheme a live
endpoint uses. Verify the **raw body** before parsing JSON:

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

Convenience modules expose the following subsets of service contracts:

- `qnsi::vault` - secret creation, retrieval, version history, rotation, soft deletion, dynamic engine/configuration catalogs, credential issuance, lease listing/renewal/revocation and measured dynamic-secret statistics - wraps `apps/vault-service`
- `qnsi::kms` - `create_key`, `list_keys`, `get_key`, `rotate_key`, `delete_key`, `sign`, `verify`, `wrap`, `unwrap_` - wraps `apps/kms-service`
- `qnsi::audit` - `log_event`, `ingest_events` (batch), `list_events` - wraps `apps/audit-service`
- `qnsi::auth` - `login`, `refresh_token`, `revoke`, `mfa_challenge`/`mfa_verify`, `evaluate_risk`, `list_risk_policies` - wraps `apps/auth-service`
- `qnsi::tenant` - `create_tenant`, `get_tenant`, `update_tenant`, `list_tenants`, `get_crypto_policy`, `upsert_crypto_policy`, `get_current_health`, `get_current_quotas` - wraps `apps/tenant-service`
- `qnsi::access` - `create_role`, `get_role`, `list_roles`, `delete_role`, `assign_role`, `revoke_role_assignment`, `check_permission` - wraps `apps/access-control-service`
- `qnsi::billing` - `get_entitlements`, `ingest_meter`, `ingest_meters`, `list_invoices`, `get_invoice`, `get_credit_balance` - wraps `apps/billing-service`
- `qnsi::crypto_inventory` - `list_assets`, `get_asset`, `get_asset_stats`, `discover_assets`, `get_readiness_score` - wraps `apps/crypto-inventory-service` (CBOM)
- `qnsi::storage` - `put_object`, `get_object`, `delete_object`, `list_objects`, `list_buckets` - wraps `apps/storage-service` (SSE-X)
- `qnsi::search` - `create_index`, `list_indexes`, `delete_index`, `upsert_vectors`, `query` - wraps `apps/search-service` (vector search)
- `qnsi::ai` - `register_model`, model lifecycle, `submit_workload`, `invoke_inference`, `register_artifact` - wraps `apps/ai-orchestrator`

Local primitives + integration:

- `qnsi::crypto` (feature-gated on `crypto`) - algorithm resolvers for ML-KEM, ML-DSA, historical SPHINCS+ names, Falcon, BIKE, FrodoKEM, Classic-McEliece, MAYO and CROSS. Resolver names and historical aliases do not establish FIPS conformance or execution of every algorithm.
- `qnsi::parse_webhook` / `qnsi::verify_webhook_signature` - HMAC-SHA-256 signature verification + typed `qnsi::WebhookEvent`
- `qnsi::Client::new` - API-key activation against `/billing/v1/sdk/activate` with caching and 401 retry

### Dynamic Vault and tenant contract (unreleased source)

Dynamic configuration creation requires `engine_type` and an approved
`connection_ref`. Optional TTL policy, role templates and credential metadata are
serialized with the backend's camelCase names. Credential responses retain
engine-specific fields. `list_leases` can request all recovery statuses;
`revoke_lease` retains the `revoking` queue acknowledgement rather than claiming
provider revocation has completed. Secret IDs, config IDs and lease IDs are encoded
as single URL path segments; empty/dot identifiers and version zero fail before
HTTP. Existing secret methods remain available, including soft deletion.

Crypto-inventory statistics/readiness methods now forward explicit nonempty
tenant arguments. The historical empty-string default selects the activated
tenant. Backend authorization is still required; no tenant delegation is approved
by this change.

The local all-features suite passes 27 tests, with none ignored. Branch-enabled
LLVM coverage includes all 18 production Rust source files: 58.42% lines
(951/1628), 72.45% branches (71/98), 40.38% functions (126/312), and 52.09% regions
(1231/2363). The complete exact-100% gate FAILS. Vault itself measures 100% lines,
branches, functions and LLVM regions; that subset does not close the SDK-wide
gate. LLVM regions are not reported as a separate statement measurement. HTTP
fixtures and local native crypto tests are not production assurance. Publication,
distribution acceptance and live provider behavior remain NOT VERIFIED.

Reproduce the complete local gate from the monorepo root:

```bash
node scripts/verify/rust-sdk-tests.mjs
```

The `test:sdk-rust` package command invokes the same gate. It uses nightly branch
instrumentation, compares the report against every `src/**/*.rs` file, rejects
ignored/filtered tests and requires exact coverage counts, including branches.
Missing source, missing branch data, rounded percentages and malformed reports
fail closed. Four gate self-tests exercise those rejection paths. This does not
close the unmeasured statement metric or independent production acceptance.

## Remaining client work

- Async streaming for `Storage::get_object` on large objects
- Pre-built `qnsi::test_support` helper that mocks the QNSI API for tests
- Generated typed responses (currently `serde_json::Value`) for every method

## License

Apache-2.0. See [LICENSE](../../../LICENSE).
