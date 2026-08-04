"""REGRESSION GUARD: the request bodies must match the backend's Zod schemas.

FOUND IN PRODUCTION 2026-07-14 with the PUBLISHED qnsi 0.4.0, against api.qnsi.heossi.com:

    vault.create_secret(name=..., payload_b64=...)  -> HTTP 500
    kms.list_keys()                                 -> HTTP 400 BAD_REQUEST

vault-service's own log gave the cause:

    ZodError: path ["payload"] - expected string, received undefined

Three real defects, all shipped:

1. `vault.create_secret` sent `payloadBase64`. The backend's createSecretSchema requires
   `payload`. It has NEVER worked.
2. `vault.rotate_secret` sent `newPayloadBase64`. rotateSecretSchema requires `newPayload`.
   Same story.
3. The central tenantId injection tested the KEY, not the VALUE:
       if query is None or "tenantId" not in query:
   `kms.list_keys` always passes `{"tenantId": None, ...}` - the key IS present, so
   injection was skipped, `_url` then dropped the None, and no tenant reached the wire.

Backend Zod objects are NON-STRICT: an unknown key like `payloadBase64`, or a top-level
`algorithm`, is silently STRIPPED rather than rejected. So a wrong field name does not
produce a helpful error - it produces a MISSING REQUIRED FIELD, and the SDK looks broken
for a reason the caller cannot see. That is why this is pinned by a test, not by review.

HOW THIS GUARD IS WIRED, AND WHY IT MATTERS:
it patches the HTTP CLIENT, not `_request`. The real `_service._request` therefore RUNS -
including its tenantId injection - and we assert on what actually went out. An earlier
draft replaced `_request` with a double that re-implemented the injection, so the guard was
testing a copy of the code it was meant to guard: it passed with the bug still in place.
No network, no credentials.
"""

from __future__ import annotations

import base64
from typing import Any
from urllib.parse import parse_qs, urlparse

from qnsi.kms import KmsClient
from qnsi.vault import VaultClient

TENANT = "155f43f3-bb3f-43be-b62c-0c0c97b5b5b0"


class _Activation:
    """Minimal activation double: base_url, tenant_id, and the api-key header."""

    base_url = "https://api.qnsi.heossi.com"
    tenant_id = TENANT
    api_key_header = {"authorization": "Bearer test"}

    def get_activation(self) -> None:
        return None

    def invalidate(self) -> None:  # pragma: no cover - not reached (we return 200)
        return None


class _Response:
    status_code = 200
    text = "{}"
    content = b"{}"

    @staticmethod
    def json() -> dict[str, Any]:
        return {}


class _HttpSpy:
    """Stands in for httpx.Client. The SDK's real _request runs against it."""

    def __init__(self) -> None:
        self.url: str | None = None
        self.json: dict[str, Any] | None = None

    def request(
        self,
        method: str,
        url: str,
        *,
        json: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        timeout: Any = None,
    ) -> _Response:
        self.url, self.json = url, json
        return _Response()

    @property
    def query(self) -> dict[str, str]:
        """The query string the SDK actually put on the wire."""
        if not self.url:
            return {}
        return {k: v[0] for k, v in parse_qs(urlparse(self.url).query).items()}


def _wire(cls: Any) -> tuple[Any, _HttpSpy]:
    spy = _HttpSpy()
    return cls(activation=_Activation(), http_client=spy, timeout=5), spy


def test_create_secret_sends_payload_not_payloadBase64() -> None:
    """createSecretSchema requires `payload`. `payloadBase64` produced a production 500."""
    client, spy = _wire(VaultClient)
    payload = base64.b64encode(b"value").decode()
    client.create_secret(name="a-secret", payload_b64=payload)

    assert spy.json is not None
    assert spy.json["payload"] == payload, "backend requires `payload`"
    assert "payloadBase64" not in spy.json, "the field the backend does not know"
    assert spy.json["name"] == "a-secret"


def test_create_secret_puts_algorithm_in_metadata_not_top_level() -> None:
    """`algorithm` is not a backend field - a non-strict Zod object silently strips it."""
    client, spy = _wire(VaultClient)
    client.create_secret(
        name="a-secret",
        payload_b64=base64.b64encode(b"v").decode(),
        algorithm="ml-kem-1024",
    )

    assert spy.json is not None
    assert "algorithm" not in spy.json, "would be silently stripped by the backend"
    assert spy.json["metadata"]["algorithm"] == "ml-kem-1024"


def test_rotate_secret_sends_newPayload_not_newPayloadBase64() -> None:
    """rotateSecretSchema requires `newPayload`. Same defect as create_secret."""
    client, spy = _wire(VaultClient)
    payload = base64.b64encode(b"v2").decode()
    client.rotate_secret("sec-1", new_payload_b64=payload)

    assert spy.json is not None
    assert spy.json["newPayload"] == payload
    assert "newPayloadBase64" not in spy.json


def test_tenant_id_is_injected_even_when_the_key_is_present_as_None() -> None:
    """The bug: `"tenantId" not in query` saw the KEY and skipped injection.

    kms.list_keys always builds {"tenantId": None, "limit": None, "cursor": None}, so the
    guard must test the VALUE. Without this, list_keys() 400s in production.
    """
    client, spy = _wire(KmsClient)
    client.list_keys()

    assert spy.query.get("tenantId") == TENANT, "must be injected, not dropped as None"


def test_a_caller_supplied_tenant_id_still_wins() -> None:
    client, spy = _wire(KmsClient)
    client.list_keys(tenant_id="11111111-2222-3333-4444-555555555555")

    assert spy.query.get("tenantId") == "11111111-2222-3333-4444-555555555555"


def test_write_bodies_carry_a_tenant_id() -> None:
    client, spy = _wire(VaultClient)
    client.create_secret(name="a-secret", payload_b64=base64.b64encode(b"v").decode())

    assert spy.json is not None
    assert spy.json["tenantId"] == TENANT
