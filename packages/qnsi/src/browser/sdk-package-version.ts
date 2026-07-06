/**
 * Published semver — used for SDK activation metering (must match the npm
 * publish version of `@heossi/qnsi`).
 *
 * Kept as a literal (not a `../package.json` JSON import) because this module
 * must stay browser-safe — no `node:fs` runtime read — and a static JSON
 * import would resolve outside the package `rootDir` (TS6059). This mirrors
 * the same release-bump contract as `SDK_VERSION` in `../_internal.ts`:
 * **bump this in lockstep with `packages/qnsi/package.json` `version`.**
 */
export const SDK_PACKAGE_VERSION = "0.3.0";
