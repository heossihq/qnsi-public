---
title: CLI Exit Codes
version: 0.0.1
last_updated: 2026-04-23
description: Reference for QNSI CLI exit codes, from success and general errors to authentication, authorization, not-found, rate-limit, and network failure statuses.
copyright: 2025 HEOSSI. All rights reserved.
license: Apache-2.0
source_files:
  - /packages/qnsi/src/cli/config.ts
---
# CLI Exit Codes

Exit codes returned by QNSI CLI commands.

## Exit Codes

From `packages/qnsi/src/cli/config.ts`:

```typescript
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGUMENTS: 2,
  AUTH_ERROR: 3,
  AUTHORIZATION_ERROR: 4,
  NOT_FOUND: 5,
  RATE_LIMITED: 6,
  NETWORK_ERROR: 7,
} as const;
```

| Code | Name | Description |
|------|------|-------------|
| 0 | SUCCESS | Command completed successfully |
| 1 | GENERAL_ERROR | Unspecified error occurred |
| 2 | INVALID_ARGUMENTS | Invalid command-line arguments |
| 3 | AUTH_ERROR | Authentication failed |
| 4 | AUTHORIZATION_ERROR | Insufficient permissions |
| 5 | NOT_FOUND | Requested resource not found |
| 6 | RATE_LIMITED | Rate limit exceeded |
| 7 | NETWORK_ERROR | Network connectivity issue |

## Using exit codes

### Bash
```bash
qnsi kms keys get "$KEY_ID"
case $? in
  0) echo "Success" ;;
  5) echo "Key not found" ;;
  3) echo "Auth failed" ;;
  *) echo "Unknown error: $?" ;;
esac
```

### Check specific code
```bash
qnsi vault secrets get "$SECRET_ID"
if [ $? -eq 5 ]; then
  echo "Secret doesn't exist"
fi
```

## Verbose error info

Get detailed error information:
```bash
qnsi --verbose kms keys get invalid-id 2>&1
# Outputs detailed error with request ID
```

## Machine-readable errors

```bash
qnsi kms keys get invalid-id --output json 2>&1
```

Returns:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Key not found",
    "requestId": "uuid"
  }
}
```
