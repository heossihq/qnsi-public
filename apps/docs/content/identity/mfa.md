---
title: Multi-Factor Authentication
version: 0.0.1
last_updated: 2026-04-23
copyright: 2025 HEOSSI. All rights reserved.
---
# Multi-Factor Authentication

QNSI supports MFA for enhanced security.

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

### WebAuthn enrollment
See [WebAuthn documentation](./webauthn.md)

## Authentication with MFA

If a user has MFA enabled, primary authentication requires a `totp`.

Optional helper endpoints:
1. `POST /auth/mfa/challenge` — confirms MFA is required for `{ email, tenantId }`
2. `POST /auth/mfa/verify` — verifies a 6-digit TOTP for `{ email, tenantId, totp }`

Tokens are issued by `POST /auth/login` (with `totp`) or by WebAuthn authentication.

## Enforcement

MFA can be:
- Optional (user choice)
- Required for specific roles
- Required for all users (tenant setting)

## Recovery

If MFA device is lost:
- Admin can reset MFA
- Recovery via verified email (if enabled)
