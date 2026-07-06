use chrono::{Duration, Utc};
use serde_json::json;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use qnsi::{Client, ClientOptions, Error};

#[tokio::test]
async fn ensure_activated_succeeds() {
    let srv = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/billing/v1/sdk/activate"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "tenantId": "tenant-abc",
            "tier": "free",
            "limits": {},
            "activationToken": "t",
            "expiresAt": (Utc::now() + Duration::hours(1)).to_rfc3339(),
        })))
        .mount(&srv)
        .await;

    let c = Client::new(ClientOptions {
        api_key: "qnsp_pqc_test".into(),
        base_url: srv.uri(),
        timeout_seconds: 5,
    })
    .unwrap();
    let res = c.ensure_activated().await.unwrap();
    assert_eq!(res.tenant_id, "tenant-abc");
}

#[tokio::test]
async fn rejects_invalid_api_key() {
    let srv = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/billing/v1/sdk/activate"))
        .respond_with(ResponseTemplate::new(401).set_body_json(json!({
            "code": "INVALID_API_KEY",
            "message": "API key not found",
        })))
        .mount(&srv)
        .await;
    let c = Client::new(ClientOptions {
        api_key: "qnsp_pqc_bad".into(),
        base_url: srv.uri(),
        timeout_seconds: 5,
    })
    .unwrap();
    let err = c.ensure_activated().await.unwrap_err();
    match err {
        Error::Auth(_) => {}
        other => panic!("expected AuthError, got {other:?}"),
    }
}

#[test]
fn rejects_empty_api_key() {
    let err = Client::new(ClientOptions {
        api_key: "".into(),
        base_url: "https://example.com".into(),
        timeout_seconds: 5,
    })
    .unwrap_err();
    assert!(matches!(err, Error::Auth(_)));
}
