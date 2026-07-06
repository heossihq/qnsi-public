# @heossi/qnsi-cryptography

Abstractions and helpers for post-quantum cryptography within the Quantum-Native Security Infrastructure (QNSI). The package defines provider interfaces for key encapsulation, signatures, and hashing while enabling pluggable integrations with HSMs or PQC libraries.

> **v0.2.0 — breaking change.** `initializeExternalPqcProvider()` now requires a QNSI API key. See **[Migration from v0.1.x](#migration-from-v01x)** below.

## Get your free QNSI API key

A free-forever QNSI account takes 60 seconds to set up — sign in with GitHub, Google, or email at <https://cloud.qnsi.heossi.com/auth>. No credit card required. Free tier includes 10 GB PQC storage, 50,000 API calls/month, 20 KMS keys, and 25 vault secrets — and full access to this package.

## Usage

```ts
import { registerPqcProvider } from "@heossi/qnsi-cryptography";
import { initializeExternalPqcProvider } from "@heossi/qnsi-cryptography/providers";

const provider = await initializeExternalPqcProvider("qnsp-hsm-provider", {
  apiKey: process.env.QNSP_API_KEY,           // required since v0.2.0
  algorithms: ["kyber-768", "dilithium-3"],
  configuration: {
    endpoint: process.env.HSM_ENDPOINT
  }
});

registerPqcProvider(provider.name, provider);

const { keyPair } = await provider.generateKeyPair({ algorithm: "kyber-768" });
const signature = await provider.sign({
  algorithm: "dilithium-3",
  data: new TextEncoder().encode("hello"),
  privateKey: keyPair.privateKey
});
```

## Migration from v0.1.x

v0.2.0 adds a one-shot activation handshake against `https://api.qnsi.heossi.com/billing/v1/sdk/activate` the first time you call `initializeExternalPqcProvider()`. The handshake validates your API key, returns your tier limits, and caches a short-lived activation token in memory — subsequent calls reuse it.

**What you need to change:**

```diff
  const provider = await initializeExternalPqcProvider("noble", {
+   apiKey: process.env.QNSP_API_KEY,
    algorithms: ["ml-kem-768", "ml-dsa-65"],
  });
```

That's it. No other code changes.

**If you do not want activation:** the underlying primitives this package wraps are upstream open-source projects that you can use directly — no QNSI signup required. Use [`@noble/post-quantum`](https://github.com/paulmillr/noble-post-quantum) for the pure-JS surface, or build [`liboqs`](https://github.com/open-quantum-safe/liboqs) yourself for the full 87-algorithm native surface. `@heossi/qnsi-cryptography` adds the activation gate, telemetry, attestation receipts, and integration with the rest of the QNSI platform — that is what the API key tracks.

## Providers

`@heossi/qnsi-cryptography` ships two interchangeable PQC providers. Consumers pick the
one that matches their deployment profile.

### `noble` provider (default, pure-JS, always available)

The `noble` provider is backed by [`@noble/post-quantum`](https://github.com/paulmillr/noble-post-quantum)
and ships as a regular `dependency`. It has no native build step, runs on every
Node.js `>= 22` target, and is always available after `npm install @heossi/qnsi-cryptography`.

```ts
import { initializeExternalPqcProvider } from "@heossi/qnsi-cryptography/providers";

const noble = await initializeExternalPqcProvider("noble");
const { keyPair } = await noble.generateKeyPair({ algorithm: "ml-kem-768" });
```

### `liboqs` provider (optional, native, opt-in)

For workloads that require the full 87-algorithm NIST PQC surface (FN-DSA,
every SLH-DSA variant, Classic McEliece), the `liboqs` provider bridges to a native binding of the
[Open Quantum Safe liboqs](https://openquantumsafe.org/) library via the private
package `@heossi/liboqs-native`. This native binding is published **only to
GitHub Packages** (not the public npm registry) and is declared as an
`optionalDependency` of `@heossi/qnsi-cryptography`: public installs that do not have a
`@heossi` scope mapping will silently skip it and the rest of the package
continues to work through the `noble` provider.

To opt in, configure a scope mapping for the `@heossi` org and install the
native binding explicitly:

```bash
echo '@heossi:registry=https://npm.pkg.github.com' >> .npmrc
npm install @heossi/liboqs-native
```

Then bootstrap the provider:

```ts
import { initializeExternalPqcProvider } from "@heossi/qnsi-cryptography/providers";

const liboqs = await initializeExternalPqcProvider("liboqs", {
  algorithms: ["ml-kem-768", "ml-dsa-65"], // optional: restrict to a subset
});
```

If you request the `liboqs` provider without installing the native binding, the
package throws a targeted `Error` with the exact install command above and a
pointer to fall back to `initializeExternalPqcProvider("noble")`. No raw
`ERR_MODULE_NOT_FOUND` stack leaks to the caller.

### Determinism note

Neither provider supports seeded key generation for ML-KEM / ML-DSA / SLH-DSA
because the underlying NIST specifications do not expose deterministic key
generation primitives. Use `generateKeyPair` for production; use your own
test fixtures for deterministic test scenarios.

## Scripts

```bash
pnpm build     # Compile TypeScript to dist/
pnpm lint      # Run Biome checks
pnpm test      # Execute Vitest test suites
pnpm typecheck # Run TypeScript without emitting output
```

© 2025 QNSI - HEOSSI, Singapore
