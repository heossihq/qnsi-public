---
title: Service Boundaries
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Service Boundaries

Each QNSI service owns a specific domain and exposes a versioned API.

## Boundary principles

- Services own their data stores
- Cross-service communication via defined APIs
- No shared databases between services
- Events for async coordination

## Service responsibilities

### auth-service
- Token issuance and validation
- User and service account management
- Session lifecycle
- MFA and WebAuthn

Membership is stored in `auth-service` (`auth_users`). Tenant admin operations (list users, create users for join approval/invites) are performed via auth-service endpoints.

### tenant-service
- Tenant lifecycle and metadata
- Domain verification (DNS TXT claim)
- Join requests (request-to-join workflow)
- Tenant domains registry (verified domains)

### kms-service
- Key generation and storage
- Encryption/decryption operations
- Key rotation and revocation
- HSM integration

### vault-service
- Secret storage
- TTL and rotation
- Workload identity injection
- Access control

### storage-service
- Encrypted object storage
- Client-side encryption support
- Data lifecycle management

### search-service
- Searchable encryption index
- Query processing
- Index encryption

### audit-service
- Event ingestion
- Merkle tree checkpointing
- Retention and export
- SIEM integration

### access-control-service
- Policy storage
- Policy evaluation
- RBAC enforcement
