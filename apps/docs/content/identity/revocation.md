---
title: Token and Credential Revocation
version: 0.0.1
last_updated: 2026-04-23
copyright: 2025 HEOSSI. All rights reserved.
---
# Token and Credential Revocation

QNSI supports immediate revocation of tokens and credentials.

## Token revocation

### By refresh token
```
POST /auth/token/revoke
{
  "refreshToken": "<token>"
}
```

### By token ID
```
POST /auth/token/revoke
{
  "tokenId": "<uuid>"
}
```

An optional `reason` can also be provided.

### Revocation reasons
- `user_logout`: User-initiated
- `rotated`: Replaced by new token
- `admin_revoke`: Administrative action
- `security_incident`: Security response
- `expired`: Natural expiry

## Access token handling

Access tokens are short-lived and not individually revoked. Instead:
- Revoke the refresh token
- Wait for access token expiry

## Credential revocation

### WebAuthn credentials
```
DELETE /auth/webauthn/credentials/{credentialId}?userId=<user_uuid>
```
