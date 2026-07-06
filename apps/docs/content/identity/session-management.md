---
title: Session Management
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Session Management

QNSI manages user sessions for interactive authentication.

## Session model

Sessions track:
- User identity
- Authentication method
- Device/client information
- Creation and last activity time

## Session lifecycle

### Creation
Session created on successful authentication:
- Password login
- WebAuthn
- Federated SSO

### Refresh
Sessions extend on activity:
- Token refresh extends session
- Configurable idle timeout

### Termination
Sessions end via:
- Explicit logout
- Idle timeout
- Absolute timeout
- Admin revocation

## Session limits

Per-user session limits:
- Maximum concurrent sessions
- Per-device limits
- Oldest session eviction

## Session listing

Session listing APIs are not shipped in this repo.

## Session revocation

Session revocation is performed by revoking refresh tokens.
See Token and Credential Revocation.

## Security

- Sessions bound to refresh token
- Session ID not exposed in tokens
- Secure, HttpOnly cookies for web
