"""Audit client — append immutable, hash-chained audit events.

Mirrors the most-used methods of ``@heossi/qnsi-audit-sdk``. Routes verified
against ``apps/audit-service/src/routes/events.ts`` and the TypeScript
SDK's ``ingestEvents`` / ``listEvents`` paths:

  POST /audit/v1/events  — ingestEvents (write a batch)
  GET  /audit/v1/events  — listEvents (query a window)
"""

from __future__ import annotations

from typing import Any

from qnsi._service import _ServiceClient


class AuditClient(_ServiceClient):
    """Tenant-scoped audit log client."""

    PATH_PREFIX = "/audit/v1"

    def log_event(
        self,
        *,
        event_type: str,
        payload: dict[str, Any] | None = None,
        actor_id: str | None = None,
        resource_id: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Append a single audit event. Convenience wrapper over
        :meth:`ingest_events` for the common one-event-at-a-time case.
        """
        event: dict[str, Any] = {"eventType": event_type}
        if payload is not None:
            event["payload"] = payload
        if actor_id:
            event["actorId"] = actor_id
        if resource_id:
            event["resourceId"] = resource_id
        return self.ingest_events([event], idempotency_key=idempotency_key)

    def ingest_events(
        self,
        events: list[dict[str, Any]],
        *,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Append a batch of audit events.

        Each event must have at least ``eventType``. The server enriches
        every record with the tenant id, a hash chain link, and a PQC
        signature; the response includes the assigned event ids.
        """
        if not events:
            return {"events": []}
        return self._request(
            "POST",
            "/events",
            json={"events": events},
            idempotency_key=idempotency_key,
        )

    def list_events(
        self,
        *,
        event_type: str | None = None,
        actor_id: str | None = None,
        resource_id: str | None = None,
        since: str | None = None,
        until: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        """Query audit events. ``since`` / ``until`` are RFC-3339 timestamps."""
        return self._request(
            "GET",
            "/events",
            query={
                "eventType": event_type,
                "actorId": actor_id,
                "resourceId": resource_id,
                "since": since,
                "until": until,
                "limit": limit,
                "cursor": cursor,
            },
        )
