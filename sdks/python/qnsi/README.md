# qnsi - Python SDK for the Quantum-Native Security Infrastructure

[![PyPI version](https://img.shields.io/pypi/v/qnsi.svg)](https://pypi.org/project/qnsi/)
[![Python versions](https://img.shields.io/pypi/pyversions/qnsi.svg)](https://pypi.org/project/qnsi/)
[![License](https://img.shields.io/pypi/l/qnsi.svg)](./LICENSE)

Python client for QNSI with service convenience APIs, optional local PQC primitives
through liboqs, and webhook verification. Language SDKs are independently versioned;
complete wire-schema parity and production acceptance require separate evidence.

> **Free tier available.** Free-forever account at <https://cloud.qnsi.heossi.com/auth> - 60-second signup, no credit card. Includes 10 GB PQC storage, 50 000 API calls/month, 20 KMS keys, 25 vault secrets.

## Manifest operation access (unreleased source)

`qnsi.surface.operations()` returns the bundled catalog of 880 manifest
declarations across 15 services. `qnsi.surface.call_operation(operation_id,
path_parameters=..., body=..., query=..., idempotency_key=...)` uses the existing
activation, tenant binding and retry transport. Reserved query characters and
path parameters are encoded; invalid or dot-segment parameters fail before HTTP.
Existing service methods remain available.

This is JSON operation access, not a typed payload schema for every route.
Backend schemas, permissions and endpoint-specific authentication still apply.
Catalog presence does not verify live availability. Publication, full-source
coverage and production acceptance of these additions are **NOT VERIFIED**.

## Installation

Base install (HTTP clients for vault, KMS, audit):

```bash
pip install qnsi
```

With local PQC primitives (`qnsi.crypto` - wraps `liboqs-python` 0.16.0.1 and
loads the host liboqs runtime, including liboqs 0.16.0 identifiers when present):

```bash
pip install 'qnsi[crypto]'
```

`liboqs-python` requires the `liboqs` C library available on the host. Easiest paths:

| Platform | Command |
| --- | --- |
| macOS | `brew install liboqs` |
| Debian/Ubuntu | `apt install liboqs-dev` |
| From source | `cmake -DBUILD_SHARED_LIBS=ON ...` - see <https://github.com/open-quantum-safe/liboqs> |

The Python wheel does not bundle a native library. Install a shared liboqs library
before importing the optional crypto module. Static archives are not sufficient.
Treat native-library paths and build environment variables as trusted configuration.
The binding pin includes the fix for
[GHSA-pw23-r5gj-42g8](https://github.com/open-quantum-safe/liboqs-python/security/advisories/GHSA-pw23-r5gj-42g8).

Declares Python 3.10+ support and requires `httpx`. The current source and patched
crypto binding passed the complete local suite on CPython 3.13 and 3.14 on macOS
ARM64. Current acceptance on other interpreters and platforms is **NOT VERIFIED**.

## Quick start

```python
import os
import base64

from qnsi import QnsiClient

with QnsiClient(api_key=os.environ["QNSI_API_KEY"]) as qnsi:
    # ── Vault - PQC-encrypted secret storage ─────────────────────────
    secret = qnsi.vault.create_secret(
        name="openai-api-key",
        payload_b64=base64.b64encode(b"sk-...").decode(),
        algorithm="ml-kem-768",
    )
    fresh = qnsi.vault.get_secret(secret["id"])

    # ── KMS - server-side PQC keys ──────────────────────────────────
    key = qnsi.kms.create_key(algorithm="ml-dsa-65", purpose="signing")
    signature = qnsi.kms.sign(key["keyId"], data=b"hello")
    assert qnsi.kms.verify(key["keyId"], data=b"hello", signature=signature)

    # ── Audit - immutable, hash-chained event log ───────────────────
    qnsi.audit.log_event(
        event_type="model.inference",
        payload={"modelId": "gpt-4o", "latencyMs": 412},
    )

    # Service convenience APIs
    qnsi.tenant.get_tenant(qnsi.tenant_id)
    qnsi.access.check_permission(subject_id="user-1", permission="vault.read")
    qnsi.billing.get_entitlements()
    qnsi.crypto_inventory.get_readiness_score(qnsi.tenant_id)
    qnsi.storage.put_object("uploads", "report.pdf", data=b"...")
    qnsi.search.query("docs", vector=[0.1] * 768, top_k=5)
    qnsi.ai.invoke_inference(model_deployment_id="your-deployment-id", input={"prompt": "..."})
    qnsi.auth.login(email="user@example.com", password="...", tenant_id=qnsi.tenant_id)
```

## Local PQC primitives

`qnsi.crypto` wraps `liboqs-python` so you don't have to write `oqs` calls yourself, and so the algorithm-name surface matches the rest of the QNSI ecosystem (TypeScript, Go, Rust):

```python
from qnsi.crypto import MlKem, MlDsa, SlhDsa, Falcon

# Module-Lattice KEM (FIPS 203)
kem = MlKem("ML-KEM-768")
pair = kem.keygen()
enc = kem.encapsulate(pair.public_key)
recovered = kem.decapsulate(enc.ciphertext, pair.secret_key)
assert recovered == enc.shared_secret

# Module-Lattice signatures (FIPS 204)
sig = MlDsa("ML-DSA-65")
sig_pair = sig.keygen()
signature = sig.sign(b"hello", sig_pair.secret_key)
assert sig.verify(b"hello", signature, sig_pair.public_key)

# Stateless hash-based signatures (FIPS 205) - conservative, no lattice assumption
slh = SlhDsa("SLH-DSA-SHA2-128f")

# Compact lattice signatures (NIST PQC selection)
fal = Falcon("Falcon-512")
```

Sizes match the FIPS specs exactly (the SDK reads them from the linked liboqs build, so no inline literals drift).

## Verifying inbound webhooks

QNSI signs every webhook with HMAC-SHA-256. Verify the **raw body** before parsing JSON:

```python
from fastapi import FastAPI, Request, HTTPException
from qnsi import parse_qnsi_webhook, QnsiWebhookError

app = FastAPI()

@app.post("/webhooks/qnsi")
async def receive(request: Request) -> dict:
    body = await request.body()
    try:
        event = parse_qnsi_webhook(
            body=body,
            signature_header=request.headers.get("x-qnsp-signature", ""),
            timestamp_header=request.headers.get("x-qnsp-timestamp"),
            secret=os.environ["QNSI_WEBHOOK_SECRET"],
        )
    except QnsiWebhookError as exc:
        raise HTTPException(400, str(exc))

    if event.event_type == "key.rotated":
        ...
    return {"ok": True}
```

The verifier runs HMAC comparison in constant time, rejects timestamps older than 5 minutes by default (replay protection), and refuses payloads missing required fields.

## Error handling

All errors descend from `qnsi.QnsiError`:

| Class | When |
| --- | --- |
| `QnsiNetworkError` | DNS, TLS, timeout, or connection failure |
| `QnsiAuthError` | API key rejected at activation |
| `QnsiApiError` | A service returned 4xx/5xx with a structured body |
| `QnsiWebhookError` | HMAC mismatch, expired timestamp, malformed body, etc. |

```python
from qnsi import QnsiApiError, QnsiNetworkError

try:
    qnsi.vault.get_secret("missing")
except QnsiApiError as exc:
    print("HTTP", exc.status_code, exc.code, exc.body)
except QnsiNetworkError as exc:
    print("Could not reach QNSI:", exc)
```

## Activation + tier introspection

`QnsiClient` performs a one-shot handshake against `/billing/v1/sdk/activate` on first use. The result is cached in memory; subsequent calls reuse it until ~1 minute before expiry. You can inspect the current activation:

```python
qnsi.tenant_id        # resolved tenant
qnsi.tier             # plan tier
qnsi.limits           # full limits dict
qnsi.has_feature("sseEnabled")  # convenience boolean
```

If the activation token is rotated server-side, the SDK invalidates its cache and retries the originating request once on a 401.

## Service convenience APIs

Tenant creation and single-meter ingestion accept a `request` dictionary with
the backend's required fields, including caller-supplied security evidence.
Model registration requires `model_type` or `request["modelType"]`; workloads
require a complete `request` including the signed manifest. Artifact registration
requires `document_id` and `version`. Inference requires `model_deployment_id`,
not a model registry ID. WebAuthn credential deletion requires `user_id`.
Legacy keywords remain accepted where possible, but cannot invent missing
security envelopes, signatures, deployment identities or document versions.
The backend remains authoritative for schema and cryptographic validation.

The convenience modules below expose subsets of service contracts:

- `qnsi.vault` - secrets management (create / get / get-version / rotate / soft-delete / list-versions), dynamic engine catalog/configuration, credential issuance, lease lifecycle and measured statistics
- `qnsi.kms` - server-side PQC keys (create / list / get / rotate / delete / sign / verify / wrap / unwrap)
- `qnsi.audit` - immutable hash-chained event log (log-event / ingest-events / list-events)
- `qnsi.auth` - login, refresh, revoke, WebAuthn passkeys, MFA, SAML/OIDC federation, risk-based auth
- `qnsi.tenant` - tenant CRUD, crypto-policy management, current-health, current-quotas
- `qnsi.access` - RBAC roles, role assignments, `check_permission`
- `qnsi.billing` - entitlements, usage meters (single + batch), invoice listing, credit balance
- `qnsi.crypto_inventory` - Cryptographic Bill of Materials: assets, discovery runs, PQC readiness
- `qnsi.storage` - PQC-encrypted object storage with SSE-X
- `qnsi.search` - encrypted vector search (index lifecycle, `upsert_vectors`, `query`)
- `qnsi.ai` - model registry, AI workloads with enclave attestation, `invoke_inference`, artifacts

Local primitives + integration:

- `qnsi.crypto` (requires `qnsi[crypto]`) - ML-KEM (512/768/1024), HQC (1/3/5 when exposed by the host liboqs runtime), ML-DSA (44/65/87), SLH-DSA (12 variants using liboqs 0.16 `SLH_DSA_*` identifiers with legacy SPHINCS+ fallbacks), Falcon/FN-DSA (512/1024), plus BIKE, FrodoKEM, Classic-McEliece, MAYO, CROSS. Available algorithms depend on the installed native build; unavailable algorithms fail closed.
- `qnsi.parse_qnsi_webhook` / `qnsi.verify_qnsi_webhook_signature` - HMAC-SHA-256 verify + replay protection
- `qnsi.QnsiClient` - API-key activation with caching and 401 retry

## What's coming

- `AsyncQnsiClient` - native-async variants using `httpx.AsyncClient`
- A `pytest` plugin that mocks the QNSI API for tests in your codebase
- Generated typed responses (currently `dict[str, Any]`) for every method

## Local verification

The new dynamic Vault methods use the mounted `engineType`, `connectionRef`,
`roleTemplate` and TTL contract. They retain engine-specific credential fields,
nullable recovery metadata and lifecycle states. Configuration creation requires
an approved connection reference; it does not provision account resources or
send inline admin credentials. `revoke_lease()` returns a queued acknowledgement,
not proof of completed provider revocation. Renewal is provider-backed when the
configured engine supports it; other engines reject unsupported renewal.

The existing `algorithm` keyword on secret creation remains request metadata,
not an authoritative crypto selector. Inspect the returned authenticated envelope
for the executing algorithm. Secret deletion is soft deletion, not destruction of
all historical values.

On local CPython 3.14 with the pinned liboqs build, the complete gate passes
223 tests with no skips, plus seven coverage-gate self-tests. Full-source coverage
measures 1,042 executable statements/lines, 274 branches and 327 function entries
across 22 Python production files, all at 100 percent. HTTP contract fixtures do
not establish live account behavior. Publication, other language parity,
distribution-matrix acceptance and production assurance remain NOT VERIFIED.

Crypto-inventory statistics and readiness calls now forward an explicitly supplied
`tenant_id` instead of silently discarding it. Omission selects the activated
tenant. Backend authorization still determines whether the requested tenant is
permitted; this client change does not approve tenant delegation.

From the monorepo root, `pnpm test:sdk-python` builds the pinned upstream liboqs
0.16.0 commit in an ignored cache, installs the optional crypto extra in an
isolated environment, and runs the entire suite. Every production Python source
file must be measured with no exclusions, 100 percent executable statement
lines and branches, and actual calls into every compiled source function,
including lambdas, generator expressions and lazy annotation functions. Skips and
expected failures reject the run. Coverage is local regression evidence, not
proof of production behavior or platform-wide assurance.

## License

Apache-2.0. See [LICENSE](./LICENSE).
