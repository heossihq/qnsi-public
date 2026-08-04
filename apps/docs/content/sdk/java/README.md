---
title: JVM / Android SDK
version: 0.4.0
last_updated: 2026-07-20
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
---
# JVM / Android SDK

QNSI ships a first-party **JVM / Android SDK** - `com.heossi:qnsi` on Maven
Central. One artifact serves both **server-side JVM** (Spring Boot, plain
Java/Kotlin) and **native Android** (API 21+), because its only transport
dependency, OkHttp, runs on both. It mirrors the wire contract of the
TypeScript, Python, Go, and Rust SDKs byte-for-byte (same 11-service surface,
same algorithm names, same FIPS 203 / 204 / 205 posture).

## Install

Gradle (Kotlin DSL):

```kotlin
dependencies {
    implementation("com.heossi:qnsi:0.4.0")
}
```

Maven:

```xml
<dependency>
  <groupId>com.heossi</groupId>
  <artifactId>qnsi</artifactId>
  <version>0.4.0</version>
</dependency>
```

Get a free API key at <https://cloud.qnsi.heossi.com/auth>. The client performs
the `POST /billing/v1/sdk/activate` handshake automatically on first use (see
[SDK Activation](../sdk-activation.md)).

## Quick start

Kotlin:

```kotlin
val qnsi = QnsiClient(System.getenv("QNSI_API_KEY"))
qnsi.ensureActivated()                       // surfaces an invalid key eagerly
val key = qnsi.kms.createKey(CreateKeyRequest(algorithm = "ml-dsa-65", purpose = "signing"))
qnsi.vault.createSecret(CreateSecretRequest(name = "api-key", payloadB64 = payloadB64))
```

Java:

```java
QnsiClient qnsi = new QnsiClient(System.getenv("QNSI_API_KEY"));
qnsi.ensureActivated();
JsonObject key = qnsi.getKms().createKey(new CreateKeyRequest("ml-dsa-65", "signing"));
```

The eleven service sub-clients are reached as `qnsi.<service>` (Kotlin) /
`qnsi.get<Service>()` (Java): `kms`, `vault`, `audit`, `auth`, `tenant`,
`access`, `billing`, `cryptoInventory`, `storage`, `search`, `ai`. Service
methods return `kotlinx.serialization.json.JsonObject`; KMS `sign`/`wrap`/`unwrap`
return `ByteArray`, `verify` returns `Boolean`. Webhook verification is in
`QnsiWebhooks`.

## On-device PQC primitives

The SDK is a managed control-plane client - server-side KMS performs PQC key
operations. For **on-device** PQC inside an Android app (local ML-KEM / ML-DSA),
pair the SDK with a JVM PQC library such as Bouncy Castle, or the OS-native PQC
APIs (Android Keystore PQC, available from Android 17). The byte-for-byte
algorithm-name surface matches the other SDKs:

- KEMs: `ML-KEM-512`, `ML-KEM-768`, `ML-KEM-1024`, `Kyber512..1024`, `BIKE-L1..L5`, `FrodoKEM-{640,976,1344}-{AES,SHAKE}`, `Classic-McEliece-*`, `sntrup761`
- Signatures: `ML-DSA-{44,65,87}`, `Dilithium{2,3,5}`, `Falcon-{512,1024}`, `SLH-DSA-{SHA2,SHAKE}-{128,192,256}{f,s}`, `MAYO-{1,2,3,5}`, `cross-rsdp{,g}-{128,192,256}-{balanced,fast,small}`

## Source & support

Source: [`sdks/jvm/`](https://github.com/heossihq/qnsi-public/tree/main/sdks/jvm).
Questions or feature requests: **qnsi-devrel@heossi.com**.
