---
title: SDK Compatibility
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# SDK Compatibility

Version compatibility between SDKs and APIs.

## SDK versioning

SDKs follow semantic versioning:
- Major: Breaking changes
- Minor: New features, backward compatible
- Patch: Bug fixes

## API compatibility

SDKs in this repo target the v1 APIs (for example `/kms/v1`, `/vault/v1`, `/audit/v1`).
Newer API versions are not shipped in this repo.

## Runtime requirements

### Node.js SDK
TypeScript SDKs in this repo target Node.js 24.12.0.

## Deprecation policy

Deprecation and versioning guidance is documented in the Versioning Policy.

## Upgrade guide

Check release notes per package.

## Testing compatibility

SDKs tested against:
- Latest API version
- Previous API version
- All supported runtimes
