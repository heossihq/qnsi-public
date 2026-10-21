# @heossihq/qnsi-kms-client

KMS client for QNSI key management service. Post-quantum key generation, rotation, and cryptographic operations.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossihq/qnsi-kms-client
```

## Quick Start

```typescript
import { HttpKmsServiceClient } from "@heossihq/qnsi-kms-client";

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

`getKey({ tenantId, keyId })` returns a typed authoritative `exportable` and
`custodyPolicy` response. It rejects missing or inconsistent policy and a
mismatched tenant/key identity; caller metadata is never used as authority.
Legacy keys remain `exportable: null`. Service enforcement is not a claim of
hardware non-extractability. See the repository
[custody contract](../../apps/kms-service/README.md#authoritative-non-exportability-contract)
for rollout requirements and limitations. This contract change is local and
unreleased until deployment and release checks are completed.

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/kms-client)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.18.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key - [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
