//! Wire-contract regression guards (wiremock). These assert the REQUEST bodies
//! the SDK sends — the field names + the central tenantId injection — so they
//! fail if the contract regresses (e.g. vault `payload`->`payloadBase64`, kms
//! `keyType`->`purpose`, sign `data`->`dataB64`). The live proof is
//! examples/prod_verify; these guard the shapes offline.
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use chrono::{Duration, Utc};
use serde_json::json;
use wiremock::matchers::{body_partial_json, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use qnsi::{audit, kms, vault, Client, ClientOptions};

async fn mock_activation(srv: &MockServer) {
    Mock::given(method("POST"))
        .and(path("/billing/v1/sdk/activate"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "tenantId": "tenant-test",
            "tier": "free",
            "limits": {"sseEnabled": true},
            "activationToken": "tkn",
            "expiresAt": (Utc::now() + Duration::hours(1)).to_rfc3339(),
        })))
        .mount(srv)
        .await;
}

fn client_for(srv: &MockServer) -> Client {
    Client::new(ClientOptions {
        api_key: "qnsp_pqc_test".into(),
        base_url: srv.uri(),
        timeout_seconds: 5,
    })
    .unwrap()
}

#[tokio::test]
async fn vault_create_and_get() {
    let srv = MockServer::start().await;
    mock_activation(&srv).await;
    // Guard: SDK maps payload_b64 -> `payload` (NOT payloadBase64/payloadB64) and
    // ServiceClient injects the activated tenantId. A regression here -> body
    // mismatch -> wiremock 404 -> test fails.
    Mock::given(method("POST"))
        .and(path("/proxy/vault/v1/secrets"))
        .and(body_partial_json(json!({
            "name": "openai-api-key",
            "payload": B64.encode(b"sk-..."),
            "tenantId": "tenant-test",
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"id": "sec-1"})))
        .mount(&srv)
        .await;
    Mock::given(method("GET"))
        .and(path("/proxy/vault/v1/secrets/sec-1"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"id": "sec-1", "version": 1})))
        .mount(&srv)
        .await;

    let c = client_for(&srv);
    let resp = c
        .vault()
        .create_secret(
            vault::CreateSecretRequest {
                name: "openai-api-key".into(),
                payload_b64: B64.encode(b"sk-..."),
                algorithm: Some("ml-kem-768".into()),
                metadata: None,
            },
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp["id"], "sec-1");
    let get = c.vault().get_secret("sec-1").await.unwrap();
    assert_eq!(get["id"], "sec-1");
}

#[tokio::test]
async fn kms_create_sign_verify() {
    let srv = MockServer::start().await;
    mock_activation(&srv).await;
    // Guard: create sends `keyType` (default "data") + injected tenantId — NOT the
    // old `purpose` field.
    Mock::given(method("POST"))
        .and(path("/proxy/kms/v1/keys"))
        .and(body_partial_json(json!({
            "keyType": "data",
            "algorithm": "ml-dsa-65",
            "tenantId": "tenant-test",
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"keyId": "key-1"})))
        .mount(&srv)
        .await;
    // Guard: sign sends `data` (NOT dataB64); response field is `signature`.
    Mock::given(method("POST"))
        .and(path("/proxy/kms/v1/keys/key-1/sign"))
        .and(body_partial_json(json!({ "data": B64.encode(b"hello") })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"signature": B64.encode(b"signature")})))
        .mount(&srv)
        .await;
    // Guard: verify sends `data` + `signature`.
    Mock::given(method("POST"))
        .and(path("/proxy/kms/v1/keys/key-1/verify"))
        .and(body_partial_json(json!({
            "data": B64.encode(b"hello"),
            "signature": B64.encode(b"signature"),
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"valid": true})))
        .mount(&srv)
        .await;

    let c = client_for(&srv);
    let key = c
        .kms()
        .create_key(
            kms::CreateKeyRequest { algorithm: "ml-dsa-65".into(), ..Default::default() },
            None,
        )
        .await
        .unwrap();
    assert_eq!(key["keyId"], "key-1");
    let sig = c.kms().sign("key-1", b"hello", None).await.unwrap();
    assert_eq!(sig, b"signature");
    let ok = c.kms().verify("key-1", b"hello", &sig).await.unwrap();
    assert!(ok);
}

#[tokio::test]
async fn audit_log_event() {
    let srv = MockServer::start().await;
    mock_activation(&srv).await;
    // Guard: log_event posts the bare event to /events (not /events/batch) with
    // eventType + injected tenantId.
    Mock::given(method("POST"))
        .and(path("/proxy/audit/v1/events"))
        .and(body_partial_json(json!({
            "eventType": "model.inference",
            "tenantId": "tenant-test",
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"id": "evt-1"})))
        .mount(&srv)
        .await;

    let c = client_for(&srv);
    let resp = c
        .audit()
        .log_event(
            audit::LogEventRequest {
                event_type: "model.inference".into(),
                payload: serde_json::Map::from_iter([(
                    "modelId".to_string(),
                    serde_json::Value::String("gpt-4o".into()),
                )]),
                tags: None,
            },
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp["id"], "evt-1");
}
