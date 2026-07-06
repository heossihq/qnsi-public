---
title: Authentication Flows
version: 0.0.2
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Authentication Flows

QNSI supports multiple authentication flows depending on identity type.

## User authentication

### Password flow
```
POST /auth/login
{
  "email": "user@example.com",
  "tenantId": "<tenant_uuid>",
  "password": "..."
}
```

Returns access token + refresh token.

### WebAuthn flow
1. `POST /auth/webauthn/authenticate/start` — get challenge
2. Client signs with authenticator
3. `POST /auth/webauthn/authenticate/complete` — verify and get tokens

### OAuth / Social Sign-In
One-click sign-up and sign-in via GitHub, Google, LinkedIn, or Microsoft. Handled entirely by the Cloud Portal BFF — no direct auth-service API calls required from the client.

1. User navigates to `GET /api/auth/oauth/{provider}`
2. BFF generates a CSRF state (HMAC-SHA256 nonce) and sets `qnsi_oauth_state` cookie (HttpOnly, SameSite=Lax, 10 min TTL)
3. For authenticated linking flows, the BFF also sets short-lived intent cookies so the callback knows whether this is:
   - a login/signup flow, or
   - a link-external-identity flow from profile settings
4. BFF redirects to the provider's authorization endpoint:
   - **GitHub**: `https://github.com/login/oauth/authorize` — scopes `user:email read:user`
   - **Google**: `https://accounts.google.com/o/oauth2/v2/auth` — scopes `openid email profile`
   - **LinkedIn**: `https://www.linkedin.com/oauth/v2/authorization` — scopes `openid profile email`
   - **Microsoft**: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` — scopes `openid profile email User.Read`
5. Provider redirects to `GET /api/auth/oauth/{provider}/callback?code=…&state=…`
6. BFF verifies the CSRF state against the cookie, exchanges the `code` for an access token, and fetches the user profile from the provider API
7. **Returning user**: identity lookup via `GET /auth/oauth/identity` → session issued
8. **New user**: tenant + user provisioned via billing-service, identity linked via `POST /auth/oauth/identity`, then session issued
9. **Authenticated link flow**: the provider identity is bound to the current QNSI user without provisioning a new tenant or rotating the active session
10. BFF calls `POST /auth/oauth/session` for login/signup flows → receives PQC-signed JWT (ML-DSA) + refresh token
11. Session cookies written; user redirected to `/dashboard` or back to `/profile?tab=accounts` for link flows

**Environment variables** (Cloud Portal):
| Variable | Description |
|---|---|
| `CLOUD_OAUTH_GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `CLOUD_OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `CLOUD_OAUTH_GITHUB_CALLBACK_URL` | Optional GitHub callback override |
| `CLOUD_OAUTH_GOOGLE_CLIENT_ID` | Google OAuth app client ID |
| `CLOUD_OAUTH_GOOGLE_CLIENT_SECRET` | Google OAuth app client secret |
| `CLOUD_OAUTH_GOOGLE_CALLBACK_URL` | Optional Google callback override |
| `CLOUD_OAUTH_LINKEDIN_CLIENT_ID` | LinkedIn OAuth app client ID |
| `CLOUD_OAUTH_LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth app client secret |
| `CLOUD_OAUTH_LINKEDIN_CALLBACK_URL` | Optional LinkedIn callback override |
| `CLOUD_OAUTH_MICROSOFT_CLIENT_ID` | Microsoft OAuth app client ID |
| `CLOUD_OAUTH_MICROSOFT_CLIENT_SECRET` | Microsoft OAuth app client secret |
| `CLOUD_OAUTH_MICROSOFT_CALLBACK_URL` | Optional Microsoft callback override |
| `CLOUD_OAUTH_SESSION_SECRET` | HMAC secret for CSRF state signing |
| `CLOUD_PORTAL_URL` | Callback base URL (default: `https://cloud.qnsi.heossi.com`) |

**Sign up / sign in at:** [cloud.qnsi.heossi.com/auth](https://cloud.qnsi.heossi.com/auth)

### Enterprise Federation (OIDC / SAML)
QNSI supports workforce federation for:
- Microsoft Entra ID
- Okta
- Auth0
- Google Workspace
- AWS IAM Identity Center
- Tenant-configured SAML 2.0 or OIDC providers

Flow:
1. User selects **Continue with your company SSO**
2. QNSI performs tenant discovery by verified email domain first, then tenant/workspace identifier
3. If multiple workforce providers exist for the tenant, QNSI presents a provider selector instead of guessing
4. QNSI starts the provider-specific OIDC or SAML flow
5. Auth-service validates the callback/assertion and either:
   - issues QNSI tokens for sign-in, or
   - links the external identity to the currently authenticated QNSI user when the flow was initiated from profile settings

### Linked External Identities
Authenticated users can manage linked identities from **Profile → Linked Accounts** in the Cloud Portal.

Supported linking paths:
- Social OAuth: GitHub, Google, LinkedIn, Microsoft
- Workforce SSO: Entra ID, Okta, Auth0, Google Workspace, AWS IAM Identity Center, and configured tenant SAML/OIDC providers

Unlinking removes the external identity binding without deleting the QNSI user account or tenant membership.

## Service authentication

### Service token flow
```
POST /auth/service-token
Authorization: Bearer <service-secret>
{
  "serviceId": "<uuid>",
  "audience": "internal-service"
}
```

Returns access token only (no refresh).

## Token refresh

```
POST /auth/token/refresh
{
  "refreshToken": "<token>"
}
```

Returns new access token + rotated refresh token.

## Organization access (C2)

### Request-to-join (public)

Users who are not yet members can request access through edge-gateway:

```
POST /public/join-requests
{
  "tenant": "<tenant_slug_or_uuid>",
  "email": "user@company.com",
  "requestedRole": "Developer"
}
```

### Invite acceptance (password reset)

Invites are implemented as a locked user created in auth-service, followed by a password reset email.

- `POST /auth/forgot-password` sends reset email
- `POST /auth/reset-password` sets the new password

On first successful reset, auth-service activates invited users:

- `locked` → `active`
