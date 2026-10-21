//! QNSI Vault - PQC-encrypted secret storage with versioning, rotation,
//! and deletion.

use reqwest::Method;
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;

use crate::activation::Activation;
use crate::errors::{ApiError, Error};
use crate::service_client::ServiceClient;

const PATH_PREFIX: &str = "/proxy/vault/v1";

fn resource_segment(value: &str) -> Result<String, Error> {
    if value.is_empty() || value == "." || value == ".." {
        return Err(ApiError {
            status_code: 400,
            code: Some("INVALID_RESOURCE_IDENTIFIER".into()),
            message: "Empty or dot-segment Vault identifier".into(),
            body: None,
        }
        .into());
    }
    Ok(crate::surface::encode_segment(value))
}

#[derive(Clone)]
pub struct Client {
    sc: ServiceClient,
}

impl Client {
    pub fn new(activation: Arc<Activation>, http: reqwest::Client) -> Self {
        Self {
            sc: ServiceClient::new(activation, http, PATH_PREFIX),
        }
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
        let secret_id = resource_segment(secret_id)?;
        self.sc
            .request::<()>(
                Method::GET,
                &format!("/secrets/{}", secret_id),
                None,
                None,
                None,
            )
            .await
    }

    pub async fn get_secret_version(&self, secret_id: &str, version: u64) -> Result<Value, Error> {
        let secret_id = resource_segment(secret_id)?;
        if version == 0 {
            return Err(ApiError {
                status_code: 400,
                code: Some("INVALID_SECRET_VERSION".into()),
                message: "Secret version must be positive".into(),
                body: None,
            }
            .into());
        }
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
        let secret_id = resource_segment(secret_id)?;
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
        let secret_id = resource_segment(secret_id)?;
        // tenantId is injected into the query centrally by ServiceClient.
        self.sc
            .request::<()>(
                Method::DELETE,
                &format!("/secrets/{}", secret_id),
                None,
                None,
                None,
            )
            .await?;
        Ok(())
    }

    pub async fn list_secret_versions(&self, secret_id: &str) -> Result<Value, Error> {
        let secret_id = resource_segment(secret_id)?;
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

    /// Server registration catalog, not independent provider-account assurance.
    pub async fn list_dynamic_secret_engines(&self) -> Result<Value, Error> {
        self.sc
            .request::<()>(Method::GET, "/dynamic-secrets/engines", None, None, None)
            .await
    }

    /// Requires an approved connection reference, never inline admin credentials.
    pub async fn create_dynamic_secret_config(
        &self,
        request: CreateDynamicSecretConfigRequest,
        idempotency_key: Option<&str>,
    ) -> Result<Value, Error> {
        self.sc
            .request(
                Method::POST,
                "/dynamic-secrets/configs",
                Some(&request),
                None,
                idempotency_key,
            )
            .await
    }

    pub async fn list_dynamic_secret_configs(
        &self,
        engine_type: Option<&str>,
        secret_type: Option<&str>,
    ) -> Result<Value, Error> {
        let mut query = Vec::new();
        if let Some(engine) = engine_type {
            query.push(("engineType", engine.to_string()));
        }
        if let Some(kind) = secret_type {
            query.push(("secretType", kind.to_string()));
        }
        self.sc
            .request::<()>(
                Method::GET,
                "/dynamic-secrets/configs",
                None,
                Some(&query),
                None,
            )
            .await
    }

    /// Retains engine-specific credential fields and authoritative lease lifecycle.
    pub async fn request_credentials(
        &self,
        config_id: &str,
        request: RequestCredentialsRequest,
        idempotency_key: Option<&str>,
    ) -> Result<Value, Error> {
        let config_id = resource_segment(config_id)?;
        self.sc
            .request(
                Method::POST,
                &format!("/dynamic-secrets/configs/{config_id}/credentials"),
                Some(&request),
                None,
                idempotency_key,
            )
            .await
    }

    pub async fn list_leases(
        &self,
        config_id: &str,
        include_all_statuses: Option<bool>,
    ) -> Result<Value, Error> {
        let config_id = resource_segment(config_id)?;
        let mut query = Vec::new();
        if let Some(include) = include_all_statuses {
            query.push(("includeAllStatuses", include.to_string()));
        }
        self.sc
            .request::<()>(
                Method::GET,
                &format!("/dynamic-secrets/configs/{config_id}/leases"),
                None,
                Some(&query),
                None,
            )
            .await
    }

    pub async fn renew_lease(
        &self,
        lease_id: &str,
        ttl_seconds: Option<u64>,
    ) -> Result<Value, Error> {
        let lease_id = resource_segment(lease_id)?;
        let mut body = serde_json::json!({});
        if let Some(ttl) = ttl_seconds {
            body["ttlSeconds"] = Value::from(ttl);
        }
        self.sc
            .request(
                Method::POST,
                &format!("/dynamic-secrets/leases/{lease_id}/renew"),
                Some(&body),
                None,
                None,
            )
            .await
    }

    /// Returns the revoking queue acknowledgement, not completed provider revocation.
    pub async fn revoke_lease(&self, lease_id: &str) -> Result<Value, Error> {
        let lease_id = resource_segment(lease_id)?;
        self.sc
            .request::<()>(
                Method::POST,
                &format!("/dynamic-secrets/leases/{lease_id}/revoke"),
                None,
                None,
                None,
            )
            .await
    }

    pub async fn get_dynamic_secret_stats(&self) -> Result<Value, Error> {
        self.sc
            .request::<()>(Method::GET, "/dynamic-secrets/stats", None, None, None)
            .await
    }
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDynamicSecretConfigRequest {
    pub name: String,
    pub engine_type: String,
    pub connection_ref: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secret_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role_template: Option<serde_json::Map<String, Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_ttl_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_ttl_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestCredentialsRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ttl_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Map<String, Value>>,
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
