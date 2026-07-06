"""SDK activation — the standard end-user flow.

End-user customers authenticate with a `qnsp_pqc_*` API key issued from the
cloud portal. The SDK calls `/billing/v1/sdk/activate`, which:

1. Validates the API key against the tenant's billing record.
2. Returns the tier name + the limits dict (storage GB, API calls, enclaves
   enabled, etc.) for client-side enforcement.
3. Issues a short-lived activation token cached in memory; subsequent calls
   reuse the same token until ~1 minute before its stated expiry.

This mirrors `@heossi/qnsi-sdk-activation`'s `activateSdk()` in the TypeScript SDKs.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx

from qnsi._errors import QnsiApiError, QnsiAuthError, QnsiNetworkError

DEFAULT_BASE_URL = "https://api.qnsi.heossi.com"
ACTIVATION_PATH = "/billing/v1/sdk/activate"
DEFAULT_TIMEOUT_SECONDS = 15.0
EXPIRY_BUFFER_SECONDS = 60.0
SDK_ID = "qnsp-python"
SDK_VERSION = "0.3.0"


@dataclass(frozen=True)
class ActivationResult:
    """Decoded response from the activation handshake."""

    tenant_id: str
    tier: str
    limits: dict[str, Any]
    activation_token: str
    expires_at_epoch: float
    raw: dict[str, Any]


class ApiKeyActivation:
    """Activate a `qnsp_pqc_*` API key against billing-service.

    Concurrency note: this class is NOT thread-safe. Callers that share a
    single `QnsiClient` across threads should rely on the lock that
    `_client.QnsiClient` holds internally; direct users of
    `ApiKeyActivation` should serialize calls themselves.
    """

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        http_client: httpx.Client | None = None,
    ) -> None:
        if not api_key or not api_key.strip():
            raise ValueError(
                "api_key is required. Get a free QNSP API key at "
                "https://cloud.qnsi.heossi.com/auth — no credit card required."
            )
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._http = http_client or httpx.Client(timeout=timeout)
        self._owned_http_client = http_client is None
        self._cached: ActivationResult | None = None

    @property
    def base_url(self) -> str:
        return self._base_url

    @property
    def api_key_header(self) -> dict[str, str]:
        """Return the auth header dict for outbound service calls."""
        return {"authorization": f"Bearer {self._api_key}"}

    def get_activation(self) -> ActivationResult:
        """Return current activation, refreshing if expired or near-expired."""
        cached = self._cached
        now = time.time()
        if cached is not None and cached.expires_at_epoch - EXPIRY_BUFFER_SECONDS > now:
            return cached
        return self._refresh()

    @property
    def tenant_id(self) -> str:
        return self.get_activation().tenant_id

    @property
    def tier(self) -> str:
        return self.get_activation().tier

    @property
    def limits(self) -> dict[str, Any]:
        return self.get_activation().limits

    def has_feature(self, feature: str) -> bool:
        """Convenience: check a billing-side boolean limit (e.g. 'sseEnabled')."""
        return bool(self.get_activation().limits.get(feature, False))

    def invalidate(self) -> None:
        """Drop the cached activation; next call re-mints."""
        self._cached = None

    def close(self) -> None:
        if self._owned_http_client:
            self._http.close()

    def __enter__(self) -> ApiKeyActivation:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    # ── internal ──────────────────────────────────────────────────────────

    def _refresh(self) -> ActivationResult:
        url = f"{self._base_url}{ACTIVATION_PATH}"
        try:
            response = self._http.post(
                url,
                json={
                    "sdkId": SDK_ID,
                    "sdkVersion": SDK_VERSION,
                    "runtime": "python",
                },
                headers={
                    "authorization": f"Bearer {self._api_key}",
                    "content-type": "application/json",
                },
                timeout=self._timeout,
            )
        except httpx.RequestError as exc:
            raise QnsiNetworkError(
                f"Failed to reach QNSP activation endpoint at {url}: {exc}",
                cause=exc,
            ) from exc

        if response.status_code in (401, 403):
            body = _safe_json(response)
            message = (
                "QNSP rejected your API key. "
                "Get a free API key at https://cloud.qnsi.heossi.com/api-keys"
            )
            if isinstance(body, dict):
                err = body.get("error") or body.get("message")
                if isinstance(err, str):
                    message = err
            raise QnsiAuthError(message, status_code=response.status_code)
        if response.status_code >= 400:
            raise QnsiApiError(
                f"activation failed: {response.text}",
                status_code=response.status_code,
                body=_safe_json(response),
            )

        body = _safe_json(response)
        if not isinstance(body, dict):
            raise QnsiApiError(
                "activation returned an unexpected response shape",
                status_code=response.status_code,
                body=body,
            )

        tenant_id = body.get("tenantId") or body.get("tenant_id")
        tier = body.get("tier") or body.get("planTier") or body.get("plan_tier")
        limits = body.get("limits") or {}
        token = body.get("activationToken") or body.get("activation_token") or body.get("accessToken")
        expires_in = body.get("expiresInSeconds") or body.get("expires_in") or 3600

        if not isinstance(tenant_id, str) or not tenant_id:
            raise QnsiApiError(
                "activation response missing tenantId",
                status_code=response.status_code,
                body=body,
            )

        result = ActivationResult(
            tenant_id=tenant_id,
            tier=str(tier) if isinstance(tier, str) else "unknown",
            limits=limits if isinstance(limits, dict) else {},
            activation_token=token if isinstance(token, str) else "",
            expires_at_epoch=time.time() + float(expires_in),
            raw=body,
        )
        self._cached = result
        return result


def _safe_json(response: httpx.Response) -> object:
    try:
        return response.json()
    except (ValueError, TypeError):
        return None
