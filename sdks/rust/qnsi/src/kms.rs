//! QNSI KMS — server-side PQC keys with sign, verify, wrap, and unwrap.

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::activation::Activation;
use crate::errors::{ApiError, Error};
use crate::service_client::ServiceClient;

const PATH_PREFIX: &str = "/proxy/kms/v1";

#[derive(Clone)]
pub struct Client {
    sc: ServiceClient,
}

impl Client {
    pub fn new(activation: Arc<Activation>, http: reqwest::Client) -> Self {
        Self { sc: ServiceClient::new(activation, http, PATH_PREFIX) }
    }

    pub async fn create_key(
        &self,
        mut req: CreateKeyRequest,
        idempotency_key: Option<&str>,
    ) -> Result<Value, Error> {
        // The backend create schema REQUIRES a client-supplied keyId (1-255 chars)
        // and a keyType (root|master|data|byok). Generate a UUID handle when the
        // caller omits one, and default keyType to "data" — mirrors the Python SDK
        // (kms.py: `key_id or str(uuid.uuid4())`, `key_type="data"`).
        if req.key_id.is_none() {
            req.key_id = Some(uuid::Uuid::new_v4().to_string());
        }
        if req.key_type.is_none() {
            req.key_type = Some("data".to_string());
        }
        self.sc
            .request(Method::POST, "/keys", Some(&req), None, idempotency_key)
            .await
    }

    pub async fn list_keys(&self) -> Result<Value, Error> {
        // kms reads scope by a tenantId QUERY param — injected centrally by ServiceClient.
        self.sc
            .request::<()>(Method::GET, "/keys", None, None, None)
            .await
    }

    pub async fn get_key(&self, key_id: &str) -> Result<Value, Error> {
        self.sc
            .request::<()>(Method::GET, &format!("/keys/{}", key_id), None, None, None)
            .await
    }

    pub async fn rotate_key(
        &self,
        key_id: &str,
        idempotency_key: Option<&str>,
    ) -> Result<Value, Error> {
        self.sc
            .request::<()>(
                Method::POST,
                &format!("/keys/{}/rotate", key_id),
                None,
                None,
                idempotency_key,
            )
            .await
    }

    pub async fn delete_key(&self, key_id: &str) -> Result<(), Error> {
        self.sc
            .request::<()>(Method::DELETE, &format!("/keys/{}", key_id), None, None, None)
            .await?;
        Ok(())
    }

    pub async fn sign(
        &self,
        key_id: &str,
        data: &[u8],
        idempotency_key: Option<&str>,
    ) -> Result<Vec<u8>, Error> {
        #[derive(Serialize)]
        struct Body {
            data: String,
        }
        let resp = self
            .sc
            .request(
                Method::POST,
                &format!("/keys/{}/sign", key_id),
                Some(&Body { data: B64.encode(data) }),
                None,
                idempotency_key,
            )
            .await?;
        let sig_b64 = resp
            .get("signature")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError {
                status_code: 200,
                code: None,
                message: "kms.sign: missing signature".into(),
                body: Some(resp.clone()),
            })?;
        B64.decode(sig_b64).map_err(|_| Error::Api(ApiError {
            status_code: 200,
            code: None,
            message: "kms.sign: signature is not valid base64".into(),
            body: None,
        }))
    }

    pub async fn verify(
        &self,
        key_id: &str,
        data: &[u8],
        signature: &[u8],
    ) -> Result<bool, Error> {
        #[derive(Serialize)]
        struct Body {
            data: String,
            signature: String,
        }
        let resp = self
            .sc
            .request(
                Method::POST,
                &format!("/keys/{}/verify", key_id),
                Some(&Body {
                    data: B64.encode(data),
                    signature: B64.encode(signature),
                }),
                None,
                None,
            )
            .await?;
        Ok(resp.get("valid").and_then(|v| v.as_bool()).unwrap_or(false))
    }

    pub async fn wrap(
        &self,
        key_id: &str,
        plaintext: &[u8],
        idempotency_key: Option<&str>,
    ) -> Result<Vec<u8>, Error> {
        #[derive(Serialize)]
        struct Body {
            #[serde(rename = "dataKey")]
            data_key: String,
        }
        let resp = self
            .sc
            .request(
                Method::POST,
                &format!("/keys/{}/wrap", key_id),
                Some(&Body { data_key: B64.encode(plaintext) }),
                None,
                idempotency_key,
            )
            .await?;
        // Backend returns `wrappedKey` (older builds: `ciphertextB64`).
        let ct_b64 = resp
            .get("wrappedKey")
            .or_else(|| resp.get("ciphertextB64"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError {
                status_code: 200,
                code: None,
                message: "kms.wrap: missing wrappedKey".into(),
                body: Some(resp.clone()),
            })?;
        B64.decode(ct_b64).map_err(|_| Error::Api(ApiError {
            status_code: 200,
            code: None,
            message: "kms.wrap: wrappedKey is not valid base64".into(),
            body: None,
        }))
    }

    pub async fn unwrap_(
        &self,
        key_id: &str,
        ciphertext: &[u8],
        idempotency_key: Option<&str>,
    ) -> Result<Vec<u8>, Error> {
        #[derive(Serialize)]
        struct Body {
            #[serde(rename = "wrappedKey")]
            wrapped_key: String,
        }
        let resp = self
            .sc
            .request(
                Method::POST,
                &format!("/keys/{}/unwrap", key_id),
                Some(&Body { wrapped_key: B64.encode(ciphertext) }),
                None,
                idempotency_key,
            )
            .await?;
        // Backend returns `dataKey` (older builds: `plaintextB64`).
        let pt_b64 = resp
            .get("dataKey")
            .or_else(|| resp.get("plaintextB64"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| ApiError {
                status_code: 200,
                code: None,
                message: "kms.unwrap: missing dataKey".into(),
                body: Some(resp.clone()),
            })?;
        B64.decode(pt_b64).map_err(|_| Error::Api(ApiError {
            status_code: 200,
            code: None,
            message: "kms.unwrap: dataKey is not valid base64".into(),
            body: None,
        }))
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CreateKeyRequest {
    /// Client-chosen key handle (1-255 chars). Left `None`, `create_key`
    /// generates a UUID v4 (mirrors the Python/npm SDKs).
    #[serde(rename = "keyId", skip_serializing_if = "Option::is_none")]
    pub key_id: Option<String>,
    /// PQC algorithm, e.g. `"dilithium-3"` (ML-DSA-65), `"ml-kem-768"`.
    pub algorithm: String,
    /// One of `root` | `master` | `data` | `byok`. Defaults to `"data"`.
    #[serde(rename = "keyType", skip_serializing_if = "Option::is_none")]
    pub key_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Map<String, Value>>,
}
