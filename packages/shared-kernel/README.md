# @heossihq/qnsi-shared-kernel

Shared domain primitives, schemas, and utilities used across the Quantum-Native Security Infrastructure (QNSI).

## Exports

### Authentication & JWT

- `createAuthSubject`, `createAccessToken`, `createJwtAccessToken`, `accessTokenSchema` - helpers for JWT token claims and subject modelling.
- `signJwt`, `verifyJwt`, `createJwtVerifier` - PQC-JWT signing and verification functions using Dilithium or other PQC signature algorithms.
- `CLASSIFICATION_LEVELS`, `TOKEN_AUDIENCES`, `DEFAULT_TOKEN_TTL_SECONDS` - shared constants.

### Error hierarchy

- `ApplicationError`, `DomainError`, `UnauthorizedError`, `ForbiddenError` - standardized error hierarchy used by every `@heossihq/qnsi-*` SDK.

### Health

- `createHealthStatus`, `healthStatusSchema` - helper for constructing standardized health responses.

### Tier gating (client-side pre-flight)

- `PricingTier` - union of every customer tier plus the internal `"platform"` tier.
- `TierLimits` - the 7-field capability view exposed to SDK consumers (`storageGB`, `apiCalls`, `enclavesEnabled`, `aiTrainingEnabled`, `aiInferenceEnabled`, `sseEnabled`, `vaultEnabled`).
- `TIER_LIMITS` - the tier → `TierLimits` lookup table.
- `FeatureName`, `FEATURE_REQUIREMENTS` - feature catalogue with the minimum tier each feature requires.
- `TierError` - typed error with `feature`, `currentTier`, `requiredTier`; `.message` links to the billing portal.
- `checkTierAccess(feature, tier)` - throws `TierError` if the tier lacks the feature.
- `isFeatureEnabled(feature, tier)` - non-throwing boolean variant.
- `getTierLimits(tier)` - direct access to a tier's capability map.

Example:

```ts
import { isFeatureEnabled, TierError } from "@heossihq/qnsi-shared-kernel";

if (!isFeatureEnabled("enclaves", currentTier)) {
  throw new TierError("enclaves", currentTier, "enterprise-standard");
}
```

The tier catalogue is **inlined** in this package. It has no runtime dependency
on the internal `@heossihq/qnsi-pricing` commercial model; drift between the two is
prevented at build time by `src/tier-limits.drift.test.ts`, which asserts
byte-exact equality against the internal source of truth.

## Scripts

```bash
pnpm build     # Compile TypeScript to dist/
pnpm lint      # Run Biome checks
pnpm test      # Execute Vitest test suites
pnpm typecheck # Run TypeScript without emitting output
```

© 2025 QNSI - HEOSSI, Singapore
