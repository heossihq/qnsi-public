---
title: Root of Trust
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Root of Trust

The root of trust establishes the foundation for all cryptographic operations.

## Root key

The root key is the top of the key hierarchy:
- Generated in HSM during initialization
- Never exported from HSM
- Used only to wrap Tenant Master Keys

## Initialization ceremony

Root key creation follows a ceremony:

1. **Quorum assembly**: Required custodians present
2. **HSM initialization**: Fresh HSM cluster
3. **Key generation**: Root key created in HSM
4. **Backup**: Encrypted backup with split keys
5. **Verification**: Test wrap/unwrap operations
6. **Audit**: Ceremony documented and signed

## Key custodians

- Minimum 3 custodians required
- M-of-N threshold for recovery
- Geographic distribution
- Regular attestation

## Recovery

If HSM fails:
1. Provision new HSM cluster
2. Assemble custodian quorum
3. Restore root key from backup
4. Verify operations
5. Resume service

## Attestation

Root of trust verified via:
- HSM attestation reports
- Firmware version verification
- Tamper-evident seals
- Audit logs

## Security properties

- Root key never in software
- Hardware-enforced access controls
- Tamper-resistant storage
- Cryptographic binding to HSM identity
