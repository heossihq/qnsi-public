//! QNSI Auth — password login, JWT session refresh/revocation, MFA, and
//! risk-based authentication, mapped to the REAL auth-service routes
//! (verified against production; mirrors the cloud portal + the JVM SDK).
//!
//! Two routing conventions:
//!  - `login` / `refresh_token` hit `/edge/auth/*` with credentials / refresh
//!    token in the body and NO auth header (the session does not exist yet);
//!  - `revoke` / `mfa_*` / `*risk*` are post-login ops on bare `/auth/*` and
//!    require the session JWT (Bearer) plus the `x-qnsp-tenant-id` header. Call
//!    [`Client::login`] first — this client caches the resulting session and
//!    uses it automatically.
//!
//! WebAuthn passkeys and SAML/OIDC federation are intentionally NOT exposed:
//! the backend has no passkey routes, and federation is a SCIM/SAML-ACS
//! provisioning API (not a per-call SDK surface). They were removed rather than
//! ship dead endpoints (the prior `/proxy/auth/v1/*` paths did not exist).

use reqwest::{Method, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::{Arc, Mutex};

use crate::activation::{parse_api_error, Activation};
use crate::errors::{ApiError, Error, NetworkError};

#[derive(Clone)]
pub struct Client {
    activation: Arc<Activation>,
    http: reqwest::Client,
    session: Arc<Mutex<Option<Session>>>,
}

/// A logged-in session (JWT + tenant), established by [`Client::login`] and used
/// automatically by the post-login operations.
#[derive(Debug, Clone)]
pub struct Session {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub tenant_id: String,
}

impl Client {
    pub fn new(activation: Arc<Activation>, http: reqwest::Client) -> Self {
        Self {
            activation,
            http,
            session: Arc::new(Mutex::new(None)),
        }
    }

    /// The current session, or `None` until [`Client::login`] succeeds.
    pub fn session(&self) -> Option<Session> {
        self.session.lock().unwrap().clone()
    }

    fn require_session(&self) -> Result<Session, Error> {
        self.session
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| {
                ApiError {
                    status_code: 401,
                    code: Some("NOT_LOGGED_IN".into()),
                    message: "Not logged in: call auth().login(...) first".into(),
                    body: None,
                }
                .into()
            })
    }

    /// Password login. `POST /edge/auth/login` (credentials in the body, no auth
    /// header). Caches the returned session so [`Client::revoke`],
    /// [`Client::mfa_challenge`], [`Client::evaluate_risk`], … authenticate
    /// automatically. Returns the raw response (accessToken / refreshToken / …).
    pub async fn login(&self, req: LoginRequest) -> Result<Value, Error> {
        let body = self
            .request_json(Method::POST, "/edge/auth/login", Some(&req), None, None)
            .await?;
        if let Some(access) = token_string(body.get("accessToken")) {
            *self.session.lock().unwrap() = Some(Session {
                access_token: access,
                refresh_token: token_string(body.get("refreshToken")),
                tenant_id: req.tenant_id.clone(),
            });
        }
        Ok(body)
    }

    /// Refresh the access token using a refresh token. `POST /edge/auth/token/refresh`.
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<Value, Error> {
        #[derive(Serialize)]
        struct Body<'a> {
            #[serde(rename = "refreshToken")]
            refresh_token: &'a str,
        }
        let body = self
            .request_json(
                Method::POST,
                "/edge/auth/token/refresh",
                Some(&Body { refresh_token }),
                None,
                None,
            )
            .await?;
        if let Some(access) = token_string(body.get("accessToken")) {
            let mut guard = self.session.lock().unwrap();
            if let Some(s) = guard.as_mut() {
                s.access_token = access;
                if let Some(r) = token_string(body.get("refreshToken")) {
                    s.refresh_token = Some(r);
                }
            }
        }
        Ok(body)
    }

    /// Revoke a refresh token (session). `POST /auth/token/revoke` (session-authenticated).
    pub async fn revoke(&self, refresh_token: &str) -> Result<(), Error> {
        let s = self.require_session()?;
        #[derive(Serialize)]
        struct Body<'a> {
            token: &'a str,
        }
        self.request_json(
            Method::POST,
            "/auth/token/revoke",
            Some(&Body { token: refresh_token }),
            Some(&s.access_token),
            Some(&s.tenant_id),
        )
        .await?;
        Ok(())
    }

    // ── MFA (session-authenticated) ──────────────────────────────────

    pub async fn mfa_challenge(&self, body: serde_json::Map<String, Value>) -> Result<Value, Error> {
        self.session_post("/auth/mfa/challenge", body).await
    }

    pub async fn mfa_verify(&self, body: serde_json::Map<String, Value>) -> Result<Value, Error> {
        self.session_post("/auth/mfa/verify", body).await
    }

    // ── Risk-based auth (session-authenticated) ──────────────────────

    pub async fn evaluate_risk(&self, body: serde_json::Map<String, Value>) -> Result<Value, Error> {
        self.session_post("/auth/risk/evaluate", body).await
    }

    pub async fn list_risk_policies(&self) -> Result<Value, Error> {
        let s = self.require_session()?;
        self.request_json::<()>(
            Method::GET,
            "/auth/risk/policies",
            None,
            Some(&s.access_token),
            Some(&s.tenant_id),
        )
        .await
    }

    async fn session_post(
        &self,
        path: &str,
        body: serde_json::Map<String, Value>,
    ) -> Result<Value, Error> {
        let s = self.require_session()?;
        self.request_json(
            Method::POST,
            path,
            Some(&Value::Object(body)),
            Some(&s.access_token),
            Some(&s.tenant_id),
        )
        .await
    }

    /// Raw request against the auth surface. `bearer = None` sends no auth header
    /// (pre-session login/refresh); `bearer = Some(jwt)` sends the session JWT as
    /// a Bearer token plus the `x-qnsp-tenant-id` header. Mirrors the error
    /// handling of the shared `ServiceClient`.
    async fn request_json<B: Serialize>(
        &self,
        method: Method,
        path: &str,
        body: Option<&B>,
        bearer: Option<&str>,
        tenant_id: Option<&str>,
    ) -> Result<Value, Error> {
        let url = format!("{}{}", self.activation.base_url(), path);
        let mut rb = self
            .http
            .request(method.clone(), &url)
            .header("accept", "application/json");
        if let Some(b) = bearer {
            rb = rb.header("authorization", format!("Bearer {b}"));
        }
        if let Some(t) = tenant_id {
            rb = rb.header("x-qnsp-tenant-id", t);
        }
        if let Some(b) = body {
            rb = rb.json(b);
        }
        let resp = rb.send().await.map_err(|e| NetworkError {
            op: method.to_string(),
            url: url.clone(),
            cause: e.to_string(),
        })?;
        let status = resp.status();
        let resp_url = resp.url().to_string();
        let body_text = resp.text().await.map_err(|e| NetworkError {
            op: "read body".into(),
            url: resp_url,
            cause: e.to_string(),
        })?;
        if !status.is_success() {
            return Err(parse_api_error(status, &body_text).into());
        }
        if status == StatusCode::NO_CONTENT || body_text.is_empty() {
            return Ok(Value::Object(serde_json::Map::new()));
        }
        serde_json::from_str(&body_text).map_err(|_| {
            ApiError {
                status_code: status.as_u16(),
                code: None,
                message: "response is not valid JSON".into(),
                body: None,
            }
            .into()
        })
    }
}

impl std::fmt::Debug for Client {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AuthClient")
            .field(
                "logged_in",
                &self.session.lock().map(|g| g.is_some()).unwrap_or(false),
            )
            .finish()
    }
}

/// Tokens come back either as a bare string or as `{ "token": "…" }` (the
/// refresh token is the object form). Extract the string either way.
fn token_string(el: Option<&Value>) -> Option<String> {
    match el {
        Some(Value::String(s)) => Some(s.clone()),
        Some(Value::Object(o)) => o.get("token").and_then(|t| t.as_str()).map(str::to_string),
        _ => None,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    #[serde(rename = "tenantId")]
    pub tenant_id: String,
}
