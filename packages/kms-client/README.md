# @heossi/qnsi-kms-client

KMS client for QNSI key management service. Post-quantum key generation, rotation, and cryptographic operations.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossi/qnsi-kms-client
```

## Quick Start

```typescript
import { HttpKmsServiceClient } from "@heossi/qnsi-kms-client";

const kms = new HttpKmsServiceClient(
  "https://api.qnsi.heossi.com",
  "YOUR_API_KEY",
);

const wrapped = await kms.wrapKey({
  tenantId: "your-tenant-id",
  dataKey: btoa("my-data-encryption-key"),
  keyId: "your-kms-key-id",
});

const unwrapped = await kms.unwrapKey({
  tenantId: "your-tenant-id",
  wrappedKey: wrapped.wrappedKey,
  keyId: wrapped.keyId,
});
```

## Documentation

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/kms-client)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.12.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key — [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
