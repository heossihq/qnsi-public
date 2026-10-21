//! Local transport regressions, not production acceptance evidence.
use chrono::{Duration, Utc};
use qnsi::{auth::LoginRequest, Client, ClientOptions, Error};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, Request, Respond, ResponseTemplate};

fn client(server: &MockServer) -> Client {
    Client::new(ClientOptions {
        api_key: "test-api-key".into(),
        base_url: server.uri(),
        timeout_seconds: 5,
    })
    .unwrap()
}

async fn activation(server: &MockServer, response: Value) {
    Mock::given(method("POST"))
        .and(path("/billing/v1/sdk/activate"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response))
        .mount(server)
        .await;
}

fn assert_redirect_rejected(result: Result<Value, Error>) {
    match result {
        Err(Error::Api(error)) => assert_eq!(error.status_code, 307),
        other => panic!("expected rejected redirect, got {other:?}"),
    }
}

#[tokio::test]
async fn activation_and_session_redirects_do_not_send_credentials() {
    let target = MockServer::start().await;
    Mock::given(|_: &Request| true)
        .respond_with(ResponseTemplate::new(200).set_body_json(
            json!({"tenantId":"stolen","expiresInSeconds":3600,"accessToken":"stolen"}),
        ))
        .expect(0)
        .mount(&target)
        .await;
    let server = MockServer::start().await;
    Mock::given(|_: &Request| true)
        .respond_with(ResponseTemplate::new(307).insert_header("location", target.uri()))
        .mount(&server)
        .await;
    let client = client(&server);
    match client.ensure_activated().await {
        Err(Error::Api(error)) => assert_eq!(error.status_code, 307),
        other => panic!("expected activation redirect rejection: {other:?}"),
    }
    assert_redirect_rejected(
        client
            .auth()
            .login(LoginRequest {
                email: "test@example.com".into(),
                password: "test-password".into(),
                tenant_id: "test-tenant".into(),
            })
            .await,
    );
    assert!(client.auth().session().is_none());
    assert!(target.received_requests().await.unwrap().is_empty());
}

struct RetryRedirect {
    requests: AtomicUsize,
    target: String,
}
impl Respond for RetryRedirect {
    fn respond(&self, _: &Request) -> ResponseTemplate {
        if self.requests.fetch_add(1, Ordering::SeqCst) == 0 {
            ResponseTemplate::new(401)
        } else {
            ResponseTemplate::new(307).insert_header("location", self.target.clone())
        }
    }
}

#[tokio::test]
async fn service_and_retry_redirects_do_not_forward_api_keys() {
    for retry in [false, true] {
        let target = MockServer::start().await;
        let server = MockServer::start().await;
        activation(
            &server,
            json!({"tenantId":"test-tenant","expiresInSeconds":3600}),
        )
        .await;
        if retry {
            Mock::given(path("/proxy/kms/v1/keys"))
                .respond_with(RetryRedirect {
                    requests: AtomicUsize::new(0),
                    target: target.uri(),
                })
                .expect(2)
                .mount(&server)
                .await;
        } else {
            Mock::given(path("/proxy/kms/v1/keys"))
                .respond_with(ResponseTemplate::new(307).insert_header("location", target.uri()))
                .expect(1)
                .mount(&server)
                .await;
        }
        assert_redirect_rejected(client(&server).kms().list_keys().await);
        assert!(target.received_requests().await.unwrap().is_empty());
    }
}

#[tokio::test]
async fn expiry_uses_backend_lifetime_and_concurrent_refresh_is_cached() {
    let server = MockServer::start().await;
    activation(
        &server,
        json!({"tenantId":"test-tenant","expiresInSeconds":3600}),
    )
    .await;
    let client = Arc::new(client(&server));
    let start = Utc::now();
    let mut tasks = Vec::new();
    for _ in 0..32 {
        let client = client.clone();
        tasks.push(tokio::spawn(async move { client.ensure_activated().await }));
    }
    for task in tasks {
        let result = task.await.unwrap().unwrap();
        assert!(result.expires_at >= start + Duration::hours(1));
        assert!(result.expires_at <= Utc::now() + Duration::hours(1));
    }
    assert_eq!(server.received_requests().await.unwrap().len(), 1);
}

#[tokio::test]
async fn invalid_lifetime_does_not_fabricate_cache_expiry() {
    let mut responses = vec![json!({"tenantId":"test-tenant"})];
    for invalid in [
        Value::Null,
        json!("3600"),
        json!(true),
        json!(0),
        json!(-1),
        json!(1e30),
        json!(1e-10),
    ] {
        responses.push(json!({"tenantId":"test-tenant","expiresInSeconds":invalid}));
    }
    for invalid in [
        Value::Null,
        json!(3600),
        json!("invalid"),
        json!((Utc::now() - Duration::hours(1)).to_rfc3339()),
    ] {
        responses
            .push(json!({"tenantId":"test-tenant","expiresAt":invalid,"expiresInSeconds":3600}));
    }
    for response in responses {
        let server = MockServer::start().await;
        activation(&server, response).await;
        assert!(matches!(
            client(&server).ensure_activated().await,
            Err(Error::Api(_))
        ));
    }
}
