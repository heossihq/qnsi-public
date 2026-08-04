# @heossihq/qnsi-events

Canonical event contracts and envelope schemas for messaging inside the Quantum-Native Security Infrastructure (QNSI).

## Usage

```ts
import { eventEnvelopeSchema, createEventEnvelope } from "@heossihq/qnsi-events";

const envelope = createEventEnvelope({
  topic: "auth.user.created",
  payload: { userId: "123" },
  metadata: {
    correlationId: "abc-123",
    causationId: "root"
  }
});

const parsed = eventEnvelopeSchema.parse(envelope);
```

The package enforces shape, metadata, and versioning semantics for platform-wide events.

## Scripts

```bash
pnpm build     # Compile TypeScript to dist/
pnpm lint      # Run Biome checks
pnpm test      # Execute Vitest test suites
pnpm typecheck # Run TypeScript without emitting output
```

© 2025 QNSI - HEOSSI, Singapore
