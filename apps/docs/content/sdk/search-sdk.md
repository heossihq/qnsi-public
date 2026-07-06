---
title: Search SDK (@heossi/qnsi-search-sdk)
version: 0.2.10
last_updated: 2026-04-30
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/search-sdk/src/client.ts
  - /packages/search-sdk/src/types.ts
---

> **Note** — As of 2026-04-30, the per-service `@heossi/qnsi-search-sdk` package is consolidated into the unified `@heossi/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossi/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.search./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# Search SDK (`@heossi/qnsi-search-sdk`)

The TypeScript client for `search-service`; equivalent shapes ship in Python, Go, Rust, and JVM/Android. Search indexes are encrypted with tenant-specific PQC algorithms based on crypto policy.

## Install

```bash
pnpm install @heossi/qnsi-search-sdk
```

## Create a client

```ts
import { SearchClient } from "@heossi/qnsi-search-sdk";

const search = new SearchClient({
	baseUrl: "http://localhost:8101",
	apiToken: "<access_token>",
	sseKey: "<optional_sse_key>", // For searchable symmetric encryption
});
```

## Index Documents

```ts
// Index a single document
await search.indexDocument({
	tenantId: "<tenant_uuid>",
	documentId: "<doc_uuid>",
	sourceService: "storage-service",
	title: "Q4 Report",
	description: "Quarterly financial report",
	body: "Full document content...",
	tags: ["finance", "quarterly"],
	metadata: { department: "accounting" },
});

// Batch index multiple documents
await search.batchIndexDocuments([
	{ tenantId: "...", documentId: "...", /* ... */ },
	{ tenantId: "...", documentId: "...", /* ... */ },
]);

// Index with automatic SSE token derivation
await search.indexDocumentWithAutoSse({
	tenantId: "<tenant_uuid>",
	documentId: "<doc_uuid>",
	sourceService: "storage-service",
	title: "Confidential Report",
	body: "Encrypted searchable content...",
});
```

## Search Documents

```ts
// Basic search
const results = await search.search({
	tenantId: "<tenant_uuid>",
	query: "quarterly report",
	limit: 20,
});

// Search with automatic SSE
const results = await search.searchWithAutoSse({
	tenantId: "<tenant_uuid>",
	query: "confidential data",
	limit: 20,
	language: "en",
});

// Paginate results
let cursor = results.nextCursor;
while (cursor) {
	const page = await search.search({
		tenantId: "<tenant_uuid>",
		query: "quarterly report",
		cursor,
	});
	// Process page.items
	cursor = page.nextCursor;
}
```

## Query Analytics

Track and analyze search performance:

```ts
// Record a query for analytics
await search.recordQuery({
	tenantId: "<tenant_uuid>",
	query: "quarterly report",
	resultCount: 15,
	latencyMs: 45,
	clickedDocumentIds: ["<doc_uuid>"],
});

// Get query metrics
const metrics = await search.getQueryMetrics({
	tenantId: "<tenant_uuid>",
	since: "2026-03-01T00:00:00Z",
	groupBy: "day",
});
console.log(metrics.avgLatencyMs, metrics.zeroResultRate);

// Get search quality metrics
const quality = await search.getSearchQuality({
	tenantId: "<tenant_uuid>",
});
console.log(quality.relevanceScore, quality.clickThroughRate);

// Get top queries
const topQueries = await search.getTopQueries({
	tenantId: "<tenant_uuid>",
	limit: 20,
	zeroResultsOnly: false,
});
```

## Synonym Management

Configure query expansion with synonyms:

```ts
// Create a synonym group
const group = await search.createSynonymGroup({
	tenantId: "<tenant_uuid>",
	name: "Document Types",
	synonyms: ["report", "document", "file", "doc"],
	isExpanded: true,
	language: "en",
});

// List synonym groups
const { items } = await search.listSynonymGroups({
	tenantId: "<tenant_uuid>",
});

// Update a group
await search.updateSynonymGroup(group.id, {
	synonyms: ["report", "document", "file", "doc", "paper"],
});

// Expand a term
const expansion = await search.expandTerm({
	tenantId: "<tenant_uuid>",
	term: "report",
});
console.log(expansion.expandedTerms); // ["document", "file", "doc", "paper"]

// Import/export synonyms
await search.importSynonyms({
	tenantId: "<tenant_uuid>",
	format: "solr",
	data: "report,document,file\nquarterly,q1,q2,q3,q4",
});

const exported = await search.exportSynonyms({
	tenantId: "<tenant_uuid>",
	format: "json",
});
```

## Index Health

Monitor index health and configure maintenance:

```ts
// Record a health snapshot
await search.recordHealthSnapshot({
	tenantId: "<tenant_uuid>",
	metrics: {
		documentCount: 150000,
		indexSizeBytes: 1073741824,
		avgQueryLatencyMs: 25,
	},
});

// Get current index health
const health = await search.getIndexHealth({
	tenantId: "<tenant_uuid>",
});
console.log(health.status, health.metrics.fragmentationPercent);

// List health alerts
const alerts = await search.listHealthAlerts({
	tenantId: "<tenant_uuid>",
	status: "active",
	severity: "warning",
});

// Acknowledge an alert
await search.acknowledgeAlert({
	alertId: "<alert_uuid>",
	acknowledgedBy: "admin@example.com",
	note: "Investigating high latency",
});

// Create a maintenance window
await search.createMaintenanceWindow({
	tenantId: "<tenant_uuid>",
	name: "Index Optimization",
	startsAt: "2026-03-21T02:00:00Z",
	endsAt: "2026-03-21T04:00:00Z",
	suppressAlerts: true,
	operations: ["optimize", "merge_segments"],
});
```

## Tenant Isolation

Verify and enforce tenant data boundaries:

```ts
// Create an isolation policy
const policy = await search.createIsolationPolicy({
	tenantId: "<tenant_uuid>",
	name: "Strict Tenant Isolation",
	level: "strict",
	rules: [
		{
			field: "tenantId",
			operator: "equals",
			value: "<tenant_uuid>",
		},
	],
	enforcementMode: "enforce",
});

// List isolation policies
const policies = await search.listIsolationPolicies({
	tenantId: "<tenant_uuid>",
});

// Run isolation verification
const result = await search.runIsolationVerification({
	tenantId: "<tenant_uuid>",
	sampleSize: 1000,
});
console.log(result.passedChecks, result.failedChecks);

// Report a violation
await search.reportViolation({
	tenantId: "<tenant_uuid>",
	policyId: policy.id,
	severity: "critical",
	description: "Cross-tenant data access detected",
	documentIds: ["<doc_uuid>"],
});
```

## Searchable Symmetric Encryption (SSE)

When configured with an SSE key, the SDK can derive encrypted search tokens:

```ts
const search = new SearchClient({
	baseUrl: "http://localhost:8101",
	apiToken: "<token>",
	sseKey: "<32_byte_key>",
});

// Create SSE token for a value
const token = search.createSseToken("confidential");

// Derive tokens for document indexing
const docTokens = search.deriveDocumentSseTokens({
	tenantId: "<tenant_uuid>",
	documentId: "<doc_uuid>",
	sourceService: "storage-service",
	title: "Report",
	body: "Content...",
	tags: ["finance"],
	metadata: {},
});

// Derive tokens for query
const queryTokens = search.deriveQuerySseTokens("quarterly report");
```

## Key APIs

### Indexing
- `SearchClient.indexDocument(input)` - Index single document
- `SearchClient.batchIndexDocuments(documents)` - Batch index
- `SearchClient.indexDocumentWithAutoSse(document)` - Index with auto SSE

### Querying
- `SearchClient.search(params)` - Search with filters
- `SearchClient.searchWithAutoSse(params)` - Search with auto SSE

### Query Analytics
- `SearchClient.recordQuery(input)` - Record query for analytics
- `SearchClient.getQueryMetrics(params?)` - Get query performance metrics
- `SearchClient.getSearchQuality(params?)` - Get search quality metrics
- `SearchClient.getTopQueries(params?)` - Get top/zero-result queries

### Synonym Management
- `SearchClient.createSynonymGroup(input)` - Create synonym group
- `SearchClient.listSynonymGroups(params)` - List synonym groups
- `SearchClient.updateSynonymGroup(groupId, input)` - Update group
- `SearchClient.deleteSynonymGroup(groupId)` - Delete group
- `SearchClient.expandTerm(params)` - Expand term with synonyms
- `SearchClient.importSynonyms(input)` - Import from CSV/JSON/Solr
- `SearchClient.exportSynonyms(params)` - Export to CSV/JSON/Solr

### Index Health
- `SearchClient.recordHealthSnapshot(input)` - Record health metrics
- `SearchClient.getIndexHealth(params)` - Get current health status
- `SearchClient.listHealthAlerts(params?)` - List health alerts
- `SearchClient.acknowledgeAlert(input)` - Acknowledge an alert
- `SearchClient.createMaintenanceWindow(input)` - Schedule maintenance

### Isolation
- `SearchClient.createIsolationPolicy(input)` - Create isolation policy
- `SearchClient.listIsolationPolicies(params?)` - List policies
- `SearchClient.reportViolation(input)` - Report isolation violation
- `SearchClient.runIsolationVerification(input)` - Verify tenant boundaries

### SSE Utilities
- `SearchClient.createSseToken(value)` - Create encrypted token
- `SearchClient.deriveDocumentSseTokens(document)` - Derive index tokens
- `SearchClient.deriveQuerySseTokens(query)` - Derive query tokens
