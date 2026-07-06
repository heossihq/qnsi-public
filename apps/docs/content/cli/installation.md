---
title: CLI Installation
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/cli/package.json
  - /packages/cli/README.md
---

# CLI Installation

Install the QNSI command-line interface.

## Package Information

From `packages/cli/package.json`:

```json
{
  "name": "@heossi/qnsi-cli",
  "version": "0.1.0",
  "license": "Apache-2.0",
  "bin": {
    "qnsi": "./dist/index.js"
  }
}
```

## Installation Methods

### pnpm (recommended)
```bash
pnpm add -g @heossi/qnsi-cli
```

### Verify installation
```bash
qnsi --version
# Output: 0.1.0

qnsi --help
```

## Upgrade

```bash
pnpm update -g @heossi/qnsi-cli
# or
brew upgrade qnsi
```

## Uninstall

```bash
pnpm remove -g @heossi/qnsi-cli
# or
brew uninstall qnsi
```
