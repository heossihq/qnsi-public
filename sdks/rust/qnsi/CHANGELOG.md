# Changelog

All notable changes to the QNSP Rust SDK (`qnsp` on crates.io) will be documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-04-30

**Full-parity release.** Adds the two customer-facing service modules that were missing in 0.1.0, bringing the Rust SDK to feature parity with the TypeScript family (11 service modules total).

### Added

- `qnsi::auth` — `Client` with `login`, `refresh_token`, `revoke`, WebAuthn passkey lifecycle (register/authenticate start+complete, list, delete), `mfa_challenge`/`mfa_verify`, `federate_saml`/`federate_oidc`, `evaluate_risk`, `list_risk_policies`. Wraps `apps/auth-service` (`/auth/v1`).
- `qnsi::ai` — `Client` with model registry (`register_model`, `list_models`, `get_model`, `update_model`, `activate_model`, `deploy_model`), workloads (`submit_workload`, `get_workload`, `list_workloads`, `cancel_workload`) with enclave-attestation metadata, `invoke_inference`, `register_artifact`. Wraps `apps/ai-orchestrator` (`/ai/v1`).
- Top-level `Client::auth()` and `Client::ai()` accessors.

### Changed

- Activation handshake reports `sdkVersion="0.2.0"` (was `0.1.0`).

## [0.1.0] — 2026-04-30

Initial release. The SDK is general-purpose — every QNSP customer uses the same shape, with no per-partner crates.

### Added

- `qnsi::Client` with `vault()`, `kms()`, `audit()`, `tenant()`, `access()`, `billing()`, `crypto_inventory()`, `storage()`, `search()` accessors over a shared activation cache and `reqwest::Client` connection pool.
- `qnsi::vault::Client` — `create_secret`, `get_secret`, `get_secret_version`, `rotate_secret`, `delete_secret`, `list_secret_versions`.
- `qnsi::kms::Client` — `create_key`, `list_keys`, `get_key`, `rotate_key`, `delete_key`, `sign`, `verify`, `wrap`, `unwrap_`.
- `qnsi::audit::Client` — `log_event`, `ingest_events` (batch), `list_events`.
- `qnsi::tenant::Client` — tenant CRUD, crypto-policy management, quotas, health snapshots.
- `qnsi::access::Client` — RBAC roles, role assignments, `check_permission`.
- `qnsi::billing::Client` — `get_entitlements`, usage-meter ingest, invoice listing, credit-balance lookup.
- `qnsi::crypto_inventory::Client` — Cryptographic Bill of Materials: asset listing, discovery runs, PQC readiness score.
- `qnsi::storage::Client` — PQC-encrypted object storage (SSE-X): `put_object`, `get_object`, `delete_object`, `list_objects`, `list_buckets`.
- `qnsi::search::Client` — encrypted vector search: index lifecycle, `upsert_vectors`, `query`.
- `qnsi::crypto` (feature-gated on `crypto`) — local PQC primitives wrapping `oqs` 0.11. Covers ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205), Falcon, plus HQC, BIKE, FrodoKEM, Classic-McEliece, MAYO, CROSS. Algorithm names mirror `@heossi/qnsp-cryptography` (TypeScript), `qnsp.crypto` (Python), and `qnsp/crypto` (Go).
- `qnsi::Activation` — one-shot handshake against `/billing/v1/sdk/activate` with `sdkId="qnsp-rust"`, cached with a 60 s near-expiry buffer.
- `qnsi::parse_webhook` and `qnsi::verify_webhook_signature` — HMAC-SHA-256 verify, replay protection (`qnsi::MAX_WEBHOOK_SKEW = chrono::Duration::minutes(5)`), typed `qnsi::WebhookEvent`.
- Top-level introspection: `Client::tenant_id`, `Client::tier`, `Client::limits`, `Client::has_feature`.
- Typed errors: `qnsi::Error` enum wrapping `NetworkError`, `AuthError`, `ApiError`, `WebhookError` with `thiserror`-derived `Display`/`Debug`.

### Notes

- The crypto feature delegates to `oqs-sys`, which builds `liboqs` from source via `cmake`. A C toolchain plus `cmake` are required at build time.
- The base crate (without `crypto`) has no native dependency.
