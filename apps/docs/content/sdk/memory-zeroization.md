---
title: Memory Zeroization
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Memory Zeroization

JavaScript runtimes do not provide strong guarantees around in-memory zeroization.

## What is zeroized

- Encryption keys
- Decrypted secrets
- Authentication tokens
- Private key material

## How it works

### Node.js
```typescript
// JavaScript runtimes do not provide strong guarantees around in-memory zeroization.
// Prefer short-lived tokens, avoid logging secrets, and minimize copying sensitive values.
```

## Limitations

### Language limitations
- JavaScript: No guaranteed memory control
- Best effort in managed languages

### What we do
SDKs in this repo avoid unnecessary copying where practical, but cannot guarantee zeroization.

## Best practices

1. Minimize secret lifetime in memory
2. Avoid logging secrets
3. Prefer `Buffer`/`Uint8Array` and overwrite buffers when possible
4. Use short-lived access tokens

## Verification

Managed runtimes do not provide reliable verification of in-memory zeroization.
