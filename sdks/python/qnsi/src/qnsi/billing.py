"""QNSP Billing — entitlement queries, usage meters, invoice listing,
credit balance."""

from __future__ import annotations

from typing import Any

from qnsi._service import _ServiceClient


class BillingClient(_ServiceClient):
    """Billing client. Wraps ``apps/billing-service`` (``/billing/v1``)."""

    PATH_PREFIX = "/billing/v1"

    def get_entitlements(self) -> dict[str, Any]:
        return self._request("GET", "/entitlements")

    def ingest_meter(
        self,
        *,
        meter_id: str,
        quantity: float,
        occurred_at: str | None = None,
        metadata: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"meterId": meter_id, "quantity": quantity}
        if occurred_at is not None:
            body["occurredAt"] = occurred_at
        if metadata is not None:
            body["metadata"] = metadata
        return self._request("POST", "/meters", json=body, idempotency_key=idempotency_key)

    def ingest_meters(
        self,
        meters: list[dict[str, Any]],
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "POST", "/meters/batch", json={"meters": meters}, idempotency_key=idempotency_key
        )

    def list_invoices(self, **query: Any) -> dict[str, Any]:
        return self._request("GET", "/invoices", query=query or None)

    def get_invoice(self, invoice_id: str) -> dict[str, Any]:
        return self._request("GET", f"/invoices/{invoice_id}")

    def get_credit_balance(self, tenant_id: str) -> dict[str, Any]:
        return self._request("GET", f"/credits/balance/{tenant_id}")
