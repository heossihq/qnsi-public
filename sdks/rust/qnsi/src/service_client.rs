//! Internal shared HTTP plumbing for the public service modules.
//! End users should call `Client::vault()`, `Client::kms()`, or
//! `Client::audit()` rather than construct this directly.

use reqwest::{Method, StatusCode};
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;

use crate::activation::{parse_api_error, Activation};
use crate::errors::{Error, NetworkError};

#[derive(Clone)]
pub struct ServiceClient {
    pub activation: Arc<Activation>,
    pub http: reqwest::Client,
    pub path_prefix: &'static str,
}

impl ServiceClient {
    pub fn new(
        activation: Arc<Activation>,
        http: reqwest::Client,
        path_prefix: &'static str,
    ) -> Self {
        Self {
            activation,
            http,
            path_prefix,
        }
    }

    pub async fn request<B: Serialize>(
        &self,
        method: Method,
        path: &str,
        body: Option<&B>,
        query: Option<&[(&str, String)]>,
        idempotency_key: Option<&str>,
    ) -> Result<Value, Error> {
        // Lazy activation - first call exercises the handshake. The resolved
        // tenantId is injected into object bodies below.
        let tenant_id = self.activation.get().await?.tenant_id;

        let resp = self
            .send(method.clone(), path, body, query, idempotency_key, &tenant_id)
            .await?;

        let resp = if resp.status() == StatusCode::UNAUTHORIZED {
            self.activation.invalidate();
            let tenant_id = self.activation.get().await?.tenant_id;
            self.send(method, path, body, query, idempotency_key, &tenant_id)
                .await?
        } else {
            resp
        };

        let status = resp.status();
        let url = resp.url().to_string();
        let body_text = resp.text().await.map_err(|e| NetworkError {
            op: "read body".into(),
            url,
            cause: e.to_string(),
        })?;

        if !status.is_success() {
            return Err(parse_api_error(status, &body_text).into());
        }

        if status == StatusCode::NO_CONTENT || body_text.is_empty() {
            return Ok(Value::Object(serde_json::Map::new()));
        }

        let parsed: Value = serde_json::from_str(&body_text).map_err(|_| crate::errors::ApiError {
            status_code: status.as_u16(),
            code: None,
            message: "response is not valid JSON".into(),
            body: None,
        })?;

        Ok(parsed)
    }

    async fn send<B: Serialize>(
        &self,
        method: Method,
        path: &str,
        body: Option<&B>,
        query: Option<&[(&str, String)]>,
        idempotency_key: Option<&str>,
        tenant_id: &str,
    ) -> Result<reqwest::Response, NetworkError> {
        let url = format!("{}{}{}", self.activation.base_url(), self.path_prefix, path);
        let mut req = self
            .http
            .request(method.clone(), &url)
            .header("authorization", self.activation.auth_header())
            .header("accept", "application/json");
        if let Some(b) = body {
            // Backend write schemas REQUIRE a tenantId (uuid) and scope the row to
            // it. Inject the activated tenantId into object bodies centrally rather
            // than per-method (mirrors the Python SDK's _service.py:74-75 and the npm
            // SDK's withTenantId); a caller-supplied tenantId always wins. Omitting
            // it is what shipped silent "missing tenantId" 400s + stripped fields.
            let mut value = serde_json::to_value(b).map_err(|e| NetworkError {
                op: "serialize body".into(),
                url: url.clone(),
                cause: e.to_string(),
            })?;
            if let Value::Object(ref mut map) = value {
                map.entry("tenantId")
                    .or_insert_with(|| Value::String(tenant_id.to_string()));
            }
            req = req.json(&value);
        }
        // Inject the activated tenantId into the query too (npm withTenantIdQuery):
        // GET/DELETE endpoints (e.g. GET /kms/v1/keys/:id, /crypto/v1/assets) read
        // tenantId from the query and 400 without it; the body injection above cannot
        // help a body-less request. A caller-supplied query tenantId wins.
        let mut query_pairs: Vec<(String, String)> = query
            .map(|q| q.iter().map(|(k, v)| (k.to_string(), v.clone())).collect())
            .unwrap_or_default();
        if !query_pairs.iter().any(|(k, _)| k == "tenantId") {
            query_pairs.push(("tenantId".to_string(), tenant_id.to_string()));
        }
        req = req.query(&query_pairs);
        if let Some(key) = idempotency_key {
            req = req.header("idempotency-key", key);
        }
        req.send().await.map_err(|e| NetworkError {
            op: method.to_string(),
            url,
            cause: e.to_string(),
        })
    }
}
