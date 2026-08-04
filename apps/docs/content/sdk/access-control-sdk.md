---
title: Access Control SDK (qnsi.access)
version: 0.3.6
last_updated: 2026-04-30
description: Access Control SDK for QNSI, now consolidated into the unified @heossihq/qnsi package, with capability tokens signed using tenant-specific PQC algorithms.
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/access-control-sdk/src/index.ts
---

> **Note** - As of 2026-04-30, the per-service `@heossihq/qnsi-access-control-sdk` package is consolidated into the unified `@heossihq/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossihq/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.access./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# Access Control SDK (`qnsi.access`)

The TypeScript client for `access-control-service`; equivalent shapes ship in Python, Go, Rust, and JVM/Android. All capability tokens are signed with tenant-specific PQC algorithms based on crypto policy.

## Install

```bash
pnpm install @heossihq/qnsi
```

## Create a client

```ts
import { AccessControlClient } from "@heossihq/qnsi";

const accessControl = new AccessControlClient({
	baseUrl: "http://localhost:8102",
	apiKey: "<access_token>",
});
```

## Policy Management

```ts
// Create a policy
const policy = await accessControl.createPolicy({
	tenantId: "<tenant_uuid>",
	name: "storage-read-policy",
	description: "Allow reading storage documents",
	statement: {
		effect: "allow",
		actions: ["storage:read", "storage:list"],
		resources: ["storage:documents/*"],
		conditions: {
			classification: { lte: "confidential" },
		},
	},
});

// Get a policy
const policy = await accessControl.getPolicy("<policy_uuid>");

// List policies for a tenant
const { items, nextCursor } = await accessControl.listPolicies("<tenant_uuid>", {
	limit: 50,
});
```

## Capability Tokens

```ts
// Issue a capability token
const capability = await accessControl.issueCapability({
	tenantId: "<tenant_uuid>",
	policyId: "<policy_uuid>",
	subject: {
		type: "user",
		id: "<user_uuid>",
	},
	issuedBy: "admin@example.com",
	ttlSeconds: 3600, // 1 hour
	security: {
		controlPlaneTokenSha256: "<hash>",
		pqcSignatures: [
			{
				provider: "liboqs",
				algorithm: "dilithium-3",
			},
		],
	},
});

console.log(capability.token); // JWT-like token
console.log(capability.payload.signature.algorithm); // "dilithium-3"

// Introspect a token
const introspection = await accessControl.introspectCapability({
	token: capability.token,
});

if (introspection.active) {
	console.log(introspection.payload?.subject);
	console.log(introspection.payload?.expiresAt);
}

// Revoke a token
await accessControl.revokeCapability({
	tokenId: capability.payload.tokenId,
	revokedBy: "admin@example.com",
	reason: "User access revoked",
});
```

## Policy Simulation

Test policy changes before deployment with what-if analysis.

```ts
// Simulate a single access request
const result = await accessControl.simulateAccess({
	subject: { type: "user", id: "<user_uuid>" },
	resource: { type: "storage", id: "documents/secret.pdf" },
	action: "storage:read",
	context: { ipAddress: "10.0.0.5", environment: "production" },
	proposedPolicies: [
		{
			name: "new-deny-policy",
			effect: "deny",
			actions: ["storage:*"],
			resources: ["storage:documents/secret*"],
		},
	],
});

console.log(result.decision); // "allow" | "deny" | "no_match"
console.log(result.matchedPolicies); // policies that matched
console.log(result.decisionReason);

// Batch simulation for multiple requests
const batchResult = await accessControl.batchSimulate([
	{ subject: { type: "user", id: "user-1" }, resource: { type: "storage", id: "doc-1" }, action: "read" },
	{ subject: { type: "user", id: "user-2" }, resource: { type: "storage", id: "doc-2" }, action: "write" },
]);

console.log(batchResult.summary.allowed);
console.log(batchResult.summary.denied);

// Analyze impact of a policy change
const impact = await accessControl.analyzeImpact({
	proposedChange: {
		type: "remove",
		policyId: "<policy_uuid>",
	},
	scope: { sampleSize: 100 },
});

console.log(impact.impact.totalAffected);
console.log(impact.riskAssessment.level); // "low" | "medium" | "high"
console.log(impact.riskAssessment.recommendation);

// Get simulation history
const history = await accessControl.getSimulationHistory({ limit: 50 });
```

## Just-In-Time (JIT) Access

Time-limited elevated access with approval workflows.

```ts
// Request JIT access
const jitRequest = await accessControl.requestJitAccess({
	resourceType: "database",
	resourceId: "production-db",
	permissions: ["read", "write"],
	justification: "Investigating production incident INC-12345",
	durationMinutes: 60,
	ticketId: "INC-12345",
	urgency: "high",
});

console.log(jitRequest.status); // "pending_approval" | "approved" | "auto_approved"
console.log(jitRequest.expiresAt);

// List JIT requests
const requests = await accessControl.listJitRequests({
	status: "pending_approval",
	limit: 20,
});

// Process (approve/deny) a JIT request
const processed = await accessControl.processJitRequest("<request_uuid>", {
	decision: "approve",
	comment: "Approved for incident response",
	modifiedDuration: 30, // reduce to 30 minutes
});

// Get user's active JIT grants
const grants = await accessControl.getUserJitGrants("<user_uuid>");
for (const grant of grants.activeGrants) {
	console.log(`${grant.resourceType}/${grant.resourceId}: ${grant.remainingMinutes} min left`);
}

// Check if user has JIT access
const access = await accessControl.checkJitAccess(
	"<user_uuid>",
	"database",
	"production-db",
	"write"
);

if (access.hasAccess) {
	console.log(`Access granted until ${access.expiresAt}`);
}

// Revoke a JIT grant
await accessControl.revokeJitGrant("<grant_uuid>", "Security review required");

// Create a JIT policy
await accessControl.createJitPolicy({
	name: "database-jit-policy",
	resourcePattern: "database/%",
	maxDurationMinutes: 120,
	requireApproval: true,
	approvers: ["security-team@example.com"],
	autoApproveConditions: {
		maxDurationMinutes: 15,
		requiredTicketSystem: true,
	},
	notifyOnGrant: true,
	notifyOnExpiry: true,
});

// List JIT policies
const policies = await accessControl.listJitPolicies();

// Get JIT statistics
const stats = await accessControl.getJitStats();
console.log(`Approval rate: ${stats.last30Days.approvalRate}%`);
console.log(`Active grants: ${stats.activeGrants}`);
```

## Cross-Tenant Analysis

Analyze access patterns and policies across tenants (platform admin).

```ts
// Get cross-tenant overview
const overview = await accessControl.getCrossTenantOverview({
	tenantIds: ["tenant-1", "tenant-2"],
	timeRange: { lastHours: 24 },
	includeMetrics: true,
});

console.log(overview.tenantCount);
console.log(overview.aggregates.totalPolicies);

// Compare policies across tenants
const comparison = await accessControl.comparePolicies(
	["tenant-1", "tenant-2", "tenant-3"],
	"effect" // compare by: "effect" | "actions" | "resources" | "category"
);

console.log(`Fully shared: ${comparison.summary.fullyShared}`);
console.log(`Unique policies: ${comparison.summary.unique}`);

// Query access anomalies
const anomalies = await accessControl.queryAnomalies({
	anomalyTypes: ["privilege_escalation", "cross_tenant_violation"],
	minSeverity: "medium",
	limit: 100,
});

for (const anomaly of anomalies.anomalies) {
	console.log(`${anomaly.severity}: ${anomaly.description}`);
}

// Get cross-tenant access graph
const graph = await accessControl.getCrossTenantGraph({
	depth: 2,
	includeExpired: false,
});

console.log(`Nodes: ${graph.statistics.totalNodes}`);
console.log(`Edges: ${graph.statistics.totalEdges}`);

// Run tenant isolation audit
const audit = await accessControl.runIsolationAudit("<tenant_uuid>");

console.log(audit.isolationStatus); // "healthy" | "violations_found"
if (audit.crossTenantViolations.length > 0) {
	console.log("Violations found:", audit.crossTenantViolations);
	console.log("Recommendations:", audit.recommendations);
}
```

## PQC Algorithm Information

The Access Control SDK exports the NIST name mapping covering all PQC families supported by QNSI: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205), FN-DSA (FIPS 206 draft), BIKE, Classic McEliece, FrodoKEM, NTRU, NTRU-Prime, MAYO, CROSS, UOV, and SNOVA.

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
//   "mayo-1": "MAYO-1",               // NIST Additional Signatures
//   "cross-rsdp-128-balanced": "CROSS-RSDP-128-balanced",
//   "ov-Is": "UOV-Is",
//   "snova-24-5-4": "SNOVA-24-5-4",
//   ... // 87 algorithms total
// }
```

## Key APIs

### Policy Management
- `AccessControlClient.createPolicy(request)` - Create a policy
- `AccessControlClient.getPolicy(policyId)` - Get policy by ID
- `AccessControlClient.listPolicies(tenantId, options?)` - List tenant policies

### Capability Tokens
- `AccessControlClient.issueCapability(request)` - Issue PQC-signed token
- `AccessControlClient.introspectCapability(request)` - Validate token
- `AccessControlClient.revokeCapability(request)` - Revoke token

### Policy Simulation
- `AccessControlClient.simulateAccess(input, options?)` - Simulate policy access
- `AccessControlClient.batchSimulate(requests, options?)` - Batch simulation
- `AccessControlClient.analyzeImpact(input, options?)` - Analyze policy change impact
- `AccessControlClient.getSimulationHistory(options?)` - Get simulation history

### Just-In-Time Access
- `AccessControlClient.requestJitAccess(input, options?)` - Request JIT access
- `AccessControlClient.listJitRequests(options?)` - List JIT requests
- `AccessControlClient.processJitRequest(requestId, input, options?)` - Approve/deny request
- `AccessControlClient.getUserJitGrants(userId, options?)` - Get user's active grants
- `AccessControlClient.checkJitAccess(userId, resourceType, resourceId, permission, options?)` - Check JIT access
- `AccessControlClient.revokeJitGrant(grantId, reason, options?)` - Revoke grant
- `AccessControlClient.createJitPolicy(input, options?)` - Create JIT policy
- `AccessControlClient.listJitPolicies(options?)` - List JIT policies
- `AccessControlClient.getJitStats(options?)` - Get JIT statistics

### Cross-Tenant Analysis
- `AccessControlClient.getCrossTenantOverview(query?)` - Cross-tenant overview
- `AccessControlClient.comparePolicies(tenantIds, compareBy?)` - Compare policies
- `AccessControlClient.queryAnomalies(query?)` - Query anomalies
- `AccessControlClient.getCrossTenantGraph(options?)` - Access graph
- `AccessControlClient.runIsolationAudit(tenantId?)` - Isolation audit

### Utilities
- `toNistAlgorithmName(algorithm)` - Convert internal to NIST name
- `ALGORITHM_TO_NIST` - Algorithm name mapping

### Types
- `AccessPolicy` - Policy with statement and signature
- `PolicyStatement` - Effect, actions, resources, conditions
- `IssueCapabilityResponse` - Token with PQC signature metadata
- `IntrospectCapabilityResponse` - Token validation result
- `SimulateAccessResult` - Simulation result with decision and matched policies
- `ImpactAnalysisResult` - Impact analysis with risk assessment
- `JitAccessRequestResult` - JIT request result
- `JitStats` - JIT statistics
- `CrossTenantOverviewResult` - Cross-tenant metrics
- `IsolationAuditResult` - Isolation audit result
