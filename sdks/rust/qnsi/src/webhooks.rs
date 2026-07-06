//! QNSI webhook signature verification + typed event parsing.
//!
//! Every QNSI webhook is signed with HMAC-SHA-256 over the raw request
//! body. Always verify the **raw bytes** before parsing JSON.

use chrono::{DateTime, Duration, Utc};
use hmac::{Hmac, Mac};
use sha2::Sha256;

use crate::errors::WebhookError;

type HmacSha256 = Hmac<Sha256>;

/// Default replay-protection window for [`parse_webhook`].
pub const MAX_WEBHOOK_SKEW: Duration = Duration::minutes(5);

/// The typed envelope every QNSI webhook follows.
#[derive(Debug, Clone)]
pub struct WebhookEvent {
    pub event_type: String,
    pub event_id: String,
    pub occurred_at: String,
    pub payload: serde_json::Map<String, serde_json::Value>,
}

/// Constant-time HMAC-SHA-256 verification. The header must be of the
/// form `sha256=<hex>`.
pub fn verify_webhook_signature(
    body: &[u8],
    signature_header: &str,
    secret: &str,
) -> Result<(), WebhookError> {
    let expected_hex = signature_header.strip_prefix("sha256=").ok_or_else(|| {
        WebhookError {
            reason: "signature header must start with 'sha256='".into(),
        }
    })?;
    let expected = hex::decode(expected_hex).map_err(|_| WebhookError {
        reason: "signature is not valid hex".into(),
    })?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| WebhookError {
        reason: "invalid secret".into(),
    })?;
    mac.update(body);
    mac.verify_slice(&expected).map_err(|_| WebhookError {
        reason: "signature mismatch".into(),
    })?;
    Ok(())
}

/// Verify the HMAC, enforce replay protection, parse the JSON body, and
/// return a typed [`WebhookEvent`].
pub fn parse_webhook(
    body: &[u8],
    signature_header: &str,
    timestamp_header: Option<&str>,
    secret: &str,
    max_skew: Duration,
    now: Option<DateTime<Utc>>,
) -> Result<WebhookEvent, WebhookError> {
    verify_webhook_signature(body, signature_header, secret)?;

    if let Some(ts) = timestamp_header {
        let parsed = DateTime::parse_from_rfc3339(ts)
            .map_err(|_| WebhookError {
                reason: "timestamp header is not RFC3339".into(),
            })?
            .with_timezone(&Utc);
        let reference = now.unwrap_or_else(Utc::now);
        let delta = reference - parsed;
        if delta > max_skew {
            return Err(WebhookError {
                reason: "timestamp is too old".into(),
            });
        }
        if -delta > max_skew {
            return Err(WebhookError {
                reason: "timestamp is in the future".into(),
            });
        }
    }

    let raw: serde_json::Value = serde_json::from_slice(body).map_err(|_| WebhookError {
        reason: "body is not valid JSON".into(),
    })?;
    let obj = raw.as_object().ok_or_else(|| WebhookError {
        reason: "body is not a JSON object".into(),
    })?;

    let event_type = obj
        .get("event_type")
        .and_then(|v| v.as_str())
        .ok_or_else(|| WebhookError {
            reason: "missing event_type".into(),
        })?
        .to_string();
    let event_id = obj
        .get("event_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| WebhookError {
            reason: "missing event_id".into(),
        })?
        .to_string();
    let occurred_at = obj
        .get("occurred_at")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let payload = obj
        .get("payload")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    Ok(WebhookEvent {
        event_type,
        event_id,
        occurred_at,
        payload,
    })
}
