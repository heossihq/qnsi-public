# QNSI packages

QNSI is operated security infrastructure. These packages are its public integration surfaces, not the whole platform or a publication of the private service monorepo.

Each artifact is distributed through its ecosystem's canonical registry. QNSI does not require a duplicate GitHub Packages feed. The machine-readable [package index](PACKAGE-INDEX.json) is included in repository checksums and release assets.

| Ecosystem | Artifact | Version | Role | Install |
| --- | --- | --- | --- | --- |
| npm | [@heossihq/qnsi](https://www.npmjs.com/package/@heossihq/qnsi) | `0.6.0` | `primary-sdk-and-cli` | `pnpm add @heossihq/qnsi` |
| PyPI | [qnsi](https://pypi.org/project/qnsi/) | `0.4.2` | `primary-sdk` | `pip install qnsi` |
| crates.io | [qnsi](https://crates.io/crates/qnsi) | `0.3.0` | `primary-sdk` | `cargo add qnsi` |
| Maven Central | [com.heossi:qnsi](https://central.sonatype.com/artifact/com.heossi/qnsi) | `0.4.0` | `primary-sdk` | `implementation("com.heossi:qnsi:0.4.0")` |
| Swift Package Manager | [qnsi-swift](https://github.com/heossihq/qnsi-public) | `0.1.0` | `primary-sdk` | `.package(url: "https://github.com/heossihq/qnsi-public.git", exact: "0.1.0")` |
| Go modules | [github.com/heossihq/qnsi-public/sdks/go/qnsi](https://pkg.go.dev/github.com/heossihq/qnsi-public/sdks/go/qnsi) | `0.4.0` | `primary-sdk` | `go get github.com/heossihq/qnsi-public/sdks/go/qnsi@v0.4.0` |
| npm | [@heossihq/qnsi-mcp](https://www.npmjs.com/package/@heossihq/qnsi-mcp) | `0.2.0` | `integration-server` | `pnpm add @heossihq/qnsi-mcp` |
| npm | [@heossihq/qnsi-agent](https://www.npmjs.com/package/@heossihq/qnsi-agent) | `0.1.2` | `discovery-agent` | `pnpm add -g @heossihq/qnsi-agent` |
| npm | [@heossihq/product-facts-schema](https://www.npmjs.com/package/@heossihq/product-facts-schema) | `0.1.0` | `supporting-protocol` | `pnpm add @heossihq/product-facts-schema` |

## Source and trust boundary

The inspectable source for these artifacts is linked by the `source` field in `PACKAGE-INDEX.json`. Hosted control, data, evidence, and operations plane implementations remain private. Package publication never changes repository visibility or the organization package-creation policy.

Versions in this catalog are derived from the package metadata exported from the reviewed private source revision. Registry publication is independently checked before a public-surface release.
