# Changelog

All notable changes to the QNSP Go SDK (`github.com/heossihq/qnsi-public/sdks/go/qnsi`) will be documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

## [0.3.0] — 2026-06-14

**Routing + wire-contract fix — the service clients now actually reach production.** A
reaudit (2026-06-13/14) found every service client targeted bare `/<svc>/v1` paths, which the
edge gateway answers with `404 "No route found"` (service traffic must go through the `/proxy/*`
handler), plus a set of request/response field-name and tenant-scoping mismatches. All proven
end-to-end against production through the real SDK (`prodsmoke_test.go`, `auth/prodsmoke_test.go`,
gated on the synthetic-canary key).

### Fixed

- **All service prefixes** `/<svc>/v1` → `/proxy/<svc>/v1` (and storage's double `/storage/storage/v1`
  → `/proxy/storage/v1`). Bare paths 404'd at the edge.
- **Central tenantId injection** — the activated tenant is now injected into every GET query and
  write body (caller-supplied wins). Backend read/write routes scope by `tenantId`; without it
  `kms`/`vault` list+create returned `400 "missing tenant"`.
- **`kms`** request/response fields: `Sign`/`Verify` use `data`/`signature` (were
  `dataB64`/`signatureB64`); `Wrap`/`Unwrap` use `dataKey`/`wrappedKey`; `CreateKey` now sends the
  required `keyId` (generated) + `keyType` (`data`) and folds `purpose` into `metadata` (was
  `{algorithm, purpose}` → `400 "Invalid request body"`).
- **`vault`** `CreateSecret` maps `PayloadB64` → `payload`; `RotateSecret` → `newPayload` (were
  `payloadB64`, silently stripped by the non-strict schema → empty stored secret).
- **`qnsp/auth`** rewritten to the real routes: `Login` → `/edge/auth/login`, `RefreshToken` →
  `/edge/auth/token/refresh` (credentials/refresh in body, no auth header); `Revoke`/`MfaChallenge`/
  `MfaVerify`/`EvaluateRisk`/`ListRiskPolicies` → bare `/auth/*` with the cached session JWT +
  `x-qnsp-tenant-id` header. `Login` caches the session for subsequent calls.

### Removed

- **WebAuthn passkey and SAML/OIDC federation methods** from `qnsp/auth`. The old `/passkeys/*`
  and `/federate/*` paths did not exist on the backend; the real surfaces are `/auth/webauthn/*`
  (a browser authenticator ceremony, not driveable from a server-side api-key SDK) and
  `/auth/federation/scim|saml/acs` (a SCIM/SAML-ACS provisioning + callback API). Removed rather
  than ship dead endpoints.

## [0.2.0] — 2026-04-30

**Full-parity release.** Adds the two customer-facing service modules that were missing in 0.1.0, bringing the Go SDK to feature parity with the TypeScript family (11 service modules total).

### Added

- `qnsp/auth` — `*Client` with `Login`, `RefreshToken`, `Revoke`, WebAuthn passkey lifecycle (register/authenticate start+complete, list, delete), `MfaChallenge`/`MfaVerify`, `FederateSAML`/`FederateOIDC`, `EvaluateRisk`, `ListRiskPolicies`. Wraps `apps/auth-service` (`/auth/v1`).
- `qnsp/ai` — `*Client` with model registry (`RegisterModel`, `ListModels`, `GetModel`, `UpdateModel`, `ActivateModel`, `DeployModel`), workloads (`SubmitWorkload`, `GetWorkload`, `ListWorkloads`, `CancelWorkload`) with enclave-attestation metadata, `InvokeInference`, `RegisterArtifact`. Wraps `apps/ai-orchestrator` (`/ai/v1`).
- Top-level `Client.Auth()` and `Client.AI()` accessors.

### Changed

- Activation handshake reports `sdkVersion="0.2.0"` (was `0.1.0`).

## [0.1.0] — 2026-04-30

Initial release. The SDK is general-purpose — every QNSP customer uses the same shape, with no per-partner namespaces.

### Added

- `qnsp.Client` with `Vault()`, `KMS()`, `Audit()`, `Tenant()`, `Access()`, `Billing()`, `CryptoInventory()`, `Storage()`, `Search()` accessors over a shared activation cache and HTTP connection pool.
- `qnsp/vault` — `*Client` with `CreateSecret`, `GetSecret`, `GetSecretVersion`, `RotateSecret`, `DeleteSecret`, `ListSecretVersions`.
- `qnsp/kms` — `*Client` with `CreateKey`, `ListKeys`, `GetKey`, `RotateKey`, `DeleteKey`, `Sign`, `Verify`, `Wrap`, `Unwrap`.
- `qnsp/audit` — `*Client` with `LogEvent`, `IngestEvents` (batch), `ListEvents`.
- `qnsp/tenant` — tenant CRUD, crypto-policy management, quotas, health snapshots.
- `qnsp/access` — RBAC roles, role assignments, `CheckPermission`.
- `qnsp/billing` — `GetEntitlements`, usage-meter ingest, invoice listing, credit-balance lookup.
- `qnsp/cryptoinventory` — Cryptographic Bill of Materials: asset listing, discovery runs, PQC readiness score.
- `qnsp/storage` — PQC-encrypted object storage (SSE-X): `PutObject`, `GetObject`, `DeleteObject`, `ListObjects`, `ListBuckets`.
- `qnsp/search` — encrypted vector search: index lifecycle, `UpsertVectors`, `Query`.
- Each submodule also exposes a generic `Do(ctx, method, path, body, query, idempotencyKey)` escape hatch for endpoints not yet typed.
- `qnsp/crypto` — local PQC primitives wrapping `liboqs-go` 0.12.0. Covers ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205), Falcon, plus the full liboqs 0.12.0 algorithm surface (HQC, BIKE, FrodoKEM, Classic-McEliece, MAYO, CROSS). Algorithm names mirror `@heossi/qnsp-cryptography` (TypeScript), `qnsp.crypto` (Python), and the new Rust SDK.
- `qnsp.Activator` — one-shot handshake against `/billing/v1/sdk/activate` with `sdkId="qnsp-go"`, cached with a 60 s near-expiry buffer.
- `qnsp.ParseWebhook` and `qnsp.VerifyWebhookSignature` — HMAC-SHA-256 verify, replay protection (`qnsp.MaxWebhookSkew = 5 * time.Minute`), typed `qnsp.WebhookEvent`.
- Top-level introspection: `Client.TenantID`, `Client.Tier`, `Client.Limits`, `Client.HasFeature`.
- Typed errors: `qnsp.Error`, `qnsp.NetworkError`, `qnsp.AuthError`, `qnsp.APIError`, `qnsp.WebhookError`.

### Notes

- The crypto subpackage requires `liboqs` to be installed at link time (`brew install liboqs` on macOS, `apt install liboqs-dev` on Debian). If you do not import `qnsp/crypto`, no native library is required.
