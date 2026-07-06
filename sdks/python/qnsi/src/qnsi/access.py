"""QNSP Access-Control — RBAC: roles, permissions, role assignments."""

from __future__ import annotations

from typing import Any

from qnsi._service import _ServiceClient


class AccessClient(_ServiceClient):
    """Access-control client. Wraps ``apps/access-control-service``
    (``/access/v1``)."""

    PATH_PREFIX = "/access/v1"

    def create_role(
        self,
        *,
        name: str,
        permissions: list[str],
        description: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"name": name, "permissions": permissions}
        if description is not None:
            body["description"] = description
        return self._request("POST", "/roles", json=body, idempotency_key=idempotency_key)

    def get_role(self, role_id: str) -> dict[str, Any]:
        return self._request("GET", f"/roles/{role_id}")

    def list_roles(self, **query: Any) -> dict[str, Any]:
        return self._request("GET", "/roles", query=query or None)

    def delete_role(self, role_id: str) -> None:
        self._request("DELETE", f"/roles/{role_id}")

    def assign_role(
        self,
        *,
        role_id: str,
        subject_id: str,
        scope: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"roleId": role_id, "subjectId": subject_id}
        if scope is not None:
            body["scope"] = scope
        return self._request(
            "POST", "/role-assignments", json=body, idempotency_key=idempotency_key
        )

    def revoke_role_assignment(self, assignment_id: str) -> None:
        self._request("DELETE", f"/role-assignments/{assignment_id}")

    def check_permission(
        self,
        *,
        subject_id: str,
        permission: str,
        scope: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"subjectId": subject_id, "permission": permission}
        if scope is not None:
            body["scope"] = scope
        return self._request("POST", "/check", json=body)
