//! SDK activation handshake against billing-service.
//!
//! End-user customers authenticate with a `qnsp_pqc_*` API key issued
//! from the cloud portal. The SDK calls `/billing/v1/sdk/activate`,
//! which validates the key, returns the tenant tier + limits, and issues
//! a short-lived activation token cached in memory.

use chrono::{DateTime, Duration, Utc};
use reqwest::StatusCode;
use serde_json::Value;
use std::sync::Mutex;

use crate::errors::{ApiError, AuthError, Error, NetworkError};

const ACTIVATION_PATH: &str = "/billing/v1/sdk/activate";
const EXPIRY_BUFFER_SECONDS: i64 = 60;

/// Decoded response from the activation handshake.
#[derive(Debug, Clone)]
pub struct ActivationResult {
    pub tenant_id: String,
    pub tier: String,
    pub limits: serde_json::Map<String, Value>,
    pub activation_token: String,
    pub expires_at: DateTime<Utc>,
}

/// Performs the SDK activation handshake and caches the result until
/// ~1 minute before expiry.
#[derive(Debug)]
pub struct Activation {
    api_key: String,
    base_url: String,
    http: reqwest::Client,
    cache: Mutex<Option<ActivationResult>>,
}

impl Activation {
    pub(crate) fn new(api_key: String, base_url: String, http: reqwest::Client) -> Self {
        Self {
            api_key,
            base_url: base_url.trim_end_matches('/').to_string(),
            http,
            cache: Mutex::new(None),
        }
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn auth_header(&self) -> String {
        format!("Bearer {}", self.api_key)
    }

    /// Return the current activation, refreshing if expired or near
    /// expiry. Concurrent callers may both observe a refresh; the result
    /// is only meaningful as a cache hint.
    pub async fn get(&self) -> Result<ActivationResult, Error> {
        if let Some(cached) = self.cache.lock().unwrap().clone() {
            let still_fresh = (cached.expires_at - Utc::now()).num_seconds() > EXPIRY_BUFFER_SECONDS;
            if still_fresh {
                return Ok(cached);
            }
        }
        self.refresh().await
    }

    /// Drop the cached activation. The next call to `get` will trigger a
    /// fresh handshake.
    pub fn invalidate(&self) {
        *self.cache.lock().unwrap() = None;
    }

    async fn refresh(&self) -> Result<ActivationResult, Error> {
        let url = format!("{}{}", self.base_url, ACTIVATION_PATH);
        let body = serde_json::json!({
            "sdkId": crate::SDK_ID,
            "sdkVersion": crate::SDK_VERSION,
            "runtime": "rust",
        });

        let resp = self
            .http
            .post(&url)
            .header("authorization", self.auth_header())
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| NetworkError {
                op: "POST".into(),
                url: url.clone(),
                cause: e.to_string(),
            })?;

        let status = resp.status();
        let raw = resp.text().await.map_err(|e| NetworkError {
            op: "POST".into(),
            url: url.clone(),
            cause: e.to_string(),
        })?;

        if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
            return Err(parse_auth_error(status, &raw).into());
        }
        if !status.is_success() {
            return Err(parse_api_error(status, &raw).into());
        }

        let parsed: Value = serde_json::from_str(&raw).map_err(|_| ApiError {
            status_code: status.as_u16(),
            code: None,
            message: "activation response is not valid JSON".into(),
            body: None,
        })?;

        let result = decode_activation(parsed)?;
        *self.cache.lock().unwrap() = Some(result.clone());
        Ok(result)
    }
}

fn decode_activation(raw: Value) -> Result<ActivationResult, ApiError> {
    let obj = raw.as_object().ok_or_else(|| ApiError {
        status_code: 200,
        code: None,
        message: "activation response is not a JSON object".into(),
        body: Some(raw.clone()),
    })?;

    let tenant_id = obj
        .get("tenantId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError {
            status_code: 200,
            code: None,
            message: "activation response missing tenantId".into(),
            body: Some(raw.clone()),
        })?
        .to_string();

    let tier = obj
        .get("tier")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let limits = obj
        .get("limits")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    let activation_token = obj
        .get("activationToken")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let expires_at = obj
        .get("expiresAt")
        .and_then(|v| v.as_str())
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|| Utc::now() + Duration::minutes(5));

    Ok(ActivationResult {
        tenant_id,
        tier,
        limits,
        activation_token,
        expires_at,
    })
}

pub(crate) fn parse_auth_error(status: StatusCode, raw: &str) -> AuthError {
    let value: Value = serde_json::from_str(raw).unwrap_or(Value::Null);
    let code = value
        .get("code")
        .and_then(|v| v.as_str())
        .map(String::from);
    let message = value
        .get("message")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| format!("activation rejected (HTTP {})", status.as_u16()));
    AuthError { code, message }
}

pub(crate) fn parse_api_error(status: StatusCode, raw: &str) -> ApiError {
    let value: Value = serde_json::from_str(raw).unwrap_or(Value::Null);
    let code = value
        .get("code")
        .and_then(|v| v.as_str())
        .map(String::from);
    let message = value
        .get("message")
        .or_else(|| value.get("error"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| format!("HTTP {}", status.as_u16()));
    ApiError {
        status_code: status.as_u16(),
        code,
        message,
        body: Some(value),
    }
}
