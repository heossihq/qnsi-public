//! Controlled local HTTP contracts, not live provider or production assurance.
use chrono::{Duration, Utc};
use qnsi::{vault, Client, ClientOptions, Error};
use serde_json::{json, Value};
use wiremock::matchers::{body_json, header, method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

async fn setup() -> (MockServer, Client) {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/billing/v1/sdk/activate"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "tenantId": "owned-tenant", "tier": "free", "limits": {},
            "activationToken": "owned-test-token", "expiresAt": (Utc::now() + Duration::hours(1)).to_rfc3339(),
        }))).mount(&server).await;
    let client = Client::new(ClientOptions {
        api_key: "owned-test-key".into(),
        base_url: server.uri(),
        timeout_seconds: 5,
    })
    .unwrap();
    (server, client)
}

#[tokio::test]
async fn dynamic_configuration_catalog_and_stats_contracts() {
    let (server, client) = setup().await;
    let catalog =
        json!({"engines":[{"engineType":"ssh_signed_certs","implemented":false,"subPhase":4}]});
    Mock::given(method("GET"))
        .and(path("/proxy/vault/v1/dynamic-secrets/engines"))
        .respond_with(ResponseTemplate::new(200).set_body_json(&catalog))
        .mount(&server)
        .await;
    assert_eq!(
        client.vault().list_dynamic_secret_engines().await.unwrap(),
        catalog
    );
    for full in [false, true] {
        let mut expected = json!({"name":"owned","engineType":"postgresql","connectionRef":"approved-test-reference","tenantId":"owned-tenant"});
        let mut request = vault::CreateDynamicSecretConfigRequest {
            name: "owned".into(),
            engine_type: "postgresql".into(),
            connection_ref: "approved-test-reference".into(),
            ..Default::default()
        };
        if full {
            request.secret_type = Some("database".into());
            request.default_ttl_seconds = Some(60);
            request.max_ttl_seconds = Some(120);
            request.tenant_id = Some("owned-tenant".into());
            request.role_template = Some(serde_json::Map::new());
            expected["secretType"] = json!("database");
            expected["defaultTtlSeconds"] = json!(60);
            expected["maxTtlSeconds"] = json!(120);
            expected["roleTemplate"] = json!({});
        }
        Mock::given(method("POST"))
            .and(path("/proxy/vault/v1/dynamic-secrets/configs"))
            .and(body_json(expected))
            .respond_with(ResponseTemplate::new(201).set_body_json(json!({"id":"owned-config"})))
            .expect(1)
            .mount(&server)
            .await;
        assert_eq!(
            client
                .vault()
                .create_dynamic_secret_config(request, Some("owned-idempotency"))
                .await
                .unwrap()["id"],
            "owned-config"
        );
    }
    Mock::given(method("GET"))
        .and(path("/proxy/vault/v1/dynamic-secrets/configs"))
        .and(query_param("engineType", "postgresql"))
        .and(query_param("secretType", "database"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"configs":[]})))
        .mount(&server)
        .await;
    assert_eq!(
        client
            .vault()
            .list_dynamic_secret_configs(Some("postgresql"), Some("database"))
            .await
            .unwrap(),
        json!({"configs":[]})
    );
    Mock::given(method("GET"))
        .and(path("/proxy/vault/v1/dynamic-secrets/configs"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"configs":[]})))
        .mount(&server)
        .await;
    client
        .vault()
        .list_dynamic_secret_configs(None, None)
        .await
        .unwrap();
    Mock::given(method("GET"))
        .and(path("/proxy/vault/v1/dynamic-secrets/stats"))
        .respond_with(
            ResponseTemplate::new(503)
                .set_body_json(json!({"error":"DYNAMIC_SECRET_STATS_UNAVAILABLE"})),
        )
        .mount(&server)
        .await;
    assert!(
        matches!(client.vault().get_dynamic_secret_stats().await, Err(Error::Api(error)) if error.status_code == 503)
    );
}

#[tokio::test]
async fn engine_credentials_recovery_states_and_queued_revocation() {
    let (server, client) = setup().await;
    let credentials = json!({"leaseId":"owned-lease","engineType":"aws_iam","renewable":false,"credentials":{"accessKeyId":"owned-test-id","sessionToken":"owned-test-session"}});
    for full in [false, true] {
        let request = vault::RequestCredentialsRequest {
            ttl_seconds: if full { Some(60) } else { None },
            metadata: if full {
                Some(serde_json::Map::new())
            } else {
                None
            },
        };
        let expected = if full {
            json!({"ttlSeconds":60,"metadata":{},"tenantId":"owned-tenant"})
        } else {
            json!({"tenantId":"owned-tenant"})
        };
        Mock::given(method("POST"))
            .and(path(
                "/proxy/vault/v1/dynamic-secrets/configs/config%2Fencoded/credentials",
            ))
            .and(body_json(expected))
            .respond_with(ResponseTemplate::new(201).set_body_json(&credentials))
            .expect(1)
            .mount(&server)
            .await;
        assert_eq!(
            client
                .vault()
                .request_credentials("config/encoded", request, None)
                .await
                .unwrap(),
            credentials
        );
    }
    let leases = json!({"leases":[{"id":"owned-lease","status":"revoking","metadata":null}]});
    Mock::given(method("GET"))
        .and(path(
            "/proxy/vault/v1/dynamic-secrets/configs/config%2Fencoded/leases",
        ))
        .respond_with(ResponseTemplate::new(200).set_body_json(&leases))
        .mount(&server)
        .await;
    for include in [None, Some(false), Some(true)] {
        assert_eq!(
            client
                .vault()
                .list_leases("config/encoded", include)
                .await
                .unwrap(),
            leases
        );
    }
    for ttl in [None, Some(120)] {
        let expected = if ttl.is_some() {
            json!({"ttlSeconds":120,"tenantId":"owned-tenant"})
        } else {
            json!({"tenantId":"owned-tenant"})
        };
        Mock::given(method("POST"))
            .and(path(
                "/proxy/vault/v1/dynamic-secrets/leases/lease%2Fencoded/renew",
            ))
            .and(body_json(expected))
            .respond_with(
                ResponseTemplate::new(200)
                    .set_body_json(json!({"leaseId":"owned-lease","ttlSeconds":120})),
            )
            .expect(1)
            .mount(&server)
            .await;
        assert_eq!(
            client
                .vault()
                .renew_lease("lease/encoded", ttl)
                .await
                .unwrap()["leaseId"],
            "owned-lease"
        );
    }
    let queued = json!({"leaseId":"owned-lease","status":"revoking"});
    Mock::given(method("POST"))
        .and(path(
            "/proxy/vault/v1/dynamic-secrets/leases/lease%2Fencoded/revoke",
        ))
        .respond_with(ResponseTemplate::new(202).set_body_json(&queued))
        .mount(&server)
        .await;
    assert_eq!(
        client.vault().revoke_lease("lease/encoded").await.unwrap(),
        queued
    );
    let requests = server.received_requests().await.unwrap();
    let queries: Vec<_> = requests
        .iter()
        .filter(|request| request.url.path().ends_with("/leases"))
        .map(|request| {
            request
                .url
                .query_pairs()
                .find(|(name, _)| name == "includeAllStatuses")
                .map(|(_, value)| value.into_owned())
        })
        .collect();
    assert_eq!(
        queries,
        vec![None, Some("false".into()), Some("true".into())]
    );
}

fn invalid(result: Result<Value, Error>) {
    assert!(matches!(result, Err(Error::Api(error)) if error.status_code == 400));
}

#[tokio::test]
async fn retained_secret_lifecycle_preserves_encoded_paths_and_wire_bodies() {
    let (server, client) = setup().await;
    for algorithm in [None, Some("ml-kem-768".to_string())] {
        let mut metadata = serde_json::Map::from_iter([("owner".into(), json!("owned"))]);
        if let Some(value) = &algorithm {
            metadata.insert("algorithm".into(), json!(value));
        }
        Mock::given(method("POST"))
            .and(path("/proxy/vault/v1/secrets"))
            .and(header("idempotency-key", "owned-create"))
            .and(body_json(json!({"name":"owned-secret","payload":"Zg==","metadata":metadata,"tenantId":"owned-tenant"})))
            .respond_with(ResponseTemplate::new(201).set_body_json(json!({"id":"secret/encoded","version":1})))
            .expect(1)
            .mount(&server).await;
        let request = vault::CreateSecretRequest {
            name: "owned-secret".into(),
            payload_b64: "Zg==".into(),
            algorithm: algorithm.clone(),
            metadata: Some(serde_json::Map::from_iter([(
                "owner".into(),
                json!("owned"),
            )])),
        };
        assert_eq!(
            client
                .vault()
                .create_secret(request, Some("owned-create"))
                .await
                .unwrap()["version"],
            1
        );

        let mut expected = json!({"newPayload":"Zw==","tenantId":"owned-tenant"});
        if let Some(value) = &algorithm {
            expected["metadata"] = json!({"algorithm":value});
        }
        Mock::given(method("POST"))
            .and(path("/proxy/vault/v1/secrets/secret%2Fencoded/rotate"))
            .and(header("idempotency-key", "owned-rotate"))
            .and(body_json(expected))
            .respond_with(
                ResponseTemplate::new(200)
                    .set_body_json(json!({"id":"secret/encoded","version":2})),
            )
            .expect(1)
            .mount(&server)
            .await;
        assert_eq!(
            client
                .vault()
                .rotate_secret(
                    "secret/encoded",
                    "Zw==".into(),
                    algorithm,
                    Some("owned-rotate")
                )
                .await
                .unwrap()["version"],
            2
        );
    }
    for (suffix, response) in [
        (
            "",
            json!({"id":"secret/encoded","version":2,"payload":"Zw=="}),
        ),
        ("/versions/1", json!({"version":1,"payload":"Zg=="})),
        (
            "/versions",
            json!({"versions":[{"version":1},{"version":2}]}),
        ),
    ] {
        Mock::given(method("GET"))
            .and(path(format!(
                "/proxy/vault/v1/secrets/secret%2Fencoded{suffix}"
            )))
            .and(query_param("tenantId", "owned-tenant"))
            .respond_with(ResponseTemplate::new(200).set_body_json(&response))
            .expect(1)
            .mount(&server)
            .await;
        let actual = match suffix {
            "" => client.vault().get_secret("secret/encoded").await,
            "/versions/1" => client.vault().get_secret_version("secret/encoded", 1).await,
            _ => client.vault().list_secret_versions("secret/encoded").await,
        }
        .unwrap();
        assert_eq!(actual, response);
    }
    Mock::given(method("DELETE"))
        .and(path("/proxy/vault/v1/secrets/secret%2Fencoded"))
        .and(query_param("tenantId", "owned-tenant"))
        .respond_with(ResponseTemplate::new(204))
        .expect(1)
        .mount(&server)
        .await;
    client
        .vault()
        .delete_secret("secret/encoded")
        .await
        .unwrap();
    Mock::given(method("DELETE"))
        .and(path("/proxy/vault/v1/secrets/denied"))
        .respond_with(ResponseTemplate::new(403).set_body_json(json!({"error":"FORBIDDEN"})))
        .expect(1)
        .mount(&server)
        .await;
    assert!(
        matches!(client.vault().delete_secret("denied").await, Err(Error::Api(error)) if error.status_code == 403)
    );
}

#[tokio::test]
async fn resource_identifiers_fail_before_http() {
    let client = Client::new(ClientOptions {
        api_key: "owned-test-key".into(),
        base_url: "https://unused.example.test".into(),
        timeout_seconds: 1,
    })
    .unwrap();
    for id in ["", ".", ".."] {
        invalid(client.vault().get_secret(id).await);
        invalid(client.vault().get_secret_version(id, 1).await);
        invalid(
            client
                .vault()
                .rotate_secret(id, "Zg==".into(), None, None)
                .await,
        );
        assert!(
            matches!(client.vault().delete_secret(id).await, Err(Error::Api(error)) if error.status_code == 400)
        );
        invalid(client.vault().list_secret_versions(id).await);
        invalid(
            client
                .vault()
                .request_credentials(id, Default::default(), None)
                .await,
        );
        invalid(client.vault().list_leases(id, None).await);
        invalid(client.vault().renew_lease(id, None).await);
        invalid(client.vault().revoke_lease(id).await);
    }
    invalid(client.vault().get_secret_version("owned-secret", 0).await);
}

#[tokio::test]
async fn inventory_preserves_explicit_tenants_and_legacy_empty_default() {
    let (server, client) = setup().await;
    for tenant in ["explicit-tenant", ""] {
        for suffix in ["/assets/stats", "/readiness"] {
            Mock::given(method("GET"))
                .and(path(format!("/proxy/crypto/v1{suffix}")))
                .and(query_param(
                    "tenantId",
                    if tenant.is_empty() {
                        "owned-tenant"
                    } else {
                        tenant
                    },
                ))
                .respond_with(
                    ResponseTemplate::new(403).set_body_json(json!({"error":"TENANT_MISMATCH"})),
                )
                .expect(1)
                .mount(&server)
                .await;
            let result = if suffix == "/assets/stats" {
                client.crypto_inventory().get_asset_stats(tenant).await
            } else {
                client.crypto_inventory().get_readiness_score(tenant).await
            };
            assert!(matches!(result, Err(Error::Api(error)) if error.status_code == 403));
        }
    }
    let selected = json!({"runs":[{"source":"code_repo","status":"queued"}]});
    Mock::given(method("POST"))
        .and(path("/proxy/crypto/v1/assets/discover"))
        .and(body_json(
            json!({"source":"code_repo","tenantId":"owned-tenant"}),
        ))
        .and(header("idempotency-key", "owned-discovery"))
        .respond_with(ResponseTemplate::new(200).set_body_json(&selected))
        .expect(1)
        .mount(&server)
        .await;
    assert_eq!(
        client
            .crypto_inventory()
            .discover_assets_from_source("code_repo", Some("owned-discovery"))
            .await
            .unwrap(),
        selected
    );
}
