---
title: Migration from AWS KMS
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Migration from AWS KMS

Migrate keys from AWS KMS to QNSI.

## Overview

QNSI supports importing keys from AWS KMS using BYOK.

## Key types supported

| AWS KMS | QNSI equivalent |
|---------|-----------------|
| SYMMETRIC_DEFAULT | aes-256-gcm |
| RSA_2048 | Not supported (use PQC) |
| ECC_NIST_P256 | ecdsa-p256 |

## Migration steps

### 1. Export key material (if extractable)

AWS KMS keys are typically not extractable. Options:
- Re-encrypt data with new QNSI keys
- Use HYOK to keep keys in AWS KMS

### 2. Create equivalent keys in QNSI
```bash
qnsi kms keys create \
  --name "migrated-key" \
  --algorithm aes-256-gcm
```

### 3. Re-encrypt data
```bash
# Decrypt with AWS KMS
aws kms decrypt \
  --ciphertext-blob fileb://encrypted.bin \
  --output text --query Plaintext | base64 -d > plaintext.bin

# Encrypt with QNSI
qnsi kms encrypt \
  --key-id $QNSI_KEY_ID \
  --input plaintext.bin \
  --output encrypted-qnsi.bin

# Securely delete plaintext
shred -u plaintext.bin
```

## HYOK option

Keep keys in AWS KMS, use QNSI for orchestration:
```json
{
  "type": "hyok",
  "provider": "aws-kms",
  "keyArn": "arn:aws:kms:us-east-1:123456789:key/..."
}
```

## Considerations

- Plan for re-encryption downtime
- Maintain AWS KMS for decrypt during transition
- Update all applications to use QNSI
