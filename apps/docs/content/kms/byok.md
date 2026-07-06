---
title: Bring Your Own Key (BYOK)
version: 0.0.1
last_updated: 2026-04-23
copyright: 2025 HEOSSI. All rights reserved.
---
# Bring Your Own Key (BYOK)

BYOK allows customers to import their own key material into QNSI KMS.

## Overview

- Customer generates key material externally
- Key material wrapped for import
- QNSI stores and uses the imported key
- Customer retains a copy

## Import process

### Import wrapped key
```
POST /kms/v1/byok/import
{
  "tenantId": "<tenant_uuid>",
  "keyId": "my-imported-key",
  "wrappedKey": "<base64_wrapped_key>",
  "algorithm": "AES-256-GCM",
  "provider": "<provider>",
  "proof": {
    "signature": "<base64_signature>",
    "publicKey": "<base64_public_key>",
    "algorithm": "<signature_algorithm>"
  },
  "metadata": {}
}
```

## Constraints

- Key material must match declared algorithm
- Key material validated on import

## Key lifecycle

Imported keys follow normal lifecycle:
- Rotation (re-import new material)
- Revocation
- Destruction

## Security considerations

- Customer responsible for source key security
- Transport protection via wrapping
- No key material export from QNSI
