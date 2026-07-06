---
title: Forward Secrecy
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Forward Secrecy

QNSI implements forward secrecy to protect past communications.

## What is forward secrecy

Even if long-term keys are compromised, past session keys cannot be derived.

## Implementation

### TLS connections
- Ephemeral key exchange (ECDHE + Kyber)
- Session keys derived per connection
- Long-term keys only for authentication

### Token signing
- Signing keys rotate regularly
- Old signing keys destroyed
- Past tokens remain valid until expiry

### Data encryption
- Per-object DEKs
- DEKs wrapped with rotating KEKs
- Compromise of current KEK doesn't expose old DEKs

## Key exchange

Hybrid key exchange:
1. Generate ephemeral X25519 keypair
2. Generate ephemeral Kyber keypair
3. Combine shared secrets
4. Derive session key

## Session key lifecycle

1. Generated per session/connection
2. Used for session duration
3. Securely erased on session end
4. Never stored persistently

## Benefits

- Past data protected from future key compromise
- Limits exposure window
- Reduces value of key theft
