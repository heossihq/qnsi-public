# qnsi - Go SDK for the Quantum-Native Security Infrastructure

Go client for QNSI with service convenience APIs, optional local PQC primitives
through liboqs, and webhook verification. Language SDKs are independently versioned;
complete wire-schema parity and production acceptance require separate evidence.

> **Free tier available.** Free-forever account at <https://cloud.qnsi.heossi.com/auth> - 60-second signup, no credit card. Includes 10 GB PQC storage, 50 000 API calls/month, 20 KMS keys, 25 vault secrets.

## Manifest operation access (unreleased source)

`qnsp.Operations()` returns a fresh bundled catalog of 880 manifest declarations
across 15 services. `client.CallOperation(ctx, operationID, pathParameters, body,
query, idempotencyKey)` uses shared activation, tenant binding and retry. Path
parameters are encoded, and missing or dot-segment parameters fail before HTTP.
Existing service methods and `Do` remain available.

Catalog presence is not typed payload-schema parity, live availability or an
authentication grant. Backend schemas, permissions and authentication modes
still apply. Publication, full-source coverage and production acceptance of
these additions are **NOT VERIFIED**.

## Install

```bash
go get github.com/heossihq/qnsi-public/sdks/go/qnsi@latest
```

The base module pulls in only the standard library (`net/http`, `crypto/hmac`, etc.) plus its tests. The optional `qnsi/crypto` subpackage links against [`liboqs`](https://github.com/open-quantum-safe/liboqs) via [`liboqs-go`](https://github.com/open-quantum-safe/liboqs-go) 0.16.0; if you do not import `qnsi/crypto`, no native dependency is required.

To use the `qnsi/crypto` subpackage you need `liboqs` available at link time:

| Platform | Command |
| --- | --- |
| macOS | `brew install liboqs` |
| Debian/Ubuntu | `apt install liboqs-dev` |
| From source | `cmake -DBUILD_SHARED_LIBS=ON ...` - see <https://github.com/open-quantum-safe/liboqs> |

Requires Go 1.22+.

The upstream Go binding also requires a `liboqs-go.pc` configuration, not just
`liboqs.pc`. This SDK provides `crypto/pkgconfig/liboqs-go.pc`, which requires
the exact liboqs 0.16.0 version. For a source installation, set
`PKG_CONFIG_PATH` to both that directory and the installed library's
`lib/pkgconfig` directory. Set the platform's runtime library search path to
the same installation, or configure an executable rpath. A missing native
library is a build failure, not permission to replace cryptography.

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

	// ── Vault - PQC-encrypted secret storage ───────────────────────────
	secret, _ := c.Vault().CreateSecret(ctx, vault.CreateSecretRequest{
		Name:       "openai-api-key",
		PayloadB64: base64.StdEncoding.EncodeToString([]byte("sk-...")),
		Algorithm:  "ml-kem-768",
	}, "")
	fmt.Printf("vault id=%v\n", secret["id"])

	// ── KMS - server-side PQC keys ────────────────────────────────────
	key, _ := c.KMS().CreateKey(ctx, kms.CreateKeyRequest{
		Algorithm: "ml-dsa-65",
		Purpose:   "signing",
	}, "")
	signature, _ := c.KMS().Sign(ctx, key["keyId"].(string), []byte("hello"), "")
	ok, _ := c.KMS().Verify(ctx, key["keyId"].(string), []byte("hello"), signature)
	fmt.Println("verify ok:", ok)

	// ── Audit - immutable, hash-chained event log ─────────────────────
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

Convenience modules expose the following subsets of service contracts:

- `qnsi/vault` - secret lifecycle, dynamic engine catalog/configuration, provider credentials, lease lifecycle and measured statistics - wraps `apps/vault-service`
- `qnsi/kms` - `CreateKey`, `ListKeys`, `GetKey`, `RotateKey`, `DeleteKey`, `Sign`, `Verify`, `Wrap`, `Unwrap` - wraps `apps/kms-service`
- `qnsi/audit` - `LogEvent`, `IngestEvents` (batch), `ListEvents` - wraps `apps/audit-service`
- `qnsi/auth` - `Login` (caches the session), `RefreshToken`, `Revoke`, `MfaChallenge`/`MfaVerify`, `EvaluateRisk`, `ListRiskPolicies` - wraps `apps/auth-service`. Current source also contains WebAuthn and federation workflows; their complete coverage and production acceptance remain NOT VERIFIED. Browser ceremonies and endpoint-specific authentication still apply.
- `qnsi/tenant` - `CreateTenant`, `GetTenant`, `UpdateTenant`, `ListTenants`, `GetCryptoPolicy`, `UpsertCryptoPolicy`, `GetCurrentHealth`, `GetCurrentQuotas` - wraps `apps/tenant-service`
- `qnsi/access` - `CreateRole`, `GetRole`, `ListRoles`, `DeleteRole`, `AssignRole`, `RevokeRoleAssignment`, `CheckPermission` - wraps `apps/access-control-service`
- `qnsi/billing` - `GetEntitlements`, `IngestMeter`, `IngestMeters`, `ListInvoices`, `GetInvoice`, `GetCreditBalance` - wraps `apps/billing-service`
- `qnsi/cryptoinventory` - `ListAssets`, `GetAsset`, `GetAssetStats`, `DiscoverAssets`, `GetReadinessScore` - wraps `apps/crypto-inventory-service` (CBOM)
- `qnsi/storage` - `PutObject`, `GetObject`, `DeleteObject`, `ListObjects`, `ListBuckets` - wraps `apps/storage-service` (SSE-X)
- `qnsi/search` - `CreateIndex`, `ListIndexes`, `DeleteIndex`, `UpsertVectors`, `Query` - wraps `apps/search-service` (vector search)
- `qnsi/ai` - `RegisterModel`, model lifecycle, `SubmitWorkload`, `InvokeInference`, `RegisterArtifact` - wraps `apps/ai-orchestrator`

Local primitives + integration:

- `qnsi/crypto` (requires liboqs at link time) - ML-KEM (512/768/1024), HQC (1/3/5), ML-DSA (44/65/87), SLH-DSA (12 variants using liboqs 0.16 `SLH_DSA_*` identifiers), Falcon/FN-DSA (512/1024), plus BIKE, FrodoKEM, Classic-McEliece, MAYO, CROSS - the current liboqs-go 0.16.0 surface exposed through QNSI names
- `qnsp.ParseWebhook` / `qnsp.VerifyWebhookSignature` - HMAC-SHA-256 signature verification + typed `qnsp.WebhookEvent`
- `qnsp.NewClient` - API-key activation against `/billing/v1/sdk/activate` with caching and 401 retry

Each subclient also exposes a `Do(ctx, method, path, body, query, idempotencyKey)` escape hatch so endpoints not yet wrapped above are still callable without dropping to raw HTTP.

### Dynamic Vault contract (unreleased source)

`ListDynamicSecretEngines`, `CreateDynamicSecretConfig`,
`ListDynamicSecretConfigs`, `RequestCredentials`, `ListLeases`, `RenewLease`,
`RevokeLease` and `GetDynamicSecretStats` use the mounted dynamic-credential
contract. Configuration creation requires `EngineType` and an approved
`ConnectionRef`, with optional role template and pointer-valued TTL limits.
It does not create account resources or infer a connection approval. Response
maps retain engine-specific credentials, nullable metadata and lifecycle state.
`ListLeases` accepts an optional `includeAllStatuses` boolean; `RevokeLease`
preserves the HTTP 202 `revoking` queue acknowledgement, not proof of completed
provider invalidation. Native-expiry and renewal support remain engine-specific.

Secret and dynamic resource identifiers are encoded as single path segments.
Empty/dot-segment identifiers and nonpositive secret versions fail before HTTP.
Existing secret APIs remain available. The `Algorithm` field is request metadata,
not independent proof of the executed algorithm. `DeleteSecret` is soft deletion.

The local Vault package passes its controlled HTTP contract tests at 100 percent
statement coverage across both production files. Go's statement profile alone
does not establish complete branch/function-entry acceptance. The complete Go
suite still fails its two production verifiers without approved canary credentials;
they were not skipped, mocked into production success or removed. Other Go
coverage gaps, publication, consumer migration, operating-system acceptance and
independent production assurance remain NOT VERIFIED.

## What's coming

- AsyncStream variants for `Storage.GetObject` - large objects without buffering
- Pre-built `qnsi/qnsitest` helper that mocks the QNSI API for tests
- Generated typed responses (currently `map[string]any`) for every method

## License

Apache-2.0. See [LICENSE](../../../LICENSE).
