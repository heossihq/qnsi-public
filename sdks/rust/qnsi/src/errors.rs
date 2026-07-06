//! Typed error hierarchy for the QNSI Rust SDK.

use thiserror::Error;

/// Root error type for the SDK.
#[derive(Debug, Error)]
pub enum Error {
    /// DNS, TLS, timeout, or connection failure reaching QNSI.
    #[error("{0}")]
    Network(NetworkError),

    /// API key rejected at activation.
    #[error("{0}")]
    Auth(AuthError),

    /// A service returned 4xx/5xx with a structured body.
    #[error("{0}")]
    Api(ApiError),

    /// Webhook signature, replay, or shape failure.
    #[error("{0}")]
    Webhook(WebhookError),
}

#[derive(Debug, Error)]
#[error("qnsi: network error on {op} {url}: {cause}")]
pub struct NetworkError {
    pub op: String,
    pub url: String,
    pub cause: String,
}

#[derive(Debug, Error)]
#[error("qnsi: auth error{}: {message}", code.as_ref().map(|c| format!(" ({c})")).unwrap_or_default())]
pub struct AuthError {
    pub code: Option<String>,
    pub message: String,
}

#[derive(Debug, Error)]
#[error("qnsi: api error {status_code}{}: {message}", code.as_ref().map(|c| format!(" {c}")).unwrap_or_default())]
pub struct ApiError {
    pub status_code: u16,
    pub code: Option<String>,
    pub message: String,
    pub body: Option<serde_json::Value>,
}

#[derive(Debug, Error)]
#[error("qnsi: webhook error: {reason}")]
pub struct WebhookError {
    pub reason: String,
}

impl From<NetworkError> for Error {
    fn from(e: NetworkError) -> Self { Error::Network(e) }
}
impl From<AuthError> for Error {
    fn from(e: AuthError) -> Self { Error::Auth(e) }
}
impl From<ApiError> for Error {
    fn from(e: ApiError) -> Self { Error::Api(e) }
}
impl From<WebhookError> for Error {
    fn from(e: WebhookError) -> Self { Error::Webhook(e) }
}
