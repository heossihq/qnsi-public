# @heossihq/qnsi-ai-sdk

TypeScript SDK client for the QNSI AI orchestration service; equivalent shapes ship in Python, Go, and Rust. Provides secure AI workload management, enclave inference, and encrypted training.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossihq/qnsi-ai-sdk
```

## Quick Start

```typescript
import { AiOrchestratorClient } from "@heossihq/qnsi-ai-sdk";

const ai = new AiOrchestratorClient({
  baseUrl: "https://api.qnsi.heossi.com",
  apiKey: "YOUR_API_KEY",
});

const result = await ai.runInference({
  model: "my-model",
  input: { prompt: "Summarize the quarterly report" },
});
```

## Documentation

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/ai-sdk)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.12.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key - [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
