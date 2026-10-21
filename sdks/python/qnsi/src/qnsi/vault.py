"""Vault client - PQC-encrypted secret storage.

Mirrors the public surface of the TypeScript ``@heossihq/qnsi-vault-sdk`` for the
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
    the wire shape - type-safe wrappers around each shape are a v0.3 nice-
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
        """Create a new secret. The algorithm keyword is request metadata,
        not an authoritative selector. Server recipient configuration and tenant
        policy determine the executed algorithm in the returned envelope.
        """
        # WIRE CONTRACT (apps/vault-service createSecretSchema):
        #     { tenantId: uuid, name: min 3, payload: string, metadata, rotationPolicy }
        #
        # This sent `payloadBase64` and a top-level `algorithm`. The backend requires
        # `payload`; `payloadBase64` is not a field it knows, so `payload` arrived
        # undefined and the call NEVER succeeded. Proven against production 2026-07-14
        # with the PUBLISHED 0.4.0 - vault-service's own log:
        #
        #     ZodError: path ["payload"] - expected string, received undefined
        #
        # `algorithm` is likewise not a backend field: Zod's non-strict object silently
        # STRIPS it. It belongs in metadata, exactly as the (proven) npm SDK does
        # (packages/qnsi/src/vault.ts: `{ name, payload: req.payloadB64, metadata }`).
        body: dict[str, Any] = {
            "name": name,
            "payload": payload_b64,
            "metadata": {**(metadata or {}), "algorithm": algorithm},
        }
        if tenant_id:
            body["tenantId"] = tenant_id
        return self._request("POST", "/secrets", json=body, idempotency_key=idempotency_key)

    def get_secret(
        self,
        secret_id: str,
        *,
        lease_token: str | None = None,
    ) -> dict[str, Any]:
        """Read a secret by id. ``lease_token`` is required for lease-protected
        secrets (created via the dynamic-secrets flow)."""
        query = {"leaseToken": lease_token} if lease_token else None
        return self._request("GET", f"/secrets/{self._segment(secret_id)}", query=query)

    def get_secret_version(self, secret_id: str, version: int) -> dict[str, Any]:
        return self._request(
            "GET", f"/secrets/{self._segment(secret_id)}/versions/{self._segment(version)}"
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
        # WIRE CONTRACT (apps/vault-service rotateSecretSchema):
        #     { tenantId: uuid, newPayload?: string, metadata?, rotationPolicy? }
        #
        # Same defect as create_secret: this sent `newPayloadBase64`, which the backend
        # does not know, so the rotation carried no payload. `algorithm` is not a backend
        # field either - Zod's non-strict object silently STRIPS it - so it goes in
        # metadata, exactly as the (proven) npm SDK does.
        body: dict[str, Any] = {"newPayload": new_payload_b64}
        if algorithm:
            body["metadata"] = {"algorithm": algorithm}
        return self._request(
            "POST",
            f"/secrets/{self._segment(secret_id)}/rotate",
            json=body,
            idempotency_key=idempotency_key,
        )

    def delete_secret(self, secret_id: str, *, tenant_id: str) -> None:
        """Soft-delete a secret and revoke its value leases. Caller must own the tenant.

        Returns ``None`` on success; raises ``QnsiApiError`` on 4xx/5xx.
        """
        self._request(
            "DELETE", f"/secrets/{self._segment(secret_id)}", query={"tenantId": tenant_id}
        )

    def list_secret_versions(
        self,
        secret_id: str,
        *,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/secrets/{self._segment(secret_id)}/versions",
            query={"limit": limit, "cursor": cursor},
        )

    def list_dynamic_secret_engines(self) -> dict[str, Any]:
        """Read server registration states, not provider-account assurance."""
        return self._request("GET", "/dynamic-secrets/engines")

    def create_dynamic_secret_config(
        self,
        *,
        name: str,
        engine_type: str,
        connection_ref: str,
        secret_type: str = "database",
        role_template: dict[str, Any] | None = None,
        default_ttl_seconds: int | None = None,
        max_ttl_seconds: int | None = None,
        tenant_id: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Use an approved Secrets Manager reference, never inline admin credentials."""
        body: dict[str, Any] = {
            "name": name,
            "engineType": engine_type,
            "connectionRef": connection_ref,
            "secretType": secret_type,
        }
        if role_template is not None:
            body["roleTemplate"] = role_template
        if default_ttl_seconds is not None:
            body["defaultTtlSeconds"] = default_ttl_seconds
        if max_ttl_seconds is not None:
            body["maxTtlSeconds"] = max_ttl_seconds
        return self._request(
            "POST",
            "/dynamic-secrets/configs",
            json=body,
            query={"tenantId": tenant_id},
            idempotency_key=idempotency_key,
        )

    def list_dynamic_secret_configs(
        self,
        *,
        engine_type: str | None = None,
        secret_type: str | None = None,
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            "/dynamic-secrets/configs",
            query={
                "engineType": engine_type,
                "secretType": secret_type,
                "tenantId": tenant_id,
            },
        )

    def request_credentials(
        self,
        config_id: str,
        *,
        ttl_seconds: int | None = None,
        metadata: dict[str, Any] | None = None,
        tenant_id: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Preserve engine-specific credential fields and authoritative lease state."""
        body: dict[str, Any] = {}
        if ttl_seconds is not None:
            body["ttlSeconds"] = ttl_seconds
        if metadata is not None:
            body["metadata"] = metadata
        return self._request(
            "POST",
            f"/dynamic-secrets/configs/{self._segment(config_id)}/credentials",
            json=body,
            query={"tenantId": tenant_id},
            idempotency_key=idempotency_key,
        )

    def list_leases(
        self,
        config_id: str,
        *,
        include_all_statuses: bool | None = None,
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/dynamic-secrets/configs/{self._segment(config_id)}/leases",
            query={"includeAllStatuses": include_all_statuses, "tenantId": tenant_id},
        )

    def renew_lease(self, lease_id: str, *, ttl_seconds: int | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if ttl_seconds is not None:
            body["ttlSeconds"] = ttl_seconds
        return self._request(
            "POST",
            f"/dynamic-secrets/leases/{self._segment(lease_id)}/renew",
            json=body,
        )

    def revoke_lease(self, lease_id: str) -> dict[str, Any]:
        """Return the queue acknowledgement, not a claim of completed revocation."""
        return self._request("POST", f"/dynamic-secrets/leases/{self._segment(lease_id)}/revoke")

    def get_dynamic_secret_stats(self, *, tenant_id: str | None = None) -> dict[str, Any]:
        return self._request("GET", "/dynamic-secrets/stats", query={"tenantId": tenant_id})
