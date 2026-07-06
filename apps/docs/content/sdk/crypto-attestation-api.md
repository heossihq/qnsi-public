
> **Note** — As of 2026-04-30, the per-service `@heossi/qnsi-crypto-inventory-sdk` package is consolidated into the unified `@heossi/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossi/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.crypto./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.

# Crypto Attestation API

The Crypto Attestation API provides programmatic access to cryptographic policy enforcement, algorithm registry, CBOM export, and compliance assessment.

## Base URL

```
https://api.qnsi.heossi.com/platform/v1/crypto
```

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Get Crypto Policy

Returns the current crypto policy configuration and attestation.

```bash
GET /platform/v1/crypto/policy
```

**Response:**

```json
{
  "version": "1.0.0",
  "timestamp": "2025-12-31T06:30:00.000Z",
  "policyHash": "sha3-256:abc123...",
  "config": {
    "enabled": true,
    "mode": "enforce",
    "allowedKemAlgorithms": ["kyber-512", "kyber-768", "kyber-1024"],
    "allowedSignatureAlgorithms": ["dilithium-2", "dilithium-3", "dilithium-5"],
    "allowedSymmetricAlgorithms": ["aes-256-gcm", "chacha20-poly1305"],
    "forbiddenAlgorithms": [],
    "minimumSecurityLevel": 1,
    "requireNistFinal": false,
    "allowClassicalFallback": true,
    "hybridModeRequired": false
  },
  "nistFinalAlgorithms": ["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024", "ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  "deprecatedAlgorithms": ["RSA-2048", "RSA-4096", "ECDSA-P256", "ECDSA-P384"]
}
```

### Check Algorithm

Check if an algorithm is allowed by the current policy.

```bash
GET /platform/v1/crypto/policy/check?algorithm=kyber-768&context=kem
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| algorithm | string | Yes | Algorithm identifier (e.g., kyber-768, dilithium-3) |
| context | string | Yes | Usage context: kem, signature, symmetric, hash |

**Response (Allowed):**

```json
{
  "allowed": true,
  "algorithm": "kyber-768",
  "metadata": {
    "name": "ML-KEM-768",
    "type": "kem",
    "status": "NIST_FINAL",
    "securityLevel": 3,
    "nistStandard": "FIPS 203"
  },
  "violations": []
}
```

**Response (Blocked):**

```json
{
  "allowed": false,
  "algorithm": "rsa-2048",
  "reason": "Algorithm is deprecated",
  "metadata": {
    "name": "RSA-2048",
    "type": "signature",
    "status": "DEPRECATED",
    "securityLevel": 1,
    "deprecationDate": "2030-01-01",
    "replacementAlgorithm": "dilithium-2"
  },
  "violations": [
    {
      "code": "ALGORITHM_DEPRECATED",
      "message": "Algorithm RSA-2048 is deprecated",
      "severity": "warning"
    }
  ]
}
```

### List Algorithms

List all algorithms in the registry with optional filtering.

```bash
GET /platform/v1/crypto/algorithms
GET /platform/v1/crypto/algorithms?status=NIST_FINAL
GET /platform/v1/crypto/algorithms?type=signature
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status: NIST_FINAL, NIST_DRAFT, DEPRECATED, CLASSICAL |
| type | string | No | Filter by type: kem, signature, symmetric, hash |

**Response:**

```json
{
  "algorithms": [
    {
      "id": "kyber-768",
      "name": "ML-KEM-768",
      "type": "kem",
      "status": "NIST_FINAL",
      "securityLevel": 3,
      "nistStandard": "FIPS 203"
    }
  ],
  "total": 15,
  "generatedAt": "2025-12-31T06:30:00.000Z"
}
```

### Get Algorithm Details

Get metadata for a specific algorithm.

```bash
GET /platform/v1/crypto/algorithms/:algorithm
```

**Response:**

```json
{
  "id": "kyber-768",
  "name": "ML-KEM-768",
  "type": "kem",
  "status": "NIST_FINAL",
  "securityLevel": 3,
  "nistStandard": "FIPS 203",
  "publicKeySize": 1184,
  "secretKeySize": 2400,
  "ciphertextSize": 1088
}
```

### Get CBOM

Generate and return the Cryptographic Bill of Materials.

```bash
GET /platform/v1/crypto/cbom
```

**Response:**

```json
{
  "specVersion": "QNSI-CBOM-1.0",
  "version": "1.0.0",
  "generatedAt": "2025-12-31T06:30:00.000Z",
  "generatedBy": "QNSI CBOM Service",
  "documentHash": "sha3-256:abc123...",
  "platform": {
    "name": "QNSI",
    "version": "1.0.0",
    "environment": "production"
  },
  "components": [...],
  "services": [...],
  "keyMaterials": [...],
  "tlsConfig": {
    "minVersion": "TLS 1.3",
    "cipherSuites": ["TLS_AES_256_GCM_SHA384"],
    "pqcEnabled": true,
    "hybridMode": true
  },
  "compliance": [
    {
      "framework": "CNSA 2.0",
      "status": "compliant",
      "checkedAt": "2025-12-31T06:30:00.000Z",
      "findings": []
    }
  ]
}
```

### Download CBOM

Download CBOM as a JSON file.

```bash
GET /platform/v1/crypto/cbom/download
```

Returns the CBOM with `Content-Disposition: attachment` header.

### Get Compliance Status

Get compliance status summary for all frameworks.

```bash
GET /platform/v1/crypto/compliance
```

**Response:**

```json
{
  "compliance": [
    {
      "framework": "CNSA 2.0",
      "status": "compliant",
      "checkedAt": "2025-12-31T06:30:00.000Z",
      "findings": []
    },
    {
      "framework": "FIPS 140-3",
      "status": "compliant",
      "checkedAt": "2025-12-31T06:30:00.000Z",
      "findings": []
    }
  ],
  "generatedAt": "2025-12-31T06:30:00.000Z",
  "platformVersion": "1.0.0",
  "environment": "production"
}
```

### Get Attestation

Generate a comprehensive cryptographic attestation document.

```bash
GET /platform/v1/crypto/attestation
```

**Response:**

```json
{
  "version": "1.0.0",
  "type": "crypto-attestation",
  "generatedAt": "2025-12-31T06:30:00.000Z",
  "platform": {
    "name": "QNSI",
    "version": "1.0.0",
    "environment": "production"
  },
  "policy": {
    "version": "1.0.0",
    "timestamp": "2025-12-31T06:30:00.000Z",
    "policyHash": "sha3-256:abc123..."
  },
  "compliance": [...],
  "services": [
    {
      "name": "auth-service",
      "algorithms": ["dilithium-2", "kyber-768"],
      "pqcProvider": "liboqs"
    }
  ],
  "documentHash": "sha3-256:def456...",
  "nistFinalAlgorithmsInUse": ["ML-KEM-768", "ML-DSA-44"],
  "deprecatedAlgorithmsInUse": []
}
```

### Get Policy Presets

List available policy presets.

```bash
GET /platform/v1/crypto/policy/presets
```

**Response:**

```json
{
  "presets": [
    {
      "name": "default",
      "description": "Default policy - PQC preferred, classical fallback allowed",
      "config": {...}
    },
    {
      "name": "strict",
      "description": "Strict policy - PQC required, no classical algorithms",
      "config": {...}
    },
    {
      "name": "maximum",
      "description": "Maximum policy - level-5 PQC only with no classical fallback",
      "config": {...}
    },
    {
      "name": "government",
      "description": "Government policy - FIPS-finalized level-5 PQC with hybrid transport required",
      "config": {...}
    }
  ]
}
```

## SDK Usage

### TypeScript/Node.js

```typescript
import { CryptoInventoryClient } from '@heossi/qnsi-crypto-inventory-sdk';

const client = new CryptoInventoryClient({
  apiKey: process.env.QNSI_API_KEY,
  baseUrl: 'https://api.qnsi.heossi.com',
  pathPrefix: '/proxy/crypto',
});

// Get crypto policy
const policy = await client.crypto.getPolicy();
console.log('Policy mode:', policy.config.mode);

// Check algorithm
const result = await client.crypto.checkAlgorithm('kyber-768', 'kem');
if (result.allowed) {
  console.log('Algorithm allowed');
} else {
  console.log('Violations:', result.violations);
}

// Get CBOM
const cbom = await client.crypto.getCbom();
console.log('CBOM hash:', cbom.documentHash);

// Get compliance status
const compliance = await client.crypto.getCompliance();
for (const status of compliance.compliance) {
  console.log(`${status.framework}: ${status.status}`);
}
```

## Error Responses

### 400 Bad Request

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Missing required query parameters: algorithm, context"
}
```

### 404 Not Found

```json
{
  "statusCode": 404,
  "error": "NOT_FOUND",
  "message": "Algorithm unknown-algorithm not found in registry"
}
```

### 403 Forbidden (Algorithm Blocked)

```json
{
  "statusCode": 403,
  "error": "ALGORITHM_BLOCKED",
  "message": "Algorithm rsa-2048 is not allowed by policy",
  "violations": [...]
}
```

### Get CBOM History

List recent CBOM generation snapshots.

```bash
GET /platform/v1/crypto/cbom/history
```

**Response:**

```json
{
  "snapshots": [
    {
      "id": "cbom-1735623000000-abc123",
      "timestamp": "2025-12-31T06:30:00.000Z",
      "documentHash": "sha3-256:def456..."
    }
  ],
  "total": 1
}
```

### Compare CBOM Snapshots

Compare two CBOM snapshots to see differences.

```bash
GET /platform/v1/crypto/cbom/diff?oldId=cbom-123&newId=cbom-456
```

**Response:**

```json
{
  "oldId": "cbom-123",
  "newId": "cbom-456",
  "addedComponents": ["comp-new"],
  "removedComponents": ["comp-old"],
  "addedServices": ["new-service"],
  "removedServices": [],
  "complianceChanges": [
    {
      "framework": "CNSA 2.0",
      "oldStatus": "partial",
      "newStatus": "compliant"
    }
  ],
  "generatedAt": "2025-12-31T06:30:00.000Z"
}
```

### Get Attestation History

List recent attestation generation snapshots.

```bash
GET /platform/v1/crypto/attestation/history?limit=100
```

**Response:**

```json
{
  "attestations": [
    {
      "id": "attest-1735623000000-abc123",
      "timestamp": "2025-12-31T06:30:00.000Z",
      "documentHash": "sha3-256:def456...",
      "policyHash": "sha3-256:abc123...",
      "compliance": {...}
    }
  ],
  "total": 1
}
```

### Get Migration Plan

Generate a migration plan for deprecated algorithms.

```bash
GET /platform/v1/crypto/migration-plan
```

**Response:**

```json
{
  "deprecatedAlgorithms": [
    {
      "algorithm": "rsa-2048",
      "nistName": "RSA-2048",
      "deprecationDate": "2030-01-01",
      "replacement": "dilithium-2",
      "affectedServices": ["legacy-service"],
      "priority": "medium"
    }
  ],
  "timeline": [
    {
      "phase": "Assessment",
      "deadline": "2026-01-30",
      "actions": ["Inventory all deprecated algorithm usage", "..."]
    }
  ],
  "estimatedEffort": {
    "totalServices": 8,
    "servicesRequiringMigration": 1,
    "algorithmsToMigrate": 1
  },
  "generatedAt": "2025-12-31T06:30:00.000Z",
  "platformVersion": "1.0.0"
}
```

## Rate Limits

| Endpoint | Rate Limit |
|----------|------------|
| GET /policy | 100/min |
| GET /policy/check | 1000/min |
| GET /algorithms | 100/min |
| GET /cbom | 10/min |
| GET /cbom/history | 100/min |
| GET /cbom/diff | 100/min |
| GET /compliance | 100/min |
| GET /attestation | 10/min |
| GET /attestation/history | 100/min |
| GET /migration-plan | 10/min |
