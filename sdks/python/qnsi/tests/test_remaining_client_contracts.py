"""Regression checks for mounted convenience-route contracts, not live acceptance."""

import json

import httpx
import pytest
from test_services import _activation_payload

from qnsi import QnsiClient


@pytest.mark.parametrize(
    "invoke,method,path,query",
    [
        (
            lambda q: q.billing.get_entitlements(),
            "GET",
            "/proxy/billing/v1/entitlements/resolved/tenant-abc",
            {},
        ),
        (lambda q: q.billing.ingest_meters([]), "POST", "/proxy/billing/v1/meters", {}),
        (
            lambda q: q.tenant.get_current_health("tenant-abc"),
            "GET",
            "/proxy/tenant/v1/health/current",
            {},
        ),
        (
            lambda q: q.tenant.get_current_quotas("tenant-abc"),
            "GET",
            "/proxy/tenant/v1/quotas/current",
            {},
        ),
        (lambda q: q.ai.list_models(), "GET", "/proxy/ai/v1/registry/models", {}),
        (lambda q: q.ai.get_model("model-1"), "GET", "/proxy/ai/v1/registry/models/model-1", {}),
        (
            lambda q: q.ai.update_model("model-1", {"description": "updated"}),
            "PATCH",
            "/proxy/ai/v1/registry/models/model-1",
            {},
        ),
        (
            lambda q: q.ai.activate_model("model-1"),
            "POST",
            "/proxy/ai/v1/registry/models/model-1/activate",
            {},
        ),
        (
            lambda q: q.ai.deploy_model({"modelId": "model-1", "environment": "staging"}),
            "POST",
            "/proxy/ai/v1/registry/deployments",
            {},
        ),
        (lambda q: q.auth.refresh_token("refresh"), "POST", "/proxy/auth/token/refresh", {}),
        (lambda q: q.auth.revoke("refresh"), "POST", "/proxy/auth/token/revoke", {}),
        (
            lambda q: q.auth.register_passkey_start(user_id="user", tenant_id="tenant-abc"),
            "POST",
            "/proxy/auth/webauthn/register/start",
            {},
        ),
        (
            lambda q: q.auth.register_passkey_complete({}),
            "POST",
            "/proxy/auth/webauthn/register/complete",
            {},
        ),
        (
            lambda q: q.auth.authenticate_passkey_start({}),
            "POST",
            "/proxy/auth/webauthn/authenticate/start",
            {},
        ),
        (
            lambda q: q.auth.authenticate_passkey_complete({}),
            "POST",
            "/proxy/auth/webauthn/authenticate/complete",
            {},
        ),
        (
            lambda q: q.auth.list_passkeys(user_id="user", tenant_id="tenant-abc"),
            "GET",
            "/proxy/auth/webauthn/credentials/user",
            {},
        ),
        (lambda q: q.auth.federate_saml({}), "POST", "/proxy/auth/federation/saml/assertion", {}),
        (lambda q: q.auth.federate_oidc({}), "POST", "/proxy/auth/federation/oidc/callback", {}),
    ],
)
def test_convenience_routes_match_backend_declarations(invoke, method, path, query):
    recorded = []

    def handler(request):
        if request.url.path == "/billing/v1/sdk/activate":
            return httpx.Response(200, json=_activation_payload())
        recorded.append(request)
        return httpx.Response(200, json={})

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as http,
        QnsiClient(api_key="test-key", http_client=http) as client,
    ):
        invoke(client)
    assert len(recorded) == 1
    assert recorded[0].method == method
    assert recorded[0].url.path == path
    assert recorded[0].url.params["tenantId"] == "tenant-abc"
    for name, value in query.items():
        assert recorded[0].url.params[name] == value


def test_meter_batch_binds_every_meter_without_mutating_caller():
    meter = {
        "source": "client",
        "meterType": "api_calls",
        "quantity": 2,
        "unit": "calls",
        "recordedAt": "2026-10-05T00:00:00Z",
        "security": {"pqcSignatures": []},
        "tenantId": "another-tenant",
    }
    recorded = []

    def handler(request):
        if request.url.path == "/billing/v1/sdk/activate":
            return httpx.Response(200, json=_activation_payload())
        recorded.append(json.loads(request.content))
        return httpx.Response(200, json={})

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as http,
        QnsiClient(api_key="test-key", http_client=http) as client,
    ):
        client.billing.ingest_meters([meter], idempotency_key="request-1")
    assert recorded[0]["meters"] == [{**meter, "tenantId": "tenant-abc"}]
    assert meter["tenantId"] == "another-tenant"
