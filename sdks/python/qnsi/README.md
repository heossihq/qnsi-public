# qnsi - Python SDK for the Quantum-Native Security Infrastructure

[![PyPI version](https://img.shields.io/pypi/v/qnsi.svg)](https://pypi.org/project/qnsi/)
[![Python versions](https://img.shields.io/pypi/pyversions/qnsi.svg)](https://pypi.org/project/qnsi/)
[![License](https://img.shields.io/pypi/l/qnsi.svg)](./LICENSE)

Typed Python client for QNSI - post-quantum cryptography (ML-KEM, ML-DSA, SLH-DSA, Falcon via liboqs), PQC-encrypted vault, server-side KMS, immutable audit trails. Same wire contracts as the official `@heossihq/qnsi-*` TypeScript SDKs - pick whichever language fits your stack and the byte-for-byte outputs round-trip.

> **Free tier available.** Free-forever account at <https://cloud.qnsi.heossi.com/auth> - 60-second signup, no credit card. Includes 10 GB PQC storage, 50 000 API calls/month, 20 KMS keys, 25 vault secrets.

## Installation

Base install (HTTP clients for vault, KMS, audit):

```bash
pip install qnsi
```

With local PQC primitives (`qnsi.crypto` - wraps `liboqs-python` 0.12.0):

```bash
pip install 'qnsi[crypto]'
```

`liboqs-python` requires the `liboqs` C library available on the host. Easiest paths:

| Platform | Command |
| --- | --- |
| macOS | `brew install liboqs` |
| Debian/Ubuntu | `apt install liboqs-dev` |
| From source | `cmake -DBUILD_SHARED_LIBS=ON ...` - see <https://github.com/open-quantum-safe/liboqs> |

(A v0.3.x release will ship `cibuildwheel`-built wheels that bundle a self-contained liboqs binary, removing the system prerequisite.)

Requires Python 3.10+ and `httpx`. Tested on CPython 3.10, 3.11, 3.12, 3.13.

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

    # ── New in 0.3.0 - full parity with Go and Rust SDKs ────────────
    qnsi.tenant.get_tenant(qnsi.tenant_id)
    qnsi.access.check_permission(subject_id="user-1", permission="vault.read")
    qnsi.billing.get_entitlements()
    qnsi.crypto_inventory.get_readiness_score(qnsi.tenant_id)
    qnsi.storage.put_object("uploads", "report.pdf", data=b"...")
    qnsi.search.query("docs", vector=[0.1] * 768, top_k=5)
    qnsi.ai.invoke_inference(model_id="gpt-4o", input={"prompt": "..."})
    qnsi.auth.login(email="user@example.com", password="...", tenant_id=qnsi.tenant_id)
```

## Local PQC primitives

`qnsi.crypto` wraps `liboqs-python` so you don't have to write `oqs` calls yourself, and so the algorithm-name surface matches the rest of the QNSI ecosystem (TypeScript, Go, Rust):

```python
from qnsi.crypto import MlKem, MlDsa, SlhDsa, Falcon

# Module-Lattice KEM (FIPS 203)
kem = MlKem("ML-KEM-768")
pk, sk = kem.keygen()
enc = kem.encapsulate(pk)
recovered = kem.decapsulate(enc.ciphertext, sk)
assert recovered == enc.shared_secret

# Module-Lattice signatures (FIPS 204)
sig = MlDsa("ML-DSA-65")
sig_pk, sig_sk = sig.keygen()
signature = sig.sign(b"hello", sig_sk)
assert sig.verify(b"hello", signature, sig_pk)

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

## What's covered today (v0.3.0 - full parity with Go and Rust SDKs)

Customer-facing service modules - every QNSI service callable through the edge gateway:

- `qnsi.vault` - secrets management (create / get / get-version / rotate / delete / list-versions)
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

- `qnsi.crypto` (requires `qnsi[crypto]`) - ML-KEM (512/768/1024), ML-DSA (44/65/87), SLH-DSA (8 variants), Falcon (512/1024), plus BIKE, FrodoKEM, Classic-McEliece, MAYO, CROSS - every FIPS 203/204/205 finalist exposed by liboqs 0.12.0
- `qnsi.parse_qnsi_webhook` / `qnsi.verify_qnsi_webhook_signature` - HMAC-SHA-256 verify + replay protection
- `qnsi.QnsiClient` - API-key activation with caching and 401 retry

## What's coming

- `AsyncQnsiClient` - native-async variants using `httpx.AsyncClient`
- A `pytest` plugin that mocks the QNSI API for tests in your codebase
- Generated typed responses (currently `dict[str, Any]`) for every method

## License

Apache-2.0. See [LICENSE](./LICENSE).
