# Public SDK Reference

QNSP ships first-party SDKs for **TypeScript / Node.js**, **Python**, **Go**, and **Rust** — all built on the same wire contracts, the same algorithm names, and the same FIPS 203 / 204 / 205 posture. Pick whichever fits your stack and the byte-for-byte outputs round-trip across languages.

This page lists the **TypeScript** packages on npm. Python, Go, and Rust SDKs are listed separately at the end with their package-manager URLs and source paths.

All `@heossi/qnsi-*` SDKs below are TypeScript-first, ESM, and published to the public npm registry under **Apache-2.0**. They install cleanly from a default `.npmrc` with **no GitHub Packages scope configuration required**.

**Runtime floor:** every manifest declares `engines.node >= 22.0.0`.

**Post-quantum backend:** the PQC primitives in `@heossi/qnsi-cryptography` resolve against the pure-JS [`@noble/post-quantum`](https://github.com/paulmillr/noble-post-quantum) provider by default. The optional native backend (`@heossi/liboqs-native`) is published to GitHub Packages only and declared as an `optionalDependency` of `@heossi/qnsi-cryptography` — npm will skip it silently on public installs. To opt in, add a scope mapping and install it explicitly:

```bash
echo '@heossi:registry=https://npm.pkg.github.com' >> .npmrc
npm install @heossi/liboqs-native
```

For the full SDK and API reference see:
[`docs/technical/QNSP-SDKs-APIs.md`](../technical/QNSP-SDKs-APIs.md)

## TypeScript packages on npm (last updated 2026-04-30)

### Application SDKs

| Package | Version | Install |
|---------|---------|---------|
| `@heossi/qnsi-auth-sdk` | 0.3.6 | `pnpm add @heossi/qnsi-auth-sdk` |
| `@heossi/qnsi-vault-sdk` | 0.3.9 | `pnpm add @heossi/qnsi-vault-sdk` |
| `@heossi/qnsi-kms-client` | 0.2.6 | `pnpm add @heossi/qnsi-kms-client` |
| `@heossi/qnsi-storage-sdk` | 0.3.6 | `pnpm add @heossi/qnsi-storage-sdk` |
| `@heossi/qnsi-search-sdk` | 0.2.10 | `pnpm add @heossi/qnsi-search-sdk` |
| `@heossi/qnsi-audit-sdk` | 0.3.6 | `pnpm add @heossi/qnsi-audit-sdk` |
| `@heossi/qnsi-billing-sdk` | 0.2.6 | `pnpm add @heossi/qnsi-billing-sdk` |
| `@heossi/qnsi-tenant-sdk` | 0.3.6 | `pnpm add @heossi/qnsi-tenant-sdk` |
| `@heossi/qnsi-access-control-sdk` | 0.3.6 | `pnpm add @heossi/qnsi-access-control-sdk` |
| `@heossi/qnsi-crypto-inventory-sdk` | 0.3.6 | `pnpm add @heossi/qnsi-crypto-inventory-sdk` |
| `@heossi/qnsi-ai-sdk` | 0.1.11 | `pnpm add @heossi/qnsi-ai-sdk` |
| `@heossi/qnsi-browser` | 0.1.4 | `pnpm add @heossi/qnsi-browser` |
| `@heossi/qnsi-sdk-activation` | 0.1.6 | `pnpm add @heossi/qnsi-sdk-activation` |

### Framework adapters

| Package | Version | Install |
|---------|---------|---------|
| `@heossi/qnsi-langchain-qnsp` | 0.1.7 | `pnpm add @heossi/qnsi-langchain-qnsp` |
| `@heossi/qnsi-llamaindex-qnsp` | 0.2.5 | `pnpm add @heossi/qnsi-llamaindex-qnsp` |
| `@heossi/qnsi-autogen-qnsp` | 0.2.5 | `pnpm add @heossi/qnsi-autogen-qnsp` |

### Bin-first packages

| Package | Version | Install | Bin |
|---------|---------|---------|-----|
| `@heossi/qnsi-cli` | 0.1.12 | `pnpm add -g @heossi/qnsi-cli` | `qnsp` |
| `@heossi/qnsi-mcp` | 0.1.3 | `pnpm add -g @heossi/qnsi-mcp` | `qnsp-mcp` |

### Core libraries (consumed by the SDKs above)

| Package | Version | Purpose |
|---------|---------|---------|
| `@heossi/qnsi-cryptography` | 0.2.0 | PQC primitives (ML-KEM, ML-DSA, SLH-DSA) via noble; optional liboqs native backend |
| `@heossi/qnsi-shared-kernel` | 0.1.4 | Domain primitives, JWT helpers, error hierarchy, SDK-facing tier gating |
| `@heossi/qnsi-observability` | 0.1.4 | OpenTelemetry helpers, structured logging |
| `@heossi/qnsi-events` | 0.1.4 | Event envelope schemas |
| `@heossi/qnsi-resilience` | 0.1.2 | Retry / circuit-breaker primitives |

## Python, Go, Rust SDKs

Each language ships **one** package with sub-modules per service (vault, kms, audit, tenant, access, billing, crypto-inventory, storage, search) plus local PQC primitives via the language's liboqs binding.

| Language | Package | Source | Activation `sdkId` |
|---|---|---|---|
| Python | [`qnsp` on PyPI](https://pypi.org/project/qnsp/) | [`sdks/python/qnsp/`](../../sdks/python/qnsp) | `qnsp-python` |
| Go | `github.com/heossihq/qnsi-public/sdks/go/qnsp` | [`sdks/go/qnsp/`](../../sdks/go/qnsp) | `qnsp-go` |
| Rust | [`qnsp` on crates.io](https://crates.io/crates/qnsp) | [`sdks/rust/qnsp/`](../../sdks/rust/qnsp) | `qnsp-rust` |

### Install

```bash
pip install qnsi                                           # Python
pip install 'qnsi[crypto]'                                 # + local PQC primitives via liboqs-python

go get github.com/heossihq/qnsi-public/sdks/go/qnsp@latest  # Go

cargo add qnsp                                             # Rust
cargo add qnsp --features crypto                           # + local PQC primitives via oqs 0.11
```

The Python `qnsp` package currently exposes vault / kms / audit / crypto / webhooks at v0.2.0; the additional service modules (tenant, access, billing, crypto-inventory, storage, search) are scheduled for v0.3.0 to match the Go and Rust v0.1.0 surface. See [`apps/docs/content/sdk/languages.md`](../../apps/docs/content/sdk/languages.md) for the full feature matrix.

## Tier gating (client-side pre-flight)

`@heossi/qnsi-shared-kernel` exports a small, **self-contained** tier catalogue so SDK consumers can fail fast with a typed error before making a network call:

```ts
import { isFeatureEnabled, TierError } from "@heossi/qnsi-shared-kernel";

if (!isFeatureEnabled("enclaves", currentTier)) {
  throw new TierError("enclaves", currentTier, "enterprise-standard");
}
```

The catalogue is **inlined** in `@heossi/qnsi-shared-kernel` — no separate pricing package is required. The internal `@heossi/qnsi-pricing` package is private to this monorepo and deliberately not published; a build-time drift test (`packages/shared-kernel/src/tier-limits.drift.test.ts`) keeps the inlined catalogue byte-exact with the internal commercial source of truth.

## API Base URL

```
https://api.qnsi.heossi.com
```

All SDK clients accept `baseUrl` as a constructor option (or `BaseURL` / `base_url` depending on language). Default is the production URL above.

## Source

- TypeScript: `packages/<sdk-name>/src/` (entry point `src/index.ts`, co-located `*.test.ts`, `vitest.config.ts`)
- Python: `sdks/python/qnsp/src/qnsp/` (entry point `__init__.py`, tests under `sdks/python/qnsp/tests/`)
- Go: `sdks/go/qnsp/` (root entry point `client.go`, sub-packages per service, `*_test.go` files in root)
- Rust: `sdks/rust/qnsp/src/` (entry point `lib.rs`, integration tests under `sdks/rust/qnsp/tests/`)
