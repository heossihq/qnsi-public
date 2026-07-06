---
title: Storage SDK (@heossi/qnsi-storage-sdk)
version: 0.3.6
last_updated: 2026-04-30
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/storage-sdk/src/index.ts
---

> **Note** — As of 2026-04-30, the per-service `@heossi/qnsi-storage-sdk` package is consolidated into the unified `@heossi/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossi/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.storage./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# Storage SDK (`@heossi/qnsi-storage-sdk`)

The TypeScript client for `storage-service`; equivalent shapes ship in Python, Go, Rust, and JVM/Android. All files are encrypted with tenant-specific PQC algorithms based on crypto policy.

## Install

```bash
pnpm install @heossi/qnsi-storage-sdk
```

## Create a client

```ts
import { StorageClient } from "@heossi/qnsi-storage-sdk";

const storage = new StorageClient({
	baseUrl: "http://localhost:8092",
	apiKey: "<access_token>",
	tenantId: "<tenant_uuid>",
});
```

## Upload Flow

```ts
// 1. Initiate upload
const upload = await storage.initiateUpload({
	name: "document.pdf",
	mimeType: "application/pdf",
	sizeBytes: 1024000,
	classification: "confidential",
	metadata: { department: "engineering" },
	tags: ["report", "q4"],
});

// PQC metadata shows which algorithm was used
console.log(upload.pqc);
// {
//   provider: "liboqs",
//   algorithm: "kyber-768",
//   algorithmNist: "ML-KEM-768",  // NIST standardized name
//   keyId: "key-uuid"
// }

// 2. Upload parts
for (let i = 0; i < upload.totalParts; i++) {
	const partData = getPartData(i); // Your data source
	await storage.uploadPart(upload.uploadId, i, partData);
}

// 3. Complete upload
const result = await storage.completeUpload(upload.uploadId);
console.log(result.documentId);
```

## Download Flow

```ts
// Get download descriptor
const descriptor = await storage.getDownloadDescriptor(documentId, version);

// Stream download
const { stream, totalSize, checksumSha3 } = await storage.downloadStream(
	documentId,
	version,
	{ range: "bytes=0-1023" } // Optional range request
);

// Process stream
const reader = stream.getReader();
while (true) {
	const { value, done } = await reader.read();
	if (done) break;
	// Process chunk
}
```

## Document Policies

```ts
// Get document policies
const policies = await storage.getDocumentPolicies(documentId);
console.log(policies.compliance.retentionMode); // "compliance" | "governance"

// Update retention policy
await storage.updateDocumentPolicies(documentId, {
	retentionMode: "compliance",
	retainUntil: "2027-01-01T00:00:00Z",
});

// Apply legal hold
await storage.applyLegalHold(documentId, { holdId: "litigation-2026" });

// Release legal hold
await storage.releaseLegalHold(documentId, "litigation-2026");

// Schedule lifecycle transition
await storage.scheduleLifecycleTransition(documentId, {
	targetTier: "cold",
	transitionAfter: "2026-06-01T00:00:00Z",
});
```

## Data Classification

Classify objects based on sensitivity and detect PII automatically.

```ts
// Create a classification policy
const policy = await storage.createClassificationPolicy({
	name: "PII Detection Policy",
	classificationLevel: "confidential",
	piiDetectionEnabled: true,
	autoClassify: true,
	patterns: [
		{ name: "SSN", regex: "\\d{3}-\\d{2}-\\d{4}", piiType: "ssn", weight: 100 },
	],
});

// List classification policies
const { policies } = await storage.listClassificationPolicies({ enabled: true });

// Classify an object manually
const classification = await storage.classifyObject(objectId, {
	classificationLevel: "restricted",
	piiDetected: true,
	piiTypes: ["ssn", "email"],
});

// Get object classification
const objClassification = await storage.getObjectClassification(objectId);

// Start a classification scan
const scan = await storage.startClassificationScan({
	scanType: "full",
	scope: { pathPrefix: "/documents/", fileTypes: ["pdf", "docx"] },
});

// Detect PII in content (without storing)
const detection = await storage.detectPII("Contact: john@example.com, SSN: 123-45-6789");
console.log(detection.piiDetected); // true
console.log(detection.detections); // [{ type: "email", count: 1 }, { type: "ssn", count: 1 }]

// Get classification statistics
const stats = await storage.getClassificationStats();
console.log(stats.piiStatistics.objectsWithPii);
```

## Retention Policies

Define and enforce data retention and deletion policies.

```ts
// Create a retention policy
const retentionPolicy = await storage.createRetentionPolicy({
	name: "7-Year Financial Records",
	retentionType: "time_based",
	retentionDays: 2555, // ~7 years
	deletionType: "secure_erase",
	appliesTo: { tags: ["financial"], classificationLevels: ["confidential"] },
	requireApprovalForDeletion: true,
	approvers: ["compliance@company.com"],
});

// List retention policies
const { policies } = await storage.listRetentionPolicies({ enabled: true });

// Place a legal hold
const hold = await storage.placeHold(objectId, {
	holdType: "litigation",
	holdReason: "Active lawsuit - Case #12345",
	legalCaseId: "CASE-12345",
});

// Release a legal hold
await storage.releaseHold(objectId, hold.id, "Case dismissed - no longer needed");

// Schedule object deletion
const deletion = await storage.scheduleDelete(objectId, {
	scheduledAt: "2027-01-01T00:00:00Z",
	deletionType: "secure_erase",
});

// Evaluate if object can be deleted
const evaluation = await storage.evaluateRetention(objectId);
if (evaluation.canDelete) {
	console.log("Object can be deleted");
} else {
	console.log(`Blocked by: ${evaluation.reason}`);
}
```

## Cross-Region Replication

Configure and monitor data replication across regions.

```ts
// Create a replication configuration
const replicationConfig = await storage.createReplicationConfig({
	name: "US to EU Replication",
	sourceRegion: "us-east-1",
	targetRegions: ["eu-west-1", "eu-central-1"],
	replicationMode: "async",
	encryptionInTransit: true,
	verifyChecksum: true,
	filterRules: [
		{ type: "include", field: "classification", operator: "equals", value: "critical" },
	],
});

// List replication configurations
const { configurations } = await storage.listReplicationConfigs({ enabled: true });

// Replicate a specific object
const replication = await storage.replicateObject(objectId, ["eu-west-1", "ap-southeast-1"], {
	priority: "high",
	sizeBytes: 1024000,
});

// Get replication status for an object
const status = await storage.getReplicationStatus(objectId);
for (const rep of status.replications) {
	console.log(`${rep.targetRegion}: ${rep.status}`);
}

// Get replication metrics
const metrics = await storage.getReplicationMetrics({ periodDays: 7 });
console.log(metrics.summary);

// Check region health
const health = await storage.getRegionHealth();
console.log(`Overall status: ${health.status}`);
```

## Intelligent Tiering

Auto-migrate data to cheaper storage tiers based on access patterns.

```ts
// Create a tiering policy
const tieringPolicy = await storage.createTieringPolicy({
	name: "Auto-Archive Policy",
	enabled: true,
	rules: [
		{
			name: "Move to cold after 30 days",
			condition: { lastAccessedDaysAgo: 30 },
			action: { targetTier: "cold" },
			priority: 100,
		},
		{
			name: "Archive after 90 days",
			condition: { lastAccessedDaysAgo: 90 },
			action: { targetTier: "archive" },
			priority: 200,
		},
	],
});

// List tiering policies
const { policies } = await storage.listTieringPolicies();

// Evaluate a policy (dry run by default)
const evaluation = await storage.evaluateTiering(policyId, true);
console.log(`Objects matched: ${evaluation.objectsMatched}`);
console.log(`Estimated savings: ${evaluation.estimatedSavingsPercent}%`);

// Execute tiering (not dry run)
const execution = await storage.evaluateTiering(policyId, false);
console.log(`Transition ID: ${execution.transitionId}`);

// Get tiering statistics
const stats = await storage.getTieringStats();
console.log(stats.tierDistribution);

// Get tiering recommendations
const { recommendations } = await storage.getTieringRecommendations();
for (const rec of recommendations) {
	console.log(`${rec.title}: ${rec.sizeGb} GB, ~${rec.estimatedSavingsPercent}% savings`);
}
```

## PQC Algorithm Information

The Storage SDK exports the NIST name mapping covering all PQC families supported by QNSI: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205), FN-DSA (FIPS 206 draft), BIKE, Classic McEliece, FrodoKEM, NTRU, NTRU-Prime, MAYO, CROSS, UOV, and SNOVA.

```ts
import { toNistAlgorithmName, ALGORITHM_TO_NIST } from "@heossi/qnsi-storage-sdk";

// Convert internal to NIST name
const nistName = toNistAlgorithmName("kyber-768"); // "ML-KEM-768"

// All uploads include PQC metadata
const upload = await storage.initiateUpload({ /* ... */ });
console.log(`Encrypted with ${upload.pqc.algorithmNist}`);

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
//   "mayo-1": "MAYO-1",               // NIST Additional Signatures
//   "cross-rsdp-128-balanced": "CROSS-RSDP-128-balanced",
//   "ov-Is": "UOV-Is",
//   "snova-24-5-4": "SNOVA-24-5-4",
//   ... // 87 algorithms total
// }
```

## Key APIs

### Upload Lifecycle
- `StorageClient.initiateUpload(options)` - Returns PQC metadata
- `StorageClient.uploadPart(uploadId, partId, data)`
- `StorageClient.getUploadStatus(uploadId)`
- `StorageClient.completeUpload(uploadId)`

### Download
- `StorageClient.getDownloadDescriptor(documentId, version, options?)`
- `StorageClient.downloadStream(documentId, version, options?)`

### Document Policies
- `StorageClient.getDocumentPolicies(documentId)`
- `StorageClient.updateDocumentPolicies(documentId, input)`
- `StorageClient.applyLegalHold(documentId, request)`
- `StorageClient.releaseLegalHold(documentId, holdId)`
- `StorageClient.scheduleLifecycleTransition(documentId, request)`

### Data Classification
- `StorageClient.createClassificationPolicy(policy)` - Create policy
- `StorageClient.listClassificationPolicies(options?)` - List policies
- `StorageClient.classifyObject(objectId, classification)` - Tag object
- `StorageClient.getObjectClassification(objectId)` - Get classification
- `StorageClient.startClassificationScan(scope)` - Start scan
- `StorageClient.detectPII(content, contentType?)` - Detect PII in content
- `StorageClient.getClassificationStats()` - Get statistics

### Retention Policies
- `StorageClient.createRetentionPolicy(policy)` - Create policy
- `StorageClient.listRetentionPolicies(options?)` - List policies
- `StorageClient.placeHold(objectId, hold)` - Place legal hold
- `StorageClient.releaseHold(objectId, holdId, releaseReason)` - Release hold
- `StorageClient.scheduleDelete(objectId, schedule)` - Schedule deletion
- `StorageClient.evaluateRetention(objectId, options?)` - Check if deletable

### Cross-Region Replication
- `StorageClient.createReplicationConfig(config)` - Create config
- `StorageClient.listReplicationConfigs(options?)` - List configs
- `StorageClient.replicateObject(objectId, regions, options?)` - Replicate
- `StorageClient.getReplicationStatus(objectId)` - Get status
- `StorageClient.getReplicationMetrics(options?)` - Get metrics
- `StorageClient.getRegionHealth()` - Get region health

### Intelligent Tiering
- `StorageClient.createTieringPolicy(policy)` - Create policy
- `StorageClient.listTieringPolicies()` - List policies
- `StorageClient.evaluateTiering(policyId, dryRun?)` - Evaluate policy
- `StorageClient.getTieringStats()` - Get stats
- `StorageClient.getTieringRecommendations()` - Get recommendations

### Utilities
- `toNistAlgorithmName(algorithm)` - Convert internal to NIST name
- `ALGORITHM_TO_NIST` - Algorithm name mapping
