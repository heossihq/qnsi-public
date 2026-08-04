# Changelog

All notable changes to `qnsp` (Python SDK) will be documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-04-30

**Full-parity release.** The Python SDK now exposes the same 11 customer-facing service modules as the Go and Rust SDKs and the TypeScript family.

### Added

- `qnsp.auth` - `AuthClient`. Login, refresh, revoke, WebAuthn passkeys (register / authenticate start+complete, list, delete), MFA challenge/verify, federated identity (SAML / OIDC), risk-based authentication.
- `qnsp.tenant` - `TenantClient`. Tenant CRUD, crypto-policy management, current-health snapshot, current-quota readout.
- `qnsp.access` - `AccessClient`. RBAC roles, role assignments, `check_permission`.
- `qnsp.billing` - `BillingClient`. `get_entitlements`, `ingest_meter`, `ingest_meters` (batch), invoice listing, credit-balance lookup.
- `qnsp.crypto_inventory` - `CryptoInventoryClient`. Asset listing, discovery runs, PQC readiness score (CBOM).
- `qnsp.storage` - `StorageClient`. PQC-encrypted object storage with SSE-X: `put_object`, `get_object` (returns `(bytes, descriptor)`), `delete_object`, `list_objects`, `list_buckets`. Bytes are base64-encoded at the boundary; consumers work with raw `bytes`.
- `qnsp.search` - `SearchClient`. Encrypted vector search: index lifecycle, `upsert_vectors`, `query`.
- `qnsp.ai` - `AIClient`. Model registry (register / list / get / update / activate / deploy), workloads (submit / get / list / cancel) with enclave attestation, `invoke_inference`, artifact registration.

### Changed

- `QnsiClient.__init__` constructs all 11 sub-clients (was 3); they all share the same `httpx.Client` connection pool and the same activation cache.
- `__version__` bumped from `0.2.0` to `0.3.0`.
- Activation handshake now reports `sdkVersion="0.3.0"` (was `0.2.0`).

### Migration from 0.2.0

Existing `vault` / `kms` / `audit` / `crypto` / `webhooks` usage is unchanged. New modules are additive - no breaking changes:

```python
from qnsi import QnsiClient

with QnsiClient(api_key=...) as q:
    q.vault.get_secret("...")              # unchanged
    q.tenant.get_tenant("...")             # NEW in 0.3.0
    q.access.check_permission(             # NEW
        subject_id="...", permission="vault.read"
    )
    q.billing.get_entitlements()           # NEW
    q.search.query("docs", vector=[...], top_k=5)   # NEW
    q.storage.put_object("bucket", "key", data=b"...")  # NEW
    q.ai.invoke_inference(model_id="...", input={})     # NEW
    q.auth.login(email="...", password="...", tenant_id="...")  # NEW
    q.crypto_inventory.get_readiness_score("...")       # NEW
```

## [0.2.0] - 2026-04-30

**Repositioning release.** The SDK is now general-purpose - every QNSP customer uses the same shape, with no per-partner namespaces.

### Added

- `qnsp.crypto` - local PQC primitives via `liboqs-python` 0.12.0, opt-in via the `qnsi[crypto]` extra. Covers ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205), Falcon, plus the full liboqs 0.12.0 algorithm surface (HQC, BIKE, FrodoKEM, Classic-McEliece, MAYO, CROSS). Algorithm names mirror `@heossihq/qnsi-cryptography` and the new Go/Rust SDKs.
- `qnsp.vault` - `VaultClient` with create / get / get-version / rotate / delete / list-versions.
- `qnsp.kms` - `KmsClient` with create-key / list-keys / get-key / rotate / delete plus sign / verify / wrap / unwrap.
- `qnsp.audit` - `AuditClient` with log-event, ingest-events (batch), and list-events.
- `_service.py` - shared HTTP plumbing for service clients, including 401-triggered token refresh + retry.
- `_activation.py` - `ApiKeyActivation` flow that mirrors `@heossihq/qnsi-sdk-activation` from the TypeScript family. Handshake hits `/billing/v1/sdk/activate` with `sdkId="qnsp-python"`, caches the result with a 60 s near-expiry buffer.
- Generic `parse_qnsi_webhook()` and `verify_qnsi_webhook_signature()` - every QNSP webhook consumer needs these regardless of integration.
- Top-level introspection: `client.tenant_id`, `client.tier`, `client.limits`, `client.has_feature("sseEnabled")`.

### Changed

- **Removed all BEE-specific surface.** `qnsp.partners.bee`, `BeePartnerClient`, `BeeProvisionResponse`, `BeeStatusResponse`, `parse_bee_webhook`, `verify_bee_webhook_signature`, `BeeWebhookEvent` are all gone. Per-partner SDKs were the wrong abstraction; partners use QNSP like any other customer. The webhook helpers were renamed to QNSP-generic names since no partner-specific logic exists in them.
- `QnsiClient` no longer takes `client_id`/`client_secret`. The `from_partner_credentials` constructor is removed alongside `QnsiPartnerClient`. Service-account JWT minting can be reintroduced as a generic feature in a later release if a non-partner use case materialises.
- README rewritten to lead with vault / KMS / audit / local crypto. No BEE references.

### Migration from 0.1.x

If you were using the v0.1.0 BEE-specific SDK:

```diff
- from qnsi import QnsiClient, parse_bee_webhook
-
- with QnsiClient(client_id=..., client_secret=...) as q:
-     sub = q.bee.provision(...)
+ # Use httpx (or any HTTP client) to call the partner endpoints
+ # directly. The endpoints + auth are documented at
+ # docs/integrations/bee-partner-contract.md (private repo) /
+ # heossihq/qnsi-public if exported. The SDK no longer wraps them.
```

If you used `parse_bee_webhook` for general QNSP webhook verification (its only legitimate use):

```diff
- from qnsi import parse_bee_webhook
- event = parse_bee_webhook(...)
+ from qnsi import parse_qnsi_webhook
+ event = parse_qnsi_webhook(...)  # identical signature
```

## [0.1.0] - 2026-04-30 (yanked)

Initial release - BEE-partner-specific surface (provision / deprovision / status). Yanked from PyPI shortly after publish; superseded by the general-purpose 0.2.0. If you installed 0.1.0, upgrade with `pip install --upgrade qnsp` and follow the migration above.
