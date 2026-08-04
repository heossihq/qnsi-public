# @heossihq/qnsi - Node.js / TypeScript SDK for the Quantum-Native Security Infrastructure

[![npm version](https://img.shields.io/npm/v/@heossihq/qnsi.svg)](https://www.npmjs.com/package/@heossihq/qnsi)
[![License](https://img.shields.io/npm/l/@heossihq/qnsi.svg)](./LICENSE)

The official **single-package** Node.js / TypeScript SDK for QNSI. It exposes typed clients for the mounted vault, KMS, audit, auth, tenant, access-control, billing, crypto-inventory, storage, search, and AI routes, plus local PQC utilities and webhook verification. Cross-language SDKs are independently versioned and may expose different contracts.

> **Platform:** <https://qnsi.heossi.com> · **Free tier:** free-forever account at <https://cloud.qnsi.heossi.com/auth> - 60-second signup, no credit card. Includes 10 GB PQC storage, 50 000 API calls/month, 20 KMS keys, 25 vault secrets.

## Why one package?

Previous TypeScript consumers had to install up to 11 separate `@heossihq/qnsi-*-sdk` packages and keep their versions in sync. `@heossihq/qnsi` collapses that into a single dependency with sub-namespaces:

```ts
import { QnsiClient } from "@heossihq/qnsi";

const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

await qnsi.vault.createSecret({ ... });   // was @heossihq/qnsi-vault-sdk
await qnsi.kms.sign(keyId, data);          // was @heossihq/qnsi-kms-client
await qnsi.audit.logEvent({ ... });        // was @heossihq/qnsi-audit-sdk
await qnsi.tenant.getTenant(tenantId);     // was @heossihq/qnsi-tenant-sdk
// ...
```

One activation handshake on first use, shared across all 11 sub-clients. One version bump per QNSI release. One CHANGELOG. One source of truth.

## Install

```bash
pnpm add @heossihq/qnsi
```

Requires Node.js ≥ 22.0.0. ESM-first; CommonJS consumers can `await import("@heossihq/qnsi")`.

## Quick start

```ts
import { QnsiClient } from "@heossihq/qnsi";

const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

// Vault - PQC-encrypted secret storage
const secret = await qnsi.vault.createSecret({
  name: "openai-api-key",
  payloadB64: Buffer.from("sk-...").toString("base64"),
  algorithm: "ml-kem-768",
});

// KMS - server-side PQC keys
const key = await qnsi.kms.createKey({ algorithm: "ml-dsa-65", purpose: "signing" });
const sig = await qnsi.kms.sign(key.keyId as string, new TextEncoder().encode("hello"));
const ok  = await qnsi.kms.verify(key.keyId as string, new TextEncoder().encode("hello"), sig);

// Audit - immutable, hash-chained event log
await qnsi.audit.logEvent({
  eventType: "model.inference",
  payload: { modelId: "gpt-4o", latencyMs: 412 },
});

// Tenant, access, billing, crypto-inventory, storage, search, ai, auth - all on one client
await qnsi.tenant.getTenant(await qnsi.tenantId());
await qnsi.access.checkPermission({ subjectId: "user-1", permission: "vault.read" });
await qnsi.billing.getEntitlements();
```

## Modules

Each sub-namespace wraps one QNSI backend service:

| Sub-client | Wraps | Key methods |
|---|---|---|
| `qnsi.vault` | `apps/vault-service` (`/vault/v1`) | `createSecret`, `getSecret`, `getSecretVersion`, `rotateSecret`, `deleteSecret`, `listSecretVersions` |
| `qnsi.kms` | `apps/kms-service` (`/kms/v1`) | `createKey`, `listKeys`, `getKey`, `rotateKey`, `deleteKey`, `sign`, `verify`, `wrap`, `unwrap` |
| `qnsi.audit` | `apps/audit-service` (`/audit/v1`) | `logEvent`, `ingestEvents`, `listEvents` |
| `qnsi.auth` | `apps/auth-service` (`/auth`) | `login`, `refreshToken`, `revoke`, passkey lifecycle including `deletePasskey(credentialId, userId)`, `mfaChallenge` / `mfaVerify`, `federateSAML` / `federateOIDC`, `evaluateRisk` |
| `qnsi.tenant` | `apps/tenant-service` (`/tenant/v1`) | `createTenant`, `getTenant`, `updateTenant`, `listTenants`, `getCryptoPolicy`, `upsertCryptoPolicy`, `getCurrentHealth`, `getCurrentQuotas` |
| `qnsi.access` | `apps/access-control-service` (`/access/v1`) | `createRole`, `getRole`, `listRoles`, `deleteRole`, `assignRole`, `revokeRoleAssignment`, `checkPermission` |
| `qnsi.billing` | `apps/billing-service` (`/billing/v1`) | `getEntitlements`, `ingestMeter`, `ingestMeters`, `listInvoices`, `getInvoice`, `getCreditBalance` |
| `qnsi.cryptoInventory` | `apps/crypto-inventory-service` (`/crypto/v1`) | `listAssets`, `getAsset`, `getAssetStats`, `discoverAssets`, `getReadinessScore` |
| `qnsi.storage` | `apps/storage-service` (`/storage/v1`) | `putObject`, `getObject` (returns `[bytes, descriptor]`), `deleteObject`, `listObjects`, `listBuckets` |
| `qnsi.search` | `apps/search-service` (`/search/v1`) | `createIndex`, `listIndexes`, `deleteIndex`, `upsertVectors`, `query` |
| `qnsi.ai` | `apps/ai-orchestrator` (`/ai/v1`) | model registry, deployments, workloads, inference, artifacts |

### Strict write contracts

AI model registration requires `modelType`; deployment requires `modelId` and `environment`; workload submission requires scheduling, image, command, environment, resources, artifacts, and a signed manifest; inference uses `modelDeploymentId`; artifact registration uses `documentId` and `version`. Billing meters require source, meter type, quantity, unit, timestamp, and the complete security envelope; the SDK wraps both single and batch requests in `{ meters: [...] }` and binds each meter to the activated tenant. Tenant creation requires `name`, `slug`, and a complete security envelope and uses `plan`; tenant updates also require the security envelope.

## Verifying inbound webhooks

QNSI signs every webhook with HMAC-SHA-256. Verify the **raw body** before parsing JSON:

```ts
import { parseQnsiWebhook, QnsiWebhookError } from "@heossihq/qnsi";

app.post("/webhooks/qnsi", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = parseQnsiWebhook({
      body: req.body, // raw Buffer
      signatureHeader: req.header("x-qnsp-signature") ?? "",
      timestampHeader: req.header("x-qnsp-timestamp"),
      secret: process.env.QNSI_WEBHOOK_SECRET!,
    });
    if (event.eventType === "key.rotated") {
      // ...
    }
    res.sendStatus(200);
  } catch (err) {
    if (err instanceof QnsiWebhookError) {
      res.status(400).send(err.reason);
    } else {
      throw err;
    }
  }
});
```

Constant-time HMAC comparison, 5-minute replay window by default (`MAX_WEBHOOK_SKEW_MS`), refuses payloads missing required fields.

## Error handling

All errors descend from `QnsiError`:

| Class | When |
|---|---|
| `QnsiNetworkError` | DNS, TLS, timeout, or connection failure |
| `QnsiAuthError` | API key rejected at activation |
| `QnsiApiError` | A service returned 4xx/5xx with a structured body |
| `QnsiWebhookError` | HMAC mismatch, expired timestamp, malformed body, etc. |

```ts
import { QnsiApiError, QnsiNetworkError } from "@heossihq/qnsi";

try {
  await qnsi.vault.getSecret("missing");
} catch (err) {
  if (err instanceof QnsiApiError) console.log("HTTP", err.statusCode, err.code);
  else if (err instanceof QnsiNetworkError) console.log("could not reach QNSI:", err.message);
  else throw err;
}
```

## Activation + tier introspection

`QnsiClient` performs a one-shot handshake against `/billing/v1/sdk/activate` on first use. The result is cached in memory; subsequent calls reuse it until ~60 s before expiry. You can inspect the current activation:

```ts
await qnsi.tenantId();      // resolved tenant
await qnsi.tier();          // plan tier
await qnsi.limits();        // full limits dict
await qnsi.hasFeature("sseEnabled");  // convenience boolean

// Force the handshake at startup so you fail fast on a bad key:
await qnsi.ensureActivated();
```

If the activation token is rotated server-side, the SDK invalidates its cache and retries the originating request once on a 401.

## Migration from per-service SDKs

The legacy per-service packages are **deprecated** in favour of `@heossihq/qnsi`. They are not being republished under the `@heossihq` scope; new code should use this consolidated package.

| Before | After |
|---|---|
| Legacy `VaultClient` | `import { QnsiClient } from "@heossihq/qnsi"` then `qnsi.vault` |
| Legacy `KmsClient` | `qnsi.kms` |
| Legacy `AuthClient` | `qnsi.auth` |
| Legacy `TenantClient` | `qnsi.tenant` |
| Legacy `AccessControlClient` | `qnsi.access` |
| Legacy `BillingClient` | `qnsi.billing` |
| Legacy `CryptoInventoryClient` | `qnsi.cryptoInventory` |
| Legacy `StorageClient` | `qnsi.storage` |
| Legacy `SearchClient` | `qnsi.search` |
| Legacy `AiOrchestratorClient` | `qnsi.ai` |
| Legacy `AuditClient` | `qnsi.audit` |

The constructor signature is simpler - one `apiKey` for everything, instead of a per-service config:

```ts
// One package, one activation, one client
import { QnsiClient } from "@heossihq/qnsi";

const qnsi = new QnsiClient({ apiKey });
// qnsi.vault, qnsi.kms, qnsi.audit, ... all share one connection pool + one activation cache
```

The historical per-service packages and `@heossihq/qnsi` are independently versioned. Review each typed request contract while migrating; do not assume historical packages or other language SDKs have identical wire shapes.

## License

Apache-2.0. See [LICENSE](./LICENSE).
