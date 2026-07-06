---
title: Browser SDK (@heossi/qnsi-browser)
version: 0.1.4
last_updated: 2026-04-30
copyright: © 2025-2026 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/browser-sdk/src/index.ts
  - /packages/browser-sdk/src/encrypt.ts
  - /packages/browser-sdk/src/sign.ts
  - /packages/browser-sdk/src/provider-setup.ts
---

> **Note** — As of 2026-04-30, the per-service `@heossi/qnsi-storage-sdk` package is consolidated into the unified `@heossi/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossi/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.storage./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# Browser SDK (`@heossi/qnsi-browser`)

Browser-compatible PQC encryption SDK for the QNSI platform. Provides client-side encryption (CSE), digital signatures, and key management using NIST FIPS 203/204/205 standards via `@noble/post-quantum`.

No native dependencies. No `node:` imports. Works in browsers, Deno, Bun, and Node.js.

## Install

```bash
pnpm add @heossi/qnsi-browser
```

## Supported Algorithms

18 FIPS-standardized algorithms across 3 families:

| Family | Standard | Algorithms | Use Case |
|--------|----------|------------|----------|
| ML-KEM | FIPS 203 | kyber-512, kyber-768, kyber-1024 | Key encapsulation (encryption) |
| ML-DSA | FIPS 204 | dilithium-2, dilithium-3, dilithium-5 | Digital signatures |
| SLH-DSA | FIPS 205 | 12 parameter sets (SHA2/SHAKE × 128/192/256 × f/s) | Hash-based signatures |

## Quick Start

```ts
import {
  initializePqcProvider,
  encryptBeforeUpload,
  decryptAfterDownload,
  generateEncryptionKeyPair,
} from "@heossi/qnsi-browser";

// Initialize the PQC provider with your QNSI API key
await initializePqcProvider({ apiKey: "YOUR_API_KEY" });

// Generate ML-KEM key pair
const { publicKey, privateKey } = await generateEncryptionKeyPair("kyber-768");

// Encrypt data before upload (ML-KEM + AES-256-GCM)
const plaintext = new TextEncoder().encode("classified document");
const envelope = await encryptBeforeUpload(plaintext, publicKey, "kyber-768");

// Decrypt data after download
const decrypted = await decryptAfterDownload(envelope, privateKey);
```

## Provider Setup

The SDK auto-detects the runtime environment and initializes the noble PQC provider.

```ts
import {
  initializePqcProvider,
  isProviderInitialized,
  getActiveProvider,
  detectRuntime,
  getSupportedAlgorithms,
  resetProvider,
} from "@heossi/qnsi-browser";

// Detect runtime environment
const runtime = detectRuntime(); // "browser" | "edge" | "node"

// Initialize provider with your QNSI API key
await initializePqcProvider({ apiKey: "YOUR_API_KEY" });

// Check initialization status
console.log(isProviderInitialized()); // true

// Get the active provider instance
const provider = getActiveProvider();

// List supported algorithms
const algorithms = getSupportedAlgorithms(); // 18 algorithms

// Reset provider (for testing)
resetProvider();
```

## Client-Side Encryption (CSE)

Encrypt data in the browser before uploading to QNSI storage. Uses ML-KEM for key encapsulation and AES-256-GCM for symmetric encryption.

```ts
import {
  encryptBeforeUpload,
  decryptAfterDownload,
  serializeCseEnvelope,
  deserializeCseEnvelope,
  type CseEnvelope,
} from "@heossi/qnsi-browser";

// Encrypt
const envelope: CseEnvelope = await encryptBeforeUpload(
  plaintext,
  recipientPublicKey,
  "kyber-768"
);
// envelope contains: { algorithm, kemCiphertext, iv, ciphertext }

// Serialize for transport (binary format)
const bytes: Uint8Array = serializeCseEnvelope(envelope);

// Deserialize after download
const restored: CseEnvelope = deserializeCseEnvelope(bytes);

// Decrypt
const decrypted: Uint8Array = await decryptAfterDownload(restored, privateKey);
```

### CSE Envelope Format

| Field | Type | Description |
|-------|------|-------------|
| `algorithm` | `PqcAlgorithm` | KEM algorithm used (e.g., `kyber-768`) |
| `kemCiphertext` | `Uint8Array` | KEM ciphertext (encapsulated shared secret) |
| `iv` | `Uint8Array` | AES-256-GCM initialization vector (12 bytes) |
| `ciphertext` | `Uint8Array` | AES-256-GCM encrypted data |

## Digital Signatures

Sign and verify data using ML-DSA or SLH-DSA.

```ts
import {
  signData,
  verifySignature,
  generateSigningKeyPair,
  generateEncryptionKeyPair,
  type SignedEnvelope,
} from "@heossi/qnsi-browser";

// Generate ML-DSA signing key pair
const sigKeyPair = await generateSigningKeyPair("dilithium-3");

// Sign data
const signed: SignedEnvelope = await signData(
  data,
  sigKeyPair.privateKey,
  "dilithium-3"
);
// signed contains: { data, signature, algorithm }

// Verify signature
const valid: boolean = await verifySignature(
  signed.data,
  signed.signature,
  sigKeyPair.publicKey,
  "dilithium-3"
);

// Generate ML-KEM encryption key pair
const encKeyPair = await generateEncryptionKeyPair("kyber-768");
```

## Runtime Environments

| Environment | Detection | Provider |
|-------------|-----------|----------|
| Browser | `"window" in globalThis` | noble (pure JS) |
| Edge (Cloudflare Workers, Vercel Edge) | `"EdgeRuntime" in globalThis` | noble (pure JS) |
| Node.js / Deno / Bun | Default | noble (pure JS) |

The noble provider uses `@noble/post-quantum` which is a pure JavaScript implementation with no native dependencies, making it compatible with all JavaScript runtimes.

## Integration with Storage SDK

```ts
import { initializePqcProvider, encryptBeforeUpload, generateEncryptionKeyPair } from "@heossi/qnsi-browser";
import { StorageClient } from "@heossi/qnsi-storage-sdk";

await initializePqcProvider({ apiKey: "YOUR_API_KEY" });

// Generate keys
const { publicKey, privateKey } = await generateEncryptionKeyPair("kyber-768");

// Encrypt document in browser
const plaintext = await file.arrayBuffer();
const envelope = await encryptBeforeUpload(
  new Uint8Array(plaintext),
  publicKey,
  "kyber-768"
);

// Upload encrypted envelope to QNSI storage
const storage = new StorageClient({ baseUrl, apiKey, tenantId });
const upload = await storage.initiateUpload({
  name: file.name,
  mimeType: file.type,
  sizeBytes: envelope.ciphertext.length,
  classification: "confidential",
});
```

## Key APIs

### Provider Management
- `initializePqcProvider({ apiKey })` — Initialize the noble PQC provider with API key
- `isProviderInitialized()` — Check if provider is ready
- `getActiveProvider()` — Get the active `PqcProvider` instance
- `detectRuntime()` — Detect current runtime environment
- `getSupportedAlgorithms()` — List all 18 supported algorithms
- `resetProvider()` — Reset provider state
- `NOBLE_SUPPORTED_ALGORITHMS` — Array of all supported algorithm names

### Encryption
- `encryptBeforeUpload(data, publicKey, algorithm)` — Encrypt with ML-KEM + AES-256-GCM
- `decryptAfterDownload(envelope, privateKey)` — Decrypt CSE envelope
- `serializeCseEnvelope(envelope)` — Serialize to binary
- `deserializeCseEnvelope(data)` — Deserialize from binary

### Signatures
- `signData(data, privateKey, algorithm)` — Sign data with ML-DSA or SLH-DSA
- `verifySignature(data, signature, publicKey, algorithm)` — Verify signature
- `generateSigningKeyPair(algorithm)` — Generate ML-DSA or SLH-DSA key pair
- `generateEncryptionKeyPair(algorithm)` — Generate ML-KEM key pair

### Types
- `CseEnvelope` — Client-side encryption envelope
- `SignedEnvelope` — Signed data envelope
- `RuntimeEnvironment` — `"browser" | "edge" | "node"`
- `PqcAlgorithm` — Re-exported from `@heossi/qnsi-cryptography`
- `PqcKeyPair` — Re-exported from `@heossi/qnsi-cryptography`
- `PqcProvider` — Re-exported from `@heossi/qnsi-cryptography`
