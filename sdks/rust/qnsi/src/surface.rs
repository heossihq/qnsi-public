//! Manifest-driven operations. Catalog entries are not verified live availability.
use crate::service_client::ServiceClient;
use crate::{ApiError, Client, Error};
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Operation {
    pub id: String,
    pub service: String,
    pub method: String,
    pub manifest_path: String,
    pub path: String,
    pub path_parameters: Vec<String>,
    pub description: String,
}

fn invalid(message: impl Into<String>) -> Error {
    ApiError {
        status_code: 0,
        code: Some("LOCAL_OPERATION_CONTRACT".into()),
        message: message.into(),
        body: None,
    }
    .into()
}

pub fn operations() -> Result<Vec<Operation>, Error> {
    serde_json::from_str(include_str!("surface-operations.json"))
        .map_err(|error| invalid(format!("Invalid bundled operation catalog: {error}")))
}

pub(crate) fn encode_segment(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || b"-._~".contains(&byte) {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

impl Client {
    /// Execute a catalog operation with shared activation, tenant binding and retry.
    /// Backend schemas, policy and entitlement checks remain authoritative.
    pub async fn call_operation(
        &self,
        operation_id: &str,
        parameters: &BTreeMap<String, String>,
        body: Option<&Value>,
        query: Option<&[(&str, String)]>,
        idempotency_key: Option<&str>,
    ) -> Result<Value, Error> {
        let mut operation = operations()?
            .into_iter()
            .find(|item| item.id == operation_id)
            .ok_or_else(|| invalid("Unknown operation ID"))?;
        if parameters.len() != operation.path_parameters.len() {
            return Err(invalid(format!(
                "Required path parameters: {:?}",
                operation.path_parameters
            )));
        }
        let mut path = operation.path;
        operation
            .path_parameters
            .sort_by_key(|name| std::cmp::Reverse(name.len()));
        for name in operation.path_parameters {
            let value = parameters
                .get(&name)
                .filter(|value| !value.is_empty() && *value != "." && *value != "..")
                .ok_or_else(|| invalid(format!("Invalid or missing path parameter {name}")))?;
            path = path.replace(&format!(":{name}"), &encode_segment(value));
        }
        let method = operation
            .method
            .parse::<reqwest::Method>()
            .map_err(|error| invalid(error.to_string()))?;
        ServiceClient::new(self.activation.clone(), self.http.clone(), "")
            .request(method, &path, body, query, idempotency_key)
            .await
    }
}
