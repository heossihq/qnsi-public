---
title: Identity Types
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Identity Types

QNSI supports multiple identity types for different use cases.

## User identities

Human users authenticated via:
- Email/password with MFA
- WebAuthn/passkeys
- Federated identity (OIDC/SAML)

User identities have:
- UUID identifier
- Email (unique per tenant)
- Roles and permissions
- Session management

## Service accounts

Machine-to-machine identities for:
- Backend services
- CI/CD pipelines
- Automated workflows

Service accounts have:
- UUID identifier
- Service secret (for token exchange)
- Scoped permissions
- No interactive sessions

## Workload identities

Ephemeral identities for:
- Container workloads
- Serverless functions
- Enclave attestation

Workload identities are:
- Short-lived
- Automatically rotated
- Bound to workload attestation

## Agent identities

AI/ML agent identities with:
- Capability constraints
- Action audit trails
- Revocable permissions
