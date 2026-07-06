---
title: Migration from AWS Secrets Manager
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Migration from AWS Secrets Manager

Migrate secrets from AWS Secrets Manager to QNSI.

## Prerequisites

- AWS CLI configured
- QNSI CLI configured
- IAM permissions for Secrets Manager

## Migration steps

### 1. List secrets
```bash
aws secretsmanager list-secrets --query 'SecretList[].Name'
```

### 2. Export secrets
```bash
#!/bin/bash
for secret in $(aws secretsmanager list-secrets --query 'SecretList[].Name' --output text); do
  aws secretsmanager get-secret-value \
    --secret-id "$secret" \
    --query 'SecretString' \
    --output text > "exports/$secret.json"
done
```

### 3. Import to QNSI
Import secrets by creating them via the Vault API or the Vault SDK.

## Automated migration

Automated migration tooling is not shipped in this repo.

## Rotation configuration

AWS Secrets Manager rotation needs reconfiguration:
```json
{
  "rotation": {
    "enabled": true,
    "schedule": "rate(30 days)"
  }
}
```

## Application updates

Update applications to use QNSI SDK:
```javascript
// Before (AWS SDK)
const secret = await secretsManager.getSecretValue({SecretId: 'my-secret'});

// After (QNSI SDK)
// Use the Vault SDK and request secret values by ID.
```
