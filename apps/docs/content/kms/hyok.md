---
title: Hold Your Own Key (HYOK)
version: 0.0.1
last_updated: 2026-04-23
copyright: 2025 HEOSSI. All rights reserved.
---
# Hold Your Own Key (HYOK)

HYOK allows customers to retain key material in their own infrastructure.

## Overview

- Key material never enters QNSI
- Customer HSM performs cryptographic operations
- QNSI orchestrates but doesn't hold keys

## Architecture

```
QNSI Service → Customer HSM Proxy → Customer HSM
                                         ↓
                                   Key Material
```

## Configuration

HYOK orchestration APIs are not shipped in this repo.
Configuration and enrollment depend on your deployment bundle.

## Operations

HYOK keys support:
- Encrypt/decrypt (proxied to customer HSM)
- Sign/verify (proxied to customer HSM)

Not supported:
- Key material export
- Key rotation (managed by customer)

## Requirements

Customer HSM must:
- Expose compatible API
- Support mTLS authentication
- Meet latency requirements (<100ms)

## Use cases

- Regulatory requirements for key custody
- Existing HSM investments
- Maximum control over key material

## Add-on

HYOK enablement and licensing are deployment-specific.
