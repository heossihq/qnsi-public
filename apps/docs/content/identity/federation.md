---
title: Federation
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Federation

QNSI supports identity federation with external providers.

## Supported protocols

- **OIDC**: OpenID Connect 1.0
- **SAML**: SAML 2.0

## Federation model

External identities are linked to QNSI identities:

```
External IdP → QNSI Identity
     ↓              ↓
  sub: abc123  →  user-uuid
```

## Multiple providers

A tenant can configure multiple IdPs:
- Different providers for different user populations
- Fallback providers
- Migration scenarios

## Identity linking

Users can link multiple external identities:
- Same user, different IdPs
- Account recovery via alternate IdP

## Trust configuration

Per-provider settings:
- Allowed domains
- Required claims
- Role mapping rules
- JIT provisioning rules

## Bootstrap

First admin must be created via:
1. Direct registration (if enabled)
2. Pre-configured bootstrap identity
3. API with bootstrap token
