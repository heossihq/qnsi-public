---
title: Data Retention and Backup Policy
version: 1.0.0
last_updated: 2026-04-23
copyright: © 2025–2026 HEOSSI (PTE.) LTD All rights reserved.
---

# Data Retention and Backup Policy

This document describes how HEOSSI (PTE.) LTD ("HEOSSI") retains and protects customer data in QNSI Cloud services.

This policy is subject to the [Terms of Service](https://qnsi.heossi.com/terms), [Privacy Policy](https://qnsi.heossi.com/terms#privacy-policy), and Singapore's Personal Data Protection Act 2012 (PDPA).

## 1. Data Categories

### 1.1 Customer Data

Data you store in QNSI services:
- Encrypted files and objects (Storage Service)
- Secrets and credentials (Vault Service)
- Encryption keys (KMS Service)
- Search indices (Search Service)

### 1.2 Audit Data

Records of operations performed:
- API access logs
- Authentication events
- Key usage events
- Administrative actions

### 1.3 Account Data

Information about your account:
- User profiles and credentials
- Billing information
- Configuration and preferences

## 2. Retention Periods

### 2.1 Customer Data

| Data Type | Default Retention | Notes |
|-----------|-------------------|-------|
| Stored objects | Until deleted | Customer-controlled |
| Vault secrets | Until deleted | Versions retained per configuration |
| KMS keys | Until deleted | Deleted keys have 7-day recovery window |
| Search indices | Until deleted | Re-indexable from source data |

### 2.2 Audit Data

| Tier | Default Retention | Extended Options |
|------|-------------------|------------------|
| Free | 7 days | — |
| Dev Starter | 14 days | — |
| Dev Pro | 30 days | — |
| Dev Elite | 30 days | — |
| Business Team | 30 days | 90 days, 180 days, 1 year |
| Business Advanced | 30 days | 90 days, 180 days, 1 year |
| Business Elite | 90 days | 180 days, 1 year, 7 years |
| Enterprise Standard | 90 days | 1 year, 7 years |
| Enterprise Pro | 1 year | 7 years |
| Enterprise Elite | Custom | Custom |
| Specialized | Custom | Custom |

Extended retention is available via the following add-ons:
- Audit Log Retention (90 days)
- Audit Log Retention (180 days)
- Audit Log Retention (1 year)
- Audit Log Retention (7 years - SOX)

### 2.3 Account Data

| Data Type | Retention |
|-----------|-----------|
| Active account data | Duration of account |
| Billing records | 7 years (legal requirement) |
| Deleted account data | 30 days post-deletion |

## 3. Backup Strategy

### 3.1 Automated Backups

QNSI Cloud performs automated backups:

| Component | Frequency | Retention |
|-----------|-----------|-----------|
| Database (PostgreSQL) | Continuous (WAL) + Daily snapshots | 30 days |
| Object storage | Cross-AZ replication | Real-time |
| KMS key material | HSM-backed, multi-AZ | Continuous |
| Configuration | Daily | 90 days |

### 3.2 Backup Locations

- **Primary:** Same region as your data
- **Cross-Region:** Available for Enterprise tiers with Resilience Pack
- **Customer-Managed:** Export capabilities for your own backup strategy

### 3.3 Encryption

All backups are encrypted:
- At rest: AES-256 (transitioning to PQC)
- In transit: TLS 1.3 with PQC key exchange (where supported)
- Key management: Separate backup encryption keys, rotated quarterly

## 4. Recovery

### 4.1 Recovery Point Objective (RPO)

| Tier | RPO |
|------|-----|
| Free – Dev Elite | 24 hours |
| Business Team – Business Elite | 4 hours |
| Enterprise Standard – Enterprise Pro | 1 hour |
| Enterprise Elite / Specialized | Custom (as low as near-zero) |

### 4.2 Recovery Time Objective (RTO)

| Tier | RTO |
|------|-----|
| Free – Dev Elite | 24 hours |
| Business Team – Business Elite | 4 hours |
| Enterprise Standard – Enterprise Pro | 1 hour |
| Enterprise Elite / Specialized | Custom |

### 4.3 Recovery Procedures

Recovery from backups:
1. **Customer-Initiated:** Use data export features for your own recovery
2. **Support-Assisted:** Contact support for assistance with data recovery
3. **Disaster Recovery:** Automated failover (Enterprise tiers with Resilience Pack)

## 5. Data Deletion

### 5.1 Customer-Initiated Deletion

When you delete data:
- **Immediate:** Data marked for deletion, inaccessible via API
- **Soft Delete Period:** 7 days for accidental deletion recovery (configurable)
- **Permanent:** Data purged from primary storage after soft delete period
- **Backups:** Removed from backups within 30 days

### 5.2 Account Termination

When your account is terminated:
- **Immediate:** Account access revoked
- **30-Day Export Window:** Data available for export
- **Deletion:** All customer data permanently deleted after 30 days
- **Exceptions:** Legal holds may extend retention

### 5.3 Cryptographic Deletion (Crypto Shredding)

For immediate, irreversible deletion:
- Delete the encryption key via KMS
- All data encrypted with that key becomes permanently unrecoverable
- Available for all tiers

## 6. Data Export

### 6.1 Export Capabilities

| Data Type | Export Format | Method |
|-----------|---------------|--------|
| Stored objects | Original format | Storage API, CLI |
| Vault secrets | JSON | Vault API, CLI |
| Audit logs | JSON, CSV | Audit API, Cloud Portal |
| KMS keys | BYOK format (where applicable) | KMS API |

### 6.2 Bulk Export

For large-scale exports:
- Use the CLI with pagination
- Request bulk export via support (Enterprise tiers)
- Data delivered via secure transfer

## 7. Legal Holds

QNSI supports legal hold requirements:
- Suspend automatic deletion for specified data
- Preserve audit logs beyond normal retention
- Available for Business and Enterprise tiers
- Contact legal@heossi.com for legal hold requests

## 8. Compliance

### 8.1 Regulatory Alignment

Data retention practices support compliance with:
- GDPR (right to erasure, data minimization)
- SOX (7-year audit retention)
- HIPAA (6-year retention)
- Industry-specific requirements (via custom agreements)

### 8.2 Data Residency

- Data is stored in your selected region
- Backups remain in the same region by default
- Cross-region backup requires explicit configuration and appropriate tier

## 9. Disclaimers

1. While HEOSSI implements industry-standard backup and recovery procedures, no system can guarantee 100% data durability. You are responsible for maintaining your own backups of critical data.

2. Recovery Point Objectives (RPO) and Recovery Time Objectives (RTO) are targets, not guarantees. Actual recovery times may vary based on incident severity and data volume.

3. Data retention periods may be extended to comply with legal obligations, including legal holds, regulatory requirements, or law enforcement requests.

4. HEOSSI processes personal data in accordance with Singapore's Personal Data Protection Act 2012 (PDPA) and other applicable privacy laws.

5. This Data Retention Policy is governed by the laws of Singapore.

---

**HEOSSI (PTE.) LTD**

Registered Office: 552 Ang Mo Kio, Avenue 10, #21-1982, Cheng San Place, Singapore 560552

UEN: 202532790K

**Effective Date:** February 24, 2026

**Document Version:** 1.0.0

For questions about data retention, contact: qnsi-ops@heossi.com
