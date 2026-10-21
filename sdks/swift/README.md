# QNSI Swift SDK - `qnsi-swift`

Official Swift SDK for the Quantum-Native Security Infrastructure (QNSI) on
iOS and macOS. Integrates with `@heossihq/qnsi` (npm), `qnsi` (PyPI), Go/Rust, and
`com.heossi:qnsi` (JVM) SDKs: one client, eleven service sub-clients (vault,
kms, audit, auth, tenant, access, billing, cryptoInventory, storage, search,
ai) and the shared activation handshake. Cross-language and production acceptance
require independent evidence.

## Manifest operation access (unreleased source)

`SurfaceClient.operations()` returns the bundled catalog of 880 manifest
declarations across 15 services. `qnsi.surface.callOperation(operationId:,
pathParameters:, body:, options:)` uses the shared transport and returns
`JSONValue`, preserving object, array and scalar JSON responses. Options carry
query and idempotency data. Invalid path parameters fail before HTTP.

Existing service and on-device PQC APIs are preserved. Catalog presence is not
live availability, typed payload-schema parity or permission to invoke a route.
Publication, full-source coverage, device matrix and production acceptance of
these additions are **NOT VERIFIED**.

## What makes it different from the other QNSI SDKs

On-device post-quantum cryptography via Apple CryptoKit (`QnsiDevicePqc`):
ML-KEM-768 / ML-KEM-1024 (FIPS 203) key encapsulation and ML-DSA-65 /
ML-DSA-87 (FIPS 204) signatures execute in the OS's own implementation
(Apple corecrypto underneath) on iOS 26+ / macOS 26+. Below that OS floor
every device-PQC call throws `QnsiError.devicePqc` - the SDK fails CLOSED and
never silently falls back to classical cryptography, matching the QNSI
platform invariant.

Interop with the rest of the platform is proven byte-for-byte against
`@noble/post-quantum` and Bouncy Castle by the committed harness
`scripts/verify/mobile-pqc-interop.mjs` (8/8 cross-implementation checks).

## Requirements

- Transport core: iOS 15+ / macOS 12+ (Swift 5.9 toolchain).
- Device PQC (`QnsiDevicePqc`): iOS 26+ / macOS 26+ (availability-gated,
  `QnsiDevicePqc.isAvailable`).

## Install (Swift Package Manager)

Add the package to your `Package.swift` or Xcode project and depend on the
`QNSI` library product.

## Usage

```swift
import QNSI

let qnsi = try QnsiClient(apiKey: ProcessInfo.processInfo.environment["QNSI_API_KEY"] ?? "")
try await qnsi.ensureActivated()   // surfaces an invalid key eagerly
print("tenant=\(try await qnsi.tenantId()) tier=\(try await qnsi.tier())")

// Server-side PQC via kms-service
let key = try await qnsi.kms.createKey(algorithm: "ml-dsa-65", purpose: "signing")

// PQC-encrypted secrets via vault-service
let secret = try await qnsi.vault.createSecret(
    name: "db-password",
    payloadB64: Data("hunter2".utf8).base64EncodedString()
)

// On-device PQC (iOS 26+ / macOS 26+): keys never leave the device
let pair = try QnsiDevicePqc.generateSigningKeyPair(.mlDsa65)
let signature = try QnsiDevicePqc.sign(.mlDsa65, privateSeed: pair.privateSeed,
                                       message: Data("attest".utf8))
```

Webhook verification (HMAC-SHA-256 over the raw body, constant-time):

```swift
let event = try QnsiWebhooks.parse(body: rawBody, signatureHeader: header, secret: secret)
```

## Activation gate

Activation sends `sdkId: "qnsi-swift"`, `runtime: "swift"` to
`POST /billing/v1/sdk/activate`. Both values must exist in the billing-service
activation enum (`packages/sdk-activation/src/types.ts`,
`packages/qnsi/src/_activation/types.ts`,
`apps/billing-service/src/routes/sdk-activation-schemas.ts`) and billing-service
must be deployed with them BEFORE this SDK is published.

## Build & test

```sh
swift build
swift test                                  # full suite, requires approved production canary credentials
swift test --filter 'TransportSecurityTests|LocalRedirectTests|TransportTests|SurfaceTests|WebhooksTests|DevicePqcTests' # local regression diagnostic only
QNSP_CANARY_KEY=... swift test --filter ProdSmokeTests   # REAL prod e2e
node ../../scripts/verify/mobile-pqc-interop.mjs         # cross-impl interop proof
```

The latest full local run executes 39 tests: 37 pass and two production network
verifiers fail closed without approved canary credentials. No tests are skipped.
Full-source LLVM measurement covers 18 production Swift files: 767/1271 lines,
125/216 functions and 362/597 regions. Branch and separate statement coverage
are not measured, so the complete exact-100% gate remains unsatisfied.
The local checks on macOS ARM64 with Swift 6.4 include
actual loopback HTTP redirects at activation/service/retry/session boundaries,
URLProtocol transport fixtures, webhook checks and actual CryptoKit ML-KEM/ML-DSA
round trips with size and tamper assertions. This is not the full suite,
production acceptance, a supported-platform matrix or 100% source coverage.
The two production network tests fail when `QNSP_CANARY_KEY` is absent; they
never report a skipped production verifier. Production mutations require an
approved tenant/scope before execution. On an OS below the device-PQC floor,
device tests assert fail-closed errors, not successful native cryptography.

Vault exposes engine catalog, config creation/listing, credential issuance,
lease listing/renewal/revocation and dynamic statistics. A queued revocation
acknowledgement is not proof of provider revocation. Existing secret methods remain
available. Explicit tenant overloads for inventory statistics/readiness forward
the caller's identifier without granting delegation. The new discovery-source
method forwards the backend selector; legacy targets/modes/options remain in
the SDK but are not consumed by that backend handler.

## License

Apache-2.0.
