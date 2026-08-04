export * from "./api-key-auth.js";
export * from "./auth.js";
export * from "./auth-claims.js";
export * from "./canonical-json.js";
export * from "./constants.js";
export * from "./entitlement-limits.js";
export * from "./env-aliases.js";
export { createCryptographyError } from "./errors/index.js";
export * from "./errors.js";
export * from "./health.js";
export * from "./input-validation.js";
export * from "./security-headers.js";
export * from "./service-client.js";
export * from "./service-health-registry.js";
export * from "./tier-catalog.js";
export * from "./tier-limits.js";
export * from "./token-prefixes.js";

// Node.js-only utilities (use separate import path to avoid bundling in browser)
// import { benchmark } from "@heossihq/qnsi-shared-kernel/benchmarks"
// import { loadTest } from "@heossihq/qnsi-shared-kernel/load-testing"
// import { smokeTest } from "@heossihq/qnsi-shared-kernel/smoke-test-utils"
