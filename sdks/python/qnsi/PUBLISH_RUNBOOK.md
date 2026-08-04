# `qnsp` PyPI publish runbook

The `qnsp` package on PyPI is published from the
[`publish-python-sdks.yml`](../../../.github/workflows/publish-python-sdks.yml)
GitHub Actions workflow on every `main` push that touches
`sdks/python/**`. The workflow uses **PyPI trusted publishing (OIDC)**,
which avoids storing long-lived API tokens in GitHub Secrets.

> **Primary publish path is LOCAL-FIRST** (founder directive 2026-05-16):
> publish from the workstation with the `.env` PyPI account token - see the
> canonical procedure in
> [`.claude/rules/sdk-publish-checklist.md`](../../../.claude/rules/sdk-publish-checklist.md)
> ("PyPI (`qnsp`)"). The GitHub Actions / trusted-publishing path below is the
> **fallback**, used only when local publish is unavailable (it costs Actions
> credits). The rest of this runbook is reference for that fallback plus the
> one-time org setup.

## Current ownership state (2026-06-04)

`qnsp` **already exists** on PyPI (latest `0.3.0`), first published 2026-05-16
via an **account-scoped token** under the PyPI **user account `heossi`** -
because the org wasn't approved yet and a project-scoped token can't create a
not-yet-existing project (the global name is claimed under whichever account
first uploads).

The PyPI **Company org `heossi`** was **approved + created on 2026-06-04**
(email from noreply@pypi.org to ops@heossi.com). So the remaining action is a
**one-time transfer** of the existing project from the user account into the
org. There is **no PyPI API for this - it is web-UI only.**

### Transfer the `qnsp` project into the `heossi` org (web UI, owner only)

Per <https://docs.pypi.org/organization-accounts/actions/project-actions/>,
logged in as the `heossi` user (who owns both the project and the org):

1. **Your organizations** → **Manage** on `heossi`
2. **Projects**
3. Scroll to the bottom, pick **`qnsp`** from the project dropdown
4. **Transfer existing project**

Ownership shifts from the individual user to the org. **No re-publish, no
version bump** - package metadata and installed artifacts are unaffected
(org ownership is invisible to `pip`).

After transfer, the local-publish `.env` account token should still authorise
uploads (the user remains an Owner via the org) - but **verify on the next
publish**; if PyPI rejects it, mint a new org/project-scoped token or use the
trusted-publishing fallback below.

## Trusted-publishing fallback setup (only if using Actions)

`qnsp` now exists, so this is a **regular** trusted-publisher binding (not the
"pending publisher" flow). Add it on the project's own page:

1. <https://pypi.org/manage/project/qnsp/settings/publishing/> →
   **Add a new publisher** (GitHub Actions), values (case-sensitive):

   | Field | Value |
   |---|---|
   | Owner | `heossi` |
   | Repository name | `qnsp` |
   | Workflow name | `publish-python-sdks.yml` |
   | Environment name | `pypi-publish` |

   > "Owner" here is the **GitHub** org (where the source repo lives), which
   > happens to share the name `heossi` with the PyPI org but is configured
   > separately.

2. Create the matching GitHub deploy environment once:
   <https://github.com/heossi/qnsp/settings/environments> →
   **New environment** → `pypi-publish` → (optional) add a **Required
   reviewer** rule. If it doesn't exist, GitHub auto-creates it with no
   protection on first run (the workflow still succeeds; you just lose the
   approval gate).

## Verifying the binding worked

After the org is approved, the pending publisher is configured, and
the GitHub `pypi-publish` environment exists, retrigger the workflow on
the most recent commit that touched `sdks/python/**`:

```bash
gh workflow run publish-python-sdks.yml --ref main
gh run watch
```

The workflow uses [`pypa/gh-action-pypi-publish@release/v1`](https://github.com/pypa/gh-action-pypi-publish),
which exchanges the GitHub OIDC token for a short-lived PyPI API token
automatically - no PyPI token is stored in GitHub Secrets.

Expected outcome: a successful upload to <https://pypi.org/project/qnsp/>.
Confirm with:

```bash
pip index versions qnsp        # should list the published version
pip install qnsi==<version>    # smoke install in a clean venv
```

If the run fails with `Trusted publishing exchange failure`, double-check
that the `Owner / Repository / Workflow / Environment` quartet on PyPI
matches the workflow's `heossi / qnsp / publish-python-sdks.yml /
pypi-publish` exactly (case-sensitive).

## When to bump the version

The publish action is invoked with `skip-existing: true`, so re-running
the workflow on the same version is a no-op (PyPI rejects the duplicate
upload, and the action treats it as a successful skip). To trigger a real
publish:

1. Bump `version` in
   [`sdks/python/qnsi/pyproject.toml`](pyproject.toml).
2. Add a new entry to [`CHANGELOG.md`](CHANGELOG.md).
3. Commit + push to `main`. The path filter on `sdks/python/**` will
   re-trigger the workflow automatically.

## Production billing-service activation gate (resolved 2026-04-30)

`qnsp` v0.2.0+ calls `/billing/v1/sdk/activate` on first use with
`sdkId="qnsp-python"` and `runtime="python"`. Both the sdkId and the
runtime label live in two source-of-truth files that are kept in sync:

- [`packages/sdk-activation/src/types.ts`](../../../packages/sdk-activation/src/types.ts)
- [`apps/billing-service/src/routes/sdk-activation-schemas.ts`](../../../apps/billing-service/src/routes/sdk-activation-schemas.ts)

Production billing-service was redeployed on 2026-04-30 (commit
[`112f54075b49`](https://github.com/heossihq/qnsi-public/commit/112f54075b49),
ECS task-def `qnsp-prod-billing-service:21`) so the live schema accepts
the new enums end-to-end. Verify with:

```bash
curl -s -X POST -H 'authorization: Bearer test_invalid' \
  -H 'content-type: application/json' \
  -d '{"sdkId":"qnsp-python","sdkVersion":"0.2.0","runtime":"python"}' \
  https://api.qnsi.heossi.com/billing/v1/sdk/activate
# Expect: {"activated":false,"code":"INVALID_API_KEY",...}
# (Schema accepts the request; the test API key fails validation,
# which is correct for a test-invalid token.)
```

If you ever extend the `SdkIdentifier` enum or add a new runtime label,
remember to update **both** source files in the same commit and redeploy
billing-service before publishing the SDK update.

## Yanking a bad release

If a bad version reaches PyPI:

```bash
# requires PyPI maintainer credentials interactively or via ~/.pypirc
twine upload --skip-existing dist/*  # standard reupload still no-op
# yanking is a UI-only action on https://pypi.org/manage/project/qnsp/release/<version>/
```

PyPI yanks remove the version from `pip install qnsi` defaults (so
`pip install qnsi` on a fresh resolve will not pick the yanked version)
but leave the version installable via pinned `pip install qnsi==<yanked>`.
This is the right tool for "this version is broken, please don't use it"
without breaking pinned reproducible builds elsewhere.
