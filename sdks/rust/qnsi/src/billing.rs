//! QNSI Billing — entitlement queries, usage meters, invoice listing,
//! credit balance.

use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::activation::Activation;
use crate::errors::Error;
use crate::service_client::ServiceClient;

const PATH_PREFIX: &str = "/proxy/billing/v1";

#[derive(Clone)]
pub struct Client {
    sc: ServiceClient,
}

impl Client {
    pub fn new(activation: Arc<Activation>, http: reqwest::Client) -> Self {
        Self { sc: ServiceClient::new(activation, http, PATH_PREFIX) }
    }

    pub async fn get_entitlements(&self) -> Result<Value, Error> {
        // The bare `/entitlements` path 404s — the resolution route is
        // `/entitlements/resolved/:tenantId` (server.ts:685).
        let tenant_id = self.sc.activation.get().await?.tenant_id;
        self.sc
            .request::<()>(
                Method::GET,
                &format!("/entitlements/resolved/{}", tenant_id),
                None,
                None,
                None,
            )
            .await
    }

    pub async fn ingest_meter(&self, req: IngestMeterRequest, idempotency_key: Option<&str>) -> Result<Value, Error> {
        self.sc.request(Method::POST, "/meters", Some(&req), None, idempotency_key).await
    }

    pub async fn ingest_meters(&self, meters: Vec<IngestMeterRequest>, idempotency_key: Option<&str>) -> Result<Value, Error> {
        #[derive(Serialize)]
        struct Body<'a> {
            meters: &'a [IngestMeterRequest],
        }
        self.sc.request(Method::POST, "/meters/batch", Some(&Body { meters: &meters }), None, idempotency_key).await
    }

    pub async fn list_invoices(&self, query: &[(&str, String)]) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, "/invoices", None, Some(query), None).await
    }

    pub async fn get_invoice(&self, invoice_id: &str) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, &format!("/invoices/{}", invoice_id), None, None, None).await
    }

    pub async fn get_credit_balance(&self, tenant_id: &str) -> Result<Value, Error> {
        self.sc.request::<()>(Method::GET, &format!("/credits/balance/{}", tenant_id), None, None, None).await
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestMeterRequest {
    #[serde(rename = "meterId")]
    pub meter_id: String,
    pub quantity: f64,
    #[serde(rename = "occurredAt", skip_serializing_if = "Option::is_none")]
    pub occurred_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Map<String, Value>>,
}
