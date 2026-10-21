//! Local wire-contract verification, not production availability evidence.
use qnsi::{surface, Client, ClientOptions};
use serde_json::json;
use std::collections::BTreeMap;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn every_catalog_operation_preserves_its_wire_contract() {
    let server = MockServer::start().await;
    Mock::given(method("POST")).and(path("/billing/v1/sdk/activate"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"tenantId":"tenant-test","tier":"free","limits":{},"activationToken":"test","expiresInSeconds":3600})))
        .mount(&server).await;
    Mock::given(|request: &wiremock::Request| request.url.path().starts_with("/proxy/"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"received":true})))
        .mount(&server)
        .await;
    let client = Client::new(ClientOptions {
        api_key: "test-key".into(),
        base_url: server.uri(),
        timeout_seconds: 5,
    })
    .unwrap();
    let operations = surface::operations().unwrap();
    assert!(operations.len() > 800);
    for operation in operations {
        let params = operation
            .path_parameters
            .iter()
            .map(|name| (name.clone(), format!("{name}/?# &%")))
            .collect::<BTreeMap<_, _>>();
        let body = json!({"data":"aGVsbG8="});
        let query = [("cursor", "next & # page".into())];
        let result = client
            .call_operation(
                &operation.id,
                &params,
                if operation.method == "GET" {
                    None
                } else {
                    Some(&body)
                },
                Some(&query),
                Some("request-1"),
            )
            .await
            .unwrap();
        assert_eq!(result["received"], true);
        let requests = server.received_requests().await.unwrap();
        let request = requests.last().unwrap();
        let mut expected = operation.path.clone();
        for name in operation.path_parameters.iter().rev() {
            expected = expected.replace(&format!(":{name}"), &format!("{name}%2F%3F%23%20%26%25"));
        }
        assert_eq!(request.url.path(), expected);
        assert_eq!(request.method.as_str(), operation.method);
        assert!(request
            .url
            .query_pairs()
            .any(|(name, value)| name == "cursor" && value == "next & # page"));
        assert!(request
            .url
            .query_pairs()
            .any(|(name, value)| name == "tenantId" && value == "tenant-test"));
        assert_eq!(request.headers.get("idempotency-key").unwrap(), "request-1");
        if operation.method != "GET" {
            assert_eq!(
                serde_json::from_slice::<serde_json::Value>(&request.body).unwrap()["tenantId"],
                "tenant-test"
            );
        }
    }
}

#[tokio::test]
async fn invalid_operations_do_not_initiate_activation() {
    let server = MockServer::start().await;
    let client = Client::new(ClientOptions {
        api_key: "test-key".into(),
        base_url: server.uri(),
        timeout_seconds: 5,
    })
    .unwrap();
    for (id, params) in [
        ("unknown", BTreeMap::new()),
        ("kms-service.getKeysKeyId", BTreeMap::new()),
        (
            "kms-service.getKeysKeyId",
            BTreeMap::from([("extra".into(), "x".into())]),
        ),
        (
            "kms-service.getKeysKeyId",
            BTreeMap::from([("keyId".into(), "..".into())]),
        ),
        (
            "kms-service.getKeysKeyId",
            BTreeMap::from([("keyId".into(), "".into())]),
        ),
    ] {
        assert!(client
            .call_operation(id, &params, None, None, None)
            .await
            .is_err());
    }
    assert!(server.received_requests().await.unwrap().is_empty());
}
