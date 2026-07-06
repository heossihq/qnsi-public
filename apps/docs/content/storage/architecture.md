---
title: Storage Architecture
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/storage-service/src/config/env.ts
---

# Storage Architecture

The Storage Service provides encrypted object storage with client-side encryption support.

## Service Configuration

From `apps/storage-service/src/config/env.ts`:

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| Port | `PORT` | 8092 |
| Backend | `STORAGE_BACKEND` | `filesystem` |
| Multipart chunk size | `STORAGE_MULTIPART_CHUNK_SIZE` | 32 MB |
| Upload expiration | `STORAGE_UPLOAD_EXPIRATION_MINUTES` | 60 min |
| Manifest signature | `STORAGE_MANIFEST_SIGNATURE_ALGORITHM` | `dilithium-3` |

## Storage Backends

| Backend | Environment Variable | Description |
|---------|---------------------|-------------|
| `filesystem` | `STORAGE_BASE_PATH` | Local filesystem |
| `s3` | `STORAGE_S3_BUCKET`, `STORAGE_S3_REGION` | AWS S3 or compatible |
| `azure-blob` | - | Azure Blob Storage |
| `gcs` | - | Google Cloud Storage |

### S3 Configuration

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| Bucket | `STORAGE_S3_BUCKET` | - |
| Region | `STORAGE_S3_REGION` | `us-east-1` |
| Endpoint | `STORAGE_S3_ENDPOINT` | AWS default |
| Object Lock | `STORAGE_S3_OBJECT_LOCK_ENABLED` | `false` |
| Lock Mode | `STORAGE_S3_OBJECT_LOCK_MODE` | `COMPLIANCE` |

## Malware Scanning

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| Enabled | `STORAGE_MALWARE_SCANNING_ENABLED` | `false` |
| Driver | `STORAGE_MALWARE_SCANNER_DRIVER` | `clamav` |
| Endpoint | `STORAGE_MALWARE_SCANNER_ENDPOINT` | `tcp://127.0.0.1:3310` |
| Timeout | `STORAGE_MALWARE_SCAN_TIMEOUT_MS` | 60,000 ms |
| Suspicious policy | `STORAGE_MALWARE_POLICY_SUSPICIOUS` | `treat-as-infected` |

## BYOK (Bring Your Own Key)

Configure tenant-specific encryption keys via `STORAGE_BYOK_REGISTRY`:

```json
[
  {
    "tenantId": "<uuid>",
    "keyId": "<key-id>",
    "algorithm": "aes-256-gcm",
    "provider": "byok",
    "material": "<base64-encoded-key>"
  }
]
```

## Replication

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| Enabled | `STORAGE_REPLICATION_ENABLED` | `false` |
| Targets | `STORAGE_REPLICATION_TARGETS` | - |
| Poll interval | `STORAGE_REPLICATION_POLL_INTERVAL_MS` | 10,000 ms |
| Batch size | `STORAGE_REPLICATION_BATCH_SIZE` | 10 |

## CDN Integration

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| Base URL | `STORAGE_CDN_BASE_URL` | - |
| Signing key | `STORAGE_CDN_SIGNING_KEY_BASE64` | - |
| Token TTL | `STORAGE_CDN_TOKEN_TTL_SECONDS` | 600 (10 min) |

## Request Flow

```
Client → Edge Gateway (8107) → Storage Service (8092) → Backend
                                       ↓
                                 Vault (keys) / KMS
```
