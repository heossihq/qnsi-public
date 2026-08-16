---
title: Vault SDK (qnsi.vault)
version: 0.3.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/vault-sdk/src/index.ts
---

> **Note** - As of 2026-04-30, the per-service `@heossihq/qnsi-vault-sdk` package is consolidated into the unified `@heossihq/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossihq/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.vault./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# Vault SDK (`qnsi.vault`)

TypeScript client for `vault-service`. All secrets are encrypted with tenant-specific PQC algorithms based on crypto policy.

**Tier Requirement**: Core Vault access is available on every tier with tier-specific secret and version quotas. Dynamic-credentials engines require dev-pro or higher.

## Install

```bash
pnpm install @heossihq/qnsi
```

## Create a client

```ts
import { VaultClient } from "@heossihq/qnsi";

const vault = new VaultClient({
	baseUrl: "http://localhost:8090",
	apiKey: "<access_token>",
	tier: "dev-pro", // Optional tier check
});
```

## Create a Secret

```ts
const secret = await vault.createSecret({
	tenantId: "<tenant_uuid>",
	name: "database-password",
	payload: Buffer.from("my-secret-value").toString("base64"),
	metadata: { environment: "production" },
	rotationPolicy: {
		intervalSeconds: 86400 * 30, // 30 days
	},
});

// PQC metadata shows encryption algorithm
console.log(secret.pqc);
// {
//   provider: "liboqs",
//   algorithm: "kyber-768",
//   algorithmNist: "ML-KEM-768",
//   keyId: "key-uuid"
// }
```

## Get a Secret

```ts
// Get latest version
const secret = await vault.getSecret("<secret_id>");

// Get with lease token (for access control)
const secret = await vault.getSecret("<secret_id>", {
	leaseToken: "<lease_token>",
});

// Get specific version
const secretV2 = await vault.getSecretVersion("<secret_id>", 2);
```

## Rotate a Secret

```ts
const rotated = await vault.rotateSecret("<secret_id>", {
	tenantId: "<tenant_uuid>",
	newPayload: Buffer.from("new-secret-value").toString("base64"),
	metadata: { rotatedBy: "admin" },
	rotationPolicy: {
		intervalSeconds: 86400 * 15, // 15 days
	},
});

console.log(rotated.version); // Incremented version
```

## Delete a Secret

```ts
await vault.deleteSecret("<secret_id>", "<tenant_uuid>");
```

## Dynamic Secrets

Generate ephemeral credentials on-demand for databases, cloud providers, and other services. Credentials are automatically rotated and can be revoked immediately.

### Create a Dynamic Secret Configuration

```ts
const config = await vault.createDynamicSecretConfig({
	name: "postgres-readonly",
	secretType: "database",
	backend: {
		type: "postgresql",
		host: "db.example.com",
		port: 5432,
		database: "myapp",
		adminUsername: "admin",
		adminPassword: "admin-password",
	},
	defaultTtlSeconds: 3600, // 1 hour
	maxTtlSeconds: 86400, // 24 hours
	template: {
		usernameTemplate: "readonly_{{timestamp}}_{{random}}",
		creationStatements: [
			"CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'",
			"GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\"",
		],
		revocationStatements: ["DROP ROLE IF EXISTS \"{{name}}\""],
	},
});
```

### Request Credentials

```ts
const creds = await vault.requestCredentials(config.id, {
	ttlSeconds: 1800, // 30 minutes
	metadata: { purpose: "nightly-backup" },
});

console.log(creds.credentials.username); // "readonly_abc123_xyz789"
console.log(creds.credentials.password); // Secure random password
console.log(creds.leaseId); // For renewal/revocation
console.log(creds.expiresAt); // ISO timestamp
```

### Manage Leases

```ts
// List active leases
const { leases } = await vault.listLeases(config.id);

// Renew a lease
const renewed = await vault.renewLease(creds.leaseId, {
	ttlSeconds: 3600,
});

// Revoke a lease immediately
await vault.revokeLease(creds.leaseId);
```

### Dynamic Secrets Statistics

```ts
const stats = await vault.getDynamicSecretStats();
console.log(stats);
// {
//   totalConfigs: 5,
//   enabledConfigs: 4,
//   secretTypes: 3,
//   activeLeases: 12,
//   revokedLeases: 45,
//   expiredLeases: 128
// }
```

## Secret Leakage Detection

Monitor for leaked secrets across public repositories, paste sites, dark web, and threat intelligence feeds. Automatically detect and respond to secret exposure.

### Create a Leakage Detection Policy

```ts
const policy = await vault.createLeakagePolicy({
	name: "production-secrets-monitor",
	description: "Monitor production API keys and database credentials",
	enabled: true,
	scanTargets: {
		secretTypes: ["api_key", "password", "connection_string"],
		secretTags: { environment: "production" },
	},
	scanSources: ["github", "gitlab", "pastebin", "dark_web"],
	threatFeeds: [
		{ provider: "have_i_been_pwned", enabled: true },
		{ provider: "spycloud", enabled: true },
	],
	alerting: {
		enabled: true,
		minSeverity: "medium",
		webhookUrl: "https://alerts.example.com/webhook",
		emailRecipients: ["security@example.com"],
		slackChannel: "#security-alerts",
	},
	autoRemediation: {
		enabled: true,
		actions: ["rotate_secret", "notify_owner", "create_incident"],
		requireApproval: true,
	},
	scanSchedule: {
		intervalMinutes: 60,
	},
});
```

### List Policies

```ts
const { policies } = await vault.listLeakagePolicies({
	enabled: true,
});
```

### Report a Leakage Incident

```ts
const incident = await vault.reportLeakageIncident({
	secretId: "<secret_uuid>",
	source: "github",
	severity: "critical",
	detectedAt: new Date().toISOString(),
	evidence: {
		url: "https://github.com/example/repo/blob/main/.env",
		snippet: "API_KEY=sk-...",
	},
	notes: "Found in public repository commit",
});
```

### Manage Incidents

```ts
// List incidents with filtering
const { incidents } = await vault.listLeakageIncidents({
	status: "detected",
	severity: "critical",
	limit: 50,
});

// Update incident status
const updated = await vault.updateIncidentStatus(incident.id, {
	status: "investigating",
	assignee: "<user_uuid>",
	notes: "Investigating scope of exposure",
	remediationActions: [
		{
			action: "rotate_secret",
			performedAt: new Date().toISOString(),
			performedBy: "security-team",
			result: "success",
		},
	],
});
```

### Trigger Manual Scan

```ts
const scan = await vault.triggerLeakageScan({
	secretIds: ["<secret_uuid_1>", "<secret_uuid_2>"],
	sources: ["github", "dark_web"],
	threatFeeds: ["have_i_been_pwned"],
	force: true,
});

console.log(scan.scanId); // Track scan progress
```

### Leakage Statistics

```ts
const stats = await vault.getLeakageStats();
console.log(stats);
// {
//   incidents: {
//     total: 47,
//     byStatus: { detected: 5, investigating: 3, confirmed: 2, remediated: 35, falsePositive: 2 },
//     bySeverity: { critical: 3, high: 12, medium: 20, low: 12 }
//   },
//   policies: { total: 8, enabled: 6 },
//   scans: { total: 1247, completed: 1245, lastScanAt: "2026-03-20T10:00:00Z" }
// }
```

## Versioned Secrets

Full version history with rollback capabilities, version comparison, and retention policies. Track all changes to secrets with audit trail.

### Create a Secret Version

```ts
const version = await vault.createSecretVersion({
	secretId: "<secret_uuid>",
	value: Buffer.from("new-secret-value").toString("base64"),
	metadata: { rotatedBy: "admin", reason: "scheduled-rotation" },
	rotationPolicy: {
		enabled: true,
		intervalDays: 30,
		notifyBeforeDays: 7,
	},
	retentionPolicy: {
		maxVersions: 10,
		retentionDays: 365,
		destroyOnArchive: false,
	},
	changeReason: "Quarterly security rotation",
	approvedBy: "<approver_uuid>",
});

console.log(version.version); // Version number
```

### List Secret Versions

```ts
const { versions, pagination } = await vault.listSecretVersions("<secret_uuid>", {
	state: "active",
	limit: 20,
	offset: 0,
});

for (const v of versions) {
	console.log(`Version ${v.version}: ${v.state} (created: ${v.createdAt})`);
}
```

### Get Version Details

```ts
const details = await vault.getSecretVersionDetails("<secret_uuid>", 3);
console.log(details.state); // "active", "deprecated", "archived", or "destroyed"
console.log(details.metadata);
```

### Rollback to Previous Version

```ts
// Creates a new version with the content of version 2
const rollback = await vault.rollbackSecret("<secret_uuid>", {
	targetVersion: 2,
	createNewVersion: true, // false to just reactivate old version
	reason: "Reverting due to compatibility issues",
	approvedBy: "<approver_uuid>",
});

console.log(rollback.newVersion); // New version number
console.log(rollback.previousActiveVersion); // What was active before
```

### Compare Versions

```ts
const comparison = await vault.compareVersions("<secret_uuid>", {
	version1: 2,
	version2: 5,
	includeValues: false, // true to check if values match
});

console.log(comparison.comparison.metadataDiff);
// { environment: { old: "staging", new: "production" } }
console.log(comparison.comparison.stateChanged); // true/false
```

### Set Retention Policy

```ts
const result = await vault.setRetentionPolicy("<secret_uuid>", {
	maxVersions: 5, // Keep only 5 versions
	retentionDays: 90, // Archive versions older than 90 days
	destroyOnArchive: false, // Don't destroy, just archive
	autoArchiveAfterDays: 30, // Auto-archive deprecated versions after 30 days
});
```

### Transition Version State

```ts
// Deprecate a version
await vault.transitionVersionState("<secret_uuid>", 3, {
	state: "deprecated",
	reason: "Superseded by version 4",
});

// Archive a version
await vault.transitionVersionState("<secret_uuid>", 2, {
	state: "archived",
	reason: "No longer needed for rollback",
});

// Destroy a version (permanent, clears encrypted data)
await vault.transitionVersionState("<secret_uuid>", 1, {
	state: "destroyed",
	destroyData: true,
	reason: "Compliance requirement - 90-day retention expired",
});
```

### Versioned Secrets Statistics

```ts
const stats = await vault.getVersionedSecretsStats();
console.log(stats);
// {
//   secrets: { total: 150 },
//   versions: {
//     total: 847,
//     active: 150,
//     deprecated: 412,
//     archived: 250,
//     destroyed: 35,
//     averagePerSecret: "5.65"
//   },
//   audit: {
//     totalEntries: 2341,
//     rollbacks: 12,
//     stateChanges: 697
//   }
// }
```

## PQC Algorithm Information

The Vault SDK exports the NIST name mapping covering all PQC families supported by QNSI: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205), FN-DSA (FIPS 206 draft), BIKE, Classic McEliece, FrodoKEM, NTRU, NTRU-Prime, MAYO, CROSS, UOV, and SNOVA.

```ts
import { toNistAlgorithmName, ALGORITHM_TO_NIST } from "@heossihq/qnsi";

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

## Tier Access

The SDK validates tier access when configured:

```ts
import { VaultClient, TierError } from "@heossihq/qnsi";

try {
	const vault = new VaultClient({
		baseUrl: "http://localhost:8090",
		tier: "free",
	});
} catch (error) {
	if (error instanceof TierError) {
		console.log("Vault access follows your billing-backed entitlement tier");
	}
}
```

## Key APIs

### Secret Management
- `VaultClient.createSecret(request)` - Returns PQC metadata
- `VaultClient.getSecret(id, options?)` - Get latest version
- `VaultClient.getSecretVersion(id, version)` - Get specific version
- `VaultClient.rotateSecret(id, request)` - Create new version
- `VaultClient.deleteSecret(id, tenantId)` - Soft delete

### Dynamic Secrets
- `VaultClient.createDynamicSecretConfig(config)` - Create dynamic secret configuration
- `VaultClient.listDynamicSecretConfigs(options?)` - List configurations
- `VaultClient.requestCredentials(configId, request?)` - Request ephemeral credentials
- `VaultClient.listLeases(configId, options?)` - List active leases
- `VaultClient.renewLease(leaseId, request?)` - Extend lease expiration
- `VaultClient.revokeLease(leaseId)` - Immediately revoke credentials
- `VaultClient.getDynamicSecretStats(options?)` - Get usage statistics

### Secret Leakage Detection
- `VaultClient.createLeakagePolicy(policy)` - Create detection policy
- `VaultClient.listLeakagePolicies(options?)` - List policies
- `VaultClient.reportLeakageIncident(incident)` - Report a leak
- `VaultClient.listLeakageIncidents(options?)` - List incidents
- `VaultClient.updateIncidentStatus(incidentId, update)` - Update incident
- `VaultClient.triggerLeakageScan(request?)` - Trigger manual scan
- `VaultClient.getLeakageStats(options?)` - Get detection statistics

### Versioned Secrets
- `VaultClient.createSecretVersion(request)` - Create new version
- `VaultClient.listSecretVersions(secretId, options?)` - List version history
- `VaultClient.getSecretVersionDetails(secretId, version, options?)` - Get version details
- `VaultClient.rollbackSecret(secretId, request)` - Rollback to version
- `VaultClient.compareVersions(secretId, request)` - Compare versions
- `VaultClient.setRetentionPolicy(secretId, policy)` - Set retention policy
- `VaultClient.transitionVersionState(secretId, version, request)` - Change version state
- `VaultClient.getVersionedSecretsStats(options?)` - Get version statistics

### Utilities
- `toNistAlgorithmName(algorithm)` - Convert internal to NIST name
- `ALGORITHM_TO_NIST` - Algorithm name mapping

### Types
- `Secret` - Secret with envelope and PQC metadata
- `VaultSecretPqcMetadata` - PQC encryption details
- `RotationPolicy` - Rotation configuration
- `TierError` - Tier access error
- `DynamicSecretConfig` - Dynamic secret configuration
- `DynamicCredentials` - Ephemeral credentials with lease
- `LeakagePolicy` - Leakage detection policy
- `LeakageIncident` - Detected leak incident
- `SecretVersion` - Version with state and metadata
- `VersionRetentionPolicy` - Version retention settings
