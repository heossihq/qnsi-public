# @heossi/qnsi-search-sdk

TypeScript SDK for QNSI search-service (indexing, querying, SSE token helpers); equivalent shapes ship in Python, Go, and Rust.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossi/qnsi-search-sdk
```

## Quick Start

```typescript
import { SearchClient } from "@heossi/qnsi-search-sdk";

const search = new SearchClient({
  baseUrl: "https://api.qnsi.heossi.com",
  apiKey: "YOUR_API_KEY",
});

await search.indexDocuments("my-index", [
  { id: "doc-1", content: "quantum-safe storage overview" },
]);

const results = await search.query("my-index", { text: "post-quantum encryption" });
```

## Documentation

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/search-sdk)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.12.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key — [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
