---
title: Multi-Factor Authentication
version: 0.0.1
last_updated: 2026-07-28
copyright: 2025 HEOSSI. All rights reserved.
---
# Multi-Factor Authentication

QNSI supports MFA for enhanced security.

MFA is evaluated inside the tenant boundary. The tenant identifier and email
must resolve to the same user before the service reveals whether a TOTP
challenge can proceed.

## Supported factors

### TOTP
Time-based one-time passwords:
- Standard 6-digit codes
- 30-second window
- Compatible with authenticator apps

WebAuthn is documented separately and is not integrated into the TOTP MFA endpoints.

## Enrollment

TOTP enrollment APIs are not shipped in this repo.
Users with MFA enabled have a TOTP secret stored on their user record.

QNSI does not expose a public TOTP-enrolment endpoint in the current service
contract. Do not build an enrolment screen that invents a QR-code or secret
exchange around the verification routes below. Enrolment and administrative
reset must use the controlled workspace workflow available to the deployment.

### WebAuthn enrollment
See [WebAuthn documentation](./webauthn.md)

## Authentication with MFA

If a user has MFA enabled, primary authentication requires a `totp`.

Optional helper endpoints:
1. `POST /auth/mfa/challenge` - confirms MFA is required for `{ email, tenantId }`
2. `POST /auth/mfa/verify` - verifies a 6-digit TOTP for `{ email, tenantId, totp }`

Tokens are issued by `POST /auth/login` (with `totp`) or by WebAuthn authentication.

### Challenge request

```http
POST /auth/mfa/challenge
Content-Type: application/json
```

```json
{
  "email": "user@example.invalid",
  "tenantId": "00000000-0000-4000-8000-000000000000"
}
```

A successful response contains `mfaRequired: true`. A user that does not
exist in that tenant returns `404`; an account without enabled MFA returns
`400`. Clients should display a neutral sign-in error and must not use these
differences for account discovery.

### Verification request

```http
POST /auth/mfa/verify
Content-Type: application/json
```

```json
{
  "email": "user@example.invalid",
  "tenantId": "00000000-0000-4000-8000-000000000000",
  "totp": "123456"
}
```

The verification helper returns `verified: true` for a valid code and `401`
for an invalid code. It does not issue the application session; the primary
login route performs the same TOTP check while issuing the token.

## Enforcement

MFA can be:
- Optional (user choice)
- Required for specific roles
- Required for all users (tenant setting)

High-privilege roles should use the tenant's enforced policy rather than
relying on a user to opt in. Session, device and risk-based controls remain
separate decisions; a valid TOTP does not override authorization policy.

## Recovery

If MFA device is lost:
- Admin can reset MFA
- Recovery via verified email (if enabled)

Recovery is a security-sensitive administrative operation. Require a verified
operator, record the reset in the audit trail, revoke affected sessions and
have the user enrol a replacement factor. Email recovery is deployment
specific and must not be represented as available unless it has been
configured and exercised.

## Verification checklist

- Test correct, incorrect and expired codes.
- Test the same email against the wrong tenant.
- Confirm role or tenant enforcement cannot be bypassed by omitting `totp`.
- Confirm reset and subsequent sign-in events appear in the audit trail.
- Exercise recovery with synthetic accounts before relying on it in an
  incident.

See [WebAuthn](./webauthn), [Session Management](./session-management) and
[Token and Credential Revocation](./revocation) for the surrounding controls.
