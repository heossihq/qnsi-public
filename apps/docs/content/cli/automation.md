---
title: CLI Automation
version: 0.0.1
last_updated: 2026-04-23
description: Run the QNSI CLI in automated pipelines using non-interactive mode, environment-based credentials, machine-readable JSON output, and documented exit codes.
copyright: © 2025 HEOSSI. All rights reserved.
---
# CLI Automation

Using QNSI CLI in automated environments.

## Non-interactive mode

Ensure the CLI doesn't prompt:
```bash
export QNSI_SERVICE_ID="your-service-id"
export QNSI_SERVICE_SECRET="your-service-secret"
export QNSI_TENANT_ID="your-tenant-uuid"

# With secrets set, qnsi won't need to prompt for credentials.
qnsi kms keys list
```

## JSON output

Machine-readable output:
```bash
qnsi kms keys list --output json | jq '.items[] | .keyId'
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Authentication error |
| 4 | Authorization error |
| 5 | Resource not found |
| 6 | Rate limited |
| 7 | Network error |

## Error handling

```bash
#!/bin/bash
set -e

if ! qnsi kms keys get "$KEY_ID" > /dev/null 2>&1; then
  echo "Key not found, creating..."
  qnsi kms keys create --name my-key --algorithm aes-256-gcm
fi
```

## Retry logic

```bash
#!/bin/bash

max_retries=3
retry_count=0

until qnsi vault secrets get "$SECRET_ID"; do
  retry_count=$((retry_count + 1))
  if [ $retry_count -ge $max_retries ]; then
    echo "Max retries reached"
    exit 1
  fi
  echo "Retrying in 5 seconds..."
  sleep 5
done
```

## Secrets in scripts

Never hardcode secrets:
```bash
# Good: environment variable
export QNSI_SERVICE_SECRET=$(vault read -field=secret qnsi/service)
qnsi auth token --service-id "$QNSI_SERVICE_ID" --service-secret "$QNSI_SERVICE_SECRET"

# Bad: hardcoded
qnsi auth token --service-secret "hardcoded-secret"  # DON'T DO THIS
```

## Logging

Enable verbose logging:
```bash
QNSI_VERBOSE=true qnsi kms keys list
```
