# Publishing the QNSI Swift SDK (SPM via qnsi-public)

> **Status (2026-08-17):** publish-ready and export-verified. Phase 0 satisfied
> and proven live: billing-service rev 68 (image `prod-b731a3065712`) accepts
> `sdkId=qnsi-swift` / `runtime=swift` - the invalid-key probe returned **401**
> (not a 400 Zod enum rejection) and the canary-key `ProdSmokeTests` ran
> **3/3 PASS** against production.

Distribution channel: the existing public mirror **`heossihq/qnsi-public`**.
Swift Package Manager requires `Package.swift` at the repository ROOT, so the
monorepo carries a root manifest whose targets point into `sdks/swift/`; the
exporter ships both the manifest and the SDK source (see
`scripts/automation/export-qnsi-public.py`, verified by
`test_export_qnsi_public.py` and a local `--out` export that `swift build`s).

SPM also requires **semver tags**. qnsi-public's date-form release tags
(`vYYYY.MM.DD`) are not valid semver, so each Swift SDK release adds a plain
semver tag (`0.1.0`, `0.2.0`, ...) on qnsi-public pointing at the export that
carries that SDK version.

Consumers install with:

```swift
.package(url: "https://github.com/heossihq/qnsi-public.git", exact: "0.1.0")
```

## Phase 0 gate (verify before every publish)

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'authorization: Bearer test_invalid_key' -H 'content-type: application/json' \
  -H 'user-agent: qnsi-verify/1.0' \
  -d '{"sdkId":"qnsi-swift","sdkVersion":"0.1.0","runtime":"swift"}' \
  https://api.qnsi.heossi.com/billing/v1/sdk/activate
# Expect 401 (INVALID_API_KEY). A 400 listing the enum means billing-service
# predates the qnsi-swift deploy - do NOT publish.
```

## Release steps

1. Green + prod-proven locally:

   ```bash
   swift test                                    # repo root: 25 tests via the root manifest
   QNSP_CANARY_KEY=... swift test --filter ProdSmokeTests   # 3/3 vs prod (run in sdks/swift)
   node scripts/verify/mobile-pqc-interop.mjs    # 8/8 cross-implementation
   ```

2. Land on origin/main (the publish script refuses otherwise): worktree clean,
   `git push origin main` through the full pre-push gates.

3. Publish the mirror (canonical pipeline - never hand-push exported content):

   ```bash
   scripts/automation/publish-qnsi-public-local.sh --publish
   scripts/automation/release-qnsi-public-local.sh <workdir> vYYYY.MM.DD
   ```

4. Add the SPM semver tag for this SDK version on qnsi-public:

   ```bash
   git -C <qnsi-public-clone> tag 0.1.0 && git -C <qnsi-public-clone> push origin 0.1.0
   ```

5. Clean-room verification (the proof the publish worked - from an EMPTY
   directory, no local paths): create a scratch executable package that
   depends on `https://github.com/heossihq/qnsi-public.git` `exact: "0.1.0"`,
   `import QNSI`, call `QnsiClient` + `QnsiDevicePqc`, and `swift run`.

6. Version bumps: update `sdkVersion` in
   `sdks/swift/Sources/QNSI/Internal/Transport.swift` AND the `TransportTests`
   expectation (the exporter derives the catalog version from that constant),
   re-run step 1, then repeat 2-5 with the new semver tag.

## Hard ordering - do NOT publish before Phase 0

Same rule as every QNSI SDK (see `sdks/jvm/PUBLISHING.md`): the activation
enum must be deployed to production billing-service BEFORE any user can
activate, otherwise the published SDK is dead on arrival with a Zod 400.
