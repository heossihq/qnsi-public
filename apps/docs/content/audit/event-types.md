---
title: Audit Event Types
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Audit Event Types

Hierarchical event types for all platform operations.

## Event type format

```
<service>.<resource>.<action>
```

## Authentication events

| Event type | Description |
|------------|-------------|
| `auth.login.success` | Successful login |
| `auth.login.failure` | Failed login attempt |
| `auth.logout` | User logout |
| `auth.token.issued` | Token issued |
| `auth.token.refreshed` | Token refreshed |
| `auth.token.revoked` | Token revoked |
| `auth.mfa.enrolled` | MFA enrolled |
| `auth.mfa.verified` | MFA verified |

## KMS events

| Event type | Description |
|------------|-------------|
| `kms.key.created` | Key created |
| `kms.key.rotated` | Key rotated |
| `kms.key.deleted` | Key deleted |
| `kms.key.accessed` | Key metadata accessed |
| `kms.encrypt` | Encryption operation |
| `kms.decrypt` | Decryption operation |
| `kms.sign` | Signing operation |

## Vault events

| Event type | Description |
|------------|-------------|
| `vault.secret.created` | Secret created |
| `vault.secret.read` | Secret accessed |
| `vault.secret.updated` | Secret updated |
| `vault.secret.deleted` | Secret deleted |
| `vault.secret.rotated` | Secret rotated |

## Storage events

| Event type | Description |
|------------|-------------|
| `storage.object.created` | Object uploaded |
| `storage.object.read` | Object downloaded |
| `storage.object.deleted` | Object deleted |
| `storage.bucket.created` | Bucket created |

## Access control events

| Event type | Description |
|------------|-------------|
| `access.policy.created` | Policy created |
| `access.policy.evaluated` | Policy evaluated |
| `access.denied` | Access denied |
