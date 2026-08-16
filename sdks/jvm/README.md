# QNSI JVM SDK - `com.heossi:qnsi`

Official **JVM / Android** SDK for the Quantum-Native Security Infrastructure (QNSI).
One artifact serves both server-side JVM (Spring Boot, plain Java/Kotlin) and
native Android (API 21+), because the only transport dependency - **OkHttp** -
runs on both. Mirrors the wire contract of the `@heossihq/qnsi` (npm), `qnsi`
(PyPI), and Go/Rust SDKs.

> **`com.heossi:qnsi:0.3.0`.** The ten service sub-clients route via `/proxy/<svc>/v1`
> and the auth client targets the real auth routes - all verified end-to-end against
> production (`ProdSmokeTest`). Service sub-clients: vault, kms, audit, tenant, access,
> billing, cryptoInventory, storage, search, ai. The `auth` client covers password login,
> session refresh/revoke, MFA, and risk-based auth; WebAuthn passkeys and SAML/OIDC
> federation are intentionally not exposed (no per-call backend surface).
> (Supersedes the retired `io.cuilabs:qnsp` line published under the former CUI Labs brand.)

## Install

Gradle (Kotlin DSL):
```kotlin
dependencies {
    implementation("com.heossi:qnsi:0.3.0")
}
```

Maven:
```xml
<dependency>
  <groupId>com.heossi</groupId>
  <artifactId>qnsi</artifactId>
  <version>0.3.0</version>
</dependency>
```

Get a free API key at <https://cloud.qnsi.heossi.com/auth>.

## Design

| Concern | Choice |
|---|---|
| Source language | Kotlin, with a Java-interop-clean public API (`@JvmStatic` / `@JvmOverloads`) |
| Transport | OkHttp 4.12 (JVM **and** Android 21+) |
| JSON | kotlinx.serialization (compile-time, no reflection → R8/ProGuard-clean) |
| Errors | unchecked `QnsiException` hierarchy (no checked-exception noise for Java) |
| Crypto | **not in this SDK** - server-side KMS does PQC; on-device stays Bouncy Castle / OS-native |

## Usage

```kotlin
val qnsi = QnsiClient(System.getenv("QNSI_API_KEY"))
qnsi.ensureActivated()                       // surfaces an invalid key eagerly
println("tenant=${qnsi.tenantId()} tier=${qnsi.tier()}")

// Server-side PQC keys
val key = qnsi.kms.createKey(CreateKeyRequest(algorithm = "ml-dsa-65", purpose = "signing"))
val sig = qnsi.kms.sign(key["keyId"]!!.jsonPrimitive.content, "hello".toByteArray())

// PQC-encrypted vault
qnsi.vault.createSecret(CreateSecretRequest(name = "api-key", payloadB64 = base64Payload))

// Audit, tenant, billing, access, storage, search, ai … all on `qnsi.<service>`
```

```java
QnsiClient qnsi = new QnsiClient(System.getenv("QNSI_API_KEY"));
qnsi.ensureActivated();
JsonObject key = qnsi.kms().createKey(new CreateKeyRequest("ml-dsa-65", "signing"));
```

Service methods return `kotlinx.serialization.json.JsonObject` (mirroring the
reference `@heossihq/qnsi` SDK's untyped responses); KMS `sign`/`wrap`/`unwrap`
return `ByteArray`, `verify` returns `Boolean`. Mutating calls accept an
optional `idempotencyKey`; list calls accept a `query` map.

Webhook verification is available now:

```kotlin
val event = QnsiWebhooks.parse(rawBody, signatureHeader, webhookSecret, timestampHeader)
```

## Activation gate (Phase 0 - blocks publish)

The SDK calls `POST /billing/v1/sdk/activate` with
`{ sdkId: "qnsi-jvm", runtime: "jvm", sdkVersion }`. Those two values are
**not yet in the billing enum**. Before this SDK can authenticate, add `qnsi-jvm`
and the `jvm` runtime to all three mirrors **in one commit** and deploy
billing-service first:

- `packages/sdk-activation/src/types.ts`
- `packages/qnsi/src/_activation/types.ts`
- `apps/billing-service/src/routes/sdk-activation-schemas.ts`

Then verify the live endpoint returns `401 INVALID_API_KEY` (not a Zod schema
rejection) for a bad key. See `.claude/rules/sdk-publish-checklist.md`.

## Build & test

```bash
cd sdks/jvm
./gradlew build                        # compile + run unit tests (Gradle wrapper pinned to 9.5.1)
```

(Requires network on first run to resolve OkHttp / kotlinx.serialization / JUnit.)
Verified green on 2026-05-31 with Gradle 9.5.1 / Kotlin 2.0.21 / JDK 21:
**9 tests, 0 failures** (`InternalTest` ×4, `WebhooksTest` ×5).

## License

Apache-2.0.

## On-device PQC module - `com.heossi:qnsi-crypto` (JVM / Android)

The optional `crypto/` subproject adds on-device post-quantum cryptography for
JVM and Android callers: ML-KEM-768 / ML-KEM-1024 (FIPS 203) and ML-DSA-65 /
ML-DSA-87 (FIPS 204) via Bouncy Castle's lightweight API (`QnsiDevicePqc`).
It runs identically on any JVM and on Android API 21+ (no dependence on the
Android 17 Keystore floor) and uses raw NIST wire encodings, proven
byte-for-byte interoperable with Apple CryptoKit and `@noble/post-quantum` by
`scripts/verify/mobile-pqc-interop.mjs` (8/8 checks). It is a separate artifact
so the core transport SDK keeps OkHttp as its only runtime dependency; a failed
PQC operation throws (fail closed) and every result carries the
`"bouncycastle"` provider label.

```kotlin
val pair = QnsiDevicePqc.generateSigningKeyPair(QnsiDevicePqc.SignatureAlgorithm.ML_DSA_65)
val sig = QnsiDevicePqc.sign(QnsiDevicePqc.SignatureAlgorithm.ML_DSA_65, pair.privateKey, msg)
```
