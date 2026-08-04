---
title: Thread Safety
version: 0.2.0
last_updated: 2026-04-30
copyright: © 2025-2026 HEOSSI. All rights reserved.
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

# Thread Safety

QNSI ships SDKs in five languages: TypeScript/Node.js, Python, Go, Rust, and JVM/Android. Each language has its own concurrency model - the guarantees below describe what each official SDK gives you.

## Node.js / TypeScript

- Single-threaded event loop; the SDKs are safe for concurrent `async` operations from the same client instance.
- One client instance per application is the recommended pattern.

```typescript
import { VaultClient } from "@heossihq/qnsi";

// Good: shared client
const client = new VaultClient({ baseUrl: "https://api.qnsi.heossi.com/proxy/vault", apiKey: "<token>" });

async function handler1() { await client.createSecret({ tenantId: "<uuid>", name: "s1", payload: "<base64>" }); }
async function handler2() { await client.createSecret({ tenantId: "<uuid>", name: "s2", payload: "<base64>" }); }
```

```typescript
// Bad: new client per request - wastes connections
async function handler() {
  const client = new VaultClient({ baseUrl: "https://api.qnsi.heossi.com/proxy/vault", apiKey: "<token>" });
  await client.createSecret({ tenantId: "<uuid>", name: "s", payload: "<base64>" });
}
```

## Python (`qnsi` v0.4.2+)

- `QnsiClient` is **not** thread-safe by default. The internal activation cache and `httpx.Client` connection pool are shared by all sub-clients (`vault`, `kms`, `audit`); concurrent calls from multiple threads are safe at the HTTP layer (`httpx.Client` is thread-safe), but cache invalidation is not synchronised.
- Recommended pattern: one `QnsiClient` per process, served via a global or via `contextvars` for per-request scoping.
- For multi-process workloads (gunicorn, uvicorn workers), construct one client per worker after the fork.

```python
from qnsi import QnsiClient

qnsi = QnsiClient(api_key=os.environ["QNSI_API_KEY"])  # process-wide singleton

async def handle():
    await asyncio.to_thread(qnsi.vault.create_secret, name="s", payload_b64="...")
```

For async applications, keep synchronous client calls outside the event-loop thread unless the
specific SDK surface exposes a native async client. Do not rely on an old roadmap version when
choosing concurrency behavior.

## Go (`github.com/heossihq/qnsi-public/sdks/go/qnsi`)

- `qnsi.Client` is **safe for concurrent use** by multiple goroutines. The internal `*Activator` uses a `sync.Mutex` around the activation cache; `*http.Client` is goroutine-safe by Go's standard library guarantees.
- Recommended pattern: one `qnsi.Client` per program, passed to handlers / workers.

```go
c, _ := qnsp.NewClient(qnsp.ClientOptions{APIKey: os.Getenv("QNSI_API_KEY")})
defer c.Close()

go func() { c.Vault().CreateSecret(ctx, vault.CreateSecretRequest{...}, "") }()
go func() { c.KMS().Sign(ctx, "key-id", []byte("hello"), "") }()
```

## Rust (`qnsi` v0.3.0+)

- `qnsi::Client` is `Clone` + `Send` + `Sync`. Internal state lives behind `Arc<Activation>`; the activation cache uses `std::sync::Mutex`. `reqwest::Client` is itself a cheap `Clone` over an `Arc<Inner>`.
- Recommended pattern: build one `qnsi::Client` at startup, `clone()` it freely (cheap), and pass clones into spawned tasks.

```rust
let c = qnsi::Client::new(opts)?;
let c2 = c.clone();
tokio::spawn(async move { c2.vault().create_secret(req, None).await });
```

## JVM / Android (`com.heossi:qnsi` v0.4.0+)

- `QnsiClient` is thread-safe and built to be shared. It owns one OkHttp `OkHttpClient` (an internally pooled, thread-safe HTTP client) and one activation cache guarded by a `synchronized` block.
- Recommended pattern: construct one `QnsiClient` at startup (e.g. a Spring singleton `@Bean`) and inject it everywhere. `OkHttpClient` is explicitly designed to be shared across threads.

```kotlin
val qnsi = QnsiClient(System.getenv("QNSI_API_KEY"))
// share the single instance across threads / coroutines:
executor.submit { qnsi.vault.createSecret(req) }
```

## Connection pooling

All SDKs reuse a single underlying HTTP connection pool per client instance:

- TypeScript: native `fetch` (Undici under Node) reuses keep-alive connections.
- Python: `httpx.Client` keeps a connection pool per host.
- Go: `*http.Client` reuses connections via the default `Transport`.
- Rust: `reqwest::Client` keeps a connection pool per host (Hyper underneath).
- JVM/Android: `OkHttpClient` keeps a shared, thread-safe connection pool per client instance.

Construct one client and reuse it; do not build a fresh client per request.

## Token refresh synchronisation

Each SDK runs the activation handshake on first use and caches the result with a near-expiry buffer (60 seconds before the server-issued `expiresAt`). On a `401`, the cache is invalidated and the originating request retried once.

In all SDKs the refresh is **not** strictly serialised across concurrent callers - concurrent goroutines / threads / async tasks may both observe a refresh in flight. This is intentional: the activation endpoint is idempotent, the response is identical, and serialising would block on lock contention. If you observe duplicate handshakes in your load tests, that is the expected behaviour.

## Cleanup

- TypeScript: SDK clients do not require explicit cleanup.
- Python: `QnsiClient` is a context manager; use `with QnsiClient(...) as q:` or call `.close()` to release the `httpx.Client` connection pool.
- Go: call `Client.Close()` (currently a no-op but reserved).
- Rust: `Drop` releases the `Arc`-shared state automatically.
- JVM/Android: no explicit cleanup required; the underlying OkHttp connection pool idles out automatically.
