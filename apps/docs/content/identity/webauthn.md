---
title: WebAuthn Passkeys and Passwordless Authentication
version: 0.0.1
last_updated: 2026-07-31
description: Configure QNSI WebAuthn registration and authentication flows for passkeys, platform authenticators, roaming security keys, and credential revocation.
copyright: © 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /apps/auth-service/src/config/env.ts
  - /apps/auth-service/src/server.ts
---

# WebAuthn Passkeys and Passwordless Authentication

QNSI supports WebAuthn for passwordless authentication.

## Configuration

From `apps/auth-service/src/config/env.ts`:

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| Relying Party Name | `WEBAUTHN_RP_NAME` | `QNSI` |
| Relying Party ID | `WEBAUTHN_RP_ID` | `localhost` |
| Origin | `WEBAUTHN_ORIGIN` | `https://localhost` |

## Registration Flow

1. **Request challenge:**
   ```http
   POST /auth/webauthn/register/start
   Content-Type: application/json
   
   {"userId": "<user_uuid>", "tenantId": "<tenant_uuid>"}
   ```

2. **Client creates credential** with platform/roaming authenticator

3. **Verify and store:**
   ```http
   POST /auth/webauthn/register/complete
   Content-Type: application/json
   
   {"userId": "<user_uuid>", "tenantId": "<tenant_uuid>", "challengeId": "<challenge_uuid>", "response": {}}
   ```

## Authentication Flow

1. **Request challenge:**
   ```http
   POST /auth/webauthn/authenticate/start
   Content-Type: application/json
   
   {"tenantId": "<tenant_uuid>", "email": "user@example.com"}
   ```

2. **Client signs** with authenticator

3. **Verify and get tokens:**
   ```http
   POST /auth/webauthn/authenticate/complete
   Content-Type: application/json
   
   {"tenantId": "<tenant_uuid>", "email": "user@example.com", "challengeId": "<challenge_uuid>", "response": {}}
   ```

## Supported Authenticators

- **Platform**: Touch ID, Windows Hello, Face ID
- **Roaming**: YubiKey, Titan Security Key
- **Passkeys**: Synced credentials (iCloud, Google)

## Credential Management

Users can:
- Register multiple credentials per account
- Name credentials for identification
- Revoke individual credentials

## Security

- Credentials bound to `WEBAUTHN_ORIGIN`
- Attestation optional (enterprise recommended)
- User verification required for sensitive operations
