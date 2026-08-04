---
title: Audit SDK (qnsi.audit)
version: 0.3.6
last_updated: 2026-04-30
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/audit-sdk/src/index.ts
---

> **Note** - As of 2026-04-30, the per-service `@heossihq/qnsi-audit-sdk` package is consolidated into the unified `@heossihq/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossihq/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.audit./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# Audit SDK (`qnsi.audit`)

The TypeScript client for `audit-service`; equivalent shapes ship in Python, Go, Rust, and JVM/Android. All audit events are signed with tenant-specific PQC algorithms based on crypto policy.

## Install

```bash
pnpm install @heossihq/qnsi
```

## Create a client

```ts
import { AuditClient } from "@heossihq/qnsi";

const audit = new AuditClient({
	baseUrl: "http://localhost:8103",
	apiKey: "<access_token>",
});
```

## Ingest Events

```ts
await audit.ingestEvents({
	events: [
		{
			id: "<event_uuid>",
			tenantId: "<tenant_uuid>",
			sourceService: "storage-service",
			topic: "document.uploaded",
			version: "1.0",
			payload: {
				documentId: "<doc_uuid>",
				sizeBytes: 1024000,
			},
			security: {
				controlPlaneTokenSha256: "<hash>",
				pqcSignatures: [
					{
						provider: "liboqs",
						algorithm: "dilithium-3",
						value: "<signature>",
						publicKey: "<public_key>",
					},
				],
			},
			signature: {
				algorithm: "dilithium-3",
				provider: "liboqs",
				value: "<signature>",
				publicKey: "<public_key>",
			},
			eventHash: "<hash>",
			chainHash: "<hash>",
			commitmentSignature: {
				algorithm: "dilithium-3",
				provider: "liboqs",
				value: "<signature>",
				publicKey: "<public_key>",
			},
			receivedAt: new Date().toISOString(),
		},
	],
});
```

## Query Events

```ts
// List events with filters
const { items, nextCursor } = await audit.listEvents({
	tenantId: "<tenant_uuid>",
	sourceService: "storage-service",
	topic: "document.uploaded",
	since: "2026-01-01T00:00:00Z",
	limit: 100,
});

// Paginate through results
let cursor = nextCursor;
while (cursor) {
	const page = await audit.listEvents({
		tenantId: "<tenant_uuid>",
		cursor,
	});
	// Process page.items
	cursor = page.nextCursor;
}
```

## Real-Time Streaming

Stream audit events in real-time via webhooks or WebSockets:

```ts
// Create a streaming subscription
const subscription = await audit.createSubscription({
	name: "Security Events",
	description: "Stream security-related audit events",
	filters: {
		topics: ["auth.login", "auth.logout", "access.denied"],
		severities: ["warning", "critical"],
	},
	webhookUrl: "https://example.com/webhooks/audit",
	websocketEnabled: true,
	batchSize: 100,
	batchIntervalMs: 5000,
});

// List subscriptions
const { items } = await audit.listSubscriptions({ status: "active" });

// Update subscription
await audit.updateSubscription(subscription.id, {
	status: "paused",
});

// Get streaming metrics
const metrics = await audit.getStreamingMetrics({
	subscriptionId: subscription.id,
	since: "2026-03-01T00:00:00Z",
});
console.log(metrics.eventsDelivered, metrics.deliveryLatencyP50Ms);

// Delete subscription
await audit.deleteSubscription(subscription.id);
```

## Retention Management

Configure audit event lifecycle and cleanup policies:

```ts
// Create a retention policy
const policy = await audit.createRetentionPolicy({
	name: "Standard Retention",
	rules: [
		{
			name: "Archive old events",
			filters: {
				olderThanDays: 365,
				sourceServices: ["storage-service"],
			},
			action: "archive",
			archiveDestination: "s3://audit-archive/",
		},
		{
			name: "Delete very old",
			filters: {
				olderThanDays: 2555, // 7 years
			},
			action: "delete",
		},
	],
	schedule: {
		cronExpression: "0 2 * * 0", // Weekly Sunday 2am
		timezone: "UTC",
	},
});

// List retention policies
const policies = await audit.listRetentionPolicies({ status: "active" });

// Preview cleanup (dry run)
const preview = await audit.previewCleanup({ policyId: policy.id });
console.log(`Would affect ${preview.estimatedEventsAffected} events`);

// Execute cleanup
const result = await audit.executeCleanup({
	policyId: policy.id,
	dryRun: false,
});

// Get retention metrics
const retentionMetrics = await audit.getRetentionMetrics({
	since: "2026-01-01T00:00:00Z",
});
console.log(retentionMetrics.totalBytesReclaimed);
```

## PQC Algorithm Information

The Audit SDK exports the NIST name mapping covering all PQC families supported by QNSI: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205), FN-DSA (FIPS 206 draft), BIKE, Classic McEliece, FrodoKEM, NTRU, NTRU-Prime, MAYO, CROSS, UOV, and SNOVA.

```ts
import { toNistAlgorithmName, ALGORITHM_TO_NIST } from "@heossihq/qnsi";

// Convert internal to NIST name
const nistName = toNistAlgorithmName("dilithium-3"); // "ML-DSA-65"

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

### Event Management
- `AuditClient.ingestEvents(request)` - Batch ingest (1-100 events)
- `AuditClient.listEvents(request?)` - Query with filters and pagination

### Real-Time Streaming
- `AuditClient.createSubscription(request)` - Create streaming subscription
- `AuditClient.listSubscriptions(request?)` - List subscriptions
- `AuditClient.updateSubscription(id, request)` - Update subscription
- `AuditClient.deleteSubscription(id)` - Delete subscription
- `AuditClient.getStreamingMetrics(request?)` - Get delivery metrics

### Retention
- `AuditClient.createRetentionPolicy(request)` - Create retention policy
- `AuditClient.listRetentionPolicies(request?)` - List policies
- `AuditClient.updateRetentionPolicy(id, request)` - Update policy
- `AuditClient.deleteRetentionPolicy(id)` - Delete policy
- `AuditClient.executeCleanup(request)` - Run cleanup
- `AuditClient.previewCleanup(request)` - Preview cleanup (dry run)
- `AuditClient.getRetentionMetrics(request?)` - Get retention metrics

### Utilities
- `toNistAlgorithmName(algorithm)` - Convert internal to NIST name
- `ALGORITHM_TO_NIST` - Algorithm name mapping

### Types
- `AuditEvent` - Full event with signatures and chain hashes
- `StreamingSubscription` - Real-time subscription configuration
- `RetentionPolicy` - Lifecycle management policy
- `RetentionCleanupResult` - Cleanup execution result
