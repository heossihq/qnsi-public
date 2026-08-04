# @heossihq/qnsi-vault-sdk

TypeScript SDK client for the QNSI vault-service API; equivalent shapes ship in Python, Go, and Rust. Provides secret management with envelope encryption, versioning, and rotation.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossihq/qnsi-vault-sdk
```

## Quick Start

```typescript
import { VaultClient } from "@heossihq/qnsi-vault-sdk";

const vault = new VaultClient({
  baseUrl: "https://api.qnsi.heossi.com",
  apiKey: "YOUR_API_KEY",
});

const secret = await vault.createSecret({
  tenantId: "your-tenant-id",
  name: "db/credentials",
  payload: btoa(JSON.stringify({ user: "admin", pass: "s3cret" })),
});

const retrieved = await vault.getSecret(secret.id);
```

## Documentation

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/vault-sdk)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.12.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key - [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
