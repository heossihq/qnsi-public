---
title: Tenant SDK (@heossi/qnsi-tenant-sdk)
version: 0.3.6
last_updated: 2026-04-30
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/tenant-sdk/src/index.ts
---

> **Note** — As of 2026-04-30, the per-service `@heossi/qnsi-tenant-sdk` package is consolidated into the unified `@heossi/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossi/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.tenant./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# Tenant SDK (`@heossi/qnsi-tenant-sdk`)

The TypeScript client for `tenant-service`; equivalent shapes ship in Python, Go, Rust, and JVM/Android. Provides tenant lifecycle management, crypto policy configuration, health monitoring, quota management, and onboarding workflows.

## Install

```bash
pnpm install @heossi/qnsi-tenant-sdk
```

## Create a client

```ts
import { TenantClient } from "@heossi/qnsi-tenant-sdk";

const tenants = new TenantClient({
	baseUrl: "http://localhost:8108",
	apiKey: "<access_token>",
});
```

## Tenant Management

```ts
// Create a tenant
const tenant = await tenants.createTenant({
	name: "Acme Corp",
	slug: "acme-corp",
	plan: "enterprise",
	security: {
		controlPlaneTokenSha256: null,
		pqcSignatures: [],
		hardwareProvider: null,
		attestationStatus: null,
		attestationProof: null,
	},
});

// Get a tenant
const tenant = await tenants.getTenant("<tenant_uuid>");

// Update a tenant
const updated = await tenants.updateTenant("<tenant_uuid>", {
	plan: "enterprise-pro",
	security: { /* ... */ },
});

// List tenants
const { items, nextCursor } = await tenants.listTenants({ limit: 50 });
```

## Health Dashboard

Monitor tenant health and performance:

```ts
// Record a health snapshot
await tenants.recordHealthSnapshot({
	tenantId: "<tenant_uuid>",
	metrics: {
		apiLatencyP50Ms: 25,
		apiLatencyP99Ms: 150,
		errorRate: 0.001,
		requestsPerSecond: 500,
		storageUsedBytes: 10737418240,
	},
});

// Get current health
const health = await tenants.getCurrentHealth("<tenant_uuid>");
console.log(health.status); // "healthy" | "degraded" | "unhealthy"

// Get health trends
const trends = await tenants.getHealthTrends({
	tenantId: "<tenant_uuid>",
	since: "2026-03-01T00:00:00Z",
	granularity: "hour",
});
console.log(trends.summary.uptimePercent);

// Create a health alert
const alert = await tenants.createHealthAlert({
	tenantId: "<tenant_uuid>",
	severity: "warning",
	title: "High API Latency",
	description: "P99 latency exceeded 500ms threshold",
	metric: "apiLatencyP99Ms",
	threshold: 500,
	currentValue: 650,
});

// Acknowledge alert
await tenants.acknowledgeAlert({
	alertId: alert.id,
	acknowledgedBy: "ops@example.com",
	note: "Investigating root cause",
});
```

## Quota Forecasting

Track and predict resource quota usage:

```ts
// Record quota usage
await tenants.recordQuotaUsage({
	tenantId: "<tenant_uuid>",
	quotaName: "api_requests",
	usage: 15000,
});

// Get current quotas
const quotas = await tenants.getCurrentQuotas("<tenant_uuid>");
for (const quota of quotas.quotas) {
	console.log(quota.name, quota.utilizationPercent);
}

// Get quota forecast
const forecast = await tenants.getForecast({
	tenantId: "<tenant_uuid>",
	horizonDays: 30,
});
for (const f of forecast.forecasts) {
	if (f.estimatedExhaustionDate) {
		console.log(`${f.quotaName} will exhaust on ${f.estimatedExhaustionDate}`);
	}
}

// Get quota suggestions
const suggestions = await tenants.getQuotaSuggestions("<tenant_uuid>");
for (const s of suggestions.suggestions) {
	console.log(`${s.quotaName}: ${s.currentLimit} -> ${s.suggestedLimit}`);
}
```

## Onboarding Workflows

Manage tenant onboarding with configurable workflows:

```ts
// Create a workflow template
const template = await tenants.createWorkflowTemplate({
	name: "Enterprise Onboarding",
	steps: [
		{ name: "Account Setup", order: 1, required: true, estimatedMinutes: 5 },
		{ name: "SSO Configuration", order: 2, required: true, estimatedMinutes: 15 },
		{ name: "Team Invitations", order: 3, required: false, estimatedMinutes: 10 },
		{ name: "API Keys", order: 4, required: true, estimatedMinutes: 5 },
		{ name: "Compliance Review", order: 5, required: true, estimatedMinutes: 30 },
	],
	isDefault: false,
});

// Start onboarding for a tenant
const onboarding = await tenants.startOnboarding({
	tenantId: "<tenant_uuid>",
	templateId: template.id,
});

// Check onboarding status
const status = await tenants.getOnboardingStatus("<tenant_uuid>");
console.log(status.progress.percentComplete);

// Get onboarding statistics
const stats = await tenants.getOnboardingStats({
	since: "2026-01-01T00:00:00Z",
});
console.log(stats.completionRate, stats.avgCompletionTimeMinutes);
```

## Isolation Audit

Verify tenant data isolation and security boundaries:

```ts
// Create an isolation policy
const policy = await tenants.createIsolationPolicy({
	tenantId: "<tenant_uuid>",
	name: "Data Isolation Policy",
	level: "strict",
	rules: [
		{ resource: "keys", constraint: "tenant_bound", action: "deny" },
		{ resource: "secrets", constraint: "cross_tenant_access", action: "deny" },
	],
	enforcementMode: "enforce",
});

// Run isolation audit
const audit = await tenants.runIsolationAudit({
	tenantId: "<tenant_uuid>",
	depth: "deep",
	categories: ["data_access", "key_usage", "network"],
});
console.log(audit.summary.passedChecks, audit.summary.failedChecks);

// Get isolation findings
const findings = await tenants.getIsolationFindings({
	tenantId: "<tenant_uuid>",
	severity: "critical",
});
for (const finding of findings.items) {
	console.log(finding.title, finding.recommendation);
}
```

## Crypto Policy Management (v0)

Manage tenant-specific PQC algorithm policies:

```ts
// Get tenant crypto policy
const policy = await tenants.getTenantCryptoPolicy("<tenant_uuid>");
console.log(policy.policyTier); // "default" | "strict" | "maximum" | "government"

// Update crypto policy
const updated = await tenants.upsertTenantCryptoPolicy("<tenant_uuid>", {
	policyTier: "strict",
	customAllowedSignatureAlgorithms: ["dilithium-5", "falcon-1024"],
	requireHsmForRootKeys: true,
	maxKeyAgeDays: 180,
});

// Get allowed algorithms for a tenant
const kemAlgorithms = await tenants.getAllowedKemAlgorithms("<tenant_uuid>");
const sigAlgorithms = await tenants.getAllowedSignatureAlgorithms("<tenant_uuid>");

// Get default algorithms for new operations
const defaultKem = await tenants.getDefaultKemAlgorithm("<tenant_uuid>");
const defaultSig = await tenants.getDefaultSignatureAlgorithm("<tenant_uuid>");
```

## Legacy Crypto Policy Tiers (v0)

| Tier | KEM Default | Signature Default | Use Case |
|------|-------------|-------------------|----------|
| `default` | kyber-768 | dilithium-3 | Standard business |
| `strict` | kyber-768 | dilithium-3 | Security-conscious |
| `maximum` | kyber-1024 | dilithium-5 | High-security |
| `government` | kyber-1024 | dilithium-5 | Government compliance |

## Crypto Policy V1 (Profiles + Tiers)

V1 policies use profiles + evidence-first tiers. These policies are the default returned by `/platform/v1/crypto/policy` when a tenant context is provided.

```ts
// Get tenant crypto policy v1
const policyV1 = await tenants.getTenantCryptoPolicyV1("<tenant_uuid>");
console.log(policyV1.policy.profile, policyV1.policy.enabledTiers);

// List policy history
const history = await tenants.listTenantCryptoPolicyV1History("<tenant_uuid>", { limit: 50 });

// Update policy (requires If-Match with current ETag)
const updated = await tenants.updateTenantCryptoPolicyV1(
	"<tenant_uuid>",
	{ ...policyV1.policy, overrides: { allowFalcon: true } },
	policyV1.etag,
);

// Enable Tier0 legacy (time-bounded)
await tenants.enableTier0Legacy(
	"<tenant_uuid>",
	{ expiry: "2026-12-31T00:00:00Z" },
	policyV1.etag,
);

// Enable Tier4 experimental (requires acknowledgement)
await tenants.enableTier4Experimental(
	"<tenant_uuid>",
	{ approvedBy: "security@qnsi" },
	policyV1.etag,
);

// Roll back to a previous policy history entry
await tenants.rollbackTenantCryptoPolicyV1(
	"<tenant_uuid>",
	{ historyId: history.items[0]?.id },
	policyV1.etag,
);
```

### V1 Profiles

- `gov-high-assurance` (default baseline)
- `defense-long-life-data` (high assurance, stateful options)
- `financial-hybrid-pqc` (migration/hybrid posture)
- `research-eval` (gated non-compliant research)

### V1 Tiers

- `TIER1_APPROVED` (default approved baseline)
- `TIER2_HIGH_ASSURANCE` (stateful + high assurance)
- `TIER3_DIVERSITY` (hybrid/alternate risk models)
- `TIER4_EXPERIMENTAL` (research-only, non-compliant)
- `TIER0_LEGACY` (time-bounded legacy transition)

## Algorithm Name Conversion

Convert between internal and NIST standardized names. The Tenant SDK exports the NIST name mapping covering all PQC families supported by QNSI: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205), FN-DSA (FIPS 206 draft), BIKE, Classic McEliece, FrodoKEM, NTRU, NTRU-Prime, MAYO, CROSS, UOV, and SNOVA.

```ts
import { toNistAlgorithmName, ALGORITHM_TO_NIST } from "@heossi/qnsi-tenant-sdk";

// Convert internal to NIST name
const nistName = toNistAlgorithmName("kyber-768"); // "ML-KEM-768"
const nistSig = toNistAlgorithmName("dilithium-3"); // "ML-DSA-65"

// Full mapping covers all 87 PQC algorithms. Representative entries:
console.log(ALGORITHM_TO_NIST);
// {
//   "kyber-512": "ML-KEM-512",        // FIPS 203
//   "kyber-768": "ML-KEM-768",
//   "kyber-1024": "ML-KEM-1024",
//   "dilithium-2": "ML-DSA-44",       // FIPS 204
//   "dilithium-3": "ML-DSA-65",
//   "dilithium-5": "ML-DSA-87",
//   "sphincs-sha2-128f-simple": "SLH-DSA-SHA2-128f",  // FIPS 205
//   "sphincs-shake-256f-simple": "SLH-DSA-SHAKE-256f",
//   "falcon-512": "FN-DSA-512",       // FIPS 206 (draft)
//   "falcon-1024": "FN-DSA-1024",
//   "bike-l1": "BIKE-L1",             // NIST Round 4
//   "mceliece-348864": "Classic-McEliece-348864",  // ISO standard
//   "frodokem-640-aes": "FrodoKEM-640-AES",        // ISO standard
//   "ntru-hps-2048-509": "NTRU-HPS-2048-509",      // liboqs 0.15
//   "sntrup761": "sntrup761",          // NTRU-Prime
//   "mayo-1": "MAYO-1",               // NIST Additional Signatures
//   "cross-rsdp-128-balanced": "CROSS-RSDP-128-balanced",
//   "ov-Is": "UOV-Is",
//   "snova-24-5-4": "SNOVA-24-5-4",
//   ... // 87 algorithms total
// }
```

## Key APIs

### Tenant Lifecycle
- `TenantClient.createTenant(request)`
- `TenantClient.updateTenant(id, request)`
- `TenantClient.getTenant(id)`
- `TenantClient.listTenants(options?)`

### Health Dashboard
- `TenantClient.recordHealthSnapshot(request)` - Record health metrics
- `TenantClient.getCurrentHealth(tenantId)` - Get current health status
- `TenantClient.getHealthTrends(request)` - Get health trends over time
- `TenantClient.createHealthAlert(request)` - Create health alert
- `TenantClient.acknowledgeAlert(request)` - Acknowledge alert

### Quota Forecasting
- `TenantClient.recordQuotaUsage(request)` - Record quota usage
- `TenantClient.getCurrentQuotas(tenantId)` - Get current quota status
- `TenantClient.getForecast(request)` - Get quota forecast
- `TenantClient.getQuotaSuggestions(tenantId)` - Get quota recommendations

### Onboarding
- `TenantClient.createWorkflowTemplate(request)` - Create workflow template
- `TenantClient.startOnboarding(request)` - Start onboarding workflow
- `TenantClient.getOnboardingStatus(tenantId)` - Get onboarding progress
- `TenantClient.getOnboardingStats(options?)` - Get onboarding analytics

### Isolation Audit
- `TenantClient.createIsolationPolicy(request)` - Create isolation policy
- `TenantClient.runIsolationAudit(request)` - Run isolation audit
- `TenantClient.getIsolationFindings(request)` - Get audit findings

### Crypto Policy (v0)
- `TenantClient.getTenantCryptoPolicy(tenantId)`
- `TenantClient.upsertTenantCryptoPolicy(tenantId, policy)`
- `TenantClient.getAllowedKemAlgorithms(tenantId)`
- `TenantClient.getAllowedSignatureAlgorithms(tenantId)`
- `TenantClient.getDefaultKemAlgorithm(tenantId)`
- `TenantClient.getDefaultSignatureAlgorithm(tenantId)`

### Crypto Policy (v1)
- `TenantClient.getTenantCryptoPolicyV1(tenantId)`
- `TenantClient.listTenantCryptoPolicyV1History(tenantId, { limit? })`
- `TenantClient.updateTenantCryptoPolicyV1(tenantId, policy, etag)`
- `TenantClient.enableTier0Legacy(tenantId, { expiry }, etag)`
- `TenantClient.disableTier0Legacy(tenantId, etag)`
- `TenantClient.enableTier4Experimental(tenantId, { approvedBy }, etag)`
- `TenantClient.rollbackTenantCryptoPolicyV1(tenantId, { historyId | policyHash }, etag)`

### Utilities
- `toNistAlgorithmName(algorithm)` - Convert internal to NIST name
- `getAlgorithmConfigForTier(tier)` - Get algorithm config for a tier
- `CRYPTO_POLICY_ALGORITHMS` - Full tier algorithm configurations
- `ALGORITHM_TO_NIST` - Algorithm name mapping
