"""Required backend fields must come from callers, never fabricated evidence."""

import json

import pytest


def test_model_registration_requires_model_type(client_and_requests):
    q, requests, _ = client_and_requests
    with pytest.raises(ValueError, match="modelType"):
        q.ai.register_model(name="model", version="1", provider="custom")
    assert not requests
    q.ai.register_model(name="model", version="1", provider="custom", model_type="llm")
    assert json.loads(requests[-1].content)["modelType"] == "llm"
    q.ai.register_model(
        request={
            "name": "model",
            "version": "1",
            "provider": "custom",
            "modelType": "embedding",
            "description": "caller supplied",
        },
        capabilities=["embedding"],
        metadata={"owner": "user"},
    )
    assert json.loads(requests[-1].content)["description"] == "caller supplied"


def test_workload_requires_complete_caller_manifest(client_and_requests):
    q, requests, _ = client_and_requests
    with pytest.raises(ValueError, match="manifest"):
        q.ai.submit_workload(model_id="model", type="inference")
    assert not requests
    # Negative/wire fixture only. The backend, not this fixture, verifies signatures.
    manifest = {
        "algorithm": "ml-dsa-65",
        "pqcSignature": "invalid-test-signature",
        "issuedAt": "2026-10-05T00:00:00Z",
    }
    body = {
        "name": "test",
        "priority": "normal",
        "schedulingPolicy": "on-demand",
        "containerImage": "registry.example.invalid/image@sha256:test",
        "command": ["run"],
        "env": {},
        "resources": {"cpu": 1, "memoryGiB": 1, "gpu": 0, "acceleratorType": "cpu"},
        "artifacts": [],
        "manifest": manifest,
    }
    for options in [
        {},
        {"input_refs": [], "output_bucket": "bucket", "enclave_type": "test", "metadata": {}},
    ]:
        q.ai.submit_workload(request=body, **options)
        assert json.loads(requests[-1].content)["manifest"] == manifest
    q.ai.get_workload("workload")
    q.ai.list_workloads()
    q.ai.list_workloads(limit=1)
    q.ai.cancel_workload("workload")
    assert requests[-1].url.path.endswith("/workloads/workload/cancel")


def test_model_identity_is_not_deployment_identity(client_and_requests):
    q, requests, _ = client_and_requests
    with pytest.raises(ValueError, match="deployment ID"):
        q.ai.invoke_inference(model_id="model", input={})
    assert not requests
    for options in [{}, {"stream": True, "metadata": {}}]:
        q.ai.invoke_inference(model_deployment_id="deployment", input={"text": "test"}, **options)
        assert json.loads(requests[-1].content)["modelDeploymentId"] == "deployment"


def test_artifacts_require_document_version(client_and_requests):
    q, requests, _ = client_and_requests
    with pytest.raises(ValueError, match="documentId"):
        q.ai.register_artifact(name="artifact", hash="hash", storage_id="storage")
    assert not requests
    for options in [{}, {"type": "model", "metadata": {}}]:
        q.ai.register_artifact(document_id="document", version=1, **options)
        assert json.loads(requests[-1].content)["documentId"] == "document"
        assert json.loads(requests[-1].content)["version"] == 1


def test_tenant_creation_requires_caller_security(client_and_requests):
    q, requests, _ = client_and_requests
    with pytest.raises(ValueError, match="security"):
        q.tenant.create_tenant(name="Tenant", slug="tenant")
    assert not requests
    request = {"name": "Tenant", "slug": "tenant", "security": {"pqcSignatures": []}}
    for options in [{}, {"tier": "free", "parent_tenant_id": "parent", "metadata": {}}]:
        q.tenant.create_tenant(request=request, **options)
        assert json.loads(requests[-1].content)["security"] == request["security"]
    q.tenant.create_tenant(
        name="Tenant", slug="tenant", tier="free", request={"security": request["security"]}
    )
    assert json.loads(requests[-1].content)["plan"] == "free"
    q.tenant.get_tenant("tenant-abc")
    q.tenant.update_tenant("tenant-abc", {"name": "updated"})
    q.tenant.list_tenants()
    q.tenant.list_tenants(limit=1)
    q.tenant.get_crypto_policy("tenant-abc")
    q.tenant.upsert_crypto_policy("tenant-abc", {"mode": "pqc"})


def test_single_meter_uses_real_batch_shape_and_security(client_and_requests):
    q, requests, _ = client_and_requests
    with pytest.raises(ValueError, match="security"):
        q.billing.ingest_meter(meter_id="calls", quantity=1)
    assert not requests
    body = {
        "source": "client",
        "meterType": "api_calls",
        "quantity": 1,
        "unit": "calls",
        "recordedAt": "2026-10-05T00:00:00Z",
        "security": {"pqcSignatures": []},
    }
    for options in [{}, {"occurred_at": "2026-10-05T00:00:00Z", "metadata": {}}]:
        q.billing.ingest_meter(request=body, **options)
        meter = json.loads(requests[-1].content)["meters"][0]
        assert all(meter[key] == value for key, value in body.items())
        assert meter["tenantId"] == "tenant-abc"
    assert "tenantId" not in body
    q.billing.list_invoices()
    q.billing.list_invoices(limit=1)
    q.billing.get_invoice("invoice")
    q.billing.get_credit_balance("tenant-abc")
