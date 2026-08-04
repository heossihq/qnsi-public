# Public SDK Reference

QNSP ships first-party SDKs for **TypeScript / Node.js**, **Python**, **Go**, and **Rust** - all built on the same wire contracts, the same algorithm names, and the same FIPS 203 / 204 / 205 posture. Pick whichever fits your stack and the byte-for-byte outputs round-trip across languages.

This page lists the **TypeScript** packages on npm. Python, Go, and Rust SDKs are listed separately at the end with their package-manager URLs and source paths.

The supported `@heossihq` packages below are TypeScript-first, ESM, and published to the public npm registry under **Apache-2.0**. They install cleanly from a default `.npmrc` with **no GitHub Packages scope configuration required**.

**Runtime floor:** the consolidated SDK and MCP server require Node.js 22 or newer. The product-facts signing schema requires Node.js 24 or newer for native ML-DSA support.

The service-specific TypeScript packages remain private workspace modules. Their public API is consolidated into `@heossihq/qnsi`; they are not separate `@heossihq` registry artifacts.

For the full SDK and API reference see:
[`docs/technical/QNSP-SDKs-APIs.md`](../technical/QNSP-SDKs-APIs.md)

## TypeScript packages on npm (last updated 2026-07-27)

### Supported public packages

| Package | Version | Install | Purpose |
|---------|---------|---------|---------|
| `@heossihq/qnsi` | 0.6.0 | `pnpm add @heossihq/qnsi` | Consolidated Node.js/TypeScript SDK |
| `@heossihq/qnsi-mcp` | 0.2.0 | `pnpm add -g @heossihq/qnsi-mcp` | MCP server (`qnsp-mcp`) |
| `@heossihq/qnsi-agent` | 0.1.2 | `pnpm add -g @heossihq/qnsi-agent` | Local QNSI agent |
| `@heossihq/product-facts-schema` | 0.1.0 | `pnpm add @heossihq/product-facts-schema` | Canonical product-facts signing and verification |

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

Tier and activation checks are exposed by the consolidated `@heossihq/qnsi` client. Internal shared-kernel and pricing workspace packages are deliberately not published.

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
