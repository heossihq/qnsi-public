---
title: Auth SDK (qnsi.auth)
version: 0.3.6
last_updated: 2026-04-30
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/auth-sdk/src/index.ts
---

> **Note** - As of 2026-04-30, the per-service `@heossihq/qnsi-auth-sdk` package is consolidated into the unified `@heossihq/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossihq/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.auth./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# Auth SDK (`qnsi.auth`)

The TypeScript client for `auth-service`; equivalent shapes ship in Python, Go, Rust, and JVM/Android. All tokens are signed with tenant-specific PQC algorithms based on crypto policy.

## Install

```bash
pnpm install @heossihq/qnsi
```

## Create a client

```ts
import { AuthClient } from "@heossihq/qnsi";

const auth = new AuthClient({
	baseUrl: "https://api.qnsi.heossi.com",
	apiKey: process.env.QNSI_API_KEY,
});
```

## Login

```ts
const tokenPair = await auth.login({
	email: "user@example.com",
	password: "<password>",
	tenantId: "<tenant_uuid>",
	totp: "123456", // Optional MFA code
});

console.log(tokenPair.accessToken);
console.log(tokenPair.refreshToken?.metadata);
```

## Refresh Token

```ts
const refreshed = await auth.refreshToken({
	refreshToken: tokenPair.refreshToken?.token ?? "",
});
```

## WebAuthn Passkeys

```ts
// Register a passkey
const regStart = await auth.registerPasskeyStart({
	userId: "<user_uuid>",
	tenantId: "<tenant_uuid>",
});

// Use WebAuthn API to create credential
const credential = await navigator.credentials.create({
	publicKey: regStart.options,
});

const regComplete = await auth.registerPasskeyComplete({
	userId: "<user_uuid>",
	tenantId: "<tenant_uuid>",
	challengeId: regStart.challengeId,
	response: credential,
});

// Authenticate with passkey
const authStart = await auth.authenticatePasskeyStart({
	email: "user@example.com",
	tenantId: "<tenant_uuid>",
});

const assertion = await navigator.credentials.get({
	publicKey: authStart.options,
});

const authComplete = await auth.authenticatePasskeyComplete({
	email: "user@example.com",
	tenantId: "<tenant_uuid>",
	challengeId: authStart.challengeId,
	response: assertion,
});

// List and manage passkeys
const passkeys = await auth.listPasskeys("<user_uuid>", "<tenant_uuid>");
await auth.deletePasskey("<credential_id>", "<user_uuid>");
```

## MFA

```ts
// Generate MFA challenge
const challenge = await auth.mfaChallenge({
	email: "user@example.com",
	tenantId: "<tenant_uuid>",
});

// Verify MFA code
const verified = await auth.mfaVerify({
	email: "user@example.com",
	tenantId: "<tenant_uuid>",
	totp: "123456",
});
```

## Federation

```ts
// SAML assertion
const samlResult = await auth.federateSAML({
	providerId: "okta",
	externalUserId: "ext-123",
	email: "user@example.com",
	name: "John Doe",
	tenantId: "<tenant_uuid>",
	roles: ["developer"],
});

// OIDC callback
const oidcResult = await auth.federateOIDC({
	providerId: "google",
	code: "<authorization_code>",
	state: "<state>",
});
```

## Service-to-Service Authentication

For internal services to authenticate with each other:

```ts
import { requestServiceToken, getServiceAuthHeader } from "@heossihq/qnsi";

// Get service token
const token = await requestServiceToken({
	authServiceUrl: "http://localhost:8081",
	serviceId: "storage-service",
	serviceSecret: "<service_secret>",
	audience: "internal-service",
});

// Or get ready-to-use header
const authHeader = await getServiceAuthHeader({
	authServiceUrl: "http://localhost:8081",
	serviceId: "storage-service",
	serviceSecret: "<service_secret>",
});

// Use in requests
fetch(url, {
	headers: { Authorization: authHeader },
});
```

## PQC Algorithm Information

The Auth SDK exports the NIST name mapping covering all PQC families supported by QNSI: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205), FN-DSA (FIPS 206 draft), BIKE, Classic McEliece, FrodoKEM, NTRU, NTRU-Prime, MAYO, CROSS, UOV, and SNOVA.

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

## Risk-Based Authentication

Evaluate authentication risk and manage risk policies to protect against threats:

```ts
// Evaluate risk for a login attempt
const risk = await auth.evaluateRisk({
	userId: "<user_uuid>",
	tenantId: "<tenant_uuid>",
	action: "login",
	context: {
		ipAddress: "203.0.113.42",
		userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
		deviceFingerprint: "fp_abc123",
		geoLocation: {
			country: "US",
			region: "CA",
			city: "San Francisco",
			latitude: 37.7749,
			longitude: -122.4194,
		},
	},
});

console.log(risk.riskScore);       // 0-100
console.log(risk.riskLevel);       // "low" | "medium" | "high" | "critical"
console.log(risk.requiredAction);  // "allow" | "mfa_required" | "block" | "review"
console.log(risk.riskFactors);     // Contributing factors

// Create a risk policy
const policy = await auth.createRiskPolicy({
	name: "Strict Login Policy",
	enabled: true,
	rules: [
		{
			condition: { field: "ip_reputation", operator: "lt", value: 50 },
			riskScore: 30,
		},
		{
			condition: { field: "geo_velocity", operator: "gt", value: 500 },
			riskScore: 40,
		},
	],
	thresholds: { medium: 30, high: 60, critical: 80 },
	actions: {
		low: "allow",
		medium: "mfa_required",
		high: "block",
		critical: "lockout",
	},
});

// List all risk policies
const policies = await auth.listRiskPolicies();

// Report a threat signal
const signal = await auth.reportThreatSignal({
	userId: "<user_uuid>",
	tenantId: "<tenant_uuid>",
	signalType: "impossible_travel",
	severity: "high",
	context: {
		previousLocation: "San Francisco, CA",
		currentLocation: "London, UK",
		timeDeltaMinutes: 30,
	},
	source: "geo-analysis-service",
});

// Get risk signals for a user
const signals = await auth.getUserRiskSignals("<user_uuid>", {
	tenantId: "<tenant_uuid>",
	limit: 50,
});

// Get risk statistics
const stats = await auth.getRiskStats();
console.log(stats.riskDistribution);         // { low: 850, medium: 120, high: 25, critical: 5 }
console.log(stats.blockedAttemptsLast24Hours);
```

## Federated Audit

Query and report on federation activity for compliance and security:

```ts
// Query federated audit events
const auditEvents = await auth.queryFederatedAudit({
	startDate: "2026-03-01T00:00:00Z",
	endDate: "2026-03-20T23:59:59Z",
	providerIds: ["okta", "azure-ad"],
	eventTypes: ["federation_login", "jit_provision"],
	limit: 100,
	offset: 0,
});

console.log(auditEvents.total);
for (const event of auditEvents.events) {
	console.log(event.eventType, event.providerId, event.createdAt);
}

// Create a compliance report
const report = await auth.createFederatedAuditReport({
	reportType: "compliance",
	startDate: "2026-03-01T00:00:00Z",
	endDate: "2026-03-31T23:59:59Z",
	providerIds: ["okta"],
	format: "json",
	includeDetails: true,
});

console.log(report.summary.totalEvents);
console.log(report.summary.uniqueUsers);
console.log(report.summary.jitProvisioned);

// List all reports
const reports = await auth.listFederatedAuditReports({
	limit: 20,
});

// Get a specific report
const fullReport = await auth.getFederatedAuditReport("<report_uuid>");

// Get cross-tenant activity (admin)
const crossTenant = await auth.getCrossTenantActivity(24); // Last 24 hours
console.log(crossTenant.tenantsActive);
for (const activity of crossTenant.activity) {
	console.log(activity.tenantId, activity.eventType, activity.count);
}
```

## Key APIs

### Authentication
- `AuthClient.login(request)`
- `AuthClient.refreshToken(request)`

### WebAuthn
- `AuthClient.registerPasskeyStart(request)`
- `AuthClient.registerPasskeyComplete(request)`
- `AuthClient.authenticatePasskeyStart(request)`
- `AuthClient.authenticatePasskeyComplete(request)`
- `AuthClient.listPasskeys(userId, tenantId)`
- `AuthClient.deletePasskey(credentialId, userId)`

### MFA
- `AuthClient.mfaChallenge(request)`
- `AuthClient.mfaVerify(request)`

### Federation
- `AuthClient.federateSAML(request)`
- `AuthClient.federateOIDC(request)`

### Service Tokens
- `requestServiceToken(config)` - Get service-to-service token
- `getServiceAuthHeader(config)` - Get ready-to-use auth header

### Risk-Based Authentication
- `AuthClient.evaluateRisk(input)` - Evaluate authentication risk score
- `AuthClient.createRiskPolicy(policy, tenantId?)` - Create risk policy
- `AuthClient.listRiskPolicies(tenantId?)` - List risk policies
- `AuthClient.reportThreatSignal(signal)` - Report threat signal
- `AuthClient.getUserRiskSignals(userId, options?)` - Get user risk signals
- `AuthClient.getRiskStats(tenantId?)` - Get risk statistics

### Federated Audit
- `AuthClient.queryFederatedAudit(query, tenantId?)` - Query federated audit events
- `AuthClient.createFederatedAuditReport(report, tenantId?)` - Generate compliance report
- `AuthClient.listFederatedAuditReports(options?)` - List reports
- `AuthClient.getFederatedAuditReport(reportId, tenantId?)` - Get specific report
- `AuthClient.getCrossTenantActivity(hours?)` - Cross-tenant activity

### Utilities
- `toNistAlgorithmName(algorithm)` - Convert internal to NIST name
- `ALGORITHM_TO_NIST` - Algorithm name mapping
