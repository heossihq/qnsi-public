# @heossihq/qnsi-sdk-activation

## 0.1.6

### Patch Changes

- Expanded the `SdkActivationRequest.runtime` enum to accept `python`, `go`, and `rust` in addition to the original `browser`, `node`, and `edge` values. This unblocks the new first-party Python (`qnsp` on PyPI), Go (`github.com/heossihq/qnsi-public/sdks/go/qnsp`), and Rust (`qnsp` on crates.io) SDKs whose activation handshake reports a language-native runtime label rather than masquerading as `node`. The existing `SdkIdentifierSchema` already includes `qnsp-python`, `qnsp-go`, and `qnsp-rust` as valid sdkIds (added in 0.1.5). Production billing-service was redeployed on 2026-04-30 to pick up the matching schema (task-def revision `qnsp-prod-billing-service:21`).

## 0.1.5

### Patch Changes

- Added `qnsp-python`, `qnsp-go`, and `qnsp-rust` to the `SdkIdentifierSchema` enum so the new first-party Python, Go, and Rust SDKs can pass activation. Both this package and the duplicate Zod-v4 mirror at `apps/billing-service/src/routes/sdk-activation-schemas.ts` were updated in lockstep.

## 0.1.4

### Patch Changes

- Routine maintenance bump.

## 0.1.3

### Patch Changes

- 1ac5429: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 1ac5429: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 59ec933: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 1ad6813: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 54f677d: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- d311fc1: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 8b8c331: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- dbfd5fd: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- e88fb5d: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- aaa11cc: docs: add GitHub and Google OAuth sign-up links and update platform sign-in references across all published SDKs; add OAuth/Social Sign-In section to @heossihq/qnsi-auth-sdk; add README to @heossihq/qnsi-agent
