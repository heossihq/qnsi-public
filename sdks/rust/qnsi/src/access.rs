//! QNSI Access-Control - RBAC: roles, permissions, role assignments.

use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::activation::Activation;
use crate::errors::Error;
use crate::service_client::ServiceClient;

const PATH_PREFIX: &str = "/proxy/access/v1";

#[derive(Clone)]
pub struct Client {
    sc: ServiceClient,
}

impl Client {
    pub fn new(activation: Arc<Activation>, http: reqwest::Client) -> Self {
        Self { sc: ServiceClient::new(activation, http, PATH_PREFIX) }
    }

    pub async fn create_role(&self, req: CreateRoleRequest, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::POST, "/roles", Some(&req), None, idempotency_key).await
    }

    pub async fn get_role(&self, role_id: &str) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, &format!("/roles/{}", role_id), None, None, None).await
    }

    pub async fn list_roles(&self, query: &[(&str, String)]) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, "/roles", None, Some(query), None).await
    }

    pub async fn delete_role(&self, role_id: &str) -> Result<(), Error> {
        self.sc.request::<()>(Method::DELETE, &format!("/roles/{}", role_id), None, None, None).await?;
        Ok(())
    }

    pub async fn assign_role(&self, req: AssignRoleRequest, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::POST, "/role-assignments", Some(&req), None, idempotency_key).await
    }

    pub async fn revoke_role_assignment(&self, assignment_id: &str) -> Result<(), Error> {
        self.sc.request::<()>(Method::DELETE, &format!("/role-assignments/{}", assignment_id), None, None, None).await?;
        Ok(())
    }

    pub async fn check_permission(&self, req: CheckPermissionRequest) -> Result<Value, Error> {
        self.sc.request(Method::POST, "/check", Some(&req), None, None).await
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRoleRequest {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignRoleRequest {
    #[serde(rename = "roleId")]
    pub role_id: String,
    #[serde(rename = "subjectId")]
    pub subject_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckPermissionRequest {
    #[serde(rename = "subjectId")]
    pub subject_id: String,
    pub permission: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
}
