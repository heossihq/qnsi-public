---
title: API Versioning
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# API Versioning

QNSI APIs use path-based versioning.

## Version format

Version in URL path:
```
/kms/v1/keys
```

## Current versions

| Service | Versioning approach | Example |
|---------|--------------------|---------|
| Edge Gateway (control plane) | Path-based | `/edge/v1/routes` |
| Auth | Unversioned under `/auth/*` | `/auth/token` |
| KMS | Path-based | `/kms/v1/keys` |
| Vault | Path-based | `/vault/v1/secrets` |
| Storage | Path-based | `/storage/v1/files` |
| Search | Path-based | `/search/v1/documents` |
| Audit | Path-based | `/audit/v1/events` |
| Platform API | Unversioned | `/hsm/profiles` |

## Version lifecycle

### Stable
- Production ready
- Breaking changes only in new major version
- Bug fixes and additions allowed

### Beta
- Feature complete
- May change with notice
- Not recommended for production

### Deprecated
- Still functional
- No new features
- Migration recommended

## Breaking changes

What constitutes a breaking change:
- Removing endpoints
- Removing required fields
- Changing field types
- Changing error codes
- Changing authentication

What is NOT breaking:
- Adding optional fields
- Adding new endpoints
- Adding new error codes
- Performance improvements

## Deprecation process

1. Deprecation announced (minimum 6 months notice)
2. Migration guide published
3. Old version removed

Version and deprecation headers are not currently emitted by services.
