---
title: "Quickstart"
description: "Get started with QNSI in under 10 minutes — create a tenant, obtain an API token, and make your first secure API call from TypeScript, Python, Go, Rust, or JVM/Android."
version: 0.2.0
last_updated: 2026-04-30
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: BSL-1.1
---
# Quickstart

Get from zero to a working QNSI integration in under 10 minutes.

## 1. Create an account

Sign up at [cloud.qnsi.heossi.com/auth](https://cloud.qnsi.heossi.com/auth).

Available paths today:
- One-click social sign-in with **GitHub**, **Google**, **LinkedIn**, or **Microsoft**
- Email + password signup for a new workspace
- Enterprise SSO with **Microsoft Entra ID**, **Okta**, **Auth0**, **Google Workspace**, **AWS IAM Identity Center**, or a tenant-configured **SAML 2.0 / OIDC** provider

Your workspace (tenant) is provisioned automatically on first sign-in for self-serve signup flows. If you are joining an existing organization, use **Continue with your company SSO** or your existing tenant login flow instead of creating a second workspace.

## 2. Generate an API key

In the QNSI portal, go to **Settings → API Keys → New API Key**. Copy the key — it is shown once only.

Store it as an environment variable:

```bash
export QNSI_API_KEY="qnsi_pqc_api_..."
export QNSI_TENANT_ID="<your-tenant-uuid>"
```

## 3. Make your first API call

```bash
curl -sS \
  -H "Authorization: Bearer $QNSI_API_KEY" \
  -H "x-qnsp-tenant-id: $QNSI_TENANT_ID" \
  https://api.qnsi.heossi.com/vault/v1/secrets
```

A `200 OK` with an empty `data` array confirms authentication is working.

## 4. Install an SDK (optional)

Pick the SDK for your language. All four families share the same wire contracts, the same algorithm names, and the same FIPS 203 / 204 / 205 posture — outputs round-trip across languages byte-for-byte.

### TypeScript / Node.js

```bash
pnpm add @heossi/qnsi
pnpm add -g @heossi/qnsi-cli      # CLI for scripting / CI
```

```typescript
import { QnsiClient } from "@heossi/qnsi";

const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

const secret = await qnsi.vault.createSecret({
  name: "db-password",
  payloadB64: Buffer.from("s3cr3t").toString("base64"),
});
console.log(secret.id);
```

### Python

```bash
pip install qnsi
# Optional: local PQC primitives via liboqs-python
pip install 'qnsi[crypto]'
```

```python
import os, base64
from qnsi import QnsiClient

with QnsiClient(api_key=os.environ["QNSI_API_KEY"]) as q:
    secret = q.vault.create_secret(
        name="db-password",
        payload_b64=base64.b64encode(b"s3cr3t").decode(),
    )
    print(secret["id"])
```

### Go

```bash
go get github.com/heossihq/qnsi-public/sdks/go/qnsi@latest
```

```go
import (
    "context"
    "encoding/base64"
    "os"

    "github.com/heossihq/qnsi-public/sdks/go/qnsi"
    "github.com/heossihq/qnsi-public/sdks/go/qnsi/vault"
)

c, _ := qnsp.NewClient(qnsp.ClientOptions{APIKey: os.Getenv("QNSI_API_KEY")})
defer c.Close()

secret, _ := c.Vault().CreateSecret(context.Background(), vault.CreateSecretRequest{
    Name:       "db-password",
    PayloadB64: base64.StdEncoding.EncodeToString([]byte("s3cr3t")),
}, "")
```

### Rust

```bash
cargo add qnsi
# Optional: local PQC primitives via the oqs 0.11 crate
cargo add qnsi --features crypto
```

```rust
use base64::{engine::general_purpose::STANDARD, Engine};
use qnsi::{Client, ClientOptions};
use qnsi::vault::CreateSecretRequest;

let c = Client::new(ClientOptions::with_api_key(std::env::var("QNSI_API_KEY")?))?;
let secret = c.vault().create_secret(CreateSecretRequest {
    name: "db-password".into(),
    payload_b64: STANDARD.encode(b"s3cr3t"),
    algorithm: None,
    metadata: None,
}, None).await?;
```

### JVM / Android

```kotlin
// Gradle (Kotlin DSL): build.gradle.kts
dependencies {
    implementation("io.heossi:qnsi:0.1.0")
}
```

```kotlin
import io.heossi.qnsi.QnsiClient
import io.heossi.qnsi.CreateSecretRequest
import okio.ByteString.Companion.encodeUtf8

val qnsi = QnsiClient(System.getenv("QNSI_API_KEY"))
val secret = qnsi.vault.createSecret(
    CreateSecretRequest(name = "db-password", payloadB64 = "s3cr3t".encodeUtf8().base64()),
)
println(secret["id"])
```

## Next Steps

- [API Reference](./api) — Full endpoint listing
- [SDK Overview](./sdk/overview) — All available SDKs across five languages
- [Supported Languages](./sdk/languages) — Feature matrix: TypeScript / Python / Go / Rust / JVM-Android
- [MCP Server](./sdk/mcp-server) — Connect AI assistants to QNSI
- [Getting Started Guide](./getting-started/overview) — Deeper walkthrough including auth flows
- [cURL Quickstart](./getting-started/quickstart-curl) — Step-by-step API calls without an SDK
