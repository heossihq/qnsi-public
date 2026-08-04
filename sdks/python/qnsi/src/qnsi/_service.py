"""Shared HTTP plumbing for service clients (vault, kms, audit).

Each client takes an `ApiKeyActivation` instance, calls
``activation.get_activation()`` once on first use to ensure activation
succeeds before sending real traffic, then issues authenticated requests
through the QNSP edge gateway. 401 responses trigger one cache invalidation +
retry.
"""

from __future__ import annotations

from typing import Any

import httpx

from qnsi._activation import DEFAULT_TIMEOUT_SECONDS, ApiKeyActivation
from qnsi._errors import QnsiApiError, QnsiNetworkError


class _ServiceClient:
    """Base class - concrete clients (Vault, KMS, Audit) inherit."""

    PATH_PREFIX: str = ""  # e.g. "/vault" or "/kms" or "/audit"

    def __init__(
        self,
        *,
        activation: ApiKeyActivation,
        http_client: httpx.Client,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._activation = activation
        self._http = http_client
        self._timeout = timeout

    # ── helpers ───────────────────────────────────────────────────────────

    def _url(self, path: str, *, query: dict[str, Any] | None = None) -> str:
        base = self._activation.base_url
        # All backend service traffic goes through the edge gateway's /proxy/<svc>
        # route (proven by the npm SDK e2e: /proxy/kms/v1/... etc.). The previous
        # paths omitted /proxy and 404'd at the gateway.
        full = f"{base}/proxy{self.PATH_PREFIX}{path}"
        if not query:
            return full
        encoded: list[str] = []
        for key, value in query.items():
            if value is None:
                continue
            encoded.append(f"{key}={httpx.QueryParams({key: str(value)})[key]}")
        if not encoded:
            return full
        sep = "&" if "?" in full else "?"
        return f"{full}{sep}{'&'.join(encoded)}"

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        query: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        # Lazy activation - first call exercises the handshake; later calls
        # reuse the cached token until near-expiry.
        self._activation.get_activation()

        # Backend write schemas (vault/kms/...) REQUIRE a tenantId (uuid) and scope
        # the row to it. Inject the activated tenantId into object bodies centrally
        # rather than per-method (mirrors the npm SDK's withTenantId); a
        # caller-supplied tenantId always wins. Omitting it is what shipped silent
        # "missing tenantId" 400s and stripped fields.
        #
        # MUST test the VALUE, not the KEY. Callers routinely pass an explicit
        # `tenantId: None` (e.g. kms.list_keys builds
        # `{"tenantId": tenant_id, "limit": limit, "cursor": cursor}` with tenant_id=None),
        # so a `"tenantId" not in ...` guard sees the key, skips injection, and `_url`
        # then drops the None - leaving no tenant on the wire at all. Proven against
        # production 2026-07-14 with the PUBLISHED 0.4.0:
        #     kms.list_keys()                    -> 400 BAD_REQUEST
        #     kms.list_keys(tenant_id="<uuid>")  -> 200
        if isinstance(json, dict) and json.get("tenantId") is None:
            json = {**json, "tenantId": self._activation.tenant_id}

        # Backend GET endpoints (e.g. /crypto/v1/assets/stats, /crypto/v1/readiness,
        # GET /kms/v1/keys/:id) read tenantId from the QUERY string and 400 without it.
        # The body injection above cannot help a GET (no body), so also inject the
        # activated tenant into the query (mirrors the npm SDK's withTenantIdQuery).
        # A caller-supplied tenantId always wins. Same value-not-key rule as above.
        if query is None or query.get("tenantId") is None:
            query = {**(query or {}), "tenantId": self._activation.tenant_id}

        url = self._url(path, query=query)
        headers = self._build_headers(idempotency_key=idempotency_key)
        try:
            response = self._http.request(
                method, url, json=json, headers=headers, timeout=self._timeout
            )
        except httpx.RequestError as exc:
            raise QnsiNetworkError(
                f"Failed to reach QNSP {method} {url}: {exc}", cause=exc
            ) from exc

        if response.status_code == 401:
            self._activation.invalidate()
            self._activation.get_activation()
            headers = self._build_headers(idempotency_key=idempotency_key)
            response = self._http.request(
                method, url, json=json, headers=headers, timeout=self._timeout
            )

        if response.status_code >= 400:
            body = _safe_json(response)
            code = None
            message = response.text or f"HTTP {response.status_code}"
            if isinstance(body, dict):
                if isinstance(body.get("code"), str):
                    code = body["code"]
                if isinstance(body.get("error"), str):
                    message = body["error"]
                elif isinstance(body.get("message"), str):
                    message = body["message"]
            raise QnsiApiError(
                f"QNSP {method} {self.PATH_PREFIX}{path} failed: {message}",
                status_code=response.status_code,
                code=code,
                body=body,
            )

        if response.status_code == 204 or not response.content:
            return {}
        body = _safe_json(response)
        if not isinstance(body, dict):
            # 200 with non-object JSON (e.g. an array) - wrap so callers can
            # destructure consistently.
            return {"_raw": body}
        return body

    def _build_headers(self, *, idempotency_key: str | None) -> dict[str, str]:
        headers = {"content-type": "application/json"}
        headers.update(self._activation.api_key_header)
        if idempotency_key:
            headers["idempotency-key"] = idempotency_key
        return headers


def _safe_json(response: httpx.Response) -> object:
    try:
        return response.json()
    except (ValueError, TypeError):
        return None
