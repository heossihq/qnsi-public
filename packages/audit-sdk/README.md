# @heossi/qnsi-audit-sdk

TypeScript SDK client for the QNSI audit-service API; equivalent shapes ship in Python, Go, and Rust. Provides audit log querying and compliance reporting.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossi/qnsi-audit-sdk
```

## Quick Start

```typescript
import { AuditClient } from "@heossi/qnsi-audit-sdk";

const audit = new AuditClient({
  baseUrl: "https://api.qnsi.heossi.com",
  apiKey: "YOUR_API_KEY",
});

const logs = await audit.listEvents({
  tenantId: "your-tenant-id",
  topic: "secret.read",
  since: "2025-01-01T00:00:00Z",
  limit: 50,
});
```

## Documentation

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/audit-sdk)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.12.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key — [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
