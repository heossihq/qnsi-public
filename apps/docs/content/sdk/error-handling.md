---
title: SDK Error Handling
version: 0.6.0
last_updated: 2026-07-20
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/qnsi/src/errors.ts
  - /sdks/python/qnsi/src/qnsi/_errors.py
  - /sdks/go/qnsi/internal/qnsicore/errors.go
  - /sdks/rust/qnsi/src/errors.rs
---

> **Note** - As of 2026-04-30, the per-service `@heossihq/qnsi-vault-sdk` package is consolidated into the unified `@heossihq/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossihq/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.vault./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# SDK Error Handling

Every QNSI SDK distinguishes four kinds of failure so callers can branch on the failure mode without parsing error strings:

| Kind | When it fires |
|---|---|
| Network | DNS, TLS, timeout, or connection failure reaching the QNSI edge gateway |
| Auth | API key rejected at activation (HTTP 401/403 from `/billing/v1/sdk/activate`) |
| API | A QNSI service returned a 4xx/5xx with a structured body |
| Webhook | Signature mismatch, timestamp out of skew, malformed payload, missing fields |

The class names differ per language but the taxonomy is identical, so the same `try`/`catch`/`Result` shape ports across stacks.

## TypeScript / Node.js

```typescript
import { QnsiApiError, QnsiClient, QnsiNetworkError } from "@heossihq/qnsi";

const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

try {
  await qnsi.vault.getSecret("missing");
} catch (err) {
  if (err instanceof QnsiApiError) console.log("HTTP", err.statusCode, err.code);
  else if (err instanceof QnsiNetworkError) console.log("could not reach QNSI:", err.message);
  else throw err;
}
```

The unified package exports its typed error classes from `@heossihq/qnsi`.

## Python

```python
from qnsi import QnsiApiError, QnsiNetworkError, QnsiAuthError, QnsiError

with QnsiClient(api_key=os.environ["QNSI_API_KEY"]) as q:
    try:
        q.vault.get_secret("missing")
    except QnsiApiError as exc:
        print("HTTP", exc.status_code, exc.code, exc.body)
    except QnsiNetworkError as exc:
        print("could not reach QNSI:", exc)
    except QnsiAuthError as exc:
        print("api key rejected:", exc.code, exc.message)
```

All errors descend from `QnsiError`. See [`sdks/python/qnsi/src/qnsi/_errors.py`](https://github.com/heossihq/qnsi-public/blob/main/sdks/python/qnsi/src/qnsi/_errors.py).

## Go

```go
import (
    "errors"
    "github.com/heossihq/qnsi-public/sdks/go/qnsi"
)

if _, err := c.Vault().GetSecret(ctx, "missing"); err != nil {
    var apiErr *qnsp.APIError
    var netErr *qnsp.NetworkError
    var authErr *qnsp.AuthError
    switch {
    case errors.As(err, &apiErr):
        fmt.Println("HTTP", apiErr.StatusCode, apiErr.Code)
    case errors.As(err, &netErr):
        fmt.Println("could not reach QNSI:", netErr.Err)
    case errors.As(err, &authErr):
        fmt.Println("api key rejected:", authErr.Code)
    }
}
```

All Go errors implement the unexported `qnsiError()` marker so `qnsi.Error` works as a type-narrowing predicate. See [`sdks/go/qnsi/internal/qnsicore/errors.go`](https://github.com/heossihq/qnsi-public/blob/main/sdks/go/qnsi/internal/qnsicore/errors.go).

## Rust

```rust
match c.vault().get_secret("missing").await {
    Err(qnsi::Error::Api(e)) if e.status_code == 404 => println!("not found"),
    Err(qnsi::Error::Network(e)) => println!("could not reach QNSI: {e}"),
    Err(qnsi::Error::Auth(e)) => println!("api key rejected: {e:?}"),
    Err(qnsi::Error::Webhook(e)) => println!("webhook: {e}"),
    Err(e) => return Err(e),
    Ok(secret) => println!("{secret:?}"),
}
```

All errors flow through the `qnsi::Error` enum. See [`sdks/rust/qnsi/src/errors.rs`](https://github.com/heossihq/qnsi-public/blob/main/sdks/rust/qnsi/src/errors.rs).

## JVM / Android

```kotlin
import io.heossi.qnsi.QnsiApiException
import io.heossi.qnsi.QnsiAuthException
import io.heossi.qnsi.QnsiNetworkException
import io.heossi.qnsi.QnsiWebhookException

try {
    val secret = qnsi.vault.getSecret("missing")
} catch (e: QnsiApiException) {
    if (e.statusCode == 404) println("not found") else println("api error ${e.statusCode} ${e.code}")
} catch (e: QnsiNetworkException) {
    println("could not reach QNSI: ${e.message}")
} catch (e: QnsiAuthException) {
    println("api key rejected: ${e.code}")
} catch (e: QnsiWebhookException) {
    println("webhook: ${e.message}")
}
```

All SDK errors extend the unchecked `QnsiException` base class - catch `QnsiException` to handle any failure uniformly. `QnsiApiException` exposes `statusCode`, the stable `code` string, and the raw `body`. See [`sdks/jvm/src/main/kotlin/com/heossi/qnsi/QnsiErrors.kt`](https://github.com/heossihq/qnsi-public/blob/main/sdks/jvm/src/main/kotlin/com/heossi/qnsi/QnsiErrors.kt).

## Status-code mapping

QNSI services map to standard HTTP semantics:

| Status | Meaning | Common cause |
|---|---|---|
| 400 | Bad request | Validation failure on request body |
| 401 | Unauthorised | API key invalid OR activation token expired (SDK retries once) |
| 402 | Payment required | Tier does not entitle the call (e.g. SSE on free tier) |
| 403 | Forbidden | RBAC / capability check failed |
| 404 | Not found | Resource id does not exist for the tenant |
| 409 | Conflict | Idempotency key reuse with mismatched body, version mismatch on update |
| 422 | Unprocessable | Semantically invalid request (e.g. unsupported algorithm name) |
| 429 | Too many requests | Quota exhausted; retry after `Retry-After` header |
| 502 | Bad gateway | Upstream service temporarily unavailable |
| 503 | Service unavailable | Tenant entitlement state cannot be resolved |

Each SDK surfaces the structured body of an API error so you can act on `code` (a stable string identifier) rather than parsing the human-readable `message`.

## Webhook errors

Webhook verification helpers (`parse_qnsi_webhook` in Python, `qnsi.ParseWebhook` in Go, `qnsi::parse_webhook` in Rust, `QnsiWebhooks.parse` on JVM, per-service equivalents in TypeScript) return a typed error whose `.reason` field describes which check failed:

- `signature header must start with 'sha256='`
- `signature mismatch` - HMAC verification failed
- `timestamp is too old` / `timestamp is in the future` - replay protection (5-minute window by default)
- `body is not valid JSON`
- `missing event_type` / `missing event_id`

Surface the error message back to the webhook sender as a 400; do not echo it to end users.
