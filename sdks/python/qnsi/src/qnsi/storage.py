"""QNSP Storage - PQC-encrypted object storage with SSE-X."""

from __future__ import annotations

import base64
from typing import Any

from qnsi._errors import QnsiApiError
from qnsi._service import _ServiceClient


class StorageClient(_ServiceClient):
    """Storage client. Wraps ``apps/storage-service`` (``/storage/storage/v1``).

    Bytes are base64-encoded at the boundary; consumers work with raw
    ``bytes`` and the SDK handles the encoding.
    """

    PATH_PREFIX = "/storage/storage/v1"

    def put_object(
        self,
        bucket: str,
        key: str,
        data: bytes,
        *,
        content_type: str | None = None,
        sse_algorithm: str | None = None,
        metadata: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"dataB64": base64.b64encode(data).decode("ascii")}
        if content_type is not None:
            body["contentType"] = content_type
        if sse_algorithm is not None:
            body["sseAlgorithm"] = sse_algorithm
        if metadata is not None:
            body["metadata"] = metadata
        return self._request(
            "PUT",
            f"/buckets/{bucket}/objects/{key}",
            json=body,
            idempotency_key=idempotency_key,
        )

    def get_object(self, bucket: str, key: str) -> tuple[bytes, dict[str, Any]]:
        """Return ``(plaintext_bytes, descriptor_json)``."""
        resp = self._request("GET", f"/buckets/{bucket}/objects/{key}")
        data_b64 = resp.get("dataB64")
        if not isinstance(data_b64, str):
            raise QnsiApiError(
                "storage.get_object: response missing dataB64",
                status_code=200,
                code=None,
                body=resp,
            )
        return base64.b64decode(data_b64), resp

    def delete_object(self, bucket: str, key: str) -> None:
        self._request("DELETE", f"/buckets/{bucket}/objects/{key}")

    def list_objects(self, bucket: str, **query: Any) -> dict[str, Any]:
        return self._request("GET", f"/buckets/{bucket}/objects", query=query or None)

    def list_buckets(self) -> dict[str, Any]:
        return self._request("GET", "/buckets")
