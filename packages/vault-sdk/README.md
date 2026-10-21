# @heossihq/qnsi-vault-sdk

TypeScript SDK client for the QNSI vault-service API. Provides secret management with envelope encryption, versioning, and rotation. Cross-language contract parity and production workflows remain NOT VERIFIED; TypeScript tests are not evidence that Python, Go or Rust expose equivalent behavior.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossihq/qnsi-vault-sdk
```

## Quick Start

```typescript
import { VaultClient } from "@heossihq/qnsi-vault-sdk";

const vault = new VaultClient({
  baseUrl: "https://api.qnsi.heossi.com",
  apiKey: "YOUR_API_KEY",
});

const secret = await vault.createSecret({
  tenantId: "your-tenant-id",
  name: "db/credentials",
  payload: btoa(JSON.stringify({ user: "admin", pass: "s3cret" })),
});

const retrieved = await vault.getSecret(secret.id);
```

## Documentation

### Dynamic credential contract

New configurations require `engineType` and an approved `connectionRef` to an
admin connection in Secrets Manager. The client forwards `roleTemplate` and
optional TTL limits using the mounted backend contract. It does not send inline
admin credentials, infer an approved connection reference or create account
resources. Historical backend/template types remain exported for migration;
their old request fields are deprecated and are not forwarded as new
configuration credentials. Existing consumers must migrate their configuration
creation calls before adopting this contract change.

The engine type union includes all 13 backend engine identifiers. Use
`listDynamicSecretEngines()` to read actual server registration states; an
`implemented` entry is not independent provider-account assurance. Credential
responses retain engine-specific fields rather than assuming every credential
has a username and password. `listLeases(configId, { includeAllStatuses: true })`
includes recovery and terminal states. Unrecoverable metadata is `null`, not an
invented empty object. Statistics expose the current measured lifecycle fields.

`revokeLease()` returns the backend queue acknowledgement
`{ leaseId, status: "revoking" }`. This does not establish completed provider
revocation. Native-expiry engines defer completion until their stored enforced
deadline; there is no automatic account-wide IAM policy or SSH host KRL change.
Renewal must alter the provider credential as well as Vault's persisted expiry.

Local TypeScript checks pass 33 tests and exactly 100% statements, branches,
functions and lines across the full SDK source denominator. Re-run from this
package with `../../node_modules/.bin/vitest run --coverage`. These changes have
not been published or independently verified against production. Release and
cross-language/consumer migration remain NOT VERIFIED.

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/vault-sdk)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.18.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key - [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
