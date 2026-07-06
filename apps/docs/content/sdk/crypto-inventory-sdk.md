---
title: Crypto Inventory SDK (@heossi/qnsi-crypto-inventory-sdk)
version: 0.3.6
last_updated: 2026-04-30
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/crypto-inventory-sdk/src/index.ts
---

> **Note** — As of 2026-04-30, the per-service `@heossi/qnsi-crypto-inventory-sdk` package is consolidated into the unified `@heossi/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossi/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.crypto./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# Crypto Inventory SDK (`@heossi/qnsi-crypto-inventory-sdk`)

The TypeScript client for `crypto-inventory-service`; equivalent shapes ship in Python, Go, Rust, and JVM/Android. Provides cryptographic asset discovery and inventory management across the QNSI platform.

## Install

```bash
pnpm install @heossi/qnsi-crypto-inventory-sdk
```

## Create a client

```ts
import { CryptoInventoryClient } from "@heossi/qnsi-crypto-inventory-sdk";

const inventory = new CryptoInventoryClient({
	baseUrl: "http://localhost:8115",
	apiKey: "<access_token>",
});
```

## List Assets

```ts
// List all assets for a tenant
const { assets, count } = await inventory.listAssets({
	tenantId: "<tenant_uuid>",
});

// Filter by type and PQC status
const pqcKeys = await inventory.listAssets({
	tenantId: "<tenant_uuid>",
	assetType: "key",
	isPqc: true,
	limit: 100,
});

// Filter by source
const kmsAssets = await inventory.listAssets({
	tenantId: "<tenant_uuid>",
	source: "kms",
});

// Filter by algorithm
const kyberAssets = await inventory.listAssets({
	tenantId: "<tenant_uuid>",
	algorithm: "kyber-768",
});

// Assets include NIST algorithm names
console.log(assets[0]);
// {
//   id: "<asset_uuid>",
//   tenantId: "<tenant_uuid>",
//   assetType: "key",
//   source: "kms",
//   algorithm: "kyber-768",
//   algorithmNist: "ML-KEM-768",  // NIST standardized name
//   isPqc: true,
//   ...
// }
```

## Get Asset Details

```ts
const asset = await inventory.getAsset("<asset_uuid>");
console.log(asset.algorithm, asset.algorithmNist);
```

## Asset Statistics

```ts
const stats = await inventory.getAssetStats("<tenant_uuid>");
console.log(stats);
// {
//   totalAssets: 150,
//   pqcAssets: 120,
//   classicalAssets: 30,
//   byType: { certificate: 50, key: 80, secret: 20 },
//   bySource: { kms: 80, vault: 50, "edge-gateway": 20 },
//   byAlgorithm: { "kyber-768": 60, "dilithium-3": 40, "rsa-2048": 30, ... },
//   expiringWithin30Days: 5,
//   rotationOverdue: 2,
// }
```

## PQC Migration Status

```ts
const status = await inventory.getPqcMigrationStatus("<tenant_uuid>");
console.log(status);
// {
//   totalAssets: 150,
//   pqcAssets: 120,
//   classicalAssets: 30,
//   pqcPercentage: 80,
//   migrationComplete: false,
// }
```

## Asset Discovery

Trigger discovery to scan services for cryptographic assets:

```ts
// Discover all assets
const runs = await inventory.discoverAssets();

// Discover for specific tenant
const runs = await inventory.discoverAssets({
	tenantId: "<tenant_uuid>",
});

// Discover from specific source
const runs = await inventory.discoverAssets({
	source: "kms",
});

// Get discovery run history
const history = await inventory.getDiscoveryRuns("<tenant_uuid>", 10);
console.log(history[0]);
// {
//   id: "<run_uuid>",
//   tenantId: "<tenant_uuid>",
//   source: "kms",
//   status: "completed",
//   assetsDiscovered: 25,
//   startedAt: "2026-01-04T10:00:00Z",
//   completedAt: "2026-01-04T10:00:05Z",
// }
```

## Delete Asset

```ts
await inventory.deleteAsset("<asset_uuid>");
```

## PQC Algorithm Information

The Crypto Inventory SDK exports the NIST name mapping covering all PQC families supported by QNSI: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205), FN-DSA (FIPS 206 draft), BIKE, Classic McEliece, FrodoKEM, NTRU, NTRU-Prime, MAYO, CROSS, UOV, and SNOVA.

```ts
import { toNistAlgorithmName, ALGORITHM_TO_NIST } from "@heossi/qnsi-crypto-inventory-sdk";

// Convert internal to NIST name
const nistName = toNistAlgorithmName("kyber-768"); // "ML-KEM-768"

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
//   "falcon-512": "FN-DSA-512",       // FIPS 206 (draft)
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

## Algorithm Deprecation

Manage deprecation policies for cryptographic algorithms and track affected assets:

```ts
// Create a deprecation policy
const policy = await inventory.createDeprecationPolicy({
	tenantId: "<tenant_uuid>",
	algorithm: "rsa-2048",
	status: "deprecated",
	severity: "high",
	deprecationDate: "2026-01-01",
	sunsetDate: "2027-01-01",
	replacementAlgorithm: "ML-KEM-768",
	rationale: "RSA-2048 vulnerable to future quantum attacks",
	complianceFrameworks: ["NIST-PQC", "FIPS-203"],
	notifyAffectedTenants: true,
});

// List deprecation policies
const { policies, total } = await inventory.listDeprecationPolicies({
	tenantId: "<tenant_uuid>",
	severity: "high",
	status: "deprecated",
});

// Get policy details
const policyDetails = await inventory.getDeprecationPolicy("<policy_uuid>");

// Update a policy
await inventory.updateDeprecationPolicy("<policy_uuid>", {
	sunsetDate: "2027-06-01",
	rationale: "Extended sunset date per customer feedback",
});

// Delete a policy
await inventory.deleteDeprecationPolicy("<policy_uuid>");

// Get affected assets
const { assets: affectedAssets } = await inventory.getAffectedAssets({
	tenantId: "<tenant_uuid>",
	severity: "critical",
	acknowledged: false,
});

// Acknowledge deprecation for assets
const ack = await inventory.acknowledgeDeprecation({
	tenantId: "<tenant_uuid>",
	assetIds: ["<asset_uuid_1>", "<asset_uuid_2>"],
	acknowledgmentNote: "Migration planned for Q2",
	plannedMigrationDate: "2026-06-01",
});
console.log(`Acknowledged ${ack.acknowledged} of ${ack.total} assets`);

// Get deprecation summary
const summary = await inventory.getDeprecationSummary("<tenant_uuid>");
console.log(summary);
// {
//   tenantId: "<tenant_uuid>",
//   totalAffectedAssets: 45,
//   totalAcknowledged: 30,
//   unacknowledgedCount: 15,
//   bySeverity: {
//     critical: { total: 10, acknowledged: 8 },
//     high: { total: 20, acknowledged: 15 },
//     ...
//   },
//   byStatus: { deprecated: 35, legacy: 10 },
//   upcomingSunsets: [
//     { algorithm: "rsa-2048", sunsetDate: "2027-01-01", affectedAssets: 25 }
//   ]
// }
```

## Hardware Inventory

Register and manage hardware security modules (HSMs), TPMs, and other cryptographic hardware:

```ts
// Register hardware
const device = await inventory.registerHardware({
	tenantId: "<tenant_uuid>",
	name: "Primary HSM Cluster",
	hardwareType: "hsm",
	vendor: "Thales",
	model: "Luna Network HSM 7",
	serialNumber: "SN-12345678",
	firmwareVersion: "7.8.0",
	location: "us-east-1",
	networkAddress: "10.0.1.50",
	complianceLevel: "fips_140_3_l3",
	certificationExpiry: "2028-06-15",
	maxKeyCapacity: 10000,
	supportedAlgorithms: ["ML-KEM-768", "ML-DSA-65", "AES-256-GCM"],
	pqcCapable: true,
});

// List hardware
const { devices } = await inventory.listHardware({
	tenantId: "<tenant_uuid>",
	hardwareType: "hsm",
	status: "active",
	pqcCapable: true,
});

// Get hardware details
const deviceDetails = await inventory.getHardware("<device_uuid>");

// Update hardware
await inventory.updateHardware("<device_uuid>", {
	firmwareVersion: "7.9.0",
	status: "active",
});

// Delete hardware
await inventory.deleteHardware("<device_uuid>");

// Record health check
await inventory.recordHealthCheck("<device_uuid>", {
	healthStatus: "healthy",
	responseTimeMs: 12,
	keySlotUtilization: 45.5,
	memoryUtilization: 62.3,
	cpuUtilization: 28.1,
	temperature: 42.5,
	errorCount: 0,
});

// Get health history
const { healthChecks } = await inventory.getHardwareHealth("<device_uuid>", {
	since: "2026-03-01",
	limit: 100,
});

// Get inventory summary
const inventorySummary = await inventory.getInventorySummary("<tenant_uuid>");
console.log(inventorySummary);
// {
//   tenantId: "<tenant_uuid>",
//   totalDevices: 12,
//   activeDevices: 10,
//   pqcReadyDevices: 8,
//   byType: {
//     hsm: { total: 4, healthy: 4, pqcCapable: 3 },
//     tpm: { total: 6, healthy: 5, pqcCapable: 4 },
//     ...
//   },
//   byStatus: { active: 10, standby: 1, maintenance: 1 },
//   byHealth: { healthy: 9, warning: 2, critical: 1 },
//   keyCapacity: {
//     totalSlots: 40000,
//     usedSlots: 18000,
//     availableSlots: 22000,
//     utilizationPercent: 45
//   },
//   expiringCertifications: [
//     { id: "<device_uuid>", name: "HSM-2", certificationExpiry: "2026-06-15", complianceLevel: "fips_140_3_l3" }
//   ]
// }
```

## PQC Readiness

Assess and track your organization's readiness for post-quantum cryptography:

```ts
// Get overall readiness score
const score = await inventory.getReadinessScore("<tenant_uuid>");
console.log(score);
// {
//   tenantId: "<tenant_uuid>",
//   overallScore: 72,
//   maxScore: 100,
//   percentage: 72,
//   level: "progressing",  // "exemplary" | "advanced" | "progressing" | "developing" | "initial"
//   categoryScores: [...],
//   calculatedAt: "2026-03-20T10:00:00Z",
//   trendDirection: "improving",
//   trendPercentage: 5.2
// }

// Get category-specific score
const categoryScore = await inventory.getCategoryScore(
	"<tenant_uuid>",
	"key_management"
);
console.log(categoryScore);
// {
//   category: "key_management",
//   score: 85,
//   maxScore: 100,
//   percentage: 85,
//   level: "advanced",
//   findings: [
//     { findingType: "strength", description: "All KEM keys using ML-KEM", impact: "high" },
//     { findingType: "weakness", description: "5 keys still using RSA-2048", impact: "medium", affectedAssets: 5 },
//     { findingType: "recommendation", description: "Enable automatic key rotation", impact: "low" }
//   ]
// }

// Get score history for trend analysis
const { history } = await inventory.getScoreHistory({
	tenantId: "<tenant_uuid>",
	since: "2026-01-01",
	limit: 30,
});

// Get prioritized recommendations
const recommendations = await inventory.getRecommendations("<tenant_uuid>");
console.log(recommendations);
// {
//   tenantId: "<tenant_uuid>",
//   currentScore: 72,
//   currentLevel: "progressing",
//   recommendations: [
//     {
//       priority: "critical",
//       category: "certificate_infrastructure",
//       title: "Migrate TLS certificates to hybrid algorithms",
//       description: "15 certificates still using RSA-2048 for key exchange",
//       estimatedImpact: 8,
//       affectedAssets: 15
//     },
//     ...
//   ],
//   totalRecommendations: 12
// }

// Get benchmark comparison
const benchmark = await inventory.getBenchmark("<tenant_uuid>");
console.log(benchmark);
// {
//   tenantId: "<tenant_uuid>",
//   yourScore: { percentage: 72, level: "progressing" },
//   benchmark: {
//     totalOrganizations: 500,
//     percentile25: 45,
//     percentile50: 62,
//     percentile75: 78,
//     percentile90: 89,
//     averageScore: 61,
//     topScore: 98
//   },
//   yourPercentile: 68,
//   comparedToAverage: 11
// }
```

## Key APIs

### Asset Management
- `CryptoInventoryClient.listAssets(request)` - List assets with filters
- `CryptoInventoryClient.getAsset(assetId)` - Get asset details
- `CryptoInventoryClient.deleteAsset(assetId)` - Delete asset

### Statistics
- `CryptoInventoryClient.getAssetStats(tenantId)` - Get asset statistics
- `CryptoInventoryClient.getPqcMigrationStatus(tenantId)` - Get PQC migration progress

### Discovery
- `CryptoInventoryClient.discoverAssets(request?)` - Trigger asset discovery
- `CryptoInventoryClient.getDiscoveryRuns(tenantId?, limit?)` - Get discovery history

### Algorithm Deprecation
- `CryptoInventoryClient.createDeprecationPolicy(request)` - Create deprecation policy
- `CryptoInventoryClient.listDeprecationPolicies(params?)` - List policies
- `CryptoInventoryClient.getDeprecationPolicy(policyId)` - Get policy details
- `CryptoInventoryClient.updateDeprecationPolicy(policyId, request)` - Update policy
- `CryptoInventoryClient.deleteDeprecationPolicy(policyId)` - Delete policy
- `CryptoInventoryClient.getAffectedAssets(params?)` - Get affected assets
- `CryptoInventoryClient.acknowledgeDeprecation(request)` - Acknowledge deprecation
- `CryptoInventoryClient.getDeprecationSummary(tenantId)` - Get deprecation summary

### Hardware Inventory
- `CryptoInventoryClient.registerHardware(request)` - Register hardware device
- `CryptoInventoryClient.listHardware(params?)` - List hardware
- `CryptoInventoryClient.getHardware(hardwareId)` - Get hardware details
- `CryptoInventoryClient.updateHardware(hardwareId, request)` - Update hardware
- `CryptoInventoryClient.deleteHardware(hardwareId)` - Delete hardware
- `CryptoInventoryClient.recordHealthCheck(hardwareId, request)` - Record health check
- `CryptoInventoryClient.getHardwareHealth(hardwareId, params?)` - Get health history
- `CryptoInventoryClient.getInventorySummary(tenantId)` - Get inventory summary

### PQC Readiness
- `CryptoInventoryClient.getReadinessScore(tenantId)` - Get overall readiness score
- `CryptoInventoryClient.getCategoryScore(tenantId, category)` - Get category score
- `CryptoInventoryClient.getScoreHistory(params)` - Get score history
- `CryptoInventoryClient.getRecommendations(tenantId)` - Get recommendations
- `CryptoInventoryClient.getBenchmark(tenantId)` - Get benchmark comparison

### Utilities
- `toNistAlgorithmName(algorithm)` - Convert internal to NIST name
- `ALGORITHM_TO_NIST` - Algorithm name mapping

### Types
- `CryptoAsset` - Asset with algorithm and metadata
- `AssetStats` - Aggregated statistics
- `DiscoveryRun` - Discovery run status
- `AssetType` - "certificate" | "key" | "secret"
- `AssetSource` - "kms" | "vault" | "edge-gateway" | "external"
- `DeprecationPolicy` - Algorithm deprecation policy
- `AffectedAsset` - Asset affected by deprecation
- `DeprecationSummary` - Deprecation overview
- `HardwareDevice` - Hardware security device
- `HealthCheckRecord` - Hardware health record
- `HardwareInventorySummary` - Hardware inventory overview
- `PqcReadinessScore` - PQC readiness assessment
- `CategoryScore` - Category-specific readiness
- `ReadinessRecommendation` - Prioritized recommendation
- `ReadinessBenchmark` - Industry benchmark comparison
