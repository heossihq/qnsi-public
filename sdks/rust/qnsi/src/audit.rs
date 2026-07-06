//! QNSI Audit — immutable, hash-chained event log.

use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::activation::Activation;
use crate::errors::Error;
use crate::service_client::ServiceClient;

const PATH_PREFIX: &str = "/proxy/audit/v1";

#[derive(Clone)]
pub struct Client {
    sc: ServiceClient,
}

impl Client {
    pub fn new(activation: Arc<Activation>, http: reqwest::Client) -> Self {
        Self { sc: ServiceClient::new(activation, http, PATH_PREFIX) }
    }

    /// Append a single event. `POST /audit/v1/events` (the event object directly).
    pub async fn log_event(
        &self,
        req: LogEventRequest,
        idempotency_key: Option<&str>,
    ) -> Result<Value, Error> {
        self.sc
            .request(Method::POST, "/events", Some(&req), None, idempotency_key)
            .await
    }

    /// Append a batch of events. `POST /audit/v1/events/batch` with `{ events }`.
    pub async fn ingest_events(
        &self,
        events: Vec<LogEventRequest>,
        idempotency_key: Option<&str>,
    ) -> Result<Value, Error> {
        #[derive(Serialize)]
        struct Body<'a> {
            events: &'a [LogEventRequest],
        }
        self.sc
            .request(
                Method::POST,
                "/events/batch",
                Some(&Body { events: &events }),
                None,
                idempotency_key,
            )
            .await
    }

    pub async fn list_events(&self, query: &[(&str, String)]) -> Result<Value, Error> {
        self.sc
            .request::<()>(Method::GET, "/events", None, Some(query), None)
            .await
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LogEventRequest {
    #[serde(rename = "eventType")]
    pub event_type: String,
    pub payload: serde_json::Map<String, Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}
