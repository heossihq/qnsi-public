---
title: Python SDK
version: 0.2.0
last_updated: 2026-04-30
copyright: © 2025-2026 HEOSSI. All rights reserved.
---
# Python SDK

Single `qnsi` package on PyPI ([source](https://github.com/heossihq/qnsi-public/tree/main/sdks/python/qnsi), [changelog](https://github.com/heossihq/qnsi-public/blob/main/sdks/python/qnsi/CHANGELOG.md)).

## Installation

```bash
pip install qnsi
```

For local PQC primitives (`qnsi.crypto`, wrapping `liboqs-python` 0.12.0):

```bash
pip install 'qnsi[crypto]'
```

`liboqs-python` requires the `liboqs` C library:

| Platform | Command |
| --- | --- |
| macOS | `brew install liboqs` |
| Debian/Ubuntu | `apt install liboqs-dev` |
| From source | <https://github.com/open-quantum-safe/liboqs> |

Requires Python 3.10+. Tested on CPython 3.10, 3.11, 3.12, 3.13.

## Quick start

```python
import os, base64
from qnsi import QnsiClient

with QnsiClient(api_key=os.environ["QNSI_API_KEY"]) as qnsi:
    # Vault — PQC-encrypted secret storage
    secret = qnsi.vault.create_secret(
        name="openai-api-key",
        payload_b64=base64.b64encode(b"sk-...").decode(),
        algorithm="ml-kem-768",
    )

    # KMS — server-side PQC keys
    key = qnsi.kms.create_key(algorithm="ml-dsa-65", purpose="signing")
    sig = qnsi.kms.sign(key["keyId"], data=b"hello")
    assert qnsi.kms.verify(key["keyId"], data=b"hello", signature=sig)

    # Audit — immutable, hash-chained event log
    qnsi.audit.log_event(
        event_type="model.inference",
        payload={"modelId": "gpt-4o", "latencyMs": 412},
    )
```

## Local PQC primitives

```python
from qnsi.crypto import MlKem, MlDsa, SlhDsa, Falcon

kem = MlKem("ML-KEM-768")
pk, sk = kem.keygen()
enc    = kem.encapsulate(pk)
assert kem.decapsulate(enc.ciphertext, sk) == enc.shared_secret
```

## Webhook verification

```python
from qnsi import parse_qnsi_webhook
event = parse_qnsi_webhook(
    body=raw_body,
    signature_header=request.headers["x-qnsp-signature"],
    timestamp_header=request.headers["x-qnsp-timestamp"],
    secret=os.environ["QNSI_WEBHOOK_SECRET"],
)
```

HMAC-SHA-256 verify, 5-minute replay window by default, typed `QnsiWebhookEvent` return.

## Activation + introspection

```python
qnsi.tenant_id              # resolved tenant
qnsi.tier                   # plan tier
qnsi.limits                 # full limits dict
qnsi.has_feature("sseEnabled")
```

## What's covered today

- `qnsi.crypto` — ML-KEM, ML-DSA, SLH-DSA, Falcon (full liboqs 0.12.0 surface) — see [`src/qnsi/crypto/`](https://github.com/heossihq/qnsi-public/tree/main/sdks/python/qnsi/src/qnsi/crypto)
- `qnsi.vault` — [`src/qnsi/vault.py`](https://github.com/heossihq/qnsi-public/blob/main/sdks/python/qnsi/src/qnsi/vault.py)
- `qnsi.kms` — [`src/qnsi/kms.py`](https://github.com/heossihq/qnsi-public/blob/main/sdks/python/qnsi/src/qnsi/kms.py)
- `qnsi.audit` — [`src/qnsi/audit.py`](https://github.com/heossihq/qnsi-public/blob/main/sdks/python/qnsi/src/qnsi/audit.py)
- Webhook verify + parse, API-key activation with caching and 401 retry

## What's coming in v0.3.0

To match the Go and Rust v0.1.0 surface, the Python package will gain:

- `qnsi.tenant` — tenant CRUD and crypto-policy management
- `qnsi.access` — RBAC roles and permissions
- `qnsi.billing` — entitlements, usage meters, invoices
- `qnsi.crypto_inventory` — CBOM
- `qnsi.storage` — PQC-encrypted object storage (SSE-X)
- `qnsi.search` — encrypted vector search

In the meantime, you can call those services directly via `httpx` against `https://api.qnsi.heossi.com/proxy/<service>/...` using the same auth header the SDK uses (`authorization: Bearer <api_key>`).
