//! QNSI Search - encrypted vector search with SSE-X.

use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::activation::Activation;
use crate::errors::Error;
use crate::service_client::ServiceClient;

const PATH_PREFIX: &str = "/proxy/search/v1";

#[derive(Clone)]
pub struct Client {
    sc: ServiceClient,
}

impl Client {
    pub fn new(activation: Arc<Activation>, http: reqwest::Client) -> Self {
        Self { sc: ServiceClient::new(activation, http, PATH_PREFIX) }
    }

    pub async fn create_index(&self, req: CreateIndexRequest, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::POST, "/indexes", Some(&req), None, idempotency_key).await
    }

    pub async fn list_indexes(&self) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, "/indexes", None, None, None).await
    }

    pub async fn delete_index(&self, index_name: &str) -> Result<(), Error> {
        self.sc.request::<()>(Method::DELETE, &format!("/indexes/{}", index_name), None, None, None).await?;
        Ok(())
    }

    pub async fn upsert_vectors(&self, index_name: &str, vectors: Vec<Vector>, idempotency_key: Option<&str>) -> Result<Value, Error> {
        #[derive(Serialize)]
        struct Body<'a> { vectors: &'a [Vector] }
        self.sc.request(Method::POST, &format!("/indexes/{}/vectors", index_name), Some(&Body { vectors: &vectors }), None, idempotency_key).await
    }

    pub async fn query(&self, index_name: &str, req: QueryRequest) -> Result<Value, Error> {
        self.sc.request(Method::POST, &format!("/indexes/{}/query", index_name), Some(&req), None, None).await
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateIndexRequest {
    pub name: String,
    pub dimensions: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metric: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub algorithm: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Map<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vector {
    pub id: String,
    pub values: Vec<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Map<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryRequest {
    pub vector: Vec<f32>,
    #[serde(rename = "topK")]
    pub top_k: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter: Option<serde_json::Map<String, Value>>,
}
