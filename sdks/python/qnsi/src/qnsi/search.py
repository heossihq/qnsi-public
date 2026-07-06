"""QNSP Search — encrypted vector search with SSE-X."""

from __future__ import annotations

from typing import Any

from qnsi._service import _ServiceClient


class SearchClient(_ServiceClient):
    """Search client. Wraps ``apps/search-service`` (``/search/v1``)."""

    PATH_PREFIX = "/search/v1"

    def create_index(
        self,
        *,
        name: str,
        dimensions: int,
        metric: str | None = None,
        algorithm: str | None = None,
        metadata: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"name": name, "dimensions": dimensions}
        if metric is not None:
            body["metric"] = metric
        if algorithm is not None:
            body["algorithm"] = algorithm
        if metadata is not None:
            body["metadata"] = metadata
        return self._request("POST", "/indexes", json=body, idempotency_key=idempotency_key)

    def list_indexes(self) -> dict[str, Any]:
        return self._request("GET", "/indexes")

    def delete_index(self, index_name: str) -> None:
        self._request("DELETE", f"/indexes/{index_name}")

    def upsert_vectors(
        self,
        index_name: str,
        vectors: list[dict[str, Any]],
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/indexes/{index_name}/vectors",
            json={"vectors": vectors},
            idempotency_key=idempotency_key,
        )

    def query(
        self,
        index_name: str,
        *,
        vector: list[float],
        top_k: int,
        filter: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"vector": vector, "topK": top_k}
        if filter is not None:
            body["filter"] = filter
        return self._request("POST", f"/indexes/{index_name}/query", json=body)
