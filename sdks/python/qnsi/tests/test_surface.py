"""Local HTTP contract checks; these do not attest to live service availability."""

import json
from urllib.parse import quote

import httpx
import pytest
from test_services import _activation_payload

from qnsi import QnsiClient


def test_every_manifest_operation_preserves_verb_path_query_body_and_binding():
    recorded = []

    def handler(request):
        if request.url.path == "/billing/v1/sdk/activate":
            return httpx.Response(200, json=_activation_payload())
        recorded.append(request)
        return httpx.Response(200, json={"received": True})

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as http,
        QnsiClient(api_key="test-key", http_client=http) as client,
    ):
        operations = client.surface.operations()
        assert len(operations) > 800
        for operation in operations:
            params = {name: f"{name}/?# &%" for name in operation["pathParameters"]}
            body = None if operation["method"] == "GET" else {"data": "aGVsbG8="}
            assert client.surface.call_operation(
                operation["id"],
                path_parameters=params,
                body=body,
                query={"cursor": "next & # page", "limit": 5, "enabled": False},
                idempotency_key="req-1",
            ) == {"received": True}
            request = recorded[-1]
            expected = operation["path"]
            for name, value in sorted(params.items(), key=lambda pair: -len(pair[0])):
                expected = expected.replace(f":{name}", quote(value, safe=""))
            assert request.method == operation["method"]
            assert request.url.raw_path.split(b"?", 1)[0].decode() == expected
            assert request.url.params["tenantId"] == "tenant-abc"
            assert request.url.params["cursor"] == "next & # page"
            assert request.url.params["enabled"] == "false"
            assert request.headers["idempotency-key"] == "req-1"
            if body is not None:
                assert json.loads(request.content) == {
                    "data": "aGVsbG8=",
                    "tenantId": "tenant-abc",
                }
        operations[0]["id"] = "changed-by-caller"
        assert client.surface.operations()[0]["id"] != "changed-by-caller"


@pytest.mark.parametrize(
    "operation_id,params",
    [
        ("unknown", None),
        ("kms-service.getKeysKeyId", None),
        ("kms-service.getKeys", {"extra": "x"}),
        ("kms-service.getKeysKeyId", {"keyId": ""}),
        ("kms-service.getKeysKeyId", {"keyId": "."}),
        ("kms-service.getKeysKeyId", {"keyId": ".."}),
        ("kms-service.getKeysKeyId", {"keyId": 1}),
    ],
)
def test_invalid_operation_requests_never_send_credentials(operation_id, params):
    def handler(_request):
        pytest.fail("Invalid local contract must not issue an HTTP request")

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as http,
        QnsiClient(api_key="test-key", http_client=http) as client,
        pytest.raises(ValueError),
    ):
        client.surface.call_operation(operation_id, path_parameters=params)
