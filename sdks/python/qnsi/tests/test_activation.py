"""Tests for the API-key activation flow."""

from __future__ import annotations

import time
from typing import Any

import httpx
import pytest

from qnsi._activation import ApiKeyActivation
from qnsi._errors import QnsiApiError, QnsiAuthError, QnsiNetworkError


def _transport(handler: Any) -> httpx.MockTransport:
    return httpx.MockTransport(handler)


def _activation_payload(**overrides: Any) -> dict[str, Any]:
    base = {
        "tenantId": "tenant-abc",
        "tier": "free",
        "limits": {
            "storageGB": 10,
            "apiCalls": 50_000,
            "enclavesEnabled": False,
            "aiTrainingEnabled": False,
            "aiInferenceEnabled": True,
            "sseEnabled": False,
        },
        "activationToken": "tok-1",
        "expiresInSeconds": 3600,
    }
    base.update(overrides)
    return base


def test_activation_caches_until_buffer() -> None:
    calls = {"count": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        return httpx.Response(200, json=_activation_payload(activationToken=f"tok-{calls['count']}"))

    client = httpx.Client(transport=_transport(handler))
    auth = ApiKeyActivation(api_key="qnsp_pqc_test", http_client=client)
    assert auth.tenant_id == "tenant-abc"
    assert auth.tenant_id == "tenant-abc"
    assert calls["count"] == 1


def test_activation_refreshes_near_expiry(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"count": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        return httpx.Response(
            200, json=_activation_payload(expiresInSeconds=30, activationToken=f"tok-{calls['count']}")
        )

    client = httpx.Client(transport=_transport(handler))
    auth = ApiKeyActivation(api_key="qnsp_pqc_test", http_client=client)
    auth.get_activation()  # primes cache, expires in 30 s, buffer 60 s
    real_time = time.time
    monkeypatch.setattr(time, "time", lambda: real_time() + 100)
    auth.get_activation()
    assert calls["count"] == 2


def test_activation_401_maps_to_auth_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "invalid api key"})

    client = httpx.Client(transport=_transport(handler))
    auth = ApiKeyActivation(api_key="qnsp_pqc_invalid", http_client=client)
    with pytest.raises(QnsiAuthError) as exc:
        auth.get_activation()
    assert exc.value.status_code == 401


def test_activation_500_maps_to_api_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="internal")

    client = httpx.Client(transport=_transport(handler))
    auth = ApiKeyActivation(api_key="qnsp_pqc_test", http_client=client)
    with pytest.raises(QnsiApiError) as exc:
        auth.get_activation()
    assert exc.value.status_code == 500


def test_activation_network_error_wrapped() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("simulated DNS failure", request=request)

    client = httpx.Client(transport=_transport(handler))
    auth = ApiKeyActivation(api_key="qnsp_pqc_test", http_client=client)
    with pytest.raises(QnsiNetworkError):
        auth.get_activation()


def test_activation_rejects_empty_key() -> None:
    with pytest.raises(ValueError):
        ApiKeyActivation(api_key="")


def test_has_feature_reads_limits() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json=_activation_payload(limits={"sseEnabled": True, "enclavesEnabled": False})
        )

    client = httpx.Client(transport=_transport(handler))
    auth = ApiKeyActivation(api_key="qnsp_pqc_test", http_client=client)
    assert auth.has_feature("sseEnabled") is True
    assert auth.has_feature("enclavesEnabled") is False
    assert auth.has_feature("nonexistent") is False
