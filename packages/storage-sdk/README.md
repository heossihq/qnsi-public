# @heossi/qnsi-storage-sdk

TypeScript SDK client for the QNSI storage-service API; equivalent shapes ship in Python, Go, and Rust.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossi/qnsi-storage-sdk
```

## Quick Start

```typescript
import { StorageClient } from "@heossi/qnsi-storage-sdk";

const storage = new StorageClient({
  baseUrl: "https://api.qnsi.heossi.com",
  apiKey: "YOUR_API_KEY",
  tenantId: "your-tenant-id",
});

const upload = await storage.initiateUpload({
  name: "report.pdf",
  mimeType: "application/pdf",
  sizeBytes: data.byteLength,
});

await storage.uploadPart(upload.uploadId, 1, data);
await storage.completeUpload(upload.uploadId);
```

## Documentation

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/storage-sdk)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.12.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key — [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
