# @heossihq/qnsi-crypto-inventory-sdk

TypeScript SDK client for the QNSI crypto-inventory-service API; equivalent shapes ship in Python, Go, and Rust. Provides cryptographic asset discovery and inventory management.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossihq/qnsi-crypto-inventory-sdk
```

## Quick Start

```typescript
import { CryptoInventoryClient } from "@heossihq/qnsi-crypto-inventory-sdk";

const inventory = new CryptoInventoryClient({
  baseUrl: "https://api.qnsi.heossi.com",
  apiKey: "YOUR_API_KEY",
});

const assets = await inventory.listAssets({ tenantId: "your-tenant-id", limit: 50 });
const stats = await inventory.getAssetStats("your-tenant-id");
const migration = await inventory.getPqcMigrationStatus("your-tenant-id");
```

## Documentation

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/crypto-inventory-sdk)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.12.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key - [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
