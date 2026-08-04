# Changelog - `io.heossi:qnsi` (JVM SDK)

## 0.1.0 - published to Maven Central 2026-06-01

First public release: `io.heossi:qnsi:0.1.0` is live on Maven Central
(`implementation("io.heossi:qnsi:0.1.0")`), GPG-signed, verified consumable
from a clean Gradle resolve. Contents below.

### Phase 1: core

- `QnsiClient` entry point (apiKey / baseUrl / timeoutMs; `@JvmOverloads`).
- `internal.Internal` OkHttp transport: Bearer auth, lazy activation cache,
  401 → re-activate → retry once, single per-call timeout, query/idempotency.
- `internal.Activation` handshake against `POST /billing/v1/sdk/activate`
  (`sdkId=qnsp-jvm`, `runtime=jvm`). Cache TTL honours the server's
  `expiresInSeconds` (corrects the npm SDK's latent `expiresAt` fallback).
- `QnsiException` taxonomy: `QnsiNetworkException`, `QnsiAuthException`,
  `QnsiApiException`, `QnsiWebhookException`.
- `QnsiWebhooks` - constant-time HMAC-SHA-256 verification + typed event parse,
  using `javax.crypto` only (no extra dependency).
- Tests: webhook verify/parse (pure JVM) + transport/activation/401-retry
  (OkHttp MockWebServer).

### Phase 2: service sub-clients

- All 11 service clients on the verified transport, mirroring the `@heossihq/qnsp`
  wire contract (paths, verbs, camelCase fields): `kms` (create/list/get/rotate/
  delete/sign/verify/wrap/unwrap), `vault`, `audit`, `auth` (login/refresh/revoke/
  passkeys/MFA/federation/risk), `tenant`, `access`, `billing`, `cryptoInventory`,
  `storage` (get/put with base64 via okio), `search`, `ai`.
- Typed `@Serializable` request DTOs (Java-constructable via `@JvmOverloads`);
  responses return `JsonObject` (matches the reference SDK's untyped responses);
  KMS crypto ops return `ByteArray`/`Boolean`.
- Verified: gradle build green, 16 tests 0 failures (InternalTest 4,
  ServiceClientsTest 7, WebhooksTest 5).

Pending: Phase 0 billing-service enum + deploy; Phase 3 explicit-API +
binary-compatibility validator; Phase 4 Maven Central.
