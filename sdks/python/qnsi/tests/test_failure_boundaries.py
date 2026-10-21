"""Adversarial transport, dependency and parsing checks, not release approval."""

import builtins
import hashlib
import hmac
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError

import httpx
import pytest
from test_services import _activation_payload

from qnsi import QnsiApiError, QnsiClient, QnsiWebhookError, parse_qnsi_webhook
from qnsi._activation import ApiKeyActivation, _package_version
from qnsi._service import _ServiceClient
from qnsi.crypto import MlDsa, MlKem
from qnsi.crypto.kem import _import_oqs
from qnsi.webhooks import _parse_iso8601_utc, verify_qnsi_webhook_signature


def test_package_metadata_absence_has_explicit_local_version(monkeypatch):
    import qnsi._activation as activation

    def absent(_name):
        raise PackageNotFoundError("qnsi")

    monkeypatch.setattr(activation, "version", absent)
    assert _package_version() == "0.0.0+local"


def test_shared_activation_is_serialized_and_lifecycle_respects_ownership():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json=_activation_payload())

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        with ApiKeyActivation(api_key="test", http_client=http) as activation:
            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(lambda _: activation.get_activation(), range(16)))
            assert all(result is results[0] for result in results)
            assert len(calls) == 1
            assert activation.tier == "free" and activation.limits["apiCalls"] == 50_000
            client = _ServiceClient(activation=activation, http_client=http)
            assert client._url("/path", query={}) == "https://api.qnsi.heossi.com/proxy/path"
            assert (
                client._url("/path", query={"empty": None})
                == "https://api.qnsi.heossi.com/proxy/path"
            )
            assert client._url("/path?first=1", query={"second": 2}).endswith("?first=1&second=2")
            with QnsiClient(api_key="test", http_client=http) as q:
                assert q.limits["apiCalls"] == 50_000
                assert q.base_url == "https://api.qnsi.heossi.com"
        assert not http.is_closed
    with ApiKeyActivation(api_key="test") as owned:
        assert not owned._http.is_closed
    assert owned._http.is_closed
    with QnsiClient(api_key="test") as owned_client:
        assert not owned_client._http.is_closed
    assert owned_client._http.is_closed


@pytest.mark.parametrize(
    "status,body", [(403, []), (401, {"error": 4}), (200, []), (200, {}), (200, {"tenantId": 5})]
)
def test_activation_rejects_invalid_responses(status, body):
    from qnsi import QnsiAuthError

    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(status, json=body))
    ) as http:
        activation = ApiKeyActivation(api_key="test", http_client=http)
        with pytest.raises((QnsiApiError, QnsiAuthError)):
            activation.get_activation()


def test_activation_alternate_fields_remain_explicit():
    body = {
        "tenant_id": "tenant",
        "plan_tier": "enterprise",
        "limits": [1],
        "accessToken": "token",
        "expires_in": 120,
    }
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=body))
    ) as http:
        result = ApiKeyActivation(api_key="test", http_client=http).get_activation()
        assert result.tenant_id == "tenant" and result.tier == "enterprise"
        assert result.activation_token == "token" and result.limits == {}


@pytest.mark.parametrize("body", [{"message": "failure"}, {"error": 4}, [], None])
def test_service_error_shapes_and_error_string(body):
    def handler(request):
        if request.url.path == "/billing/v1/sdk/activate":
            return httpx.Response(200, json=_activation_payload())
        return (
            httpx.Response(503, json=body)
            if body is not None
            else httpx.Response(503, text="not-json")
        )

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as http,
        QnsiClient(api_key="test", http_client=http) as q,
    ):
        with pytest.raises(QnsiApiError) as caught:
            q.kms.list_keys()
        assert "status=503" in str(caught.value)
    assert "code=ERROR" in str(QnsiApiError("failure", status_code=400, code="ERROR"))


def test_missing_optional_binding_fails_with_install_hint(monkeypatch):
    real_import = builtins.__import__

    def missing(name, *args, **kwargs):
        if name == "oqs":
            raise ModuleNotFoundError("oqs")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", missing)
    with pytest.raises(ModuleNotFoundError, match=r"0\.16\.0\.1"):
        _import_oqs()


def test_native_kem_unavailable_and_candidate_recovery(monkeypatch):
    import qnsi.crypto.kem as kem_module

    monkeypatch.setattr(kem_module, "resolve_kem_candidates", lambda _: ("not-a-native-kem",))
    with pytest.raises(RuntimeError, match="does not expose KEM"):
        MlKem("ML-KEM-768")
    monkeypatch.setattr(
        kem_module, "resolve_kem_candidates", lambda _: ("not-a-native-kem", "ML-KEM-768")
    )
    with MlKem("ML-KEM-768") as kem:
        assert kem.liboqs_name == "ML-KEM-768"
        pair = kem.keygen()
        enc = kem.encapsulate(pair.public_key)
        assert kem.decapsulate(enc.ciphertext, pair.secret_key) == enc.shared_secret


@pytest.mark.parametrize(
    "native_name,wrapper,algorithm",
    [("KeyEncapsulation", MlKem, "ML-KEM-768"), ("Signature", MlDsa, "ML-DSA-65")],
)
@pytest.mark.parametrize(
    "details",
    [
        None,
        {},
        {"length_public_key": 0},
        {"length_public_key": True},
        {"length_public_key": "1184"},
    ],
)
def test_invalid_native_metadata_fails_and_releases_context(
    monkeypatch, native_name, wrapper, algorithm, details
):
    import oqs

    constructor = getattr(oqs, native_name)
    released = []

    def corrupt_metadata(name):
        context = constructor(name)
        context.details = details
        release = context.free

        def recorded_release():
            released.append(name)
            release()

        monkeypatch.setattr(context, "free", recorded_release)
        return context

    monkeypatch.setattr(oqs, native_name, corrupt_metadata)
    with pytest.raises(RuntimeError, match="size metadata"):
        wrapper(algorithm)
    assert released == [algorithm]


@pytest.mark.parametrize(
    "wrapper,name,attribute", [(MlKem, "ML-KEM-768", "_kem"), (MlDsa, "ML-DSA-65", "_sig")]
)
def test_native_cleanup_fault_is_idempotent(monkeypatch, wrapper, name, attribute):
    context = wrapper(name)
    native = getattr(context, attribute)
    native.free()

    def failed_free():
        raise RuntimeError("cleanup fault fixture")

    monkeypatch.setattr(native, "free", failed_free)
    with pytest.raises(RuntimeError, match="cleanup fault"):
        context.close()
    assert getattr(context, attribute) is None
    context.close()
    finalizer_context = wrapper(name)
    finalizer_native = getattr(finalizer_context, attribute)
    finalizer_native.free()
    monkeypatch.setattr(finalizer_native, "free", failed_free)
    with pytest.warns(ResourceWarning, match="cleanup failed"):
        finalizer_context.__del__()


@pytest.mark.parametrize("expiry", [0, -1, True, None, [], "invalid", "nan", "inf"])
def test_activation_rejects_invalid_expiry(expiry):
    with (
        httpx.Client(
            transport=httpx.MockTransport(
                lambda _: httpx.Response(
                    200, json={**_activation_payload(), "expiresInSeconds": expiry}
                )
            )
        ) as http,
        pytest.raises(QnsiApiError, match="invalid expiry"),
    ):
        ApiKeyActivation(api_key="test", http_client=http).get_activation()


def test_boolean_entitlements_do_not_trust_truthy_strings():
    with httpx.Client(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(
                200, json={**_activation_payload(), "limits": {"sseEnabled": "false"}}
            )
        )
    ) as http:
        assert ApiKeyActivation(api_key="test", http_client=http).has_feature("sseEnabled") is False


@pytest.mark.parametrize(
    "body,header,secret",
    [
        ("not-bytes", "sha256=x", "secret"),
        (b"{}", "", "secret"),
        (b"{}", None, "secret"),
        (b"{}", "sha256=x", ""),
        (b"{}", "sha256=x", None),
    ],
)
def test_webhook_invalid_signature_inputs(body, header, secret):
    with pytest.raises(QnsiWebhookError):
        verify_qnsi_webhook_signature(body=body, signature_header=header, secret=secret)


@pytest.mark.parametrize(
    "body,timestamp,expected",
    [
        (b"{}", None, "missing"),
        (b"{}", "invalid", "valid RFC"),
        (b"[]", "2026-10-05T00:00:00Z", "JSON object"),
        (b'{"id":"id","timestamp":"time"}', "2026-10-05T00:00:00Z", "event_type"),
        (b'{"type":"test","id":"id"}', "2026-10-05T00:00:00Z", "occurred_at"),
        (
            b'{"type":"test","id":"id","timestamp":"time","data":[1]}',
            "2026-10-05T00:00:00Z",
            "JSON object",
        ),
    ],
)
def test_webhook_invalid_parse_boundaries(body, timestamp, expected):
    secret = "test-secret"
    signature = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    with pytest.raises(QnsiWebhookError, match=expected):
        parse_qnsi_webhook(
            body=body,
            signature_header=signature,
            timestamp_header=timestamp,
            secret=secret,
            now=datetime(2026, 10, 5, tzinfo=timezone.utc),
        )


def test_webhook_timezone_normalization():
    expected = datetime(2026, 10, 5, tzinfo=timezone.utc)
    assert _parse_iso8601_utc("2026-10-05T00:00:00") == expected
    assert _parse_iso8601_utc("2026-10-05T08:00:00+08:00") == expected
