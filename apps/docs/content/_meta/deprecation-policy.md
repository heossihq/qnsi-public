---
title: Deprecation Policy
version: 0.0.1
last_updated: 2026-04-23
copyright: 2025 HEOSSI. All rights reserved.
license: BSL-1.1
source_files:
  - /packages/shared-kernel/package.json
  - /apps/platform-api/src/server.ts
  - /apps/edge-gateway/src/routes/proxy.ts
---

# Deprecation Policy

This policy reflects what is actually implemented in code as of the current monorepo state.

## Current Implementation Check

| Component | File | Deprecation Header Logic |
|-----------|------|--------------------------|
| Edge gateway responses | `apps/edge-gateway/src/routes/proxy.ts` | **No** `Deprecation`/`Sunset` header emission logic present |
| Platform API | `apps/platform-api/src/server.ts` | No middleware inserting deprecation headers |

Because no automatic headers exist, deprecation notices must be communicated via documentation and release notes.

## Manual Process

1. Track API removals in `apps/docs/content/changes/changelog.md`.
2. Communicate timelines via `_meta/docs-scope` and section-specific guides.
3. Provide migration details alongside breaking-change commits.

## Timelines

- Minimum notice: **6 months** before removal (documented, not enforced by code).
- Migration guidance: Added to the relevant doc when deprecation PR merges.

## Cryptography-Specific Deprecations

Actual algorithm availability is enforced by the PQC provider registry (`packages/cryptography/src/provider.ts`). Algorithm sunsets (e.g., Dilithium → Falcon) are recorded in `changes/crypto-sunset.md`; no automated enforcement exists.

## Future Work

- Implement shared middleware that injects `Deprecation` and `Sunset` headers when an endpoint is flagged.
- Surface sunset metadata via `packages/shared-kernel` constants so all services can consume the same schedule.
