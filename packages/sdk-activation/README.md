# @heossihq/qnsi-sdk-activation

SDK activation and usage metering for QNSI platform SDKs. Ensures all SDK usage is tied to a registered QNSI account.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

> **Note:** This is an internal package used by other `@heossihq/qnsi-*` SDKs. You typically do not need to install or use it directly.

## Installation

```bash
pnpm add @heossihq/qnsi-sdk-activation
```

## Quick Start

```typescript
import { activateSdk } from "@heossihq/qnsi-sdk-activation";

// Called internally by QNSI SDKs during initialization
await activateSdk({
  apiKey: "YOUR_API_KEY",
  sdkId: "vault-sdk",
  sdkVersion: "0.3.0",
  platformUrl: "https://api.qnsi.heossi.com",
});
```

## Documentation

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/sdk-activation)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.12.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key - [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
