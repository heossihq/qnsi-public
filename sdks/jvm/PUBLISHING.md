# Publishing `com.heossi:qnsi` to Maven Central

> **Status (2026-06-22):** target coordinates are **`com.heossi:qnsi:0.3.0`** (com.heossi
> reverse-maps to the real domain `heossi.com`). NOT yet on Central - gated on the
> `com.heossi` namespace being DNS-verified on `heossi.com`. The artifact is publish-ready:
> `ProdSmokeTest` 3/3 vs prod, signed bundle valid (`gpg --verify` Good).
>
> **What IS on Central:** the legacy `io.cuilabs:qnsp` (`0.1.0`, `0.2.0`) under the former
> CUI Labs brand. **Maven Central is immutable** - those published artifacts can NOT be
> deleted (by anyone, including Sonatype); they can only be **superseded/deprecated**.
> `io.heossi:qnsi` was NEVER published (a prior doc claim of "io.heossi:qnsi:0.1.0 live" was
> a rebrand-sed error - the real deployment `23e36075…` was `io.cuilabs:qnsp`). The steps
> below are the repeatable API runbook.

## How 0.1.0 was published (the working method)

The repo's `build.gradle.kts` (`maven-publish` + `signing`) produces correctly
**signed** artifacts via `publishToMavenLocal`. The Central Portal upload was
done **manually** (the vanniktech plugin requires Kotlin ≥ 2.2; this SDK is on
2.0.21), via a signed bundle:

1. `set -a; . ./.env; set +a` then export the armored key:
   `export SIGNING_KEY="$(gpg --armor --pinentry-mode loopback --passphrase "$SIGNING_PASSWORD" --export-secret-keys "$SIGNING_KEY_ID")"`
2. `cd sdks/jvm && ./gradlew publishToMavenLocal` → signed artifacts + `.asc` in `~/.m2`.
3. Build a zip in `com/heossi/qnsi/0.3.0/` layout with each artifact + `.asc` + md5/sha1/sha256/sha512.
4. `POST https://central.sonatype.com/api/v1/publisher/upload?publishingType=USER_MANAGED`
   with `Authorization: Bearer base64($CENTRAL_USERNAME:$CENTRAL_PASSWORD)`, form `bundle=@zip`.
5. Poll `POST /api/v1/publisher/status?id=<id>` → `VALIDATED`.
6. Release: `POST /api/v1/publisher/deployment/<id>` → `PUBLISHING` → `PUBLISHED`.

Signing key: GPG fpr `182CDEB39D55E271B305187EBD823F45EE73F8E1` (keyid `BD823F45EE73F8E1`),
on keys.openpgp.org + keyserver.ubuntu.com. Creds (`CENTRAL_USERNAME/PASSWORD`,
`SIGNING_PASSWORD`, `SIGNING_KEY_ID`) live in the gitignored `.env`.

## Original prerequisites (now satisfied)

## Prerequisites (one-time, require a human)

1. **Register the `com.heossi` namespace on the Central Portal**
   (<https://central.sonatype.com>). Verify ownership via the DNS TXT challenge
   on `heossi.com`. Until verified, no `com.heossi:*` artifact can be published.
2. **Generate a GPG signing key**, publish the public key to a keyserver, and
   provide it to the release environment as `SIGNING_KEY` (ASCII-armored private
   key) + `SIGNING_PASSWORD`. The `signing` block in `build.gradle.kts` engages
   only when `SIGNING_KEY` is present.
3. **Central Portal publisher token** → expose as Gradle properties / env for
   the upload step.

## Release steps (once the above exist)

```bash
cd sdks/jvm
./gradlew clean build                         # 16 tests + apiCheck must pass
./gradlew publishToMavenLocal                 # final smoke of the publication
# Publish: bundle the staged artifacts and upload via the Central Portal
# (publisher API or the central-publishing Gradle plugin), then release the
# deployment in the Portal UI / API.
```

## Hard ordering - do NOT publish before Phase 0

The SDK calls `POST /billing/v1/sdk/activate` with `sdkId=qnsp-jvm`,
`runtime=jvm`. Those values must already be in the **billing-service** enum and
**deployed to production** before any user can activate. Verify live:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'authorization: Bearer test_invalid_key' -H 'content-type: application/json' \
  -d '{"sdkId":"qnsp-jvm","sdkVersion":"0.3.0","runtime":"jvm"}' \
  https://api.qnsi.heossi.com/billing/v1/sdk/activate
# Expect 401 (INVALID_API_KEY), NOT a 400 Zod schema rejection listing the old enum.
```

See `.claude/rules/sdk-publish-checklist.md` and the sibling
`sdks/python/qnsi/PUBLISH_RUNBOOK.md`.
