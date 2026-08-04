//! QNSI AI Orchestrator - model registry, AI workload submission with
//! enclave attestation, inference, and bias / prompt-injection monitoring.

use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::activation::Activation;
use crate::errors::Error;
use crate::service_client::ServiceClient;

const PATH_PREFIX: &str = "/proxy/ai/v1";

#[derive(Clone)]
pub struct Client {
    sc: ServiceClient,
}

impl Client {
    pub fn new(activation: Arc<Activation>, http: reqwest::Client) -> Self {
        Self { sc: ServiceClient::new(activation, http, PATH_PREFIX) }
    }

    // ── Model registry ──────────────────────────────────────────────

    pub async fn register_model(&self, req: RegisterModelRequest, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::POST, "/models", Some(&req), None, idempotency_key).await
    }

    pub async fn list_models(&self, query: &[(&str, String)]) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, "/models", None, Some(query), None).await
    }

    pub async fn get_model(&self, model_id: &str) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, &format!("/models/{}", model_id), None, None, None).await
    }

    pub async fn update_model(&self, model_id: &str, body: serde_json::Map<String, Value>, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc
            .request(Method::PATCH, &format!("/models/{}", model_id), Some(&Value::Object(body)), None, idempotency_key)
            .await
    }

    pub async fn activate_model(&self, model_id: &str, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc
            .request::<()>(Method::POST, &format!("/models/{}/activate", model_id), None, None, idempotency_key)
            .await
    }

    pub async fn deploy_model(&self, body: serde_json::Map<String, Value>, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc
            .request(Method::POST, "/models/deploy", Some(&Value::Object(body)), None, idempotency_key)
            .await
    }

    // ── Workloads ───────────────────────────────────────────────────

    pub async fn submit_workload(&self, req: SubmitWorkloadRequest, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::POST, "/workloads", Some(&req), None, idempotency_key).await
    }

    pub async fn get_workload(&self, workload_id: &str) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, &format!("/workloads/{}", workload_id), None, None, None).await
    }

    pub async fn list_workloads(&self, query: &[(&str, String)]) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, "/workloads", None, Some(query), None).await
    }

    pub async fn cancel_workload(&self, workload_id: &str, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc
            .request::<()>(Method::POST, &format!("/workloads/{}/cancel", workload_id), None, None, idempotency_key)
            .await
    }

    // ── Inference ────────────────────────────────────────────────────

    pub async fn invoke_inference(&self, req: InferenceRequest, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::POST, "/inference", Some(&req), None, idempotency_key).await
    }

    // ── Artifacts ────────────────────────────────────────────────────

    pub async fn register_artifact(&self, req: RegisterArtifactRequest, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::POST, "/artifacts", Some(&req), None, idempotency_key).await
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterModelRequest {
    pub name: String,
    pub version: String,
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Map<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitWorkloadRequest {
    #[serde(rename = "modelId")]
    pub model_id: String,
    #[serde(rename = "type")]
    pub workload_type: String,
    #[serde(rename = "inputRefs", skip_serializing_if = "Option::is_none")]
    pub input_refs: Option<Vec<String>>,
    #[serde(rename = "outputBucket", skip_serializing_if = "Option::is_none")]
    pub output_bucket: Option<String>,
    #[serde(rename = "enclaveType", skip_serializing_if = "Option::is_none")]
    pub enclave_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Map<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceRequest {
    #[serde(rename = "modelId")]
    pub model_id: String,
    pub input: serde_json::Map<String, Value>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Map<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterArtifactRequest {
    pub name: String,
    pub hash: String,
    #[serde(rename = "storageId")]
    pub storage_id: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub artifact_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Map<String, Value>>,
}
