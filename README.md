# QNSI Public Surface

This repository is an automatically published subset of the private QNSI monorepo.

Included:

- Documentation markdown content: `apps/docs/content/`
- Public TypeScript SDK and CLI sources under `packages/` (Apache-2.0 licensed per package)
- Python SDK source under `sdks/python/qnsi/` (published to PyPI as `qnsi`)
- Go SDK source under `sdks/go/qnsi/` (consumed via `go get github.com/heossihq/qnsi-public/sdks/go/qnsi`)
- Rust SDK source under `sdks/rust/qnsi/` (published to crates.io as `qnsi`)

Excluded:

- Core services and infrastructure code
- Confidential internal documentation (`docs/private/`)
- Secrets and environment files

Source revision:

- `fd54f3e7d88a23c073b4237e1c45363e374af82b`

