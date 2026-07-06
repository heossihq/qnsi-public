"""Tests for HMAC webhook verification + parsing."""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone

import pytest

from qnsi import (
    QnsiWebhookError,
    QnsiWebhookEvent,
    parse_qnsi_webhook,
    verify_qnsi_webhook_signature,
)

SECRET = "test-shared-secret"


def _sign(body: bytes, secret: str = SECRET) -> str:
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def test_verify_succeeds_on_matching_signature() -> None:
    body = b'{"event_type":"key.rotated"}'
    verify_qnsi_webhook_signature(body=body, signature_header=_sign(body), secret=SECRET)


def test_verify_rejects_tampered_body() -> None:
    body = b'{"event_type":"key.rotated"}'
    sig = _sign(body)
    tampered = b'{"event_type":"key.deleted"}'
    with pytest.raises(QnsiWebhookError, match="signature mismatch"):
        verify_qnsi_webhook_signature(body=tampered, signature_header=sig, secret=SECRET)


def test_verify_rejects_wrong_prefix() -> None:
    body = b"{}"
    with pytest.raises(QnsiWebhookError, match="must start with 'sha256='"):
        verify_qnsi_webhook_signature(
            body=body,
            signature_header="md5=abcd",
            secret=SECRET,
        )


def test_parse_returns_typed_event_on_happy_path() -> None:
    payload = {
        "event_type": "key.rotated",
        "event_id": "evt-001",
        "occurred_at": "2026-04-30T00:00:00Z",
        "payload": {"keyId": "key-abc", "newVersion": 2},
    }
    body = json.dumps(payload).encode("utf-8")
    event = parse_qnsi_webhook(
        body=body,
        signature_header=_sign(body),
        timestamp_header=_now_iso(),
        secret=SECRET,
    )
    assert isinstance(event, QnsiWebhookEvent)
    assert event.event_type == "key.rotated"
    assert event.event_id == "evt-001"
    assert event.payload["keyId"] == "key-abc"


def test_parse_rejects_old_timestamp() -> None:
    payload = {
        "event_type": "x",
        "event_id": "y",
        "occurred_at": "2026-04-30T00:00:00Z",
        "payload": {},
    }
    body = json.dumps(payload).encode("utf-8")
    old = (datetime.now(tz=timezone.utc) - timedelta(seconds=600)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with pytest.raises(QnsiWebhookError, match="too old"):
        parse_qnsi_webhook(
            body=body,
            signature_header=_sign(body),
            timestamp_header=old,
            secret=SECRET,
        )


def test_parse_rejects_future_timestamp() -> None:
    payload = {"event_type": "x", "event_id": "y", "occurred_at": "z", "payload": {}}
    body = json.dumps(payload).encode("utf-8")
    far_future = (datetime.now(tz=timezone.utc) + timedelta(seconds=600)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    with pytest.raises(QnsiWebhookError, match="future"):
        parse_qnsi_webhook(
            body=body,
            signature_header=_sign(body),
            timestamp_header=far_future,
            secret=SECRET,
        )


def test_parse_rejects_malformed_json() -> None:
    body = b'{"not-valid-json'
    with pytest.raises(QnsiWebhookError, match="not valid JSON"):
        parse_qnsi_webhook(
            body=body,
            signature_header=_sign(body),
            timestamp_header=_now_iso(),
            secret=SECRET,
        )


def test_parse_rejects_missing_event_id() -> None:
    body = json.dumps({"event_type": "x", "occurred_at": _now_iso(), "payload": {}}).encode()
    with pytest.raises(QnsiWebhookError, match="event_id"):
        parse_qnsi_webhook(
            body=body,
            signature_header=_sign(body),
            timestamp_header=_now_iso(),
            secret=SECRET,
        )
