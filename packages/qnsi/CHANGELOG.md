# @heossihq/qnsi

## 0.5.3

### Patch Changes

- d9ab7af: Bump `@noble/post-quantum` 0.6.0 → 0.6.1 (the SDK's pure-JS / cross-verification PQC provider).

  Cryptographically equivalent to 0.6.0: the regenerated NIST ACVP determinism vectors confirm keygen output is byte-identical (every ML-KEM / ML-DSA / SLH-DSA key SHA-256 matched the 0.6.0 values), and the published conformance run is unchanged (noble 435/435 against the official NIST ACVP test vectors). No API or behavior change - the dependency floor moves to the latest patch.

## 0.3.0

### Minor Changes

- Framework-adapter consolidation: the former standalone satellites
  `@heossihq/qnsi-browser`, `-langchain-qnsp`, `-llamaindex-qnsp`, and
  `-autogen-qnsp` are folded in as subpaths of the one SDK -
  `@heossihq/qnsi/browser` (client-side PQC encryption/signing via
  `@noble/post-quantum`), `@heossihq/qnsi/langchain` (governed-agent
  toolkit), `@heossihq/qnsi/llamaindex` (SSE-X encrypted vector store), and
  `@heossihq/qnsi/autogen` (enclave code executor). Each subpath is
  self-contained (no internal `@heossihq/qnsi-*` workspace deps) and
  preserves the prior behavior, endpoints, SSE-X token crypto, and
  activation `sdkId`s byte-for-byte. Framework integrations
  (`@langchain/core`, `llamaindex`, `autogen`) are **optional**
  `peerDependencies`; `@noble/hashes`/`@noble/post-quantum` are runtime
  deps for the browser + llamaindex SSE-X paths. The four standalone
  packages are deleted (they were never published). Non-breaking: the
  root export and `@heossihq/qnsi/activation` are unchanged.

## 0.2.0

### Minor Changes

- Single-SDK consolidation: completes the `@qnsp` → `@heossihq/qnsi` scope
  migration, folds the CLI in as the `qnsp` bin, and exposes the inlined
  activation client as the `@heossihq/qnsi/activation` subpath. The retired
  standalone satellites (`-cli`, `-browser`, `-sdk-activation`,
  `-langchain-qnsp`, `-llamaindex-qnsp`, `-autogen-qnsp`) are unpublished;
  `@heossihq/qnsi` is the one SDK to install.

## 0.1.0 - 2026-04-30

**Initial release.** The single-package Node.js / TypeScript SDK for QNSP, replacing the 11 per-service `@heossihq/qnsi-*-sdk` packages with one consolidated entry point.

### Why this exists

The previous TypeScript SDK family was fragmented across 11 packages (`@heossihq/qnsi-vault-sdk`, `@heossihq/qnsi-kms-client`, `@heossihq/qnsi-audit-sdk`, `@heossihq/qnsi-auth-sdk`, `@heossihq/qnsi-tenant-sdk`, `@heossihq/qnsi-access-control-sdk`, `@heossihq/qnsi-billing-sdk`, `@heossihq/qnsi-crypto-inventory-sdk`, `@heossihq/qnsi-storage-sdk`, `@heossihq/qnsi-search-sdk`, `@heossihq/qnsi-ai-sdk`). Each ran its own activation handshake, kept its own version, owned its own CHANGELOG, and emitted its own activation telemetry - making it hard to answer simple questions like "did this developer's SDK reach our backend?" or "which SDK install tripped the activation gate?".

`@heossihq/qnsi` collapses that into one package with eleven sub-namespaces, mirroring the `qnsp` Python / Go / Rust SDK shape. One activation, one connection pool, one CHANGELOG, one source of truth - same diagnostic surface as the other-language SDKs.

### Added

- `QnsiClient({ apiKey, baseUrl?, timeoutMs? })` - top-level client. Lazily activates against `/billing/v1/sdk/activate` on first request, reports `sdkId="qnsp"` and `sdkVersion="0.1.0"`.
- Eleven service sub-clients sharing one HTTP pool + one activation cache:
  - `qnsp.vault` (createSecret / getSecret / getSecretVersion / rotateSecret / deleteSecret / listSecretVersions)
  - `qnsp.kms` (createKey / listKeys / getKey / rotateKey / deleteKey / sign / verify / wrap / unwrap)
  - `qnsp.audit` (logEvent / ingestEvents / listEvents)
  - `qnsp.auth` (login / refreshToken / revoke / WebAuthn passkey lifecycle / MFA / SAML / OIDC / risk-based auth)
  - `qnsp.tenant` (CRUD / crypto-policy management / quota / health)
  - `qnsp.access` (RBAC roles, role assignments, checkPermission)
  - `qnsp.billing` (entitlements, usage meters, invoices, credit balance)
  - `qnsp.cryptoInventory` (CBOM: assets, discovery runs, PQC readiness)
  - `qnsp.storage` (PQC-encrypted object storage with SSE-X)
  - `qnsp.search` (encrypted vector search)
  - `qnsp.ai` (model registry, workloads, inference, artifacts)
- `parseQnspWebhook` and `verifyQnspWebhookSignature` - HMAC-SHA-256 verification + replay protection, identical to the helpers in the Python / Go / Rust SDKs.
- Typed error hierarchy: `QnspError`, `QnspNetworkError`, `QnspAuthError`, `QnspApiError`, `QnspWebhookError`.
- Top-level introspection: `tenantId()`, `tier()`, `limits()`, `hasFeature(name)`, `ensureActivated()`.

### Migration

The 11 per-service `@heossihq/qnsi-*-sdk` packages on npm are now `npm deprecate`d to point at `@heossihq/qnsi`. Existing installs continue to work; new code should reach for `@heossihq/qnsi` directly. See the [Migration section in the README](./README.md#migration-from-per-service-sdks) for the import-by-import mapping.

The internal QNSP monorepo continues to use the per-service packages for service-to-service calls; that migration will happen in a separate wave and is invisible to external consumers.
