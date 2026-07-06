# Contributing to QNSP

## Coverage Governance

### Baselines

- **Baselines are ratcheted weekly by automation** via the `coverage-ratchet.yml` workflow
- **No one manually edits `scripts/coverage-baseline.json` on PRs** - this defeats the ratchet mechanism
- Baseline updates only happen via:
  - The weekly scheduled ratchet workflow
  - A dedicated `chore/coverage-ratchet-*` PR reviewed by CODEOWNERS

### Coverage Requirements

| Service Category | Lines | Branches | Functions | Statements |
|------------------|-------|----------|-----------|------------|
| Security-critical | 80% | 80% | 80% | 80% |
| All others | 70% | 70% | 70% | 70% |

Security-critical services: `auth-service`, `vault-service`, `kms-service`, `access-control-service`, `crypto-inventory-service`, `security-monitoring-service`

### Pre-Deploy Gates

Before any production deploy, these must pass:

```bash
pnpm coverage:ci        # Run coverage for all services
pnpm coverage:diff      # Check new code meets thresholds
pnpm smoke:e2e          # Run E2E behavior tests
```

### PR Coverage Checks

All PRs run these automatically:
- `coverage:validate` - Ensures vitest configs aren't gamed
- `coverage:diff` - New/changed code meets tier thresholds
- Regression check - Coverage doesn't drop vs baseline

## Code Review

### Security Services Require Security Team Review

Files in these paths require `@heossi/security-team` approval:
- `apps/auth-service/**`
- `apps/vault-service/**`
- `apps/kms-service/**`
- `apps/access-control-service/**`
- `apps/security-monitoring-service/**`
- `packages/cryptography/**`

### Coverage Baseline Changes

Changes to `scripts/coverage-baseline.json` require `@heossi/platform-leads` approval.

## Error Semantics

All services must follow enterprise error semantics:

| Status | When to use |
|--------|-------------|
| **400** | Malformed request, invalid UUID, Zod validation failure |
| **401** | Missing/invalid/expired token, authentication failed |
| **403** | Valid token but insufficient permissions |
| **404** | Resource not found |
| **500** | Only for true internal faults (DB down, crypto failure) |

**Critical:** Client errors (invalid input, bad tokens) must **never** return 500.

## Smoke Tests

The smoke suite (`scripts/ci/smoke-suite.ts`) verifies runtime behavior:
- No 500 for invalid input/tokens
- Correct 401/403 on auth failures
- Health endpoints available
- Proxy routing works

Run locally: `pnpm smoke:e2e`
