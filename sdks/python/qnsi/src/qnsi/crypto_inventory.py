"""QNSP Crypto-Inventory (CBOM) — asset catalogue, discovery runs,
deprecation policies, PQC migration readiness."""

from __future__ import annotations

from typing import Any

from qnsi._service import _ServiceClient


class CryptoInventoryClient(_ServiceClient):
    """Crypto-inventory client. Wraps ``apps/crypto-inventory-service``
    (``/crypto/v1``)."""

    PATH_PREFIX = "/crypto/v1"

    def list_assets(self, **query: Any) -> dict[str, Any]:
        return self._request("GET", "/assets", query=query or None)

    def get_asset(self, asset_id: str) -> dict[str, Any]:
        return self._request("GET", f"/assets/{asset_id}")

    def get_asset_stats(self, tenant_id: str) -> dict[str, Any]:
        return self._request("GET", f"/assets/stats/{tenant_id}")

    def discover_assets(
        self,
        *,
        targets: list[str] | None = None,
        modes: list[str] | None = None,
        options: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if targets is not None:
            body["targets"] = targets
        if modes is not None:
            body["modes"] = modes
        if options is not None:
            body["options"] = options
        return self._request(
            "POST", "/discovery/runs", json=body, idempotency_key=idempotency_key
        )

    def get_readiness_score(self, tenant_id: str) -> dict[str, Any]:
        return self._request("GET", f"/readiness/{tenant_id}")
