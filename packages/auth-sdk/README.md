# @heossihq/qnsi-auth-sdk

TypeScript SDK client for the QNSI auth-service API; equivalent shapes ship in Python, Go, and Rust. Provides authentication, token management, WebAuthn, MFA, and federation.

Part of the [Quantum-Native Security Infrastructure (QNSI)](https://qnsi.heossi.com).

## Installation

```bash
pnpm add @heossihq/qnsi-auth-sdk
```

## Quick Start

```typescript
import { AuthClient } from "@heossihq/qnsi-auth-sdk";

const auth = new AuthClient({
  baseUrl: "https://api.qnsi.heossi.com",
  apiKey: "YOUR_API_KEY",
});

const tokens = await auth.login({
  email: "user@example.com",
  password: "••••••••",
  tenantId: "your-tenant-id",
});

const refreshed = await auth.refreshToken({ refreshToken: tokens.refreshToken!.token });
```

## OAuth / Social Sign-In

QNSI supports one-click sign-up and sign-in via GitHub and Google. OAuth is handled by the QNSI Cloud Portal BFF - no SDK code required for the OAuth flow itself.

**Sign up or sign in at:** [cloud.qnsi.heossi.com/auth](https://cloud.qnsi.heossi.com/auth)

Supported providers:
- **GitHub** - authorizes via `github.com/login/oauth/authorize`, scopes: `user:email read:user`
- **Google** - authorizes via `accounts.google.com/o/oauth2/v2/auth`, scopes: `openid email profile`

After OAuth sign-in completes, QNSI issues a PQC-signed JWT (ML-DSA) and a refresh token - identical to password-based sessions. Use the `AuthClient` for all subsequent token operations (refresh, revoke, introspect).

```typescript
const refreshed = await auth.refreshToken({ refreshToken: storedRefreshToken });
```

For WebAuthn passkey authentication:

```typescript
const challenge = await auth.startPasskeyAuthentication({ tenantId: "your-tenant-id" });
const assertion = await navigator.credentials.get({ publicKey: challenge.publicKeyOptions });
const session = await auth.completePasskeyAuthentication({ tenantId: "your-tenant-id", assertion });
```

## Documentation

### Tenant OIDC federation

OIDC callbacks require the exact opaque `state` returned by authorization start.
The client rejects missing or malformed state before network requests. Native
Auth persists one-time state and PKCE verifier bindings, validates the external
IdP signature, issuer, audience and nonce, and binds UserInfo to the verified
subject. The external trust leg is explicitly `oidc-classical-compatibility`;
this is not end-to-end native PQC transport evidence. Federation refresh
responses retain `{ token, metadata }`, including numeric Unix-second `issuedAt`
and `expiresAt`, with the native subject object. Production acceptance remains
NOT VERIFIED. Other-language SDK parity remains a separate acceptance requirement.

### Federated audit CSV reports

`createFederatedAuditReport({ reportType: "security", startDate, endDate,
format: "csv" })` preserves the JSON report contract and includes the generated
CSV in `report.export.content`, with `mediaType: "text/csv"`. The same artifact
is retained by `getFederatedAuditReport`. Check `detailsIncluded` and
`detailsTruncated` before treating details as complete: report details remain
bounded to 1000 records. CSV cells are quoted and protected against spreadsheet
formula interpretation. This is a data export, not compliance certification or
verified native audit retention. Production acceptance remains NOT VERIFIED.

## Documentation links

- [SDK Reference](https://docs.qnsi.heossi.com/sdk/auth-sdk)
- [API Documentation](https://docs.qnsi.heossi.com/api)
- [Getting Started](https://docs.qnsi.heossi.com/quickstart)

## Requirements

- Node.js >= 24.18.0 (`engines` in `package.json`; QNSI monorepo baseline)
- A QNSI account and API key - [sign up free](https://cloud.qnsi.heossi.com/auth) with GitHub, Google, or email

## License

[Apache-2.0](./LICENSE)
