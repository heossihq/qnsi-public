//! PROVABLE end-to-end verification of the `qnsi` Rust SDK against PRODUCTION,
//! mirroring the gold-standard npm e2e (scripts/verify/sdk-qnsp-e2e.mjs).
//!
//! Runs the REAL developer loop with NO mocks, using the persistent
//! synthetic-canary free tenant (no per-run signup, no risk-gate interaction):
//!   - auth.login                 -> POST /edge/auth/login
//!   - ensure_activated           -> POST /billing/v1/sdk/activate
//!   - vault create/get/versions  -> PQC secret store
//!   - storage put/get            -> PQC object storage (proves the path fix)
//!   - kms create/sign/verify     -> PQC signing (proves keyType+field fixes)
//!   - kms get_key/list_keys      -> query-tenantId reads
//!   - billing.get_entitlements   -> /entitlements/resolved/:tenantId
//!
//! Run from the repo root with the canary creds sourced:
//!   set -a; . ./.env; set +a
//!   cargo run --manifest-path sdks/rust/qnsi/Cargo.toml --example prod_verify
//!
//! Exit 0 = all PASS, exit 1 = any FAIL. Re-runnable by anyone with the canary key.
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use qnsi::auth::LoginRequest;
use qnsi::kms::CreateKeyRequest;
use qnsi::vault::CreateSecretRequest;
use qnsi::{Client, ClientOptions};

struct Tally {
    passed: u32,
    failed: u32,
}
impl Tally {
    fn ok(&mut self, name: &str, detail: &str) {
        self.passed += 1;
        println!("  PASS  {name} — {detail}");
    }
    fn bad(&mut self, name: &str, detail: &str) {
        self.failed += 1;
        println!("  FAIL  {name} — {detail}");
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_key = std::env::var("QNSP_CANARY_KEY")?;
    let email = std::env::var("QNSP_CANARY_EMAIL")?;
    let password = std::env::var("QNSP_CANARY_PASSWORD")?;
    let tenant = std::env::var("QNSP_CANARY_TENANT")?;
    let rand = uuid::Uuid::new_v4().to_string();
    let rand = &rand[..8];

    println!("\nqnsi Rust SDK e2e verification (PRODUCTION) — https://api.qnsi.heossi.com\n");
    let mut t = Tally { passed: 0, failed: 0 };

    let c = Client::new(ClientOptions::with_api_key(api_key))?;

    // 1. auth.login (no auth header; caches the session)
    match c.auth().login(LoginRequest { email, password, tenant_id: tenant }).await {
        Ok(b) if b.get("accessToken").and_then(|v| v.as_str()).is_some_and(|s| !s.is_empty()) => {
            t.ok("auth.login", "accessToken present; session cached")
        }
        Ok(b) => t.bad("auth.login", &format!("no accessToken: {b}")),
        Err(e) => t.bad("auth.login", &e.to_string()),
    }

    // 2. activation handshake
    match c.ensure_activated().await {
        Ok(a) => t.ok("ensure_activated", &format!("tier={} tenant={}", a.tier, a.tenant_id)),
        Err(e) => t.bad("ensure_activated", &e.to_string()),
    }

    // 3. vault create / get / list versions
    let mut secret_id: Option<String> = None;
    match c
        .vault()
        .create_secret(
            CreateSecretRequest {
                name: format!("rust-e2e-{rand}"),
                payload_b64: B64.encode(format!("rust-secret-{rand}").as_bytes()),
                algorithm: None,
                metadata: None,
            },
            None,
        )
        .await
    {
        Ok(s) => {
            let id = s.get("id").or_else(|| s.get("secretId")).and_then(|v| v.as_str());
            match id {
                Some(id) => {
                    secret_id = Some(id.to_string());
                    t.ok("vault.create_secret", &format!("id={id}"));
                }
                None => t.bad("vault.create_secret", &format!("no id: {s}")),
            }
        }
        Err(e) => t.bad("vault.create_secret", &e.to_string()),
    }
    if let Some(id) = &secret_id {
        match c.vault().get_secret(id).await {
            Ok(g) => t.ok("vault.get_secret", &format!("name={}", g.get("name").and_then(|v| v.as_str()).unwrap_or("?"))),
            Err(e) => t.bad("vault.get_secret", &e.to_string()),
        }
        match c.vault().list_secret_versions(id).await {
            Ok(lv) => {
                let n = lv.get("versions").and_then(|v| v.as_array()).map(|a| a.len());
                match n {
                    Some(n) if n >= 1 => t.ok("vault.list_secret_versions", &format!("{n} version(s)")),
                    _ => t.bad("vault.list_secret_versions", &format!("{lv}")),
                }
            }
            Err(e) => t.bad("vault.list_secret_versions", &e.to_string()),
        }
    }

    // 4. storage put / get round-trip (proves the /proxy/storage/storage/v1 path fix)
    let obj_key = format!("rust-e2e-{rand}.txt");
    let payload = format!("rust storage {rand}");
    match c
        .storage()
        .put_object(
            "default",
            &obj_key,
            qnsi::storage::PutObjectRequest {
                data_b64: B64.encode(payload.as_bytes()),
                content_type: Some("text/plain".into()),
                sse_algorithm: None,
                metadata: None,
            },
            None,
        )
        .await
    {
        Ok(_) => match c.storage().get_object("default", &obj_key).await {
            Ok((bytes, _)) if bytes == payload.as_bytes() => t.ok("storage.put/get_object", "round-trip bytes match"),
            Ok((bytes, _)) => t.bad("storage.put/get_object", &format!("byte mismatch: {} bytes", bytes.len())),
            Err(e) => t.bad("storage.get_object", &e.to_string()),
        },
        Err(e) => t.bad("storage.put_object", &e.to_string()),
    }

    // 5. kms create / sign / verify / get / list (proves keyType+keyId+field renames)
    let mut key_id: Option<String> = None;
    match c
        .kms()
        .create_key(CreateKeyRequest { algorithm: "dilithium-3".into(), ..Default::default() }, None)
        .await
    {
        Ok(k) => {
            let id = k.get("keyId").or_else(|| k.get("id")).and_then(|v| v.as_str());
            match id {
                Some(id) => {
                    key_id = Some(id.to_string());
                    t.ok("kms.create_key (ML-DSA-65)", &format!("keyId={id}"));
                }
                None => t.bad("kms.create_key", &format!("no keyId: {k}")),
            }
        }
        Err(e) => t.bad("kms.create_key", &e.to_string()),
    }
    if let Some(id) = &key_id {
        let data = format!("rust-sign-{rand}");
        match c.kms().sign(id, data.as_bytes(), None).await {
            Ok(sig) if !sig.is_empty() => {
                t.ok("kms.sign", &format!("{} sig bytes", sig.len()));
                match c.kms().verify(id, data.as_bytes(), &sig).await {
                    Ok(true) => t.ok("kms.verify", "signature valid=true"),
                    Ok(false) => t.bad("kms.verify", "valid=false"),
                    Err(e) => t.bad("kms.verify", &e.to_string()),
                }
            }
            Ok(_) => t.bad("kms.sign", "empty signature"),
            Err(e) => t.bad("kms.sign", &e.to_string()),
        }
        match c.kms().get_key(id).await {
            Ok(g) if g.get("keyId").or_else(|| g.get("id")).and_then(|v| v.as_str()) == Some(id.as_str()) => {
                t.ok("kms.get_key (query tenantId)", &format!("keyId={id}"))
            }
            Ok(g) => t.bad("kms.get_key", &format!("{g}")),
            Err(e) => t.bad("kms.get_key", &e.to_string()),
        }
        match c.kms().list_keys().await {
            Ok(l) => {
                let arr = l.get("keys").or_else(|| l.get("items")).and_then(|v| v.as_array());
                match arr {
                    Some(a) => t.ok("kms.list_keys (query tenantId)", &format!("{} key(s)", a.len())),
                    None => t.bad("kms.list_keys", &format!("{l}")),
                }
            }
            Err(e) => t.bad("kms.list_keys", &e.to_string()),
        }
    }

    // 6. billing entitlements (/entitlements/resolved/:tenantId)
    match c.billing().get_entitlements().await {
        Ok(_) => t.ok("billing.get_entitlements", "resolved path 200"),
        Err(e) => t.bad("billing.get_entitlements", &e.to_string()),
    }

    println!("\n{} passed, {} failed\n", t.passed, t.failed);
    if t.failed != 0 {
        std::process::exit(1);
    }
    Ok(())
}
