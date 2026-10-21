"""Manifest-driven operation access. Catalog entries are not live availability evidence."""

from __future__ import annotations

import json
from importlib.resources import files
from typing import Any
from urllib.parse import quote

from qnsi._service import _ServiceClient


class SurfaceClient(_ServiceClient):
    """Call source-declared operations with shared activation and tenant binding."""

    @staticmethod
    def operations() -> list[dict[str, Any]]:
        """Return a fresh catalog; callers cannot mutate another client's operation contracts."""
        return json.loads(files("qnsi").joinpath("surface-operations.json").read_text("utf-8"))

    def call_operation(
        self,
        operation_id: str,
        *,
        path_parameters: dict[str, str] | None = None,
        body: dict[str, Any] | None = None,
        query: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Call an operation; backend schemas, policy and entitlements stay authoritative."""
        operation = next((item for item in self.operations() if item["id"] == operation_id), None)
        if operation is None:
            raise ValueError("Unknown operation ID; inspect surface.operations()")
        parameters = path_parameters or {}
        required = operation["pathParameters"]
        if set(parameters) != set(required) or any(
            not isinstance(value, str) or not value or value in {".", ".."}
            for value in parameters.values()
        ):
            raise ValueError(f"Required path parameters: {', '.join(required)}")
        path = operation["path"]
        for name, value in sorted(parameters.items(), key=lambda pair: -len(pair[0])):
            path = path.replace(f":{name}", quote(value, safe=""))
        return self._request(
            operation["method"],
            path.removeprefix("/proxy"),
            json=body,
            query=query,
            idempotency_key=idempotency_key,
        )
