"""Vault client — PQC-encrypted secret storage.

Mirrors the public surface of the TypeScript ``@heossi/qnsi-vault-sdk`` for the
methods most-used by Python LLM workloads: create, get, rotate, delete.

Wire paths come from ``apps/vault-service/src/routes/secrets.ts`` and the
TypeScript SDK at ``packages/vault-sdk/src/index.ts``.

Example::

    from qnsi import QnsiClient

    qnsp = QnsiClient(api_key=os.environ["QNSP_API_KEY"])
    secret = qnsp.vault.create_secret(
        name="openai-key",
        payload_b64=base64.b64encode(b"sk-...").decode(),
        algorithm="ml-kem-768",
    )
    fresh = qnsp.vault.get_secret(secret["id"])
"""

from __future__ import annotations

from typing import Any

from qnsi._service import _ServiceClient


class VaultClient(_ServiceClient):
    """Typed-ish client for vault-service.

    Returns raw response dicts so the public API doesn't drift away from
    the wire shape — type-safe wrappers around each shape are a v0.3 nice-
    to-have. Callers can inspect every server-side field today.
    """

    PATH_PREFIX = "/vault/v1"

    # ── secrets CRUD ──────────────────────────────────────────────────────

    def create_secret(
        self,
        *,
        name: str,
        payload_b64: str,
        algorithm: str = "ml-kem-768",
        tenant_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Create a new secret. Server encrypts the payload using the named
        PQC algorithm; the client stays oblivious to the envelope details.
        """
        body: dict[str, Any] = {
            "name": name,
            "payloadBase64": payload_b64,
            "algorithm": algorithm,
        }
        if tenant_id:
            body["tenantId"] = tenant_id
        if metadata:
            body["metadata"] = metadata
        return self._request(
            "POST", "/secrets", json=body, idempotency_key=idempotency_key
        )

    def get_secret(
        self,
        secret_id: str,
        *,
        lease_token: str | None = None,
    ) -> dict[str, Any]:
        """Read a secret by id. ``lease_token`` is required for lease-protected
        secrets (created via the dynamic-secrets flow)."""
        query = {"leaseToken": lease_token} if lease_token else None
        return self._request("GET", f"/secrets/{secret_id}", query=query)

    def get_secret_version(self, secret_id: str, version: int) -> dict[str, Any]:
        return self._request(
            "GET", f"/secrets/{secret_id}/versions/{version}"
        )

    def rotate_secret(
        self,
        secret_id: str,
        *,
        new_payload_b64: str,
        algorithm: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Rotate the secret to a fresh version. Old versions remain
        accessible by version number for the configured retention window."""
        body: dict[str, Any] = {"newPayloadBase64": new_payload_b64}
        if algorithm:
            body["algorithm"] = algorithm
        return self._request(
            "POST",
            f"/secrets/{secret_id}/rotate",
            json=body,
            idempotency_key=idempotency_key,
        )

    def delete_secret(self, secret_id: str, *, tenant_id: str) -> None:
        """Hard-delete a secret. Caller must own the tenant.

        Returns ``None`` on success; raises ``QnsiApiError`` on 4xx/5xx.
        """
        self._request("DELETE", f"/secrets/{secret_id}", query={"tenantId": tenant_id})

    def list_secret_versions(
        self,
        secret_id: str,
        *,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/secrets/{secret_id}/versions",
            query={"limit": limit, "cursor": cursor},
        )
