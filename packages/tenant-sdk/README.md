# @heossi/qnsi-tenant-sdk

TypeScript SDK client for the QNSI tenant-service API; equivalent shapes ship in Python, Go, and Rust. Provides tenant lifecycle and subscription management.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossi/qnsi-tenant-sdk
```

## Quick Start

```typescript
import { TenantClient } from "@heossi/qnsi-tenant-sdk";

const tenants = new TenantClient({
  baseUrl: "https://api.qnsi.heossi.com",
  apiKey: "YOUR_API_KEY",
});

const tenant = await tenants.getTenant("your-tenant-id");
const list = await tenants.listTenants({ limit: 20 });
```

## Documentation

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/tenant-sdk)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.12.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key — [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
