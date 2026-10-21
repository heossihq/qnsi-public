"""Local wire contracts with controlled HTTP, not live provider or production evidence."""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from qnsi import QnsiApiError, QnsiClient

TENANT = "155f43f3-bb3f-43be-b62c-0c0c97b5b5b0"


@pytest.fixture
def wire() -> Any:
    requests: list[httpx.Request] = []
    responses: list[httpx.Response] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/billing/v1/sdk/activate":
            return httpx.Response(
                200,
                json={
                    "tenantId": TENANT,
                    "tier": "free",
                    "limits": {},
                    "activationToken": "owned-local-test-token",
                    "expiresInSeconds": 3600,
                },
            )
        requests.append(request)
        if not responses:
            raise AssertionError("No controlled HTTP response was supplied")
        return responses.pop(0)

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as http,
        QnsiClient(api_key="owned-local-test-key", http_client=http) as client,
    ):
        yield client.vault, requests, responses


@pytest.mark.parametrize("options", [False, True])
def test_config_creation_uses_approved_reference_and_backend_fields(
    wire: Any, options: bool
) -> None:
    vault, requests, responses = wire
    responses.append(httpx.Response(201, json={"id": "owned-config", "engineType": "postgresql"}))
    optional = (
        {
            "role_template": {"creationStatements": ["SELECT 1"]},
            "default_ttl_seconds": 60,
            "max_ttl_seconds": 120,
            "tenant_id": TENANT,
            "idempotency_key": "owned-idempotency-key",
        }
        if options
        else {}
    )
    created = vault.create_dynamic_secret_config(
        name="owned-config",
        engine_type="postgresql",
        connection_ref="approved-test-reference",
        **optional,
    )
    assert created == {"id": "owned-config", "engineType": "postgresql"}
    request = requests[-1]
    assert request.method == "POST"
    assert request.url.path == "/proxy/vault/v1/dynamic-secrets/configs"
    expected = {
        "name": "owned-config",
        "engineType": "postgresql",
        "connectionRef": "approved-test-reference",
        "secretType": "database",
        "tenantId": TENANT,
    }
    if options:
        expected.update(
            {
                "roleTemplate": {"creationStatements": ["SELECT 1"]},
                "defaultTtlSeconds": 60,
                "maxTtlSeconds": 120,
            }
        )
        assert request.headers["idempotency-key"] == "owned-idempotency-key"
    assert json.loads(request.content) == expected
    assert request.url.params["tenantId"] == TENANT


def test_catalog_filters_and_measured_stats_are_passed_through(wire: Any) -> None:
    vault, requests, responses = wire
    catalog = {"engines": [{"engineType": "ssh_signed_certs", "implemented": False, "subPhase": 4}]}
    responses.append(httpx.Response(200, json=catalog))
    assert vault.list_dynamic_secret_engines() == catalog
    assert requests[-1].url.path.endswith("/dynamic-secrets/engines")
    responses.append(httpx.Response(200, json={"configs": []}))
    assert vault.list_dynamic_secret_configs(
        engine_type="ssh_signed_certs", secret_type="ssh_key", tenant_id=TENANT
    ) == {"configs": []}
    assert requests[-1].url.params["engineType"] == "ssh_signed_certs"
    assert requests[-1].url.params["secretType"] == "ssh_key"
    responses.append(httpx.Response(200, json={"configs": []}))
    vault.list_dynamic_secret_configs()
    assert set(requests[-1].url.params) == {"tenantId"}
    stats = {"totalConfigs": 2, "failedLeases": 1, "revokingLeases": 3}
    responses.append(httpx.Response(200, json=stats))
    assert vault.get_dynamic_secret_stats(tenant_id=TENANT) == stats
    assert requests[-1].url.path.endswith("/dynamic-secrets/stats")
    responses.append(httpx.Response(503, json={"error": "DYNAMIC_SECRET_STATS_UNAVAILABLE"}))
    with pytest.raises(QnsiApiError):
        vault.get_dynamic_secret_stats()


@pytest.mark.parametrize("options", [False, True])
def test_engine_specific_credentials_and_renewal_payload(wire: Any, options: bool) -> None:
    vault, requests, responses = wire
    issued = {
        "leaseId": "owned-lease",
        "engineType": "aws_iam",
        "credentials": {
            "accessKeyId": "owned-test-access-id",
            "sessionToken": "owned-test-session",
        },
        "renewable": False,
    }
    responses.append(httpx.Response(201, json=issued))
    optional = (
        {
            "ttl_seconds": 60,
            "metadata": {},
            "tenant_id": TENANT,
            "idempotency_key": "owned-request-id",
        }
        if options
        else {}
    )
    assert vault.request_credentials("config/encoded", **optional) == issued
    request = requests[-1]
    assert "configs/config%2Fencoded/credentials" in str(request.url)
    assert json.loads(request.content) == (
        {"ttlSeconds": 60, "metadata": {}, "tenantId": TENANT} if options else {"tenantId": TENANT}
    )
    responses.append(httpx.Response(200, json={"leaseId": "owned-lease", "ttlSeconds": 120}))
    assert (
        vault.renew_lease("lease/encoded", ttl_seconds=120 if options else None)["leaseId"]
        == "owned-lease"
    )
    assert "leases/lease%2Fencoded/renew" in str(requests[-1].url)
    assert json.loads(requests[-1].content) == (
        {"ttlSeconds": 120, "tenantId": TENANT} if options else {"tenantId": TENANT}
    )


@pytest.mark.parametrize("include_all_statuses", [None, False, True])
def test_recovery_states_metadata_null_and_queue_acknowledgement(
    wire: Any, include_all_statuses: bool | None
) -> None:
    vault, requests, responses = wire
    leases = {"leases": [{"id": "owned-lease", "status": "revoking", "metadata": None}]}
    responses.append(httpx.Response(200, json=leases))
    assert (
        vault.list_leases(
            "owned-config", include_all_statuses=include_all_statuses, tenant_id=TENANT
        )
        == leases
    )
    if include_all_statuses is None:
        assert "includeAllStatuses" not in requests[-1].url.params
    else:
        assert requests[-1].url.params["includeAllStatuses"] == str(include_all_statuses).lower()
    queued = {"leaseId": "owned-lease", "status": "revoking"}
    responses.append(httpx.Response(202, json=queued))
    assert vault.revoke_lease("lease/encoded") == queued
    assert requests[-1].method == "POST"
    assert "leases/lease%2Fencoded/revoke" in str(requests[-1].url)
