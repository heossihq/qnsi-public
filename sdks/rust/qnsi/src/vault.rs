//! QNSI Vault - PQC-encrypted secret storage with versioning, rotation,
//! and deletion.

use reqwest::Method;
use serde_json::Value;
use std::sync::Arc;

use crate::activation::Activation;
use crate::errors::Error;
use crate::service_client::ServiceClient;

const PATH_PREFIX: &str = "/proxy/vault/v1";

#[derive(Clone)]
pub struct Client {
    sc: ServiceClient,
}

impl Client {
    pub fn new(activation: Arc<Activation>, http: reqwest::Client) -> Self {
        Self { sc: ServiceClient::new(activation, http, PATH_PREFIX) }
    }

    pub async fn create_secret(
        &self,
        req: CreateSecretRequest,
        idempotency_key: Option<&str>,
    ) -> Result<Value, Error> {
        // Wire contract: createSecretSchema = { tenantId, name(min3), payload,
        // metadata, rotationPolicy(default) }. tenantId is injected by ServiceClient.
        // Map payload_b64 -> payload and fold algorithm into metadata (mirrors npm).
        let mut metadata = req.metadata.unwrap_or_default();
        if let Some(alg) = &req.algorithm {
            metadata.insert("algorithm".to_string(), Value::String(alg.clone()));
        }
        let body = serde_json::json!({
            "name": req.name,
            "payload": req.payload_b64,
            "metadata": metadata,
        });
        self.sc
            .request(Method::POST, "/secrets", Some(&body), None, idempotency_key)
            .await
    }

    pub async fn get_secret(&self, secret_id: &str) -> Result<Value, Error> {
        self.sc
            .request::<()>(Method::GET, &format!("/secrets/{}", secret_id), None, None, None)
            .await
    }

    pub async fn get_secret_version(&self, secret_id: &str, version: u64) -> Result<Value, Error> {
        self.sc
            .request::<()>(
                Method::GET,
                &format!("/secrets/{}/versions/{}", secret_id, version),
                None,
                None,
                None,
            )
            .await
    }

    pub async fn rotate_secret(
        &self,
        secret_id: &str,
        payload_b64: String,
        algorithm: Option<String>,
        idempotency_key: Option<&str>,
    ) -> Result<Value, Error> {
        // Wire contract: rotateSecretSchema = { tenantId, newPayload?, metadata?,
        // rotationPolicy? }. Map payload_b64 -> newPayload; algorithm into metadata.
        let mut body = serde_json::json!({ "newPayload": payload_b64 });
        if let Some(alg) = algorithm {
            body["metadata"] = serde_json::json!({ "algorithm": alg });
        }
        self.sc
            .request(
                Method::POST,
                &format!("/secrets/{}/rotate", secret_id),
                Some(&body),
                None,
                idempotency_key,
            )
            .await
    }

    pub async fn delete_secret(&self, secret_id: &str) -> Result<(), Error> {
        // tenantId is injected into the query centrally by ServiceClient.
        self.sc
            .request::<()>(Method::DELETE, &format!("/secrets/{}", secret_id), None, None, None)
            .await?;
        Ok(())
    }

    pub async fn list_secret_versions(&self, secret_id: &str) -> Result<Value, Error> {
        self.sc
            .request::<()>(
                Method::GET,
                &format!("/secrets/{}/versions", secret_id),
                None,
                None,
                None,
            )
            .await
    }
}

/// SDK-facing input for [`Client::create_secret`]. `create_secret` maps this to
/// the backend wire shape (`payload_b64` -> `payload`, `algorithm` folded into
/// `metadata`), so the field names here are the ergonomic SDK surface, not the wire.
#[derive(Debug, Clone, Default)]
pub struct CreateSecretRequest {
    pub name: String,
    pub payload_b64: String,
    pub algorithm: Option<String>,
    pub metadata: Option<serde_json::Map<String, Value>>,
}
