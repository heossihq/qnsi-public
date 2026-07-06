---
title: OIDC Federation
version: 0.0.2
last_updated: 2026-04-23
copyright: 2025 HEOSSI. All rights reserved.
---
# OIDC Federation

QNSI supports OpenID Connect for workforce federation, tenant SSO, and authenticated identity linking.

## Configuration

Register an OIDC federation provider:

```json
{
  "id": "google-oidc",
  "provider": "oidc",
  "name": "Google Workspace",
  "enabled": true,
  "metadata": {
    "issuer": "https://accounts.google.com",
    "authorizationEndpoint": "https://accounts.google.com/o/oauth2/v2/auth",
    "tokenEndpoint": "https://oauth2.googleapis.com/token",
    "userInfoEndpoint": "https://openidconnect.googleapis.com/v1/userinfo",
    "clientId": "...",
    "clientSecret": "...",
    "scopes": ["openid", "email", "profile"]
  }
}
```

## Flow

1. Your client completes an authorization code flow with the IdP.
2. Exchange the authorization code via QNSI:
   ```
   POST /auth/federation/oidc/callback
   {
     "providerId": "google-oidc",
     "code": "<authorization_code>",
     "state": "<optional_state>",
     "linkMode": false
   }
   ```
3. QNSI exchanges the code for IdP tokens, fetches user info, and either:
   - issues QNSI access/refresh tokens for sign-in, or
   - binds the external OIDC identity to the authenticated QNSI user when `linkMode=true` and the request carries the current bearer token

## Claim mapping

Map IdP claims to QNSI attributes:

| IdP Claim | QNSI Attribute |
|-----------|----------------|
| `sub` | External ID |
| `email` | Email |
| `name` | Display name |
| `groups` | Roles (if configured) |

## Supported providers

- Google Workspace
- Microsoft Entra ID
- Okta
- Auth0
- Any OIDC-compliant provider

## JIT provisioning

Users are created on first login if JIT provisioning is enabled.

## Linking an existing QNSI account

Authenticated users can link an OIDC identity from the Cloud Portal profile page. In link mode, QNSI does not rely on email matching alone; the validated OIDC identity is bound directly to the current authenticated QNSI user.
