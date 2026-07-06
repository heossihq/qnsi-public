---
title: API Reference
version: 0.1.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
---

# QNSI API Reference

This document provides a curated reference for the core QNSI service APIs. All endpoints require authentication unless otherwise noted. See [Authentication](./authentication.md) for details.

For an exhaustive, auto-generated list of every registered endpoint derived directly from the service source code, see the [API Route Catalog](./route-catalog.md).

## Table of Contents

- [API Route Catalog](./route-catalog.md)
- [Auth Service](#auth-service)
- [Access Control Service](#access-control-service)
- [KMS Service](#kms-service)
- [Vault Service](#vault-service)
- [Storage Service](#storage-service)
- [Observability Service](#observability-service)
- [Security Monitoring Service](#security-monitoring-service)
- [Crypto Inventory Service](#crypto-inventory-service)
- [AI Orchestrator](#ai-orchestrator)
- [Tenant Service](#tenant-service)
- [Search Service](#search-service)
- [Billing Service](#billing-service)
- [Audit Service](#audit-service)

---

## Auth Service

Base path: `/auth`

### Risk-Based Authentication

#### POST /auth/risk/evaluate

Evaluate authentication risk score for a login attempt.

**Authentication:** Bearer token required  
**Required Controls:** `audit`, `metering`  
**Billable Operation:** `auth.risk_evaluation`

**Request Body:**
```json
{
  "userId": "string",
  "ipAddress": "string",
  "userAgent": "string",
  "geoLocation": {
    "country": "string",
    "city": "string",
    "latitude": "number",
    "longitude": "number"
  },
  "deviceFingerprint": "string",
  "sessionContext": {
    "previousLoginAt": "string (ISO 8601)",
    "failedAttempts": "number"
  }
}
```

**Response (200):**
```json
{
  "riskScore": "number (0-100)",
  "riskLevel": "low | medium | high | critical",
  "factors": [
    {
      "name": "string",
      "score": "number",
      "reason": "string"
    }
  ],
  "recommendation": "allow | challenge | deny",
  "challengeType": "mfa | captcha | email_verification | null"
}
```

#### POST /auth/risk/policies

Create a risk-based authentication policy.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "conditions": {
    "riskScoreThreshold": "number",
    "geoRestrictions": ["string"],
    "timeRestrictions": {
      "allowedHours": { "start": "number", "end": "number" },
      "timezone": "string"
    }
  },
  "actions": {
    "onHighRisk": "challenge | deny",
    "challengeType": "mfa | captcha | email_verification"
  },
  "enabled": "boolean"
}
```

**Response (201):**
```json
{
  "policyId": "string (UUID)",
  "name": "string",
  "createdAt": "string (ISO 8601)",
  "enabled": "boolean"
}
```

#### GET /auth/risk/policies

List all risk policies for the tenant.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results (default: 50) |
| `offset` | number | Pagination offset |
| `enabled` | boolean | Filter by enabled status |

**Response (200):**
```json
{
  "policies": [
    {
      "policyId": "string",
      "name": "string",
      "enabled": "boolean",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ],
  "total": "number",
  "limit": "number",
  "offset": "number"
}
```

#### POST /auth/risk/signals

Report a threat signal for risk analysis.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Request Body:**
```json
{
  "userId": "string",
  "signalType": "suspicious_login | credential_stuffing | brute_force | impossible_travel | new_device",
  "severity": "low | medium | high | critical",
  "metadata": {
    "ipAddress": "string",
    "userAgent": "string",
    "details": "object"
  }
}
```

**Response (201):**
```json
{
  "signalId": "string",
  "recordedAt": "string (ISO 8601)"
}
```

#### GET /auth/risk/users/:userId/signals

Get risk signals for a specific user.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | User UUID |

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `since` | string | ISO 8601 timestamp |
| `limit` | number | Max results |

**Response (200):**
```json
{
  "signals": [
    {
      "signalId": "string",
      "signalType": "string",
      "severity": "string",
      "recordedAt": "string",
      "metadata": "object"
    }
  ],
  "total": "number"
}
```

#### GET /auth/risk/stats

Get risk statistics for the tenant.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | `1h`, `24h`, `7d`, `30d` |

**Response (200):**
```json
{
  "period": "string",
  "totalEvaluations": "number",
  "riskDistribution": {
    "low": "number",
    "medium": "number",
    "high": "number",
    "critical": "number"
  },
  "topRiskFactors": [
    { "factor": "string", "count": "number" }
  ],
  "challengeRate": "number",
  "denyRate": "number"
}
```

### Federated Audit

#### POST /auth/federation/audit/query

Query federated audit events across identity providers.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "startTime": "string (ISO 8601)",
  "endTime": "string (ISO 8601)",
  "eventTypes": ["login", "logout", "token_refresh", "mfa_challenge"],
  "providers": ["string"],
  "userIds": ["string"],
  "limit": "number",
  "cursor": "string"
}
```

**Response (200):**
```json
{
  "events": [
    {
      "eventId": "string",
      "eventType": "string",
      "provider": "string",
      "userId": "string",
      "timestamp": "string",
      "metadata": "object",
      "outcome": "success | failure"
    }
  ],
  "nextCursor": "string | null",
  "total": "number"
}
```

#### POST /auth/federation/audit/reports

Generate a federation compliance report.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "reportType": "compliance | activity | security",
  "startDate": "string (ISO 8601)",
  "endDate": "string (ISO 8601)",
  "providers": ["string"],
  "format": "json | pdf | csv"
}
```

**Response (202):**
```json
{
  "reportId": "string",
  "status": "pending",
  "estimatedCompletionAt": "string (ISO 8601)"
}
```

#### GET /auth/federation/audit/reports

List federation audit reports.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "reports": [
    {
      "reportId": "string",
      "reportType": "string",
      "status": "pending | completed | failed",
      "createdAt": "string",
      "completedAt": "string | null"
    }
  ]
}
```

#### GET /auth/federation/audit/reports/:reportId

Get a specific federation audit report.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "reportId": "string",
  "reportType": "string",
  "status": "string",
  "data": "object | null",
  "downloadUrl": "string | null",
  "createdAt": "string",
  "completedAt": "string | null"
}
```

#### GET /auth/federation/audit/cross-tenant

Get cross-tenant federation activity.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | Time period |
| `tenantIds` | string[] | Filter by tenant IDs |

**Response (200):**
```json
{
  "activity": [
    {
      "sourceTenantId": "string",
      "targetTenantId": "string",
      "eventCount": "number",
      "lastActivityAt": "string"
    }
  ]
}
```

#### POST /auth/federation/audit/events

Log a federation audit event.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Request Body:**
```json
{
  "eventType": "string",
  "provider": "string",
  "userId": "string",
  "outcome": "success | failure",
  "metadata": "object"
}
```

**Response (201):**
```json
{
  "eventId": "string",
  "recordedAt": "string"
}
```

---

## Access Control Service

Base path: `/access/v1`

### Policy Simulation

#### POST /access/v1/simulate

Simulate a policy access request without making actual changes.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Request Body:**
```json
{
  "principal": {
    "type": "user | service | group",
    "id": "string"
  },
  "resource": {
    "type": "string",
    "id": "string",
    "attributes": "object"
  },
  "action": "string",
  "context": {
    "environment": "object",
    "timestamp": "string (ISO 8601)"
  }
}
```

**Response (200):**
```json
{
  "decision": "allow | deny",
  "reasons": [
    {
      "policyId": "string",
      "policyName": "string",
      "effect": "allow | deny",
      "matchedConditions": ["string"]
    }
  ],
  "effectivePolicies": ["string"],
  "simulatedAt": "string"
}
```

#### POST /access/v1/simulate/batch

Batch simulate multiple policy requests.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Request Body:**
```json
{
  "requests": [
    {
      "requestId": "string",
      "principal": { "type": "string", "id": "string" },
      "resource": { "type": "string", "id": "string" },
      "action": "string"
    }
  ]
}
```

**Response (200):**
```json
{
  "results": [
    {
      "requestId": "string",
      "decision": "allow | deny",
      "reasons": ["object"]
    }
  ],
  "summary": {
    "total": "number",
    "allowed": "number",
    "denied": "number"
  }
}
```

#### POST /access/v1/simulate/impact

Analyze the impact of a policy change before applying it.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Billable Operation:** `access.policy_simulation`

**Request Body:**
```json
{
  "policyChange": {
    "type": "create | update | delete",
    "policyId": "string | null",
    "newPolicy": {
      "name": "string",
      "effect": "allow | deny",
      "principals": ["string"],
      "resources": ["string"],
      "actions": ["string"],
      "conditions": "object"
    }
  },
  "sampleSize": "number"
}
```

**Response (200):**
```json
{
  "impactSummary": {
    "affectedPrincipals": "number",
    "affectedResources": "number",
    "permissionsGranted": "number",
    "permissionsRevoked": "number"
  },
  "samples": [
    {
      "principal": "string",
      "resource": "string",
      "action": "string",
      "currentDecision": "allow | deny",
      "newDecision": "allow | deny"
    }
  ],
  "warnings": ["string"],
  "analysisId": "string"
}
```

#### GET /access/v1/simulate/history

Get simulation history.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results |
| `offset` | number | Pagination offset |
| `since` | string | ISO 8601 timestamp |

**Response (200):**
```json
{
  "simulations": [
    {
      "simulationId": "string",
      "type": "single | batch | impact",
      "requestedBy": "string",
      "requestedAt": "string",
      "summary": "object"
    }
  ],
  "total": "number"
}
```

### Just-In-Time (JIT) Access

#### POST /access/v1/jit/requests

Request just-in-time elevated access.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`, `metering`  
**Billable Operation:** `access.jit_request`

**Request Body:**
```json
{
  "resourceType": "string",
  "resourceId": "string",
  "permissions": ["string"],
  "justification": "string",
  "duration": "number (minutes)",
  "ticketReference": "string | null"
}
```

**Response (201):**
```json
{
  "requestId": "string",
  "status": "pending | approved | denied",
  "requestedAt": "string",
  "expiresAt": "string | null",
  "approvers": ["string"]
}
```

#### GET /access/v1/jit/requests

List JIT access requests.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `requesterId` | string | Filter by requester |
| `limit` | number | Max results |
| `offset` | number | Pagination offset |

**Response (200):**
```json
{
  "requests": [
    {
      "requestId": "string",
      "requesterId": "string",
      "resourceType": "string",
      "resourceId": "string",
      "status": "string",
      "requestedAt": "string"
    }
  ],
  "total": "number"
}
```

#### POST /access/v1/jit/requests/:requestId/process

Approve or deny a JIT access request.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `requestId` | string | Request UUID |

**Request Body:**
```json
{
  "decision": "approve | deny",
  "reason": "string",
  "modifiedDuration": "number | null"
}
```

**Response (200):**
```json
{
  "requestId": "string",
  "status": "approved | denied",
  "processedBy": "string",
  "processedAt": "string",
  "grantId": "string | null"
}
```

#### GET /access/v1/jit/grants/user/:userId

Get active JIT grants for a user.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Response (200):**
```json
{
  "grants": [
    {
      "grantId": "string",
      "resourceType": "string",
      "resourceId": "string",
      "permissions": ["string"],
      "grantedAt": "string",
      "expiresAt": "string"
    }
  ]
}
```

#### POST /access/v1/jit/check

Check if a principal has active JIT access.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Request Body:**
```json
{
  "principalId": "string",
  "resourceType": "string",
  "resourceId": "string",
  "permission": "string"
}
```

**Response (200):**
```json
{
  "hasAccess": "boolean",
  "grantId": "string | null",
  "expiresAt": "string | null"
}
```

#### POST /access/v1/jit/grants/:grantId/revoke

Revoke an active JIT grant.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "reason": "string"
}
```

**Response (200):**
```json
{
  "grantId": "string",
  "revokedAt": "string",
  "revokedBy": "string"
}
```

#### POST /access/v1/jit/policies

Create a JIT access policy.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "resourceTypes": ["string"],
  "maxDuration": "number (minutes)",
  "requireApproval": "boolean",
  "approverRoles": ["string"],
  "autoApproveConditions": {
    "timeWindow": { "start": "string", "end": "string" },
    "maxRiskScore": "number"
  }
}
```

**Response (201):**
```json
{
  "policyId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### GET /access/v1/jit/policies

List JIT policies.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Response (200):**
```json
{
  "policies": [
    {
      "policyId": "string",
      "name": "string",
      "resourceTypes": ["string"],
      "requireApproval": "boolean"
    }
  ]
}
```

#### GET /access/v1/jit/stats

Get JIT access statistics.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Response (200):**
```json
{
  "period": "string",
  "totalRequests": "number",
  "approvedRequests": "number",
  "deniedRequests": "number",
  "averageApprovalTime": "number (seconds)",
  "activeGrants": "number",
  "topResources": [
    { "resourceType": "string", "count": "number" }
  ]
}
```

### Cross-Tenant Analysis

#### POST /access/v1/cross-tenant/overview

Get cross-tenant access overview.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "tenantIds": ["string"],
  "includeMetrics": "boolean"
}
```

**Response (200):**
```json
{
  "tenants": [
    {
      "tenantId": "string",
      "tenantName": "string",
      "userCount": "number",
      "roleCount": "number",
      "policyCount": "number"
    }
  ],
  "crossTenantAccess": [
    {
      "sourceTenant": "string",
      "targetTenant": "string",
      "accessCount": "number"
    }
  ]
}
```

#### POST /access/v1/cross-tenant/compare

Compare access policies across tenants.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "tenantIds": ["string"],
  "comparisonType": "policies | roles | permissions",
  "resourceTypes": ["string"]
}
```

**Response (200):**
```json
{
  "comparison": {
    "commonPolicies": ["string"],
    "uniquePolicies": {
      "<tenantId>": ["string"]
    },
    "differences": [
      {
        "policyName": "string",
        "tenantDiffs": "object"
      }
    ]
  }
}
```

#### POST /access/v1/cross-tenant/anomalies

Query access anomalies across tenants.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "tenantIds": ["string"],
  "anomalyTypes": ["unusual_access", "policy_drift", "privilege_escalation"],
  "severity": "low | medium | high | critical",
  "since": "string (ISO 8601)"
}
```

**Response (200):**
```json
{
  "anomalies": [
    {
      "anomalyId": "string",
      "tenantId": "string",
      "type": "string",
      "severity": "string",
      "description": "string",
      "detectedAt": "string",
      "affectedResources": ["string"]
    }
  ],
  "total": "number"
}
```

#### GET /access/v1/cross-tenant/graph

Get cross-tenant access graph visualization data.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "nodes": [
    {
      "id": "string",
      "type": "tenant | user | resource",
      "label": "string",
      "metadata": "object"
    }
  ],
  "edges": [
    {
      "source": "string",
      "target": "string",
      "type": "access | membership",
      "weight": "number"
    }
  ]
}
```

#### GET /access/v1/cross-tenant/isolation-audit

Run tenant isolation audit.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "auditId": "string",
  "status": "passed | failed | warning",
  "checks": [
    {
      "checkName": "string",
      "status": "passed | failed",
      "details": "string"
    }
  ],
  "violations": [
    {
      "type": "string",
      "severity": "string",
      "description": "string",
      "remediation": "string"
    }
  ],
  "auditedAt": "string"
}
```

---

## KMS Service

Base path: `/kms/v1`

### Key Usage Analytics

#### GET /kms/v1/analytics/usage

Query key usage analytics over time.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `keyId` | string | Filter by key ID |
| `operation` | string | Filter by operation type |
| `startTime` | string | ISO 8601 start time |
| `endTime` | string | ISO 8601 end time |
| `granularity` | string | `hour`, `day`, `week` |

**Response (200):**
```json
{
  "usage": [
    {
      "timestamp": "string",
      "keyId": "string",
      "operation": "encrypt | decrypt | sign | verify",
      "count": "number",
      "bytesProcessed": "number"
    }
  ],
  "summary": {
    "totalOperations": "number",
    "totalBytesProcessed": "number",
    "uniqueKeys": "number"
  }
}
```

#### GET /kms/v1/analytics/applications

List applications consuming keys.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "applications": [
    {
      "applicationId": "string",
      "applicationName": "string",
      "keysUsed": "number",
      "lastAccessAt": "string",
      "operationCounts": {
        "encrypt": "number",
        "decrypt": "number",
        "sign": "number",
        "verify": "number"
      }
    }
  ]
}
```

#### GET /kms/v1/analytics/keys/:keyId/summary

Get usage summary for a specific key.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "keyId": "string",
  "keyName": "string",
  "algorithm": "string",
  "totalOperations": "number",
  "operationBreakdown": {
    "encrypt": "number",
    "decrypt": "number",
    "sign": "number",
    "verify": "number"
  },
  "topApplications": [
    { "applicationId": "string", "count": "number" }
  ],
  "lastUsedAt": "string"
}
```

#### POST /kms/v1/analytics/applications/record

Record application usage of a key.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "applicationId": "string",
  "keyId": "string",
  "operation": "encrypt | decrypt | sign | verify",
  "bytesProcessed": "number"
}
```

**Response (201):**
```json
{
  "recorded": true,
  "timestamp": "string"
}
```

#### GET /kms/v1/analytics/alerts

List usage alerts.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "alerts": [
    {
      "alertId": "string",
      "ruleId": "string",
      "keyId": "string",
      "alertType": "threshold_exceeded | unusual_pattern | compliance_violation",
      "severity": "low | medium | high | critical",
      "message": "string",
      "triggeredAt": "string",
      "acknowledged": "boolean"
    }
  ]
}
```

#### POST /kms/v1/analytics/alerts/:alertId/acknowledge

Acknowledge a usage alert.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "alertId": "string",
  "acknowledgedAt": "string",
  "acknowledgedBy": "string"
}
```

#### POST /kms/v1/analytics/alert-rules

Create a usage alert rule.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "keyIds": ["string"],
  "condition": {
    "metric": "operation_count | bytes_processed | error_rate",
    "operator": "gt | lt | eq",
    "threshold": "number",
    "window": "string (e.g., 1h, 24h)"
  },
  "severity": "low | medium | high | critical",
  "notificationChannels": ["string"]
}
```

**Response (201):**
```json
{
  "ruleId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### GET /kms/v1/analytics/alert-rules

List usage alert rules.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "rules": [
    {
      "ruleId": "string",
      "name": "string",
      "condition": "object",
      "severity": "string",
      "enabled": "boolean"
    }
  ]
}
```

#### PATCH /kms/v1/analytics/alert-rules/:ruleId

Update a usage alert rule.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "condition": "object",
  "severity": "string",
  "enabled": "boolean"
}
```

**Response (200):**
```json
{
  "ruleId": "string",
  "updatedAt": "string"
}
```

#### DELETE /kms/v1/analytics/alert-rules/:ruleId

Delete a usage alert rule.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (204):** No content

### Bring Your Own HSM (BYOHSM)

**Note:** These endpoints require the `byohsm` add-on.

#### POST /kms/v1/byohsm/connections

Register an external HSM connection.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `byohsm`

**Request Body:**
```json
{
  "name": "string",
  "provider": "thales | safenet | aws_cloudhsm | azure_managed_hsm | google_cloud_hsm",
  "connectionConfig": {
    "endpoint": "string",
    "port": "number",
    "credentials": {
      "type": "certificate | api_key | managed_identity",
      "data": "object"
    }
  },
  "metadata": {
    "location": "string",
    "purpose": "string"
  }
}
```

**Response (201):**
```json
{
  "connectionId": "string",
  "name": "string",
  "provider": "string",
  "status": "pending_validation",
  "createdAt": "string"
}
```

#### GET /kms/v1/byohsm/connections

List HSM connections.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `byohsm`

**Response (200):**
```json
{
  "connections": [
    {
      "connectionId": "string",
      "name": "string",
      "provider": "string",
      "status": "active | inactive | error",
      "lastHealthCheckAt": "string"
    }
  ]
}
```

#### GET /kms/v1/byohsm/connections/:connectionId

Get HSM connection details.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `byohsm`

**Response (200):**
```json
{
  "connectionId": "string",
  "name": "string",
  "provider": "string",
  "status": "string",
  "connectionConfig": {
    "endpoint": "string",
    "port": "number"
  },
  "healthMetrics": {
    "latencyMs": "number",
    "errorRate": "number",
    "lastSuccessfulOperation": "string"
  },
  "createdAt": "string",
  "updatedAt": "string"
}
```

#### PATCH /kms/v1/byohsm/connections/:connectionId

Update an HSM connection.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `byohsm`

**Request Body:**
```json
{
  "name": "string",
  "connectionConfig": "object",
  "metadata": "object"
}
```

**Response (200):**
```json
{
  "connectionId": "string",
  "updatedAt": "string"
}
```

#### DELETE /kms/v1/byohsm/connections/:connectionId

Delete an HSM connection.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `byohsm`

**Response (204):** No content

#### POST /kms/v1/byohsm/connections/:connectionId/validate

Validate an HSM connection.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `byohsm`

**Response (200):**
```json
{
  "connectionId": "string",
  "valid": "boolean",
  "validatedAt": "string",
  "details": {
    "connectivity": "boolean",
    "authentication": "boolean",
    "capabilities": ["string"]
  },
  "errors": ["string"]
}
```

#### POST /kms/v1/byohsm/keys

Create a key on external HSM.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `quota`, `audit`, `metering`  
**Required Add-on:** `byohsm`  
**Billable Operation:** `kms.hsm.key.create`

**Request Body:**
```json
{
  "connectionId": "string",
  "keyType": "aes | rsa | ec | pqc",
  "keySize": "number",
  "algorithm": "string",
  "purpose": ["encrypt", "decrypt", "sign", "verify"],
  "metadata": {
    "name": "string",
    "description": "string"
  }
}
```

**Response (201):**
```json
{
  "keyId": "string",
  "connectionId": "string",
  "keyType": "string",
  "algorithm": "string",
  "createdAt": "string"
}
```

#### GET /kms/v1/byohsm/keys

List keys on external HSMs.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `byohsm`

**Response (200):**
```json
{
  "keys": [
    {
      "keyId": "string",
      "connectionId": "string",
      "keyType": "string",
      "algorithm": "string",
      "purpose": ["string"],
      "createdAt": "string"
    }
  ]
}
```

#### POST /kms/v1/byohsm/wrap

Wrap a key using external HSM.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `quota`, `audit`, `metering`  
**Required Add-on:** `byohsm`  
**Billable Operation:** `kms.hsm.wrap`

**Request Body:**
```json
{
  "wrappingKeyId": "string",
  "keyToWrap": "string (base64)",
  "algorithm": "string"
}
```

**Response (200):**
```json
{
  "wrappedKey": "string (base64)",
  "wrappingKeyId": "string",
  "algorithm": "string"
}
```

#### POST /kms/v1/byohsm/unwrap

Unwrap a key using external HSM.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `quota`, `audit`, `metering`  
**Required Add-on:** `byohsm`  
**Billable Operation:** `kms.hsm.unwrap`

**Request Body:**
```json
{
  "unwrappingKeyId": "string",
  "wrappedKey": "string (base64)",
  "algorithm": "string"
}
```

**Response (200):**
```json
{
  "unwrappedKey": "string (base64)"
}
```

#### POST /kms/v1/byohsm/sign

Sign data using external HSM.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `quota`, `audit`, `metering`  
**Required Add-on:** `byohsm`  
**Billable Operation:** `kms.hsm.sign`

**Request Body:**
```json
{
  "keyId": "string",
  "data": "string (base64)",
  "algorithm": "string"
}
```

**Response (200):**
```json
{
  "signature": "string (base64)",
  "keyId": "string",
  "algorithm": "string"
}
```

#### POST /kms/v1/byohsm/verify

Verify signature using external HSM.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `byohsm`

**Request Body:**
```json
{
  "keyId": "string",
  "data": "string (base64)",
  "signature": "string (base64)",
  "algorithm": "string"
}
```

**Response (200):**
```json
{
  "valid": "boolean",
  "keyId": "string"
}
```

#### GET /kms/v1/byohsm/connections/:connectionId/operations

List operations on an HSM connection.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `byohsm`

**Response (200):**
```json
{
  "operations": [
    {
      "operationId": "string",
      "type": "string",
      "keyId": "string",
      "timestamp": "string",
      "status": "success | failure",
      "latencyMs": "number"
    }
  ]
}
```

### Key Escrow

**Note:** These endpoints require the `key-escrow` add-on.

#### POST /kms/v1/escrow/policies

Create a key escrow policy.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `key-escrow`

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "keyTypes": ["string"],
  "escrowAgents": [
    {
      "agentId": "string",
      "role": "primary | secondary | witness"
    }
  ],
  "recoveryThreshold": "number",
  "retentionPeriod": "string (ISO 8601 duration)"
}
```

**Response (201):**
```json
{
  "policyId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### GET /kms/v1/escrow/policies

List key escrow policies.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `key-escrow`

**Response (200):**
```json
{
  "policies": [
    {
      "policyId": "string",
      "name": "string",
      "keyTypes": ["string"],
      "recoveryThreshold": "number"
    }
  ]
}
```

#### GET /kms/v1/escrow/policies/:policyId

Get key escrow policy details.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `key-escrow`

**Response (200):**
```json
{
  "policyId": "string",
  "name": "string",
  "description": "string",
  "keyTypes": ["string"],
  "escrowAgents": ["object"],
  "recoveryThreshold": "number",
  "retentionPeriod": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

#### PATCH /kms/v1/escrow/policies/:policyId

Update a key escrow policy.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `key-escrow`

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "escrowAgents": ["object"],
  "recoveryThreshold": "number"
}
```

**Response (200):**
```json
{
  "policyId": "string",
  "updatedAt": "string"
}
```

#### POST /kms/v1/escrow/keys

Create a key escrow.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `quota`, `audit`, `metering`  
**Required Add-on:** `key-escrow`  
**Billable Operation:** `kms.escrow.create`

**Request Body:**
```json
{
  "keyId": "string",
  "policyId": "string",
  "metadata": {
    "reason": "string",
    "expiresAt": "string (ISO 8601)"
  }
}
```

**Response (201):**
```json
{
  "escrowId": "string",
  "keyId": "string",
  "policyId": "string",
  "status": "active",
  "createdAt": "string"
}
```

#### GET /kms/v1/escrow/keys

List escrowed keys.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `key-escrow`

**Response (200):**
```json
{
  "escrowedKeys": [
    {
      "escrowId": "string",
      "keyId": "string",
      "policyId": "string",
      "status": "active | recovered | expired",
      "createdAt": "string"
    }
  ]
}
```

#### POST /kms/v1/escrow/recovery/initiate

Initiate key recovery from escrow.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `key-escrow`

**Request Body:**
```json
{
  "escrowId": "string",
  "reason": "string",
  "urgency": "normal | urgent | emergency"
}
```

**Response (201):**
```json
{
  "requestId": "string",
  "escrowId": "string",
  "status": "pending_shares",
  "requiredShares": "number",
  "submittedShares": "number",
  "createdAt": "string"
}
```

#### POST /kms/v1/escrow/recovery/submit-share

Submit a recovery share.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `key-escrow`

**Request Body:**
```json
{
  "requestId": "string",
  "share": "string (base64)",
  "agentId": "string"
}
```

**Response (200):**
```json
{
  "requestId": "string",
  "submittedShares": "number",
  "requiredShares": "number",
  "status": "pending_shares | ready_for_approval | approved"
}
```

#### POST /kms/v1/escrow/recovery/approve

Approve a key recovery request.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `key-escrow`

**Request Body:**
```json
{
  "requestId": "string",
  "decision": "approve | deny",
  "reason": "string"
}
```

**Response (200):**
```json
{
  "requestId": "string",
  "status": "approved | denied",
  "decidedBy": "string",
  "decidedAt": "string"
}
```

#### POST /kms/v1/escrow/recovery/execute

Execute key recovery.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `quota`, `audit`, `metering`  
**Required Add-on:** `key-escrow`  
**Billable Operation:** `kms.escrow.recover`

**Request Body:**
```json
{
  "requestId": "string"
}
```

**Response (200):**
```json
{
  "requestId": "string",
  "keyId": "string",
  "recoveredKey": "string (base64)",
  "recoveredAt": "string"
}
```

#### GET /kms/v1/escrow/recovery/:requestId

Get recovery request details.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `key-escrow`

**Response (200):**
```json
{
  "requestId": "string",
  "escrowId": "string",
  "status": "string",
  "requiredShares": "number",
  "submittedShares": "number",
  "approvals": ["object"],
  "createdAt": "string"
}
```

#### GET /kms/v1/escrow/audit

Query escrow audit log.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`  
**Required Add-on:** `key-escrow`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `escrowId` | string | Filter by escrow ID |
| `eventType` | string | Filter by event type |
| `since` | string | ISO 8601 timestamp |

**Response (200):**
```json
{
  "events": [
    {
      "eventId": "string",
      "escrowId": "string",
      "eventType": "created | share_submitted | approved | recovered",
      "actor": "string",
      "timestamp": "string",
      "details": "object"
    }
  ]
}
```

### Crypto Agility

#### GET /kms/v1/crypto-agility/algorithm-usage

Get algorithm usage report.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "algorithms": [
    {
      "algorithm": "string",
      "category": "encryption | signing | key_exchange | hash",
      "usageCount": "number",
      "keyCount": "number",
      "lastUsedAt": "string",
      "status": "recommended | acceptable | deprecated | forbidden"
    }
  ],
  "summary": {
    "pqcAdoptionRate": "number",
    "legacyAlgorithmUsage": "number"
  }
}
```

#### GET /kms/v1/crypto-agility/migration-readiness

Assess PQC migration readiness.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "overallScore": "number (0-100)",
  "categories": [
    {
      "category": "string",
      "score": "number",
      "status": "ready | partial | not_ready",
      "blockers": ["string"],
      "recommendations": ["string"]
    }
  ],
  "keyMigrationStatus": {
    "total": "number",
    "migrated": "number",
    "pendingMigration": "number",
    "blocked": "number"
  }
}
```

#### GET /kms/v1/crypto-agility/pqc-adoption

Get PQC adoption metrics and trends.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "currentAdoption": {
    "pqcKeys": "number",
    "totalKeys": "number",
    "adoptionRate": "number"
  },
  "trends": [
    {
      "date": "string",
      "pqcOperations": "number",
      "classicalOperations": "number"
    }
  ],
  "byAlgorithm": {
    "ML-KEM-768": "number",
    "ML-DSA-65": "number"
  }
}
```

#### GET /kms/v1/crypto-agility/compliance

Generate cryptographic compliance report.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `framework` | string | Compliance framework (NIST, FIPS, etc.) |

**Response (200):**
```json
{
  "framework": "string",
  "complianceStatus": "compliant | partial | non_compliant",
  "score": "number",
  "controls": [
    {
      "controlId": "string",
      "name": "string",
      "status": "passed | failed | not_applicable",
      "findings": ["string"]
    }
  ],
  "generatedAt": "string"
}
```

#### POST /kms/v1/crypto-agility/migration-plans

Create a migration plan.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "targetAlgorithms": {
    "encryption": "string",
    "signing": "string",
    "keyExchange": "string"
  },
  "scope": {
    "keyIds": ["string"],
    "keyTypes": ["string"]
  },
  "schedule": {
    "startDate": "string (ISO 8601)",
    "phases": [
      {
        "name": "string",
        "duration": "string",
        "actions": ["string"]
      }
    ]
  }
}
```

**Response (201):**
```json
{
  "planId": "string",
  "name": "string",
  "status": "draft",
  "createdAt": "string"
}
```

#### GET /kms/v1/crypto-agility/migration-plans

List migration plans.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "plans": [
    {
      "planId": "string",
      "name": "string",
      "status": "draft | active | completed | cancelled",
      "progress": "number",
      "createdAt": "string"
    }
  ]
}
```

#### GET /kms/v1/crypto-agility/migration-plans/:planId

Get migration plan details.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "planId": "string",
  "name": "string",
  "description": "string",
  "status": "string",
  "targetAlgorithms": "object",
  "scope": "object",
  "schedule": "object",
  "progress": {
    "keysTotal": "number",
    "keysMigrated": "number",
    "currentPhase": "string"
  },
  "createdAt": "string",
  "updatedAt": "string"
}
```

#### PATCH /kms/v1/crypto-agility/migration-plans/:planId

Update a migration plan.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "status": "active | paused | cancelled",
  "schedule": "object"
}
```

**Response (200):**
```json
{
  "planId": "string",
  "updatedAt": "string"
}
```

#### GET /kms/v1/crypto-agility/risk-assessment

Get quantum risk assessment for algorithms.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "overallRisk": "low | medium | high | critical",
  "algorithms": [
    {
      "algorithm": "string",
      "quantumRisk": "low | medium | high | critical",
      "timeToQuantumThreat": "string",
      "recommendation": "string",
      "affectedKeys": "number"
    }
  ],
  "assessment": {
    "harvestNowDecryptLater": "boolean",
    "longTermDataProtection": "boolean"
  }
}
```

---

## Vault Service

Base path: `/vault/v1`

### Dynamic Secrets

#### POST /v1/dynamic-secrets/configs

Create a dynamic secret configuration.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "type": "database | cloud_credentials | api_key | certificate",
  "backend": {
    "type": "postgres | mysql | mongodb | aws | azure | gcp",
    "connectionString": "string",
    "credentials": "object"
  },
  "template": {
    "usernameTemplate": "string",
    "roleTemplate": "string"
  },
  "ttl": {
    "default": "string (ISO 8601 duration)",
    "max": "string (ISO 8601 duration)"
  }
}
```

**Response (201):**
```json
{
  "configId": "string",
  "name": "string",
  "type": "string",
  "createdAt": "string"
}
```

#### GET /v1/dynamic-secrets/configs

List dynamic secret configurations.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "configs": [
    {
      "configId": "string",
      "name": "string",
      "type": "string",
      "backend": "string",
      "activeLeases": "number"
    }
  ]
}
```

#### POST /v1/dynamic-secrets/configs/:configId/credentials

Generate dynamic credentials.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `quota`, `audit`, `metering`  
**Billable Operation:** `vault.dynamic_secret_generate`

**Request Body:**
```json
{
  "ttl": "string (ISO 8601 duration)",
  "metadata": {
    "purpose": "string",
    "requestedBy": "string"
  }
}
```

**Response (200):**
```json
{
  "leaseId": "string",
  "credentials": {
    "username": "string",
    "password": "string"
  },
  "expiresAt": "string",
  "renewable": "boolean"
}
```

#### GET /v1/dynamic-secrets/configs/:configId/leases

List dynamic secret leases.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "leases": [
    {
      "leaseId": "string",
      "createdAt": "string",
      "expiresAt": "string",
      "status": "active | expired | revoked"
    }
  ]
}
```

#### POST /v1/dynamic-secrets/leases/:leaseId/renew

Renew dynamic secret lease.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "ttl": "string (ISO 8601 duration)"
}
```

**Response (200):**
```json
{
  "leaseId": "string",
  "expiresAt": "string"
}
```

#### POST /v1/dynamic-secrets/leases/:leaseId/revoke

Revoke dynamic secret lease.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "leaseId": "string",
  "revokedAt": "string"
}
```

#### GET /v1/dynamic-secrets/stats

Get dynamic secrets statistics.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "totalConfigs": "number",
  "activeLeases": "number",
  "expiredLeases": "number",
  "revokedLeases": "number",
  "byType": {
    "database": "number",
    "cloud_credentials": "number"
  }
}
```

### Leakage Detection

#### POST /v1/leakage-detection/policies

Create leakage detection policy.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "secretPatterns": [
    {
      "type": "regex | keyword | entropy",
      "pattern": "string",
      "severity": "low | medium | high | critical"
    }
  ],
  "scanTargets": ["github", "gitlab", "pastebin", "s3"],
  "actions": {
    "onDetection": "alert | rotate | revoke",
    "notificationChannels": ["string"]
  }
}
```

**Response (201):**
```json
{
  "policyId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### GET /v1/leakage-detection/policies

List leakage detection policies.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "policies": [
    {
      "policyId": "string",
      "name": "string",
      "enabled": "boolean",
      "secretPatterns": "number"
    }
  ]
}
```

#### GET /v1/leakage-detection/policies/:policyId

Get leakage detection policy.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "policyId": "string",
  "name": "string",
  "description": "string",
  "secretPatterns": ["object"],
  "scanTargets": ["string"],
  "actions": "object",
  "createdAt": "string"
}
```

#### DELETE /v1/leakage-detection/policies/:policyId

Delete leakage detection policy.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (204):** No content

#### POST /v1/leakage-detection/incidents

Report leakage incident.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "secretId": "string",
  "source": "string",
  "location": "string",
  "detectedAt": "string (ISO 8601)",
  "severity": "low | medium | high | critical",
  "details": "object"
}
```

**Response (201):**
```json
{
  "incidentId": "string",
  "status": "open",
  "createdAt": "string"
}
```

#### GET /v1/leakage-detection/incidents

List leakage incidents.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `severity` | string | Filter by severity |
| `since` | string | ISO 8601 timestamp |

**Response (200):**
```json
{
  "incidents": [
    {
      "incidentId": "string",
      "secretId": "string",
      "source": "string",
      "severity": "string",
      "status": "open | investigating | resolved | false_positive",
      "detectedAt": "string"
    }
  ]
}
```

#### GET /v1/leakage-detection/incidents/:incidentId

Get leakage incident.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "incidentId": "string",
  "secretId": "string",
  "source": "string",
  "location": "string",
  "severity": "string",
  "status": "string",
  "details": "object",
  "timeline": ["object"],
  "detectedAt": "string"
}
```

#### PATCH /v1/leakage-detection/incidents/:incidentId

Update leakage incident.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "status": "investigating | resolved | false_positive",
  "resolution": "string",
  "notes": "string"
}
```

**Response (200):**
```json
{
  "incidentId": "string",
  "status": "string",
  "updatedAt": "string"
}
```

#### POST /v1/leakage-detection/scan

Trigger leakage detection scan.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `quota`, `audit`, `metering`  
**Billable Operation:** `vault.leakage_scan`

**Request Body:**
```json
{
  "targets": ["github", "gitlab", "pastebin"],
  "scope": {
    "repositories": ["string"],
    "organizations": ["string"]
  },
  "policyIds": ["string"]
}
```

**Response (202):**
```json
{
  "scanId": "string",
  "status": "queued",
  "estimatedCompletionAt": "string"
}
```

#### GET /v1/leakage-detection/scans/:scanId

Get scan status.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "scanId": "string",
  "status": "queued | running | completed | failed",
  "progress": "number",
  "findings": "number",
  "startedAt": "string",
  "completedAt": "string | null"
}
```

#### GET /v1/leakage-detection/stats

Get leakage detection statistics.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "totalIncidents": "number",
  "openIncidents": "number",
  "resolvedIncidents": "number",
  "bySeverity": {
    "critical": "number",
    "high": "number",
    "medium": "number",
    "low": "number"
  },
  "bySource": {
    "github": "number",
    "gitlab": "number"
  }
}
```

#### POST /v1/leakage-detection/secrets/:secretId/check

Check secret for active leakage incidents.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "secretId": "string",
  "hasActiveIncidents": "boolean",
  "incidents": [
    {
      "incidentId": "string",
      "severity": "string",
      "source": "string",
      "detectedAt": "string"
    }
  ]
}
```

### Versioned Secrets

#### POST /v1/versioned-secrets

Create new secret version.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `quota`, `audit`, `metering`  
**Billable Operation:** `vault.secret_version_create`

**Request Body:**
```json
{
  "secretId": "string",
  "value": "string",
  "metadata": {
    "reason": "string",
    "changedBy": "string"
  }
}
```

**Response (201):**
```json
{
  "secretId": "string",
  "version": "number",
  "createdAt": "string"
}
```

#### GET /v1/versioned-secrets/:secretId/history

Get secret version history.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "secretId": "string",
  "versions": [
    {
      "version": "number",
      "state": "active | deprecated | destroyed",
      "createdAt": "string",
      "createdBy": "string",
      "metadata": "object"
    }
  ]
}
```

#### GET /v1/versioned-secrets/:secretId/versions/:version

Get specific secret version.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `quota`, `audit`, `metering`  
**Billable Operation:** `vault.secret_version_read`

**Response (200):**
```json
{
  "secretId": "string",
  "version": "number",
  "value": "string",
  "state": "string",
  "createdAt": "string",
  "metadata": "object"
}
```

#### PATCH /v1/versioned-secrets/:secretId/versions/:version/state

Update secret version state.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "state": "deprecated | destroyed",
  "reason": "string"
}
```

**Response (200):**
```json
{
  "secretId": "string",
  "version": "number",
  "state": "string",
  "updatedAt": "string"
}
```

#### POST /v1/versioned-secrets/:secretId/rollback

Rollback to previous secret version.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "targetVersion": "number",
  "reason": "string"
}
```

**Response (200):**
```json
{
  "secretId": "string",
  "newVersion": "number",
  "rolledBackFrom": "number",
  "rolledBackTo": "number"
}
```

#### POST /v1/versioned-secrets/:secretId/compare

Compare two secret versions.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Request Body:**
```json
{
  "version1": "number",
  "version2": "number"
}
```

**Response (200):**
```json
{
  "secretId": "string",
  "version1": {
    "version": "number",
    "createdAt": "string",
    "hash": "string"
  },
  "version2": {
    "version": "number",
    "createdAt": "string",
    "hash": "string"
  },
  "different": "boolean"
}
```

#### PUT /v1/versioned-secrets/:secretId/retention-policy

Set secret retention policy.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "maxVersions": "number",
  "deleteAfter": "string (ISO 8601 duration)",
  "autoDestroy": "boolean"
}
```

**Response (200):**
```json
{
  "secretId": "string",
  "retentionPolicy": "object",
  "updatedAt": "string"
}
```

#### GET /v1/versioned-secrets/:secretId/audit

Get secret version audit log.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "secretId": "string",
  "events": [
    {
      "eventId": "string",
      "action": "created | read | deprecated | destroyed | rollback",
      "version": "number",
      "actor": "string",
      "timestamp": "string"
    }
  ]
}
```

#### POST /v1/versioned-secrets/:secretId/enforce-retention

Enforce retention policy on secret versions.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "secretId": "string",
  "versionsDeleted": "number",
  "versionsRetained": "number"
}
```

#### GET /v1/versioned-secrets/stats

Get versioned secrets statistics.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "totalSecrets": "number",
  "totalVersions": "number",
  "averageVersionsPerSecret": "number",
  "byState": {
    "active": "number",
    "deprecated": "number",
    "destroyed": "number"
  }
}
```

---

## Storage Service

Base path: `/storage/v1`

### Data Classification

#### POST /storage/v1/classification/policies

Create data classification policy.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "rules": [
    {
      "pattern": "string (regex)",
      "classification": "public | internal | confidential | restricted",
      "dataTypes": ["pii", "phi", "pci", "custom"]
    }
  ],
  "autoApply": "boolean"
}
```

**Response (201):**
```json
{
  "policyId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### GET /storage/v1/classification/policies

List classification policies.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "policies": [
    {
      "policyId": "string",
      "name": "string",
      "ruleCount": "number",
      "autoApply": "boolean"
    }
  ]
}
```

#### POST /storage/v1/classification/scans

Trigger classification scan.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "scope": {
    "buckets": ["string"],
    "prefixes": ["string"]
  },
  "policyIds": ["string"]
}
```

**Response (202):**
```json
{
  "scanId": "string",
  "status": "queued",
  "estimatedCompletionAt": "string"
}
```

#### GET /storage/v1/classification/stats

Get classification statistics.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "totalObjects": "number",
  "classifiedObjects": "number",
  "byClassification": {
    "public": "number",
    "internal": "number",
    "confidential": "number",
    "restricted": "number"
  },
  "byDataType": {
    "pii": "number",
    "phi": "number",
    "pci": "number"
  }
}
```

### Retention Management

#### POST /storage/v1/retention/policies

Create retention policy.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "retentionPeriod": "string (ISO 8601 duration)",
  "scope": {
    "buckets": ["string"],
    "classifications": ["string"]
  },
  "actions": {
    "onExpiry": "delete | archive | notify"
  }
}
```

**Response (201):**
```json
{
  "policyId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### POST /storage/v1/retention/holds

Create legal hold.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "reason": "string",
  "scope": {
    "objectIds": ["string"],
    "buckets": ["string"]
  },
  "expiresAt": "string (ISO 8601) | null"
}
```

**Response (201):**
```json
{
  "holdId": "string",
  "name": "string",
  "objectsHeld": "number",
  "createdAt": "string"
}
```

#### POST /storage/v1/retention/holds/:holdId/release

Release legal hold.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "holdId": "string",
  "releasedAt": "string",
  "objectsReleased": "number"
}
```

### Replication

#### POST /storage/v1/replication/configurations

Create replication configuration.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "sourceRegion": "string",
  "destinationRegions": ["string"],
  "scope": {
    "buckets": ["string"],
    "prefixes": ["string"]
  },
  "replicationMode": "sync | async",
  "encryptionAtRest": "boolean"
}
```

**Response (201):**
```json
{
  "configId": "string",
  "name": "string",
  "status": "active",
  "createdAt": "string"
}
```

#### GET /storage/v1/replication/status

Get replication status.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "configurations": [
    {
      "configId": "string",
      "name": "string",
      "status": "healthy | degraded | error",
      "lagSeconds": "number",
      "pendingObjects": "number"
    }
  ]
}
```

#### GET /storage/v1/replication/health

Get replication health.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "overallHealth": "healthy | degraded | critical",
  "regions": [
    {
      "region": "string",
      "status": "string",
      "latencyMs": "number",
      "lastSyncAt": "string"
    }
  ]
}
```

---

## Observability Service

Base path: `/observability/v1`

### Cost Allocation

#### POST /observability/v1/costs/allocations

Record cost allocation.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "resourceId": "string",
  "resourceType": "string",
  "costCenter": "string",
  "amount": "number",
  "currency": "string",
  "period": {
    "start": "string (ISO 8601)",
    "end": "string (ISO 8601)"
  },
  "tags": "object"
}
```

**Response (201):**
```json
{
  "allocationId": "string",
  "recorded": true
}
```

#### GET /observability/v1/costs/allocations

Query cost allocations.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `costCenter` | string | Filter by cost center |
| `resourceType` | string | Filter by resource type |
| `startTime` | string | ISO 8601 start time |
| `endTime` | string | ISO 8601 end time |

**Response (200):**
```json
{
  "allocations": [
    {
      "allocationId": "string",
      "resourceId": "string",
      "costCenter": "string",
      "amount": "number",
      "currency": "string",
      "period": "object"
    }
  ],
  "summary": {
    "totalAmount": "number",
    "byCostCenter": "object"
  }
}
```

#### POST /observability/v1/costs/budgets

Create cost budget.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "amount": "number",
  "currency": "string",
  "period": "monthly | quarterly | yearly",
  "scope": {
    "costCenters": ["string"],
    "resourceTypes": ["string"]
  },
  "alerts": [
    {
      "threshold": "number (percentage)",
      "notificationChannels": ["string"]
    }
  ]
}
```

**Response (201):**
```json
{
  "budgetId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### GET /observability/v1/costs/summary

Get cost summary.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "period": "string",
  "totalCost": "number",
  "currency": "string",
  "byService": {
    "kms": "number",
    "vault": "number",
    "storage": "number"
  },
  "trend": {
    "change": "number",
    "direction": "up | down | stable"
  }
}
```

### Anomaly Detection

#### POST /observability/v1/anomaly-detection/rules

Create anomaly detection rule.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "metric": "string",
  "condition": {
    "type": "threshold | deviation | trend",
    "parameters": "object"
  },
  "sensitivity": "low | medium | high",
  "notificationChannels": ["string"]
}
```

**Response (201):**
```json
{
  "ruleId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### GET /observability/v1/anomaly-detection/anomalies

List detected anomalies.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "anomalies": [
    {
      "anomalyId": "string",
      "ruleId": "string",
      "metric": "string",
      "severity": "string",
      "status": "open | acknowledged | resolved",
      "detectedAt": "string"
    }
  ]
}
```

### Custom Dashboards

#### POST /observability/v1/dashboards

Create custom dashboard.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "layout": {
    "columns": "number",
    "rows": "number"
  },
  "panels": [
    {
      "type": "chart | metric | table | text",
      "title": "string",
      "query": "string",
      "position": { "x": "number", "y": "number", "w": "number", "h": "number" }
    }
  ]
}
```

**Response (201):**
```json
{
  "dashboardId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### GET /observability/v1/dashboards

List custom dashboards.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "dashboards": [
    {
      "dashboardId": "string",
      "name": "string",
      "owner": "string",
      "starred": "boolean",
      "shared": "boolean"
    }
  ]
}
```

---

## Security Monitoring Service

Base path: `/security/v1`

### Automated Response Playbooks

#### POST /security/v1/playbooks

Create automated response playbook.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "triggerConditions": {
    "eventTypes": ["string"],
    "severityThreshold": "string",
    "filters": "object"
  },
  "actions": [
    {
      "type": "isolate | block | rotate | notify | webhook",
      "parameters": "object",
      "requiresApproval": "boolean"
    }
  ],
  "enabled": "boolean"
}
```

**Response (201):**
```json
{
  "playbookId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### POST /security/v1/playbooks/execute

Execute automated response playbook.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`, `metering`  
**Billable Operation:** `security.playbook_execute`

**Request Body:**
```json
{
  "playbookId": "string",
  "context": {
    "incidentId": "string",
    "targetResources": ["string"]
  }
}
```

**Response (202):**
```json
{
  "executionId": "string",
  "status": "pending_approval | running",
  "startedAt": "string"
}
```

### Attack Surface Analysis

#### POST /security/v1/attack-surface/analyze

Analyze attack paths.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`, `metering`  
**Billable Operation:** `security.attack_path_analysis`

**Request Body:**
```json
{
  "targetAsset": "string",
  "analysisDepth": "number",
  "includeExternalThreats": "boolean"
}
```

**Response (200):**
```json
{
  "analysisId": "string",
  "attackPaths": [
    {
      "pathId": "string",
      "severity": "string",
      "steps": [
        {
          "asset": "string",
          "vulnerability": "string",
          "technique": "string"
        }
      ],
      "mitigations": ["string"]
    }
  ]
}
```

#### POST /security/v1/attack-surface/simulate

Simulate attack scenario.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`, `metering`  
**Billable Operation:** `security.attack_simulation`

**Request Body:**
```json
{
  "scenario": "string",
  "entryPoints": ["string"],
  "objectives": ["string"]
}
```

**Response (200):**
```json
{
  "simulationId": "string",
  "results": {
    "successProbability": "number",
    "pathsTaken": ["object"],
    "assetsCompromised": ["string"],
    "timeToObjective": "string"
  }
}
```

### Compliance Mapping

#### POST /security/v1/compliance/controls

Create compliance control.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "controlId": "string",
  "framework": "string",
  "name": "string",
  "description": "string",
  "requirements": ["string"],
  "automatedChecks": ["string"]
}
```

**Response (201):**
```json
{
  "controlUuid": "string",
  "controlId": "string",
  "createdAt": "string"
}
```

#### POST /security/v1/compliance/assess

Run compliance assessment.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`, `metering`  
**Billable Operation:** `security.compliance_assessment`

**Request Body:**
```json
{
  "frameworks": ["string"],
  "scope": {
    "resourceTypes": ["string"],
    "tags": "object"
  }
}
```

**Response (200):**
```json
{
  "assessmentId": "string",
  "overallScore": "number",
  "byFramework": {
    "<framework>": {
      "score": "number",
      "passed": "number",
      "failed": "number"
    }
  }
}
```

---

## Crypto Inventory Service

Base path: `/crypto/v1`

### Algorithm Deprecation

#### POST /crypto/v1/deprecation/policies

Create algorithm deprecation policy.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "algorithms": ["string"],
  "deprecationDate": "string (ISO 8601)",
  "enforcementDate": "string (ISO 8601)",
  "migrationTarget": "string",
  "notificationSchedule": ["string"]
}
```

**Response (201):**
```json
{
  "policyId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### GET /crypto/v1/deprecation/affected-assets

List assets affected by deprecation policies.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "assets": [
    {
      "assetId": "string",
      "assetType": "string",
      "algorithm": "string",
      "policyId": "string",
      "deprecationDate": "string",
      "migrationStatus": "pending | in_progress | completed"
    }
  ]
}
```

#### GET /crypto/v1/deprecation/summary

Get deprecation summary.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "totalAffectedAssets": "number",
  "byAlgorithm": {
    "<algorithm>": "number"
  },
  "upcomingDeadlines": [
    {
      "policyId": "string",
      "algorithm": "string",
      "deadline": "string",
      "affectedAssets": "number"
    }
  ]
}
```

### Hardware Inventory

#### POST /crypto/v1/hardware

Register crypto hardware device.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "type": "hsm | tpm | smartcard | accelerator",
  "vendor": "string",
  "model": "string",
  "serialNumber": "string",
  "location": "string",
  "capabilities": ["string"],
  "firmwareVersion": "string"
}
```

**Response (201):**
```json
{
  "hardwareId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### POST /crypto/v1/hardware/:hardwareId/health

Record hardware health check.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "status": "healthy | degraded | failed",
  "metrics": {
    "temperature": "number",
    "operationsPerSecond": "number",
    "errorRate": "number"
  }
}
```

**Response (201):**
```json
{
  "healthCheckId": "string",
  "recordedAt": "string"
}
```

#### GET /crypto/v1/hardware/summary

Get hardware inventory summary.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "totalDevices": "number",
  "byType": {
    "hsm": "number",
    "tpm": "number"
  },
  "byStatus": {
    "healthy": "number",
    "degraded": "number",
    "failed": "number"
  }
}
```

### PQC Readiness

#### GET /crypto/v1/pqc-readiness/score

Calculate organization PQC readiness score.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "overallScore": "number (0-100)",
  "grade": "A | B | C | D | F",
  "categories": {
    "keyManagement": "number",
    "algorithms": "number",
    "hardware": "number",
    "policies": "number"
  },
  "calculatedAt": "string"
}
```

#### GET /crypto/v1/pqc-readiness/recommendations

Get PQC readiness improvement recommendations.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "recommendations": [
    {
      "priority": "high | medium | low",
      "category": "string",
      "title": "string",
      "description": "string",
      "impact": "number",
      "effort": "low | medium | high"
    }
  ]
}
```

---

## AI Orchestrator

Base path: `/ai/v1` (via `/v1`)

### Model Registry

#### POST /v1/registry/models

Register a new AI model.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "version": "string",
  "type": "llm | embedding | classification | custom",
  "provider": "string",
  "artifacts": {
    "modelPath": "string",
    "configPath": "string"
  },
  "metadata": {
    "description": "string",
    "tags": ["string"],
    "license": "string"
  }
}
```

**Response (201):**
```json
{
  "modelId": "string",
  "name": "string",
  "status": "registered",
  "createdAt": "string"
}
```

#### POST /v1/registry/models/:id/activate

Activate a model.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "modelId": "string",
  "status": "active",
  "activatedAt": "string"
}
```

#### POST /v1/registry/models/:id/deprecate

Deprecate a model.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "reason": "string",
  "replacementModelId": "string | null"
}
```

**Response (200):**
```json
{
  "modelId": "string",
  "status": "deprecated",
  "deprecatedAt": "string"
}
```

#### POST /v1/registry/deployments

Deploy a registered model.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `quota`, `audit`, `metering`  
**Billable Operation:** `ai.model_deploy`

**Request Body:**
```json
{
  "modelId": "string",
  "versionId": "string",
  "config": {
    "replicas": "number",
    "resources": {
      "cpu": "string",
      "memory": "string",
      "gpu": "string | null"
    },
    "autoscaling": {
      "enabled": "boolean",
      "minReplicas": "number",
      "maxReplicas": "number"
    }
  }
}
```

**Response (201):**
```json
{
  "deploymentId": "string",
  "modelId": "string",
  "status": "deploying",
  "createdAt": "string"
}
```

### Cost Optimization

#### GET /v1/costs/analytics

Get cost analytics.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | Time period |
| `groupBy` | string | Group by model, user, etc. |

**Response (200):**
```json
{
  "totalCost": "number",
  "currency": "string",
  "breakdown": [
    {
      "category": "string",
      "cost": "number",
      "tokenCount": "number"
    }
  ],
  "trend": "object"
}
```

#### GET /v1/costs/recommendations

List cost recommendations.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "recommendations": [
    {
      "recommendationId": "string",
      "type": "model_switch | batch_optimization | caching",
      "title": "string",
      "estimatedSavings": "number",
      "status": "pending | accepted | rejected"
    }
  ]
}
```

### Bias Monitoring

#### POST /v1/bias/evaluations

Create bias evaluation.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "modelId": "string",
  "evaluationType": "demographic_parity | equalized_odds | calibration",
  "testDataset": {
    "source": "string",
    "sampleSize": "number"
  },
  "protectedAttributes": ["string"]
}
```

**Response (201):**
```json
{
  "evaluationId": "string",
  "status": "created",
  "createdAt": "string"
}
```

#### POST /v1/bias/evaluations/:id/start

Start bias evaluation.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (202):**
```json
{
  "evaluationId": "string",
  "status": "running",
  "startedAt": "string"
}
```

#### GET /v1/bias/summary

Get bias monitoring summary.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "modelsEvaluated": "number",
  "activeIncidents": "number",
  "overallFairnessScore": "number",
  "recentEvaluations": ["object"]
}
```

### Prompt Injection Detection

#### POST /v1/security/injection/patterns

Create injection detection pattern.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "pattern": "string (regex)",
  "category": "jailbreak | data_extraction | instruction_override",
  "severity": "low | medium | high | critical",
  "enabled": "boolean"
}
```

**Response (201):**
```json
{
  "patternId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### POST /v1/security/injection/analyze

Analyze prompt for injection attacks.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "prompt": "string",
  "context": "string | null"
}
```

**Response (200):**
```json
{
  "safe": "boolean",
  "riskScore": "number (0-100)",
  "detections": [
    {
      "patternId": "string",
      "category": "string",
      "severity": "string",
      "matchedText": "string"
    }
  ],
  "recommendation": "allow | sanitize | block"
}
```

#### GET /v1/security/injection/stats

Get injection detection statistics.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "totalAnalyzed": "number",
  "blocked": "number",
  "byCategory": {
    "jailbreak": "number",
    "data_extraction": "number",
    "instruction_override": "number"
  }
}
```

---

## Tenant Service

Base path: `/tenant/v1`

### Tenant Health

#### POST /tenant/v1/health/snapshots

Record tenant health snapshot.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Request Body:**
```json
{
  "metrics": {
    "apiLatencyP99": "number",
    "errorRate": "number",
    "activeUsers": "number",
    "storageUsage": "number"
  }
}
```

**Response (201):**
```json
{
  "snapshotId": "string",
  "recordedAt": "string"
}
```

#### GET /tenant/v1/health/current

Get current health status.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Response (200):**
```json
{
  "status": "healthy | degraded | critical",
  "score": "number",
  "metrics": "object",
  "issues": ["object"]
}
```

#### GET /tenant/v1/health/trends

Get health trends.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Response (200):**
```json
{
  "period": "string",
  "dataPoints": [
    {
      "timestamp": "string",
      "score": "number",
      "status": "string"
    }
  ]
}
```

### Quota Management

#### GET /tenant/v1/quotas/current

Get current quota usage.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Response (200):**
```json
{
  "quotas": [
    {
      "quotaType": "string",
      "quotaName": "string",
      "limit": "number",
      "used": "number",
      "remaining": "number",
      "percentage": "number"
    }
  ]
}
```

#### POST /tenant/v1/quotas/forecast

Forecast quota usage.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Request Body:**
```json
{
  "quotaTypes": ["string"],
  "forecastDays": "number"
}
```

**Response (200):**
```json
{
  "forecasts": [
    {
      "quotaType": "string",
      "currentUsage": "number",
      "projectedUsage": "number",
      "exceedsLimitAt": "string | null"
    }
  ]
}
```

### Onboarding Workflows

#### POST /tenant/v1/onboarding/workflows

Create onboarding workflow.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "templateId": "string",
  "tenantId": "string",
  "parameters": "object"
}
```

**Response (201):**
```json
{
  "workflowId": "string",
  "status": "pending",
  "steps": ["object"],
  "createdAt": "string"
}
```

#### POST /tenant/v1/onboarding/workflows/:workflowId/action

Execute workflow action.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "action": "start | pause | resume | cancel",
  "reason": "string | null"
}
```

**Response (200):**
```json
{
  "workflowId": "string",
  "status": "string",
  "updatedAt": "string"
}
```

### Isolation Verification

#### POST /tenant/v1/isolation/audits

Create isolation audit.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "scope": ["data", "network", "compute", "identity"],
  "depth": "quick | standard | comprehensive"
}
```

**Response (201):**
```json
{
  "auditId": "string",
  "status": "running",
  "startedAt": "string"
}
```

#### GET /tenant/v1/isolation/current-status

Get current isolation status.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Response (200):**
```json
{
  "overallStatus": "isolated | warning | breach",
  "byCategory": {
    "data": "string",
    "network": "string",
    "compute": "string",
    "identity": "string"
  },
  "lastAuditAt": "string"
}
```

---

## Search Service

Base path: `/search/v1`

### Search Analytics

#### GET /search/v1/analytics/metrics

Get aggregated analytics metrics.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "period": "string",
  "totalQueries": "number",
  "averageLatencyMs": "number",
  "p99LatencyMs": "number",
  "zeroResultsRate": "number"
}
```

#### GET /search/v1/analytics/quality

Get search quality metrics.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "meanReciprocalRank": "number",
  "clickThroughRate": "number",
  "satisfactionScore": "number",
  "abandonmentRate": "number"
}
```

### Synonym Management

#### POST /search/v1/synonyms

Create synonym group.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "name": "string",
  "type": "equivalent | one_way",
  "terms": ["string"],
  "indexNames": ["string"]
}
```

**Response (201):**
```json
{
  "groupId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### POST /search/v1/synonyms/expand

Expand term with synonyms.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "term": "string",
  "indexName": "string"
}
```

**Response (200):**
```json
{
  "original": "string",
  "expansions": ["string"]
}
```

### Index Health

#### GET /search/v1/health/current

Get current index health status.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "overallHealth": "green | yellow | red",
  "indices": [
    {
      "indexName": "string",
      "status": "string",
      "documentCount": "number",
      "sizeBytes": "number",
      "shards": {
        "total": "number",
        "successful": "number"
      }
    }
  ]
}
```

#### POST /search/v1/health/maintenance

Schedule maintenance window.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "indexNames": ["string"],
  "maintenanceType": "optimize | reindex | backup",
  "scheduledAt": "string (ISO 8601)",
  "duration": "string (ISO 8601 duration)"
}
```

**Response (201):**
```json
{
  "windowId": "string",
  "status": "scheduled",
  "scheduledAt": "string"
}
```

### Tenant Isolation

#### POST /search/v1/isolation/verify

Run isolation verification.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Request Body:**
```json
{
  "testType": "query_isolation | index_isolation | full",
  "sampleSize": "number"
}
```

**Response (200):**
```json
{
  "verificationId": "string",
  "passed": "boolean",
  "tests": [
    {
      "testName": "string",
      "passed": "boolean",
      "details": "string"
    }
  ]
}
```

---

## Billing Service

Base path: `/billing/v1`

### Revenue Analytics

#### GET /billing/v1/analytics/revenue/summary

Get revenue summary.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Response (200):**
```json
{
  "period": "string",
  "totalRevenue": "number",
  "currency": "string",
  "mrr": "number",
  "arr": "number",
  "growth": {
    "percentage": "number",
    "direction": "up | down | stable"
  }
}
```

#### GET /billing/v1/analytics/revenue/by-service

Get revenue breakdown by service.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Response (200):**
```json
{
  "byService": [
    {
      "service": "string",
      "revenue": "number",
      "percentage": "number",
      "trend": "string"
    }
  ]
}
```

### Usage Forecasting

#### GET /billing/v1/forecasting/usage/:tenantId

Get usage forecast for tenant.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "tenantId": "string",
  "forecasts": [
    {
      "metric": "string",
      "currentValue": "number",
      "forecastedValue": "number",
      "confidence": "number",
      "forecastDate": "string"
    }
  ]
}
```

#### GET /billing/v1/forecasting/capacity/:tenantId

Get capacity planning forecast.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "tenantId": "string",
  "capacityForecasts": [
    {
      "resource": "string",
      "currentUtilization": "number",
      "projectedUtilization": "number",
      "recommendedAction": "string"
    }
  ]
}
```

### Dunning Automation

#### POST /billing/v1/dunning/schedule

Configure dunning schedule.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Request Body:**
```json
{
  "tenantId": "string",
  "schedule": [
    {
      "dayAfterFailure": "number",
      "action": "email | sms | suspend | cancel",
      "template": "string"
    }
  ]
}
```

**Response (201):**
```json
{
  "scheduleId": "string",
  "tenantId": "string",
  "createdAt": "string"
}
```

#### GET /billing/v1/dunning/failed-payments

List failed payments.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Response (200):**
```json
{
  "failedPayments": [
    {
      "paymentId": "string",
      "tenantId": "string",
      "amount": "number",
      "failedAt": "string",
      "retryCount": "number",
      "nextRetryAt": "string | null"
    }
  ]
}
```

#### POST /billing/v1/dunning/retry

Retry failed payment.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Request Body:**
```json
{
  "paymentId": "string"
}
```

**Response (200):**
```json
{
  "paymentId": "string",
  "status": "pending | succeeded | failed",
  "retriedAt": "string"
}
```

### Credit System

#### POST /billing/v1/credits

Create credit for tenant.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Request Body:**
```json
{
  "tenantId": "string",
  "amount": "number",
  "currency": "string",
  "type": "promotional | refund | goodwill | referral",
  "expiresAt": "string (ISO 8601) | null",
  "reason": "string"
}
```

**Response (201):**
```json
{
  "creditId": "string",
  "amount": "number",
  "createdAt": "string"
}
```

#### GET /billing/v1/credits/balance/:tenantId

Get credit balance for tenant.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `audit`

**Response (200):**
```json
{
  "tenantId": "string",
  "balance": "number",
  "currency": "string",
  "expiringCredits": [
    {
      "amount": "number",
      "expiresAt": "string"
    }
  ]
}
```

#### POST /billing/v1/promotions/redeem

Redeem promotion code.

**Authentication:** Bearer token required  
**Required Controls:** `audit`

**Request Body:**
```json
{
  "tenantId": "string",
  "code": "string"
}
```

**Response (200):**
```json
{
  "success": "boolean",
  "creditAmount": "number",
  "message": "string"
}
```

---

## Audit Service

Base path: `/audit/v1` (via `/v1`)

### Event Streaming

#### POST /audit/v1/streaming/subscriptions

Create streaming subscription for audit events.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Request Body:**
```json
{
  "name": "string",
  "filters": {
    "eventTypes": ["string"],
    "services": ["string"],
    "severities": ["string"]
  },
  "destination": {
    "type": "webhook | kafka | sqs",
    "config": "object"
  }
}
```

**Response (201):**
```json
{
  "subscriptionId": "string",
  "name": "string",
  "status": "active",
  "createdAt": "string"
}
```

#### GET /audit/v1/streaming/events

SSE endpoint for real-time audit event streaming.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `subscriptionId` | string | Subscription ID |

**Response:** Server-Sent Events stream

```
event: audit_event
data: {"eventId": "...", "eventType": "...", ...}

event: audit_event
data: {"eventId": "...", "eventType": "...", ...}
```

#### GET /audit/v1/streaming/metrics

Get streaming metrics and statistics.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "activeConnections": "number",
  "eventsPerSecond": "number",
  "totalEventsStreamed": "number",
  "subscriptionMetrics": [
    {
      "subscriptionId": "string",
      "eventsDelivered": "number",
      "lastEventAt": "string"
    }
  ]
}
```

### Retention Management

#### POST /audit/v1/retention/policies

Create retention policy.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `admin`

**Request Body:**
```json
{
  "name": "string",
  "retentionPeriod": "string (ISO 8601 duration)",
  "scope": {
    "eventTypes": ["string"],
    "services": ["string"]
  },
  "archiveConfig": {
    "enabled": "boolean",
    "destination": "string"
  }
}
```

**Response (201):**
```json
{
  "policyId": "string",
  "name": "string",
  "createdAt": "string"
}
```

#### POST /audit/v1/retention/cleanup

Execute manual retention cleanup.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`, `admin`, `audit`  
**Billable Operation:** `audit.retention_cleanup`

**Request Body:**
```json
{
  "policyId": "string",
  "dryRun": "boolean"
}
```

**Response (200):**
```json
{
  "executionId": "string",
  "eventsProcessed": "number",
  "eventsDeleted": "number",
  "eventsArchived": "number",
  "dryRun": "boolean"
}
```

#### POST /audit/v1/retention/preview

Preview retention impact before cleanup.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Request Body:**
```json
{
  "policyId": "string"
}
```

**Response (200):**
```json
{
  "policyId": "string",
  "eventsAffected": "number",
  "oldestEventDate": "string",
  "newestEventDate": "string",
  "sizeBytes": "number"
}
```

#### GET /audit/v1/retention/metrics

Get retention metrics and statistics.

**Authentication:** Bearer token required  
**Required Controls:** `entitlements`

**Response (200):**
```json
{
  "totalEvents": "number",
  "totalSizeBytes": "number",
  "byAge": {
    "last7Days": "number",
    "last30Days": "number",
    "last90Days": "number",
    "older": "number"
  },
  "retentionSavings": {
    "eventsDeleted": "number",
    "bytesReclaimed": "number"
  }
}
```

---

## Common Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (async operation) |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## Error Response Format

All error responses follow this structure:

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Validation failed",
  "details": {
    "field": "description of issue"
  },
  "requestId": "string",
  "timestamp": "string (ISO 8601)"
}
```

## Rate Limiting

Rate limits are applied per tenant and returned in response headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200
```

When rate limited, a `429 Too Many Requests` response is returned with a `Retry-After` header.

