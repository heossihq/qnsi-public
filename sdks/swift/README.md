# QNSI Swift SDK - `qnsi-swift`

Official Swift SDK for the Quantum-Native Security Infrastructure (QNSI) on
iOS and macOS. Mirrors the `@heossihq/qnsp` (npm), `qnsp` (PyPI), Go/Rust, and
`com.heossi:qnsi` (JVM) SDKs: one client, eleven service sub-clients (vault,
kms, audit, auth, tenant, access, billing, cryptoInventory, storage, search,
ai), the same activation handshake, and the same verified wire contract.

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

let qnsi = try QnsiClient(apiKey: ProcessInfo.processInfo.environment["QNSP_API_KEY"] ?? "")
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
swift test                                  # mocked suites + real CryptoKit PQC tests
QNSP_CANARY_KEY=... swift test --filter ProdSmokeTests   # REAL prod e2e
node ../../scripts/verify/mobile-pqc-interop.mjs         # cross-impl interop proof
```

`swift test` runs 25 tests: URLProtocol-mocked transport tests (activation,
tenant injection, 401 retry, verified wire field names), webhook tests, and
REAL CryptoKit ML-KEM/ML-DSA round trips with FIPS 203/204 size assertions and
tamper rejection. The two `ProdSmokeTests` network tests skip unless
`QNSP_CANARY_KEY` is set.

## License

Apache-2.0.
