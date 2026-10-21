"""QNSP Tenant - tenant CRUD, crypto-policy management, quotas, health."""

from __future__ import annotations

from typing import Any

from qnsi._service import _ServiceClient


class TenantClient(_ServiceClient):
    """Tenant-service client. Wraps ``apps/tenant-service`` (``/tenant/v1``).

    Used to provision sub-tenants, manage per-tenant crypto policy, fetch
    quota usage, and read health snapshots.
    """

    PATH_PREFIX = "/tenant/v1"

    def create_tenant(
        self,
        *,
        name: str | None = None,
        slug: str | None = None,
        tier: str | None = None,
        parent_tenant_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        request: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"name": name}
        if slug is not None:
            body["slug"] = slug
        if tier is not None:
            body["plan"] = tier
        if parent_tenant_id is not None:
            body["parentTenantId"] = parent_tenant_id
        if metadata is not None:
            body["metadata"] = metadata
        body.update(request or {})
        missing = [field for field in ("name", "slug", "security") if body.get(field) is None]
        if missing:
            raise ValueError(f"Required tenant request fields are missing: {', '.join(missing)}")
        return self._request("POST", "/tenants", json=body, idempotency_key=idempotency_key)

    def get_tenant(self, tenant_id: str) -> dict[str, Any]:
        return self._request("GET", f"/tenants/{self._segment(tenant_id)}")

    def update_tenant(
        self,
        tenant_id: str,
        body: dict[str, Any],
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "PATCH",
            f"/tenants/{self._segment(tenant_id)}",
            json=body,
            idempotency_key=idempotency_key,
        )

    def list_tenants(self, **query: Any) -> dict[str, Any]:
        return self._request("GET", "/tenants", query=query or None)

    def get_crypto_policy(self, tenant_id: str) -> dict[str, Any]:
        return self._request("GET", f"/tenants/{self._segment(tenant_id)}/crypto-policy")

    def upsert_crypto_policy(
        self,
        tenant_id: str,
        body: dict[str, Any],
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "PUT",
            f"/tenants/{self._segment(tenant_id)}/crypto-policy",
            json=body,
            idempotency_key=idempotency_key,
        )

    def get_current_health(self, tenant_id: str) -> dict[str, Any]:
        return self._request("GET", "/health/current", query={"tenantId": tenant_id})

    def get_current_quotas(self, tenant_id: str) -> dict[str, Any]:
        return self._request("GET", "/quotas/current", query={"tenantId": tenant_id})
