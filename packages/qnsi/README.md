# @heossi/qnsi — Node.js / TypeScript SDK for the Quantum-Native Security Infrastructure

[![npm version](https://img.shields.io/npm/v/@heossi/qnsi.svg)](https://www.npmjs.com/package/@heossi/qnsi)
[![License](https://img.shields.io/npm/l/@heossi/qnsi.svg)](./LICENSE)

The official **single-package** Node.js / TypeScript SDK for QNSI. Covers the full customer-facing platform — vault, KMS, audit, auth, tenant, access-control, billing, crypto-inventory, storage, search, and AI orchestrator — plus webhook signature verification. Mirrors the shape of the `qnsi` Python / Go / Rust SDKs byte-for-byte: same wire contracts, same algorithm names, same FIPS 203 / 204 / 205 posture.

> **Free tier available.** Free-forever account at <https://cloud.qnsi.heossi.com/auth> — 60-second signup, no credit card. Includes 10 GB PQC storage, 50 000 API calls/month, 20 KMS keys, 25 vault secrets.

## Why one package?

Previous TypeScript consumers had to install up to 11 separate `@heossi/qnsi-*-sdk` packages and keep their versions in sync. `@heossi/qnsi` collapses that into a single dependency with sub-namespaces:

```ts
import { QnsiClient } from "@heossi/qnsi";

const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

await qnsi.vault.createSecret({ ... });   // was @heossi/qnsi-vault-sdk
await qnsi.kms.sign(keyId, data);          // was @heossi/qnsi-kms-client
await qnsi.audit.logEvent({ ... });        // was @heossi/qnsi-audit-sdk
await qnsi.tenant.getTenant(tenantId);     // was @heossi/qnsi-tenant-sdk
// ...
```

One activation handshake on first use, shared across all 11 sub-clients. One version bump per QNSI release. One CHANGELOG. One source of truth.

## Install

```bash
pnpm add @heossi/qnsi
# or
npm install @heossi/qnsi
# or
yarn add @heossi/qnsi
```

Requires Node.js ≥ 22.0.0. ESM-first; CommonJS consumers can `await import("@heossi/qnsi")`.

## Quick start

```ts
import { QnsiClient } from "@heossi/qnsi";

const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });

// Vault — PQC-encrypted secret storage
const secret = await qnsi.vault.createSecret({
  name: "openai-api-key",
  payloadB64: Buffer.from("sk-...").toString("base64"),
  algorithm: "ml-kem-768",
});

// KMS — server-side PQC keys
const key = await qnsi.kms.createKey({ algorithm: "ml-dsa-65", purpose: "signing" });
const sig = await qnsi.kms.sign(key.keyId as string, new TextEncoder().encode("hello"));
const ok  = await qnsi.kms.verify(key.keyId as string, new TextEncoder().encode("hello"), sig);

// Audit — immutable, hash-chained event log
await qnsi.audit.logEvent({
  eventType: "model.inference",
  payload: { modelId: "gpt-4o", latencyMs: 412 },
});

// Tenant, access, billing, crypto-inventory, storage, search, ai, auth — all on one client
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
| `qnsi.auth` | `apps/auth-service` (`/auth/v1`) | `login`, `refreshToken`, `revoke`, WebAuthn passkey lifecycle, `mfaChallenge` / `mfaVerify`, `federateSAML` / `federateOIDC`, `evaluateRisk` |
| `qnsi.tenant` | `apps/tenant-service` (`/tenant/v1`) | `createTenant`, `getTenant`, `updateTenant`, `listTenants`, `getCryptoPolicy`, `upsertCryptoPolicy`, `getCurrentHealth`, `getCurrentQuotas` |
| `qnsi.access` | `apps/access-control-service` (`/access/v1`) | `createRole`, `getRole`, `listRoles`, `deleteRole`, `assignRole`, `revokeRoleAssignment`, `checkPermission` |
| `qnsi.billing` | `apps/billing-service` (`/billing/v1`) | `getEntitlements`, `ingestMeter`, `ingestMeters`, `listInvoices`, `getInvoice`, `getCreditBalance` |
| `qnsi.cryptoInventory` | `apps/crypto-inventory-service` (`/crypto/v1`) | `listAssets`, `getAsset`, `getAssetStats`, `discoverAssets`, `getReadinessScore` |
| `qnsi.storage` | `apps/storage-service` (`/storage/storage/v1`) | `putObject`, `getObject` (returns `[bytes, descriptor]`), `deleteObject`, `listObjects`, `listBuckets` |
| `qnsi.search` | `apps/search-service` (`/search/v1`) | `createIndex`, `listIndexes`, `deleteIndex`, `upsertVectors`, `query` |
| `qnsi.ai` | `apps/ai-orchestrator` (`/ai/v1`) | model registry (`registerModel`, `listModels`, `getModel`, `updateModel`, `activateModel`, `deployModel`), workloads (`submitWorkload`, `getWorkload`, `listWorkloads`, `cancelWorkload`), `invokeInference`, `registerArtifact` |

## Verifying inbound webhooks

QNSI signs every webhook with HMAC-SHA-256. Verify the **raw body** before parsing JSON:

```ts
import { parseQnsiWebhook, QnsiWebhookError } from "@heossi/qnsi";

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
import { QnsiApiError, QnsiNetworkError } from "@heossi/qnsi";

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

The per-service `@heossi/qnsi-*-sdk` packages on npm are now **deprecated** in favour of `@heossi/qnsi`. They continue to install and work, but new code should use this package.

| Before | After |
|---|---|
| `import { VaultClient } from "@heossi/qnsi-vault-sdk"` | `import { QnsiClient } from "@heossi/qnsi"` then `qnsi.vault` |
| `import { KmsClient } from "@heossi/qnsi-kms-client"` | `qnsi.kms` |
| `import { AuthClient } from "@heossi/qnsi-auth-sdk"` | `qnsi.auth` |
| `import { TenantClient } from "@heossi/qnsi-tenant-sdk"` | `qnsi.tenant` |
| `import { AccessControlClient } from "@heossi/qnsi-access-control-sdk"` | `qnsi.access` |
| `import { BillingClient } from "@heossi/qnsi-billing-sdk"` | `qnsi.billing` |
| `import { CryptoInventoryClient } from "@heossi/qnsi-crypto-inventory-sdk"` | `qnsi.cryptoInventory` |
| `import { StorageClient } from "@heossi/qnsi-storage-sdk"` | `qnsi.storage` |
| `import { SearchClient } from "@heossi/qnsi-search-sdk"` | `qnsi.search` |
| `import { AiOrchestratorClient } from "@heossi/qnsi-ai-sdk"` | `qnsi.ai` |
| `import { AuditClient } from "@heossi/qnsi-audit-sdk"` | `qnsi.audit` |

The constructor signature is simpler — one `apiKey` for everything, instead of a per-service config:

```ts
// Before — 11 packages, 11 activation handshakes, 11 versions to keep in sync
import { VaultClient } from "@heossi/qnsi-vault-sdk";
import { KmsClient } from "@heossi/qnsi-kms-client";
import { AuditClient } from "@heossi/qnsi-audit-sdk";

const vault = new VaultClient({ apiKey, baseUrl: "https://api.qnsi.heossi.com/proxy/vault", tier });
const kms   = new KmsClient({   apiKey, baseUrl: "https://api.qnsi.heossi.com/proxy/kms",   tier });
const audit = new AuditClient({ apiKey, baseUrl: "https://api.qnsi.heossi.com/proxy/audit", tier });

// After — one package, one activation, one client
import { QnsiClient } from "@heossi/qnsi";

const qnsi = new QnsiClient({ apiKey });
// qnsi.vault, qnsi.kms, qnsi.audit, ... all share one connection pool + one activation cache
```

The wire contracts are identical, so migrating method-by-method is mechanical.

## License

Apache-2.0. See [LICENSE](./LICENSE).
