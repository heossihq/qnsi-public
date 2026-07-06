---
title: Algorithm Decommissioning
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Algorithm Decommissioning

QNSI follows a structured process for retiring cryptographic algorithms.

## Decommissioning triggers

- NIST/standards body deprecation
- Practical attack discovered
- Quantum computing threat realized
- Performance or compatibility issues

## Decommissioning phases

### Phase 1: Deprecation notice
- Algorithm marked deprecated
- Warning in API responses
- Documentation updated
- Timeline announced

### Phase 2: New operations disabled
- Cannot create new keys with algorithm
- Cannot encrypt new data
- Existing operations continue

### Phase 3: Decrypt-only
- Only decryption/verification allowed
- Re-encryption required
- Migration deadline set

### Phase 4: Removal
- Algorithm support removed
- Remaining data inaccessible
- Final notice period

## Timeline

| Phase | Minimum duration |
|-------|------------------|
| Deprecation notice | 12 months |
| New operations disabled | 6 months |
| Decrypt-only | 6 months |
| Removal | After deadline |

## Emergency decommissioning

For critical vulnerabilities:
- Immediate disable possible
- Shortened timeline
- Direct customer notification
- Assisted migration

## Current status

See `/changes/crypto-sunset.md` for current deprecation status.
