---
title: Compliance
version: 1.0.0
last_updated: 2026-04-23
copyright: © 2025-2026 HEOSSI (PTE.) LTD All rights reserved.
---
# Compliance

This page summarizes compliance and assurance programs for QNSI Cloud services provided by HEOSSI (PTE.) LTD ("HEOSSI"), a company incorporated in Singapore (UEN: 202532790K).

## CSA STAR

QNSI is listed in the Cloud Security Alliance (CSA) STAR Registry at Level 1 (CAIQ v4.1.0 self-assessment). Level 1 is a public CAIQ self-assessment provided by the vendor.

### What This Means
- **CAIQ Self-Assessment v4.1.0**: Comprehensive documentation of security controls for IaaS, PaaS, and SaaS services
- **Mapped to CSA CCM**: Industry-accepted framework for cloud security assurance
- **Publicly verifiable assurance**: Publicly accessible assurance artifacts for customer due diligence

### Scope
QNSI cloud service as listed in CSA STAR. Controls vary by deployment model (cloud/private/air-gapped).

[View CSA STAR Service Listing →](https://cloudsecurityalliance.org/star/registry/cui-labs-pte-ltd/services/quantum-native-security-platform-qnsi)

## SOC 2

SOC 2 Type II audit is in progress for QNSI Cloud services.

### Trust service criteria
- Security
- Availability
- Confidentiality
- Processing integrity

### Report availability
SOC 2 reports will be made available to eligible customers under NDA upon completion.

## PCI DSS

QNSI Cloud does not process or store payment card data directly. Payment processing is handled by third-party payment processors.

## HIPAA

For healthcare customers:
- BAA available
- PHI encryption
- Access controls
- Audit logging

## GDPR

For EU data:
- Data processing agreement
- Data residency options
- Right to erasure support
- Data portability

## Compliance reports

Generate compliance reports:
```
GET /audit/v1/reports?type=soc2&period=Q1-2024
```

## Shared responsibility

| Control | QNSI | Customer |
|---------|------|----------|
| Infrastructure security | ✓ | |
| Platform security | ✓ | |
| Application security | | ✓ |
| Data classification | | ✓ |
| Access management | Shared | Shared |

## Disclaimer

This page describes HEOSSI' compliance program status and is provided for informational purposes only. It does not constitute a binding commitment, warranty, or certification claim. Any contractual commitments are governed by your signed agreement and the [Terms of Service](https://qnsi.heossi.com/terms).

---

**HEOSSI (PTE.) LTD**

UEN: 202532790K
