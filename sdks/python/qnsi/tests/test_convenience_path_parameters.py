"""Encoded convenience identifiers cannot change routes or tenant query fields."""

from urllib.parse import quote

import pytest

from qnsi._service import _ServiceClient


@pytest.mark.parametrize(
    "invoke,template",
    [
        (lambda q, p: q.kms.get_key(p), "/kms/v1/keys/{p}"),
        (lambda q, p: q.kms.rotate_key(p), "/kms/v1/keys/{p}/rotate"),
        (lambda q, p: q.kms.delete_key(p, tenant_id="tenant-abc"), "/kms/v1/keys/{p}"),
        (lambda q, p: q.kms.sign(p, b"data"), "/kms/v1/keys/{p}/sign"),
        (lambda q, p: q.kms.verify(p, b"data", b"signature"), "/kms/v1/keys/{p}/verify"),
        (lambda q, p: q.kms.wrap(p, b"data"), "/kms/v1/keys/{p}/wrap"),
        (lambda q, p: q.kms.unwrap(p, b"data"), "/kms/v1/keys/{p}/unwrap"),
        (lambda q, p: q.vault.get_secret(p), "/vault/v1/secrets/{p}"),
        (lambda q, p: q.vault.get_secret_version(p, 1), "/vault/v1/secrets/{p}/versions/1"),
        (
            lambda q, p: q.vault.rotate_secret(p, new_payload_b64="YQ=="),
            "/vault/v1/secrets/{p}/rotate",
        ),
        (lambda q, p: q.vault.delete_secret(p, tenant_id="tenant-abc"), "/vault/v1/secrets/{p}"),
        (lambda q, p: q.vault.list_secret_versions(p), "/vault/v1/secrets/{p}/versions"),
        (lambda q, p: q.access.get_role(p), "/access/v1/roles/{p}"),
        (lambda q, p: q.access.delete_role(p), "/access/v1/roles/{p}"),
        (lambda q, p: q.access.revoke_role_assignment(p), "/access/v1/role-assignments/{p}"),
        (
            lambda q, p: q.auth.list_passkeys(user_id=p, tenant_id="tenant-abc"),
            "/auth/webauthn/credentials/{p}",
        ),
        (lambda q, p: q.auth.delete_passkey(p, user_id="user"), "/auth/webauthn/credentials/{p}"),
        (lambda q, p: q.ai.get_model(p), "/ai/v1/registry/models/{p}"),
        (lambda q, p: q.ai.update_model(p, {}), "/ai/v1/registry/models/{p}"),
        (lambda q, p: q.ai.activate_model(p), "/ai/v1/registry/models/{p}/activate"),
        (lambda q, p: q.ai.get_workload(p), "/ai/v1/workloads/{p}"),
        (lambda q, p: q.ai.cancel_workload(p), "/ai/v1/workloads/{p}/cancel"),
        (lambda q, p: q.tenant.get_tenant(p), "/tenant/v1/tenants/{p}"),
        (lambda q, p: q.tenant.update_tenant(p, {}), "/tenant/v1/tenants/{p}"),
        (lambda q, p: q.tenant.get_crypto_policy(p), "/tenant/v1/tenants/{p}/crypto-policy"),
        (lambda q, p: q.tenant.upsert_crypto_policy(p, {}), "/tenant/v1/tenants/{p}/crypto-policy"),
        (lambda q, p: q.billing.get_invoice(p), "/billing/v1/invoices/{p}"),
        (lambda q, p: q.billing.get_credit_balance(p), "/billing/v1/credits/balance/{p}"),
        (lambda q, p: q.crypto_inventory.get_asset(p), "/crypto/v1/assets/{p}"),
        (lambda q, p: q.search.delete_index(p), "/search/v1/indexes/{p}"),
        (lambda q, p: q.search.upsert_vectors(p, []), "/search/v1/indexes/{p}/vectors"),
        (lambda q, p: q.search.query(p, vector=[1], top_k=1), "/search/v1/indexes/{p}/query"),
        (
            lambda q, p: q.storage.put_object(p, p, b"data"),
            "/storage/storage/v1/buckets/{p}/objects/{p}",
        ),
        (lambda q, p: q.storage.get_object(p, p), "/storage/storage/v1/buckets/{p}/objects/{p}"),
        (lambda q, p: q.storage.delete_object(p, p), "/storage/storage/v1/buckets/{p}/objects/{p}"),
        (lambda q, p: q.storage.list_objects(p), "/storage/storage/v1/buckets/{p}/objects"),
    ],
)
def test_convenience_identifiers_are_encoded_and_dot_segments_rejected(
    client_and_requests, invoke, template
):
    q, requests, response = client_and_requests
    response["body"] = {
        "signature": "YQ==",
        "valid": False,
        "wrappedKey": "YQ==",
        "dataKey": "YQ==",
        "dataB64": "YQ==",
    }
    for invalid in ["", ".", ".."]:
        with pytest.raises(ValueError, match="path parameter"):
            invoke(q, invalid)
    assert not requests
    identifier = "part/../?tenantId=intruder#fragment%+ü"
    invoke(q, identifier)
    raw = requests[-1].url.raw_path.decode().split("?", 1)[0]
    assert raw == "/proxy" + template.format(p=quote(identifier, safe=""))
    assert requests[-1].url.params["tenantId"] == "tenant-abc"


@pytest.mark.parametrize("value", [True, None, [], object()])
def test_invalid_path_parameter_types(value):
    with pytest.raises(TypeError, match="Path parameter"):
        _ServiceClient._segment(value)
