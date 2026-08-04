"""QNSP AI Orchestrator - model registry, AI workload submission with
enclave attestation, inference, bias / prompt-injection monitoring."""

from __future__ import annotations

from typing import Any

from qnsi._service import _ServiceClient


class AIClient(_ServiceClient):
    """AI client. Wraps ``apps/ai-orchestrator`` (``/ai/v1``)."""

    PATH_PREFIX = "/ai/v1"

    # ── Model registry ──────────────────────────────────────────────

    def register_model(
        self,
        *,
        name: str,
        version: str,
        provider: str,
        capabilities: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"name": name, "version": version, "provider": provider}
        if capabilities is not None:
            body["capabilities"] = capabilities
        if metadata is not None:
            body["metadata"] = metadata
        return self._request("POST", "/models", json=body, idempotency_key=idempotency_key)

    def list_models(self, **query: Any) -> dict[str, Any]:
        return self._request("GET", "/models", query=query or None)

    def get_model(self, model_id: str) -> dict[str, Any]:
        return self._request("GET", f"/models/{model_id}")

    def update_model(
        self,
        model_id: str,
        body: dict[str, Any],
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "PATCH",
            f"/models/{model_id}",
            json=body,
            idempotency_key=idempotency_key,
        )

    def activate_model(
        self,
        model_id: str,
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/models/{model_id}/activate",
            idempotency_key=idempotency_key,
        )

    def deploy_model(
        self,
        body: dict[str, Any],
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "POST", "/models/deploy", json=body, idempotency_key=idempotency_key
        )

    # ── Workloads ───────────────────────────────────────────────────

    def submit_workload(
        self,
        *,
        model_id: str,
        type: str,  # noqa: A002 - matches API field name
        input_refs: list[str] | None = None,
        output_bucket: str | None = None,
        enclave_type: str | None = None,
        metadata: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"modelId": model_id, "type": type}
        if input_refs is not None:
            body["inputRefs"] = input_refs
        if output_bucket is not None:
            body["outputBucket"] = output_bucket
        if enclave_type is not None:
            body["enclaveType"] = enclave_type
        if metadata is not None:
            body["metadata"] = metadata
        return self._request(
            "POST", "/workloads", json=body, idempotency_key=idempotency_key
        )

    def get_workload(self, workload_id: str) -> dict[str, Any]:
        return self._request("GET", f"/workloads/{workload_id}")

    def list_workloads(self, **query: Any) -> dict[str, Any]:
        return self._request("GET", "/workloads", query=query or None)

    def cancel_workload(
        self,
        workload_id: str,
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/workloads/{workload_id}/cancel",
            idempotency_key=idempotency_key,
        )

    # ── Inference ────────────────────────────────────────────────────

    def invoke_inference(
        self,
        *,
        model_id: str,
        input: dict[str, Any],  # noqa: A002 - matches API field name
        stream: bool = False,
        metadata: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"modelId": model_id, "input": input}
        if stream:
            body["stream"] = True
        if metadata is not None:
            body["metadata"] = metadata
        return self._request(
            "POST", "/inference", json=body, idempotency_key=idempotency_key
        )

    # ── Artifacts ────────────────────────────────────────────────────

    def register_artifact(
        self,
        *,
        name: str,
        hash: str,  # noqa: A002 - matches API field name
        storage_id: str,
        type: str | None = None,  # noqa: A002 - matches API field name
        metadata: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"name": name, "hash": hash, "storageId": storage_id}
        if type is not None:
            body["type"] = type
        if metadata is not None:
            body["metadata"] = metadata
        return self._request(
            "POST", "/artifacts", json=body, idempotency_key=idempotency_key
        )
