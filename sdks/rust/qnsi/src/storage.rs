//! QNSI Storage - PQC-encrypted object storage with SSE-X.

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::activation::Activation;
use crate::errors::{ApiError, Error};
use crate::service_client::ServiceClient;

// Edge gateway rewrites /proxy/storage -> /storage, so this resolves to the
// backend's /storage/v1/buckets/* routes. (Was /proxy/storage/storage/v1 - a
// double "storage" the backend never served, so every call 404'd. Matches npm.)
const PATH_PREFIX: &str = "/proxy/storage/v1";

#[derive(Clone)]
pub struct Client {
    sc: ServiceClient,
}

impl Client {
    pub fn new(activation: Arc<Activation>, http: reqwest::Client) -> Self {
        Self { sc: ServiceClient::new(activation, http, PATH_PREFIX) }
    }

    pub async fn put_object(&self, bucket: &str, key: &str, req: PutObjectRequest, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::PUT, &format!("/buckets/{}/objects/{}", bucket, key), Some(&req), None, idempotency_key).await
    }

    /// Returns the decoded object bytes alongside the descriptor JSON.
    pub async fn get_object(&self, bucket: &str, key: &str) -> Result<(Vec<u8>, Value), Error> {
        let resp = self.sc.request::<()>(Method::GET, &format!("/buckets/{}/objects/{}", bucket, key), None, None, None).await?;
        let data_b64 = resp
            .get("dataB64")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError {
                status_code: 200,
                code: None,
                message: "storage.get_object: response missing dataB64".into(),
                body: Some(resp.clone()),
            })?;
        let bytes = B64.decode(data_b64).map_err(|_| Error::Api(ApiError {
            status_code: 200,
            code: None,
            message: "storage.get_object: dataB64 not valid base64".into(),
            body: None,
        }))?;
        Ok((bytes, resp))
    }

    pub async fn delete_object(&self, bucket: &str, key: &str) -> Result<(), Error> {
        self.sc.request::<()>(Method::DELETE, &format!("/buckets/{}/objects/{}", bucket, key), None, None, None).await?;
        Ok(())
    }

    pub async fn list_objects(&self, bucket: &str, query: &[(&str, String)]) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, &format!("/buckets/{}/objects", bucket), None, Some(query), None).await
    }

    pub async fn list_buckets(&self) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, "/buckets", None, None, None).await
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PutObjectRequest {
    #[serde(rename = "dataB64")]
    pub data_b64: String,
    #[serde(rename = "contentType", skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    #[serde(rename = "sseAlgorithm", skip_serializing_if = "Option::is_none")]
    pub sse_algorithm: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Map<String, Value>>,
}
