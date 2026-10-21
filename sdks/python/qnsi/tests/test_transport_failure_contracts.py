"""Local fault injection into real httpx request building, not production evidence."""

import httpx
import pytest
from test_services import _activation_payload

from qnsi import QnsiApiError, QnsiClient, QnsiNetworkError


@pytest.mark.parametrize("retry", [False, True])
def test_network_errors_have_the_same_contract_on_initial_send_and_retry(retry):
    count = 0

    def handler(request):
        nonlocal count
        if request.url.path == "/billing/v1/sdk/activate":
            return httpx.Response(200, json=_activation_payload())
        count += 1
        if retry and count == 1:
            return httpx.Response(401, json={"message": "expired"})
        raise httpx.ConnectError("connection unavailable", request=request)

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as http,
        QnsiClient(api_key="test-key", http_client=http) as client,
        pytest.raises(QnsiNetworkError) as caught,
    ):
        client.kms.list_keys()
    assert isinstance(caught.value.__cause__, httpx.ConnectError)
    assert count == (2 if retry else 1)


@pytest.mark.parametrize("at_activation,retry", [(True, False), (False, False), (False, True)])
def test_redirects_cannot_forward_credentials_even_with_redirect_enabled_http_client(
    at_activation, retry
):
    recorded = []
    count = 0

    def handler(request):
        nonlocal count
        recorded.append(request)
        assert request.url.host == "api.test"
        if not at_activation and request.url.path == "/billing/v1/sdk/activate":
            return httpx.Response(200, json=_activation_payload())
        count += 1
        if retry and count == 1:
            return httpx.Response(401, json={"message": "expired"})
        return httpx.Response(307, headers={"location": "https://untrusted.test/receive"}, json={})

    with (
        httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True) as http,
        QnsiClient(api_key="test-key", base_url="https://api.test", http_client=http) as client,
        pytest.raises(QnsiApiError) as caught,
    ):
        client.kms.list_keys()
    assert caught.value.status_code == 307
    assert all(request.url.host == "api.test" for request in recorded)


@pytest.mark.parametrize(
    "payload,expected",
    [("[1,2]", {"_raw": [1, 2]}), ("null", {"_raw": None}), ('"value"', {"_raw": "value"})],
)
def test_valid_non_object_json_is_preserved(payload, expected):
    def handler(request):
        return (
            httpx.Response(200, json=_activation_payload())
            if request.url.path == "/billing/v1/sdk/activate"
            else httpx.Response(200, text=payload)
        )

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as http,
        QnsiClient(api_key="test-key", http_client=http) as client,
    ):
        assert client.kms.list_keys() == expected


def test_malformed_success_json_fails_instead_of_becoming_null():
    def handler(request):
        return (
            httpx.Response(200, json=_activation_payload())
            if request.url.path == "/billing/v1/sdk/activate"
            else httpx.Response(200, text="not-json")
        )

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as http,
        QnsiClient(api_key="test-key", http_client=http) as client,
        pytest.raises(QnsiApiError) as caught,
    ):
        client.kms.list_keys()
    assert caught.value.code == "INVALID_RESPONSE_JSON"
