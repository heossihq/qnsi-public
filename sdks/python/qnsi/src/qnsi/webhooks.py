"""HMAC verification + parsing for inbound QNSP webhooks.

Every webhook QNSP delivers (regardless of which integration triggered it)
is signed with HMAC-SHA-256 using a shared secret QNSP issued out-of-band.
The signature lives in ``X-QNSP-Signature`` as ``sha256=<hex>`` (matches the
GitHub webhook format most callers already implement). The signed payload
is the **raw request body** - verify before parsing JSON, otherwise an
attacker could land arbitrary structures in your handlers.

Replay protection: ``X-QNSP-Timestamp`` carries an RFC-3339 UTC instant.
Reject events older than ``max_age_seconds`` (default 300 s).

Usage::

    from qnsi import parse_qnsi_webhook, QnsiWebhookError

    @app.post("/webhooks/qnsp")
    async def receive(request: Request):
        body = await request.body()
        try:
            event = parse_qnsi_webhook(
                body=body,
                signature_header=request.headers.get("x-qnsp-signature", ""),
                timestamp_header=request.headers.get("x-qnsp-timestamp"),
                secret=os.environ["QNSP_WEBHOOK_SECRET"],
            )
        except QnsiWebhookError as exc:
            raise HTTPException(400, str(exc))
        # event.event_type, event.event_id, event.payload - all typed
"""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from qnsi._errors import QnsiWebhookError

DEFAULT_MAX_AGE_SECONDS = 300


@dataclass(frozen=True)
class QnsiWebhookEvent:
    """Verified, parsed inbound webhook event from QNSP."""

    event_type: str
    event_id: str
    occurred_at: str
    payload: dict[str, Any]


def verify_qnsi_webhook_signature(
    *,
    body: bytes,
    signature_header: str,
    secret: str,
) -> None:
    """Verify the HMAC-SHA-256 signature on a raw webhook body.

    Raises ``QnsiWebhookError`` on mismatch. Returns ``None`` on success.
    The comparison uses ``hmac.compare_digest`` for constant-time equality.
    """
    if not isinstance(body, bytes):
        raise QnsiWebhookError("body must be bytes (the raw request body)")
    if not isinstance(signature_header, str) or not signature_header:
        raise QnsiWebhookError("signature header is missing")
    if not isinstance(secret, str) or not secret:
        raise QnsiWebhookError("webhook secret is required")

    if not signature_header.startswith("sha256="):
        raise QnsiWebhookError(
            "signature header must start with 'sha256=' (got "
            f"{signature_header[:10]!r}…)"
        )
    provided = signature_header[len("sha256=") :].strip().lower()

    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(provided, expected):
        raise QnsiWebhookError("webhook signature mismatch")


def parse_qnsi_webhook(
    *,
    body: bytes,
    signature_header: str,
    timestamp_header: str | None,
    secret: str,
    max_age_seconds: int = DEFAULT_MAX_AGE_SECONDS,
    now: datetime | None = None,
) -> QnsiWebhookEvent:
    """Verify signature + freshness, then parse the JSON body into a typed event.

    Raises ``QnsiWebhookError`` for any of: missing/invalid signature,
    missing/old timestamp, malformed JSON, missing required fields.
    """
    verify_qnsi_webhook_signature(body=body, signature_header=signature_header, secret=secret)

    if timestamp_header is None:
        raise QnsiWebhookError("X-QNSP-Timestamp header is missing")
    try:
        sent_at = _parse_iso8601_utc(timestamp_header)
    except ValueError as exc:
        raise QnsiWebhookError(
            f"X-QNSP-Timestamp is not a valid RFC-3339 UTC timestamp: {timestamp_header!r}"
        ) from exc
    current = now or datetime.now(tz=timezone.utc)
    age = (current - sent_at).total_seconds()
    if age < -30:
        raise QnsiWebhookError(
            f"webhook timestamp is in the future by {-age:.0f} s - clock skew or forgery"
        )
    if age > max_age_seconds:
        raise QnsiWebhookError(
            f"webhook is too old ({age:.0f} s > {max_age_seconds} s) - possible replay"
        )

    try:
        parsed = json.loads(body)
    except (ValueError, json.JSONDecodeError) as exc:
        raise QnsiWebhookError(f"webhook body is not valid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise QnsiWebhookError("webhook body must be a JSON object")

    event_type = parsed.get("event_type") or parsed.get("type")
    event_id = parsed.get("event_id") or parsed.get("id")
    occurred_at = parsed.get("occurred_at") or parsed.get("timestamp")
    payload = parsed.get("payload") or parsed.get("data") or {}

    if not isinstance(event_type, str) or not event_type:
        raise QnsiWebhookError("webhook payload missing required 'event_type'")
    if not isinstance(event_id, str) or not event_id:
        raise QnsiWebhookError("webhook payload missing required 'event_id'")
    if not isinstance(occurred_at, str) or not occurred_at:
        raise QnsiWebhookError("webhook payload missing required 'occurred_at'")
    if not isinstance(payload, dict):
        raise QnsiWebhookError("webhook payload must be a JSON object")

    return QnsiWebhookEvent(
        event_type=event_type,
        event_id=event_id,
        occurred_at=occurred_at,
        payload=payload,
    )


def _parse_iso8601_utc(value: str) -> datetime:
    """Parse an RFC-3339 / ISO-8601 timestamp into a UTC-aware datetime.

    Accepts both ``Z`` and ``+00:00`` suffixes.
    """
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
