# qnsi — Go SDK for the Quantum-Native Security Infrastructure

Typed Go client for QNSI — post-quantum cryptography (ML-KEM, ML-DSA, SLH-DSA, Falcon via liboqs), PQC-encrypted vault, server-side KMS, immutable audit trails. Same wire contracts as the official `@heossi/qnsi-*` TypeScript and `qnsi` Python SDK families — pick whichever language fits your stack and the byte-for-byte outputs round-trip.

> **Free tier available.** Free-forever account at <https://cloud.qnsi.heossi.com/auth> — 60-second signup, no credit card. Includes 10 GB PQC storage, 50 000 API calls/month, 20 KMS keys, 25 vault secrets.

## Install

```bash
go get github.com/heossihq/qnsi-public/sdks/go/qnsi@latest
```

The base module pulls in only the standard library (`net/http`, `crypto/hmac`, etc.) plus its tests. The optional `qnsi/crypto` subpackage links against [`liboqs`](https://github.com/open-quantum-safe/liboqs) via [`liboqs-go`](https://github.com/open-quantum-safe/liboqs-go) 0.12.0; if you do not import `qnsi/crypto`, no native dependency is required.

To use the `qnsi/crypto` subpackage you need `liboqs` available at link time:

| Platform | Command |
| --- | --- |
| macOS | `brew install liboqs` |
| Debian/Ubuntu | `apt install liboqs-dev` |
| From source | `cmake -DBUILD_SHARED_LIBS=ON ...` — see <https://github.com/open-quantum-safe/liboqs> |

Requires Go 1.22+.

## Quick start

```go
package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"

	"github.com/heossihq/qnsi-public/sdks/go/qnsi"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/audit"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/kms"
	"github.com/heossihq/qnsi-public/sdks/go/qnsi/vault"
)

func main() {
	c, err := qnsp.NewClient(qnsp.ClientOptions{APIKey: os.Getenv("QNSI_API_KEY")})
	if err != nil { panic(err) }
	defer c.Close()
	ctx := context.Background()

	// ── Vault — PQC-encrypted secret storage ───────────────────────────
	secret, _ := c.Vault().CreateSecret(ctx, vault.CreateSecretRequest{
		Name:       "openai-api-key",
		PayloadB64: base64.StdEncoding.EncodeToString([]byte("sk-...")),
		Algorithm:  "ml-kem-768",
	}, "")
	fmt.Printf("vault id=%v\n", secret["id"])

	// ── KMS — server-side PQC keys ────────────────────────────────────
	key, _ := c.KMS().CreateKey(ctx, kms.CreateKeyRequest{
		Algorithm: "ml-dsa-65",
		Purpose:   "signing",
	}, "")
	signature, _ := c.KMS().Sign(ctx, key["keyId"].(string), []byte("hello"), "")
	ok, _ := c.KMS().Verify(ctx, key["keyId"].(string), []byte("hello"), signature)
	fmt.Println("verify ok:", ok)

	// ── Audit — immutable, hash-chained event log ─────────────────────
	c.Audit().LogEvent(ctx, audit.LogEventRequest{
		EventType: "model.inference",
		Payload:   map[string]any{"modelId": "gpt-4o", "latencyMs": 412},
	}, "")
}
```

## Local PQC primitives

`qnsi/crypto` wraps `liboqs-go` so you don't have to write `oqs` calls directly, and so the algorithm-name surface matches the rest of the QNSI ecosystem:

```go
import "github.com/heossihq/qnsi-public/sdks/go/qnsi/crypto"

kem, _ := crypto.NewKem("ML-KEM-768")
defer kem.Close()
kp, _  := kem.Keygen()
enc, _ := kem.Encapsulate(kp.PublicKey)
ss, _  := kem.Decapsulate(enc.Ciphertext, kp.SecretKey)
// ss == enc.SharedSecret

sig, _ := crypto.NewSig("ML-DSA-65")
defer sig.Close()
sigKp, _ := sig.Keygen()
signature, _ := sig.Sign([]byte("hello"), sigKp.SecretKey)
ok, _        := sig.Verify([]byte("hello"), signature, sigKp.PublicKey)
```

Sizes match the FIPS specs exactly (the SDK reads them from the linked liboqs build).

## Verifying inbound webhooks

QNSI signs every webhook with HMAC-SHA-256. Verify the **raw body** before parsing JSON:

```go
import "github.com/heossihq/qnsi-public/sdks/go/qnsi"

func handle(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	event, err := qnsp.ParseWebhook(
		body,
		r.Header.Get("X-QNSP-Signature"),
		r.Header.Get("X-QNSP-Timestamp"),
		os.Getenv("QNSI_WEBHOOK_SECRET"),
		qnsp.MaxWebhookSkew,
		time.Time{}, // use time.Now()
	)
	if err != nil { http.Error(w, err.Error(), 400); return }
	if event.EventType == "key.rotated" {
		// ...
	}
}
```

`qnsp.MaxWebhookSkew` is 5 minutes by default; pass your own duration to tighten or loosen the replay window.

## Error handling

All errors implement the `qnsp.Error` interface and one of the concrete types below:

| Type | When |
| --- | --- |
| `*qnsp.NetworkError` | DNS, TLS, timeout, or connection failure |
| `*qnsp.AuthError` | API key rejected at activation |
| `*qnsp.APIError` | A service returned 4xx/5xx with a structured body |
| `*qnsp.WebhookError` | HMAC mismatch, expired timestamp, malformed body, etc. |

```go
import "errors"

if _, err := c.Vault().GetSecret(ctx, "missing"); err != nil {
	var apiErr *qnsp.APIError
	if errors.As(err, &apiErr) {
		fmt.Println("HTTP", apiErr.StatusCode, apiErr.Code)
	}
}
```

## Activation + tier introspection

`qnsp.Client` performs a one-shot handshake against `/billing/v1/sdk/activate` on first use. The result is cached in memory; subsequent calls reuse it until ~1 minute before expiry. You can inspect the current activation:

```go
tenantID, _ := c.TenantID(ctx)
tier, _     := c.Tier(ctx)
limits, _   := c.Limits(ctx)
ok, _       := c.HasFeature(ctx, "sseEnabled")
```

If the activation token is rotated server-side, the SDK invalidates its cache and retries the originating request once on a 401.

## What's covered today

Customer-facing modules (every QNSI service callable through the edge gateway today):

- `qnsi/vault` — `CreateSecret`, `GetSecret`, `GetSecretVersion`, `RotateSecret`, `DeleteSecret`, `ListSecretVersions` — wraps `apps/vault-service`
- `qnsi/kms` — `CreateKey`, `ListKeys`, `GetKey`, `RotateKey`, `DeleteKey`, `Sign`, `Verify`, `Wrap`, `Unwrap` — wraps `apps/kms-service`
- `qnsi/audit` — `LogEvent`, `IngestEvents` (batch), `ListEvents` — wraps `apps/audit-service`
- `qnsi/auth` — `Login` (caches the session), `RefreshToken`, `Revoke`, `MfaChallenge`/`MfaVerify`, `EvaluateRisk`, `ListRiskPolicies` — wraps `apps/auth-service`. (WebAuthn passkeys and SAML/OIDC federation are not exposed — they are a browser ceremony / SCIM provisioning surface, not a server-side api-key SDK call.)
- `qnsi/tenant` — `CreateTenant`, `GetTenant`, `UpdateTenant`, `ListTenants`, `GetCryptoPolicy`, `UpsertCryptoPolicy`, `GetCurrentHealth`, `GetCurrentQuotas` — wraps `apps/tenant-service`
- `qnsi/access` — `CreateRole`, `GetRole`, `ListRoles`, `DeleteRole`, `AssignRole`, `RevokeRoleAssignment`, `CheckPermission` — wraps `apps/access-control-service`
- `qnsi/billing` — `GetEntitlements`, `IngestMeter`, `IngestMeters`, `ListInvoices`, `GetInvoice`, `GetCreditBalance` — wraps `apps/billing-service`
- `qnsi/cryptoinventory` — `ListAssets`, `GetAsset`, `GetAssetStats`, `DiscoverAssets`, `GetReadinessScore` — wraps `apps/crypto-inventory-service` (CBOM)
- `qnsi/storage` — `PutObject`, `GetObject`, `DeleteObject`, `ListObjects`, `ListBuckets` — wraps `apps/storage-service` (SSE-X)
- `qnsi/search` — `CreateIndex`, `ListIndexes`, `DeleteIndex`, `UpsertVectors`, `Query` — wraps `apps/search-service` (vector search)
- `qnsi/ai` — `RegisterModel`, model lifecycle, `SubmitWorkload`, `InvokeInference`, `RegisterArtifact` — wraps `apps/ai-orchestrator`

Local primitives + integration:

- `qnsi/crypto` (requires liboqs at link time) — ML-KEM (512/768/1024), ML-DSA (44/65/87), SLH-DSA (12 variants), Falcon (512/1024), plus BIKE, FrodoKEM, Classic-McEliece, MAYO, CROSS — every FIPS 203/204/205 finalist exposed by liboqs 0.12.0
- `qnsp.ParseWebhook` / `qnsp.VerifyWebhookSignature` — HMAC-SHA-256 signature verification + typed `qnsp.WebhookEvent`
- `qnsp.NewClient` — API-key activation against `/billing/v1/sdk/activate` with caching and 401 retry

Each subclient also exposes a `Do(ctx, method, path, body, query, idempotencyKey)` escape hatch so endpoints not yet wrapped above are still callable without dropping to raw HTTP.

## What's coming

- AsyncStream variants for `Storage.GetObject` — large objects without buffering
- Pre-built `qnsi/qnsitest` helper that mocks the QNSI API for tests
- Generated typed responses (currently `map[string]any`) for every method

## License

Apache-2.0. See [LICENSE](../../../LICENSE).
