# @heossihq/qnsi-access-control-sdk

TypeScript SDK client for the QNSI access-control-service API; equivalent shapes ship in Python, Go, and Rust. Provides policy management and capability token operations.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossihq/qnsi-access-control-sdk
```

## Quick Start

```typescript
import { AccessControlClient } from "@heossihq/qnsi-access-control-sdk";

const acl = new AccessControlClient({
  baseUrl: "https://api.qnsi.heossi.com",
  apiKey: "YOUR_API_KEY",
});

const policy = await acl.createPolicy({
  tenantId: "your-tenant-id",
  name: "vault-read",
  statement: {
    effect: "allow",
    actions: ["vault:read"],
    resources: ["secret:*"],
  },
});

const capability = await acl.issueCapability({
  tenantId: "your-tenant-id",
  policyId: policy.id,
  subject: { type: "user", id: "user-id" },
  issuedBy: "admin",
});
```

## Documentation

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/access-control-sdk)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.12.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key - [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
