//! QNSI Crypto-Inventory (CBOM) - asset catalogue, discovery runs,
//! deprecation policies, and PQC migration readiness.

use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::activation::Activation;
use crate::errors::Error;
use crate::service_client::ServiceClient;

const PATH_PREFIX: &str = "/proxy/crypto/v1";

#[derive(Clone)]
pub struct Client {
    sc: ServiceClient,
}

impl Client {
    pub fn new(activation: Arc<Activation>, http: reqwest::Client) -> Self {
        Self { sc: ServiceClient::new(activation, http, PATH_PREFIX) }
    }

    pub async fn list_assets(&self, query: &[(&str, String)]) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, "/assets", None, Some(query), None).await
    }

    pub async fn get_asset(&self, asset_id: &str) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, &format!("/assets/{}", asset_id), None, None, None).await
    }

    pub async fn get_asset_stats(&self, _tenant_id: &str) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, "/assets/stats", None, None, None).await
    }

    pub async fn discover_assets(&self, req: DiscoverAssetsRequest, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::POST, "/assets/discover", Some(&req), None, idempotency_key).await
    }

    pub async fn get_readiness_score(&self, _tenant_id: &str) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, "/readiness", None, None, None).await
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoverAssetsRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub targets: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<serde_json::Map<String, Value>>,
}
