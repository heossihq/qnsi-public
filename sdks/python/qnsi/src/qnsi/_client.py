"""Top-level QNSP client.

A single ``QnsiClient(api_key=...)`` exposes the whole platform via
sub-namespaces (``vault``, ``kms``, ``audit``, …). Local PQC primitives
live under ``qnsp.crypto`` and require the ``qnsi[crypto]`` extra.

Customer onboarding is identical for everyone - there are no per-partner
constructors. Anyone with a free QNSP API key (https://cloud.qnsi.heossi.com/auth)
gets the same surface.
"""

from __future__ import annotations

from typing import Any

import httpx

from qnsi._activation import (
    DEFAULT_BASE_URL,
    DEFAULT_TIMEOUT_SECONDS,
    ApiKeyActivation,
)
from qnsi.access import AccessClient
from qnsi.ai import AIClient
from qnsi.audit import AuditClient
from qnsi.auth import AuthClient
from qnsi.billing import BillingClient
from qnsi.crypto_inventory import CryptoInventoryClient
from qnsi.kms import KmsClient
from qnsi.search import SearchClient
from qnsi.storage import StorageClient
from qnsi.tenant import TenantClient
from qnsi.vault import VaultClient


class QnsiClient:
    """End-user QNSP client. Pass an API key, get the full platform.

    Holds one HTTP connection pool and one activation cache; all 11
    service sub-clients (vault, kms, audit, auth, tenant, access,
    billing, crypto_inventory, storage, search, ai) share both.
    ``QnsiClient`` is reentrant as a context manager and releases the
    pool on exit.

    Args:
        api_key: A ``qnsp_pqc_*`` API key from https://cloud.qnsi.heossi.com/api-keys.
        base_url: Override the QNSP edge-gateway URL. Defaults to production.
        timeout: Per-request timeout in seconds.
        http_client: Optional pre-configured ``httpx.Client`` (useful for
            shared connection pools or for injecting a transport in tests).
    """

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._http = http_client or httpx.Client(timeout=timeout)
        self._owned_http_client = http_client is None
        self._activation = ApiKeyActivation(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            http_client=self._http,
        )

        kw: dict[str, Any] = dict(
            activation=self._activation, http_client=self._http, timeout=timeout
        )
        self.vault = VaultClient(**kw)
        self.kms = KmsClient(**kw)
        self.audit = AuditClient(**kw)
        self.auth = AuthClient(**kw)
        self.tenant = TenantClient(**kw)
        self.access = AccessClient(**kw)
        self.billing = BillingClient(**kw)
        self.crypto_inventory = CryptoInventoryClient(**kw)
        self.storage = StorageClient(**kw)
        self.search = SearchClient(**kw)
        self.ai = AIClient(**kw)

    # ── activation introspection ─────────────────────────────────────────

    @property
    def tenant_id(self) -> str:
        """Tenant ID resolved by activation. Triggers activation on first call."""
        return self._activation.tenant_id

    @property
    def tier(self) -> str:
        """Plan tier resolved by activation."""
        return self._activation.tier

    @property
    def limits(self) -> dict[str, Any]:
        """Tier limits dict from activation."""
        return self._activation.limits

    def has_feature(self, feature: str) -> bool:
        """Whether the tenant's plan enables a billing-side boolean feature."""
        return self._activation.has_feature(feature)

    @property
    def base_url(self) -> str:
        return self._activation.base_url

    # ── lifecycle ─────────────────────────────────────────────────────────

    def close(self) -> None:
        if self._owned_http_client:
            self._http.close()

    def __enter__(self) -> QnsiClient:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()
