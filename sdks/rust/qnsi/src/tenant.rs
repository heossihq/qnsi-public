//! QNSI Tenant — tenant CRUD, crypto-policy management, sub-tenant
//! onboarding, and quota / health introspection.

use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::activation::Activation;
use crate::errors::Error;
use crate::service_client::ServiceClient;

const PATH_PREFIX: &str = "/proxy/tenant/v1";

#[derive(Clone)]
pub struct Client {
    sc: ServiceClient,
}

impl Client {
    pub fn new(activation: Arc<Activation>, http: reqwest::Client) -> Self {
        Self { sc: ServiceClient::new(activation, http, PATH_PREFIX) }
    }

    pub async fn create_tenant(&self, req: CreateTenantRequest, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::POST, "/tenants", Some(&req), None, idempotency_key).await
    }

    pub async fn get_tenant(&self, tenant_id: &str) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, &format!("/tenants/{}", tenant_id), None, None, None).await
    }

    pub async fn update_tenant(&self, tenant_id: &str, body: serde_json::Map<String, Value>, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::PATCH, &format!("/tenants/{}", tenant_id), Some(&Value::Object(body)), None, idempotency_key).await
    }

    pub async fn list_tenants(&self, query: &[(&str, String)]) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, "/tenants", None, Some(query), None).await
    }

    pub async fn get_crypto_policy(&self, tenant_id: &str) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, &format!("/tenants/{}/crypto-policy", tenant_id), None, None, None).await
    }

    pub async fn upsert_crypto_policy(&self, tenant_id: &str, body: serde_json::Map<String, Value>, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::PUT, &format!("/tenants/{}/crypto-policy", tenant_id), Some(&Value::Object(body)), None, idempotency_key).await
    }

    pub async fn get_current_health(&self, tenant_id: &str) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, &format!("/tenants/{}/health", tenant_id), None, None, None).await
    }

    pub async fn get_current_quotas(&self, tenant_id: &str) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, &format!("/tenants/{}/quotas", tenant_id), None, None, None).await
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTenantRequest {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tier: Option<String>,
    #[serde(rename = "parentTenantId", skip_serializing_if = "Option::is_none")]
    pub parent_tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Map<String, Value>>,
}
