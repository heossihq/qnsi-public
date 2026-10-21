"""Request construction and malformed-response regressions, not live acceptance."""

import base64
import json

import pytest

from qnsi import QnsiApiError


def test_access_request_options(client_and_requests):
    q, requests, _ = client_and_requests
    for description in [None, "role description"]:
        q.access.create_role(name="reader", permissions=["read"], description=description)
        body = json.loads(requests[-1].content)
        assert body["permissions"] == ["read"]
        assert ("description" in body) == (description is not None)
    for scope in [None, "workspace"]:
        q.access.assign_role(role_id="role", subject_id="subject", scope=scope)
        assert ("scope" in json.loads(requests[-1].content)) == (scope is not None)
        q.access.check_permission(subject_id="subject", permission="read", scope=scope)
        assert ("scope" in json.loads(requests[-1].content)) == (scope is not None)
    q.access.get_role("role")
    q.access.list_roles()
    q.access.list_roles(limit=1)
    q.access.delete_role("role")
    q.access.revoke_role_assignment("assignment")
    assert requests[-1].method == "DELETE"


def test_search_request_options(client_and_requests):
    q, requests, _ = client_and_requests
    for options in [{}, {"metric": "cosine", "algorithm": "ml-kem-768", "metadata": {}}]:
        q.search.create_index(name="docs", dimensions=2, **options)
        body = json.loads(requests[-1].content)
        assert body["dimensions"] == 2
        for name, value in options.items():
            assert body[name] == value
    q.search.list_indexes()
    q.search.upsert_vectors("docs", [{"id": "1", "vector": [1, 0]}])
    assert json.loads(requests[-1].content)["vectors"][0]["id"] == "1"
    for filter in [None, {"kind": "public"}]:
        q.search.query("docs", vector=[1, 0], top_k=1, filter=filter)
        assert ("filter" in json.loads(requests[-1].content)) == (filter is not None)
    q.search.delete_index("docs")
    assert requests[-1].method == "DELETE"


def test_storage_request_and_response_contracts(client_and_requests):
    q, requests, response = client_and_requests
    for options in [
        {},
        {"content_type": "text/plain", "sse_algorithm": "ml-kem-768", "metadata": {}},
    ]:
        q.storage.put_object("bucket", "key", b"payload", **options)
        assert json.loads(requests[-1].content)["dataB64"] == base64.b64encode(b"payload").decode()
    response["body"] = {"dataB64": base64.b64encode(b"payload").decode()}
    assert q.storage.get_object("bucket", "key")[0] == b"payload"
    for body in [{}, {"dataB64": 3}, {"dataB64": "!invalid!"}]:
        response["body"] = body
        with pytest.raises((QnsiApiError, ValueError)):
            q.storage.get_object("bucket", "key")
    q.storage.list_buckets()
    q.storage.list_objects("bucket")
    q.storage.list_objects("bucket", limit=1)
    q.storage.delete_object("bucket", "key")


def test_inventory_and_auth_remaining_routes(client_and_requests):
    q, requests, _ = client_and_requests
    q.crypto_inventory.list_assets()
    q.crypto_inventory.list_assets(limit=1)
    q.crypto_inventory.get_asset("asset")
    q.crypto_inventory.get_asset_stats()
    q.crypto_inventory.get_readiness_score()
    for operation in [q.crypto_inventory.get_asset_stats, q.crypto_inventory.get_readiness_score]:
        operation("explicit-tenant")
        assert requests[-1].url.params["tenantId"] == "explicit-tenant"
        operation("")
        assert requests[-1].url.params["tenantId"] == ""
    for options in [{}, {"targets": ["localhost"], "modes": ["tls"], "options": {}}]:
        q.crypto_inventory.discover_assets(**options)
        assert ("targets" in json.loads(requests[-1].content)) == bool(options)
    q.crypto_inventory.discover_assets(source="code_repo")
    assert json.loads(requests[-1].content)["source"] == "code_repo"
    q.auth.login(email="user@example.com", password="test-password", tenant_id="tenant-abc")
    q.auth.delete_passkey("credential", user_id="user")
    assert requests[-1].url.path == "/proxy/auth/webauthn/credentials/credential"
    assert requests[-1].url.params["userId"] == "user"
    q.auth.mfa_challenge({})
    q.auth.mfa_verify({})
    q.auth.evaluate_risk({})
    q.auth.list_risk_policies("tenant-abc")


def test_vault_audit_remaining_options(client_and_requests):
    q, requests, _ = client_and_requests
    q.vault.create_secret(name="secret", payload_b64="YQ==", tenant_id="explicit-tenant")
    assert json.loads(requests[-1].content)["tenantId"] == "explicit-tenant"
    q.vault.get_secret("secret", lease_token="lease")
    assert requests[-1].url.params["leaseToken"] == "lease"
    q.vault.get_secret_version("secret", 1)
    q.vault.rotate_secret("secret", new_payload_b64="Yg==", algorithm="ml-kem-768")
    assert json.loads(requests[-1].content)["metadata"]["algorithm"] == "ml-kem-768"
    q.vault.list_secret_versions("secret", limit=1, cursor="cursor")
    q.audit.log_event(event_type="test", actor_id="actor", resource_id="resource")
    event = json.loads(requests[-1].content)["events"][0]
    assert event["actorId"] == "actor" and event["resourceId"] == "resource"
    before = len(requests)
    assert q.audit.ingest_events([]) == {"events": []}
    assert len(requests) == before


def test_kms_remaining_operations_and_invalid_success_responses(client_and_requests):
    q, requests, response = client_and_requests
    q.kms.create_key(algorithm="ml-dsa-65", tenant_id="explicit-tenant", key_id="key")
    assert json.loads(requests[-1].content)["tenantId"] == "explicit-tenant"
    q.kms.get_key("key")
    q.kms.rotate_key("key")
    q.kms.delete_key("key", tenant_id="tenant-abc")
    for method, arguments in [
        (q.kms.sign, ("key", "invalid")),
        (q.kms.verify, ("key", "invalid", b"signature")),
        (q.kms.verify, ("key", b"message", "invalid")),
        (q.kms.wrap, ("key", "invalid")),
        (q.kms.unwrap, ("key", "invalid")),
    ]:
        with pytest.raises(TypeError):
            method(*arguments)
    for method, field, legacy in [
        (q.kms.sign, "signature", None),
        (q.kms.wrap, "wrappedKey", "ciphertextB64"),
        (q.kms.unwrap, "dataKey", "plaintextB64"),
    ]:
        for body in [{}, {field: 2}, {field: "!invalid!"}]:
            response["body"] = body
            with pytest.raises(ValueError):
                method("key", b"data")
        response["body"] = {field: "YQ=="}
        assert method("key", bytearray(b"data")) == b"a"
        if legacy:
            response["body"] = {legacy: "YQ=="}
            assert method("key", b"data") == b"a"
    for body in [{}, {"valid": "false"}, {"valid": 1}]:
        response["body"] = body
        with pytest.raises(ValueError):
            q.kms.verify("key", b"message", b"signature")
    response["body"] = {"valid": False}
    assert q.kms.verify("key", b"message", b"signature") is False
