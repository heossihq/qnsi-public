---
title: Service Level Agreement
version: 1.0.0
last_updated: 2026-04-23
copyright: © 2025–2026 HEOSSI (PTE.) LTD All rights reserved.
---

# Service Level Agreement

This Service Level Agreement ("SLA") is entered into by and between HEOSSI (PTE.) LTD ("HEOSSI", "we", "us", "our"), a company incorporated in Singapore (UEN: 202532790K), and the customer ("you", "your") using QNSI Cloud services.

This SLA governs the availability commitments for QNSI Cloud services and applies to eligible subscription tiers. This SLA is incorporated by reference into your subscription agreement and is subject to the [Terms of Service](https://qnsi.heossi.com/terms).

## 1. Definitions

- **"Availability"** means the percentage of time during a calendar month that the QNSI Cloud services are operational and accessible, calculated as described in Section 3.
- **"Downtime"** means periods when the QNSI Cloud services are unavailable, excluding SLA Exclusions defined in Section 5.
- **"Error"** means any API request that returns a 5xx server error code.
- **"Monthly Uptime Percentage"** means the total number of minutes in a calendar month minus the number of minutes of Downtime, divided by the total number of minutes in that month.
- **"Request"** means an API call to any QNSI Cloud service endpoint.
- **"Service Credit"** means a credit calculated as described in Section 4, applied to future invoices.

## 2. SLA Eligibility

This SLA applies to the following subscription tiers:

| Tier | SLA Coverage |
|------|--------------|
| Free | Not covered |
| Dev Starter | Not covered |
| Dev Pro | 99.9% availability target (no credits) |
| Dev Elite | 99.9% availability target (no credits) |
| Business Team | 99.9% SLA with credits |
| Business Advanced | 99.9% SLA with credits |
| Business Elite | 99.9% SLA with credits |
| Enterprise Standard | 99.95% SLA with credits |
| Enterprise Pro | 99.95% SLA with credits |
| Enterprise Elite | Custom SLA per agreement |
| Specialized | Custom SLA per agreement |

**Note:** Dev Pro and Dev Elite tiers receive availability monitoring and status transparency but are not eligible for Service Credits. Business and Enterprise tiers receive contractual SLA coverage with credits as described below.

## 3. Availability Calculation

### 3.1 Measurement

Availability is measured in 5-minute intervals. For each interval:
- If requests were made and none returned 5xx errors, the interval is 100% available.
- If requests were made and some returned 5xx errors, availability is calculated as: `(successful requests / total requests) × 100%`.
- If no requests were made, the interval is assumed 100% available.

### 3.2 Monthly Uptime Percentage

Monthly Uptime Percentage is calculated as:

```
Monthly Uptime % = ((Total Minutes − Downtime Minutes) / Total Minutes) × 100%
```

### 3.3 Covered Services

The following QNSI Cloud services are covered by this SLA:

- **Authentication Service** (auth-service)
- **Key Management Service** (kms-service)
- **Vault Service** (vault-service)
- **Storage Service** (storage-service)
- **Search Service** (search-service)
- **Audit Service** (audit-service)
- **Edge Gateway** (edge-gateway)

## 4. Service Credits

### 4.1 Credit Schedule (Business Tiers)

| Monthly Uptime Percentage | Service Credit |
|---------------------------|----------------|
| Less than 99.9% but ≥ 99.0% | 10% of monthly fees |
| Less than 99.0% but ≥ 95.0% | 25% of monthly fees |
| Less than 95.0% | 50% of monthly fees |

### 4.2 Credit Schedule (Enterprise Tiers)

| Monthly Uptime Percentage | Service Credit |
|---------------------------|----------------|
| Less than 99.95% but ≥ 99.0% | 10% of monthly fees |
| Less than 99.0% but ≥ 95.0% | 25% of monthly fees |
| Less than 95.0% | 50% of monthly fees |

### 4.3 Credit Limitations

- Service Credits are calculated as a percentage of the monthly subscription fees paid for the affected services.
- Service Credits are applied to future invoices and are not redeemable for cash.
- Maximum Service Credits for any calendar month shall not exceed 50% of your monthly subscription fees.
- Service Credits must be requested within 30 days of the incident.

## 5. SLA Exclusions

This SLA does not apply to any unavailability, suspension, or performance issues:

1. **Force Majeure**: Caused by factors outside our reasonable control, including natural disasters, war, terrorism, riots, government actions, or network/power failures beyond our infrastructure.

2. **Scheduled Maintenance**: During announced maintenance windows (see Maintenance Policy).

3. **Customer Actions**: Resulting from your actions or inactions, including:
   - Misconfiguration of security settings, access policies, or API keys
   - Disabling or revoking encryption keys
   - Exceeding published rate limits or quotas
   - Not following documented best practices

4. **External Dependencies**: Resulting from:
   - Internet connectivity issues beyond our network boundary
   - Third-party services or integrations
   - Customer-managed HSM or external key stores
   - Bring Your Own Hardware (BYOH) deployments

5. **Beta Features**: Any feature, service, or API explicitly marked as "Beta" or "Preview".

6. **Suspension**: Arising from suspension or termination of your account due to breach of terms.

7. **Specialized Deployments**: Air-gapped, on-premises, or VPC deployments are governed by deployment-specific SLAs defined in your agreement.

## 6. Credit Request Procedure

To request Service Credits:

1. Submit a support ticket within 30 days of the incident.
2. Include "SLA Credit Request" in the subject line.
3. Provide:
   - The affected calendar month and services
   - Specific dates and times of unavailability
   - Request IDs or error logs demonstrating the outage
   - Your calculated Monthly Uptime Percentage

4. We will verify the claim and, if confirmed, apply credits to your next invoice within one billing cycle.

## 7. Sole Remedy

**Your sole and exclusive remedy for any unavailability or failure to meet the SLA is the receipt of Service Credits as described in this document.** This SLA states your exclusive remedies for service unavailability.

## 8. SLA Changes

We may modify this SLA from time to time. Changes that materially reduce your SLA coverage will be announced at least 30 days in advance. Continued use of QNSI Cloud services after such changes constitutes acceptance of the modified SLA.

## 9. Relationship to Other Agreements

In the event of a conflict between this SLA and your subscription agreement or enterprise agreement, the terms of the enterprise agreement take precedence. For Enterprise Elite and Specialized tiers, custom SLA terms in your signed agreement supersede this document.

## 10. Disclaimers and Limitation of Liability

### 10.1 Disclaimer of Warranties

EXCEPT AS EXPRESSLY PROVIDED IN THIS SLA, QNSI CLOUD SERVICES ARE PROVIDED ON AN "AS-IS" AND "AS-AVAILABLE" BASIS. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, HEOSSI DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND UNINTERRUPTED AVAILABILITY.

### 10.2 Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:

1. HEOSSI will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or any loss of profits, revenues, data, goodwill, or business interruption, regardless of the theory of liability.

2. HEOSSI' aggregate liability arising out of or related to this SLA will not exceed the Service Credits described herein, or the amounts paid by you for the affected services in the 12 months prior to the claim, whichever is greater.

3. Service Credits are your sole and exclusive remedy for any failure to meet the SLA commitments.

### 10.3 Essential Basis

You acknowledge that the limitations of liability in this SLA are an essential basis of the bargain between you and HEOSSI, and that HEOSSI would not provide the services without such limitations.

## 11. Governing Law and Dispute Resolution

### 11.1 Governing Law

This SLA is governed by and construed in accordance with the laws of the Republic of Singapore, without regard to conflict of laws principles.

### 11.2 Jurisdiction

You agree that the courts of Singapore shall have exclusive jurisdiction over any disputes arising out of or relating to this SLA.

### 11.3 Dispute Resolution

Before initiating any legal proceedings, you agree to attempt to resolve disputes informally by contacting us at contact@heossi.com. We will attempt to resolve the dispute within 30 days of receipt of your notice.

## 12. General Provisions

### 12.1 Entire Agreement

This SLA, together with the Terms of Service and any applicable subscription agreement, constitutes the entire agreement between you and HEOSSI regarding SLA commitments.

### 12.2 Severability

If any provision of this SLA is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

### 12.3 No Waiver

Failure to enforce any provision of this SLA shall not constitute a waiver of that provision or any other provision.

### 12.4 Assignment

You may not assign this SLA without our prior written consent. We may assign this SLA to an affiliate or in connection with a merger, acquisition, or sale of assets.

---

**HEOSSI (PTE.) LTD**

Registered Office: 552 Ang Mo Kio, Avenue 10, #21-1982, Cheng San Place, Singapore 560552

UEN: 202532790K

**Effective Date:** February 24, 2026

**Document Version:** 1.0.0

For questions about this SLA, contact: contact@heossi.com
