"""Tests for vault, kms, and audit clients via QnsiClient."""

from __future__ import annotations

import base64
from typing import Any

import httpx
import pytest

from qnsi import QnsiApiError, QnsiClient


def _activation_payload() -> dict[str, Any]:
    return {
        "tenantId": "tenant-abc",
        "tier": "free",
        "limits": {"sseEnabled": False, "aiInferenceEnabled": True, "apiCalls": 50_000, "storageGB": 10, "enclavesEnabled": False, "aiTrainingEnabled": False},
        "activationToken": "tok-1",
        "expiresInSeconds": 3600,
    }


def _route_handler(routes: dict[str, Any]) -> Any:
    """MockTransport handler keyed by '<METHOD> <path>'."""

    def handler(request: httpx.Request) -> httpx.Response:
        key = f"{request.method} {request.url.path}"
        spec = routes.get(key)
        if spec is None:
            return httpx.Response(404, json={"error": f"unknown route {key}"})
        if callable(spec):
            return spec(request)
        return httpx.Response(spec.get("status", 200), json=spec.get("json", {}))

    return handler


def _activate_route() -> dict[str, Any]:
    return {"POST /billing/v1/sdk/activate": {"json": _activation_payload()}}


def _client_with(routes: dict[str, Any]) -> QnsiClient:
    transport = httpx.MockTransport(_route_handler(routes))
    http = httpx.Client(transport=transport)
    return QnsiClient(api_key="qnsp_pqc_test_abc", http_client=http)


# ── vault ─────────────────────────────────────────────────────────────────


def test_vault_create_and_get() -> None:
    routes = {
        **_activate_route(),
        "POST /proxy/vault/v1/secrets": {
            "json": {"id": "sec-1", "name": "openai-key", "version": 1},
        },
        "GET /proxy/vault/v1/secrets/sec-1": {
            "json": {"id": "sec-1", "name": "openai-key", "version": 1},
        },
    }
    with _client_with(routes) as q:
        created = q.vault.create_secret(
            name="openai-key", payload_b64=base64.b64encode(b"sk-test").decode()
        )
        assert created["id"] == "sec-1"
        again = q.vault.get_secret("sec-1")
        assert again["name"] == "openai-key"


def test_vault_rotate() -> None:
    routes = {
        **_activate_route(),
        "POST /proxy/vault/v1/secrets/sec-1/rotate": {
            "json": {"id": "sec-1", "version": 2},
        },
    }
    with _client_with(routes) as q:
        rotated = q.vault.rotate_secret(
            "sec-1", new_payload_b64=base64.b64encode(b"sk-new").decode()
        )
        assert rotated["version"] == 2


def test_vault_delete_returns_none() -> None:
    routes = {
        **_activate_route(),
        "DELETE /proxy/vault/v1/secrets/sec-1": {"status": 204, "json": {}},
    }
    with _client_with(routes) as q:
        assert q.vault.delete_secret("sec-1", tenant_id="t-1") is None


# ── kms ───────────────────────────────────────────────────────────────────


def test_kms_create_key_and_sign_verify() -> None:
    signature_bytes = b"\x01\x02\x03\x04"
    signature_b64 = base64.b64encode(signature_bytes).decode()

    routes = {
        **_activate_route(),
        "POST /proxy/kms/v1/keys": {"json": {"keyId": "key-abc", "algorithm": "ml-dsa-65"}},
        # The real kms-service returns `signature` (proven against production
        # 2026-07-14: kms.sign returned 3309 real ML-DSA-65 bytes). This mock said
        # `signatureBase64`, so the test asserted a contract the backend does not have.
        "POST /proxy/kms/v1/keys/key-abc/sign": {
            "json": {"signature": signature_b64},
        },
        "POST /proxy/kms/v1/keys/key-abc/verify": {"json": {"valid": True}},
    }
    with _client_with(routes) as q:
        key = q.kms.create_key(algorithm="ml-dsa-65", purpose="signing")
        assert key["keyId"] == "key-abc"
        sig = q.kms.sign("key-abc", b"hello")
        assert sig == signature_bytes
        assert q.kms.verify("key-abc", b"hello", sig) is True


def test_kms_4xx_raises_api_error_with_code() -> None:
    routes = {
        **_activate_route(),
        "POST /proxy/kms/v1/keys": {
            "status": 422,
            "json": {"error": "tier does not allow ml-dsa-87", "code": "TIER_LIMIT"},
        },
    }
    with _client_with(routes) as q, pytest.raises(QnsiApiError) as exc:
        q.kms.create_key(algorithm="ml-dsa-87")
    assert exc.value.status_code == 422
    assert exc.value.code == "TIER_LIMIT"


# ── audit ─────────────────────────────────────────────────────────────────


def test_audit_log_event_and_list() -> None:
    seen: dict[str, Any] = {"posted": None}

    def post_handler(request: httpx.Request) -> httpx.Response:
        import json

        seen["posted"] = json.loads(request.content.decode())
        return httpx.Response(200, json={"events": [{"id": "evt-1"}]})

    routes = {
        **_activate_route(),
        "POST /proxy/audit/v1/events": post_handler,
        "GET /proxy/audit/v1/events": {
            "json": {"events": [{"id": "evt-1", "eventType": "model.inference"}]},
        },
    }
    with _client_with(routes) as q:
        result = q.audit.log_event(
            event_type="model.inference", payload={"modelId": "gpt-4o"}
        )
        assert result["events"][0]["id"] == "evt-1"
        assert seen["posted"]["events"][0]["eventType"] == "model.inference"

        listed = q.audit.list_events(event_type="model.inference", limit=10)
        assert listed["events"][0]["eventType"] == "model.inference"


# ── activation introspection on the top-level client ─────────────────────


def test_qnsp_client_exposes_activation_metadata() -> None:
    with _client_with(_activate_route()) as q:
        assert q.tenant_id == "tenant-abc"
        assert q.tier == "free"
        assert q.has_feature("aiInferenceEnabled") is True
        assert q.has_feature("enclavesEnabled") is False


# ── 401 retry on stale token ─────────────────────────────────────────────


def test_service_call_retries_once_on_401() -> None:
    activation_calls = {"count": 0}
    secret_calls = {"count": 0}

    def activate_handler(_request: httpx.Request) -> httpx.Response:
        activation_calls["count"] += 1
        return httpx.Response(
            200,
            json={
                **_activation_payload(),
                "activationToken": f"tok-{activation_calls['count']}",
            },
        )

    def get_handler(_request: httpx.Request) -> httpx.Response:
        secret_calls["count"] += 1
        if secret_calls["count"] == 1:
            return httpx.Response(401, json={"error": "token expired"})
        return httpx.Response(200, json={"id": "sec-1", "version": 1})

    routes = {
        "POST /billing/v1/sdk/activate": activate_handler,
        "GET /proxy/vault/v1/secrets/sec-1": get_handler,
    }
    with _client_with(routes) as q:
        result = q.vault.get_secret("sec-1")
    assert result["id"] == "sec-1"
    assert activation_calls["count"] == 2  # initial + refresh after 401
    assert secret_calls["count"] == 2
