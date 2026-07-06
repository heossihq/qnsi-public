use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use sha2::Sha256;

use qnsi::{parse_webhook, verify_webhook_signature, WebhookError, MAX_WEBHOOK_SKEW};

const SECRET: &str = "test-shared-secret";

type HmacSha256 = Hmac<Sha256>;

fn sign(body: &[u8], secret: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(body);
    format!("sha256={}", hex::encode(mac.finalize().into_bytes()))
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

#[test]
fn verify_succeeds_on_matching_signature() {
    let body = br#"{"event_type":"key.rotated"}"#;
    verify_webhook_signature(body, &sign(body, SECRET), SECRET).unwrap();
}

#[test]
fn verify_rejects_tampered_body() {
    let body = br#"{"event_type":"key.rotated"}"#;
    let sig = sign(body, SECRET);
    let tampered = br#"{"event_type":"key.deleted"}"#;
    let err = verify_webhook_signature(tampered, &sig, SECRET).unwrap_err();
    assert!(err.reason.contains("mismatch"), "expected mismatch, got {err:?}");
}

#[test]
fn verify_rejects_wrong_prefix() {
    let body = b"{}";
    let err = verify_webhook_signature(body, "md5=abcd", SECRET).unwrap_err();
    assert!(err.reason.contains("sha256="));
}

#[test]
fn parse_returns_typed_event_on_happy_path() {
    let payload = serde_json::json!({
        "event_type": "key.rotated",
        "event_id": "evt-001",
        "occurred_at": "2026-04-30T00:00:00Z",
        "payload": {"keyId": "key-abc", "newVersion": 2},
    });
    let body = serde_json::to_vec(&payload).unwrap();
    let event = parse_webhook(
        &body,
        &sign(&body, SECRET),
        Some(&now_iso()),
        SECRET,
        MAX_WEBHOOK_SKEW,
        None,
    )
    .unwrap();
    assert_eq!(event.event_type, "key.rotated");
    assert_eq!(event.event_id, "evt-001");
    assert_eq!(event.payload.get("keyId").unwrap(), "key-abc");
}

#[test]
fn parse_rejects_old_timestamp() {
    let payload = serde_json::json!({
        "event_type": "x",
        "event_id": "y",
        "payload": {},
    });
    let body = serde_json::to_vec(&payload).unwrap();
    let old = (Utc::now() - Duration::seconds(600)).to_rfc3339();
    let err: WebhookError =
        parse_webhook(&body, &sign(&body, SECRET), Some(&old), SECRET, MAX_WEBHOOK_SKEW, None)
            .unwrap_err();
    assert!(err.reason.contains("too old"));
}

#[test]
fn parse_rejects_future_timestamp() {
    let payload = serde_json::json!({"event_type": "x", "event_id": "y", "payload": {}});
    let body = serde_json::to_vec(&payload).unwrap();
    let future = (Utc::now() + Duration::seconds(600)).to_rfc3339();
    let err =
        parse_webhook(&body, &sign(&body, SECRET), Some(&future), SECRET, MAX_WEBHOOK_SKEW, None)
            .unwrap_err();
    assert!(err.reason.contains("future"));
}

#[test]
fn parse_rejects_malformed_json() {
    let body = br#"{"not-valid-json"#;
    let err =
        parse_webhook(body, &sign(body, SECRET), Some(&now_iso()), SECRET, MAX_WEBHOOK_SKEW, None)
            .unwrap_err();
    assert!(err.reason.contains("JSON"));
}

#[test]
fn parse_rejects_missing_event_id() {
    let payload = serde_json::json!({
        "event_type": "x",
        "occurred_at": Utc::now().to_rfc3339(),
        "payload": {},
    });
    let body = serde_json::to_vec(&payload).unwrap();
    let err =
        parse_webhook(&body, &sign(&body, SECRET), Some(&now_iso()), SECRET, MAX_WEBHOOK_SKEW, None)
            .unwrap_err();
    assert!(err.reason.contains("event_id"));
}
