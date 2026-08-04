# QNSI runnable scenarios

These examples exercise the published `@heossihq/qnsi` SDK against the QNSI service selected by `QNSI_API_KEY`. They are integration examples, not production evidence and not a substitute for reviewing the capability and deployment boundary.

## Setup

```bash
cd packages/qnsi/examples
pnpm install
export QNSI_API_KEY="your-api-key"
```

Use a non-production tenant. The examples never print the API key. KMS, vault, and storage scenarios create uniquely named test resources and remove them in `finally` blocks. The audit example intentionally writes a tagged audit event that remains in the tenant record. The inventory scenario is read-only.

## Run

```bash
pnpm kms
pnpm vault
pnpm inventory
pnpm audit
QNSI_BUCKET="an-existing-test-bucket" pnpm storage
```

| Scenario    | Behavior                                                                  | Persistent effect                     |
| ----------- | ------------------------------------------------------------------------- | ------------------------------------- |
| `kms`       | Create an intent-based signing key, sign, verify, and delete              | Audit and metering records may remain |
| `vault`     | Create a non-production secret, read metadata/version history, and delete | Audit and metering records may remain |
| `inventory` | Read assets, readiness, recommendations, and CBOM                         | None intended                         |
| `audit`     | Ingest a tagged developer example event                                   | The audit event remains by design     |
| `storage`   | Put, retrieve, byte-compare, and delete an object                         | Audit and metering records may remain |

All methods remain subject to tenant policy, entitlement, service version, provider, and deployment qualification. A successful response is not independent proof of the cryptographic primitive or downstream side effect; use the public verification surfaces and deployment-specific evidence for assurance claims.
