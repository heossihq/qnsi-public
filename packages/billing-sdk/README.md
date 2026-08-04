# @heossihq/qnsi-billing-sdk

TypeScript SDK client for the QNSI billing-service API; equivalent shapes ship in Python, Go, and Rust. Provides usage meter ingestion and invoice management.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossihq/qnsi-billing-sdk
```

## Quick Start

```typescript
import { BillingClient } from "@heossihq/qnsi-billing-sdk";

const billing = new BillingClient({
  baseUrl: "https://api.qnsi.heossi.com",
  apiKey: "YOUR_API_KEY",
});

await billing.ingestMeters({
  meters: [{ tenantId: "your-tenant-id", source: "api", meterType: "api-calls", quantity: 150, unit: "count", recordedAt: new Date().toISOString(), security: { controlPlaneTokenSha256: null, pqcSignatures: [], hardwareProvider: null, attestationStatus: null, attestationProof: null } }],
});

const invoices = await billing.listInvoices("your-tenant-id");
```

## Documentation

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/billing-sdk)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.12.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key - [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
