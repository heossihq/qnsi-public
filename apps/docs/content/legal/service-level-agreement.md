---
title: Service Level Agreement
description: Availability measurement, exclusions, service credits, claim procedure, and the plans eligible for contractual SLA coverage.
last_updated: 2026-07-13
copyright: © 2026 HEOSSI (PTE.) LTD. All rights reserved.
---
# Service Level Agreement

Last updated: 2026-07-13 · Effective: 2026-07-13

Draft pending review by qualified counsel. It must not be represented as counsel-approved.

> Generated from the single legal source of truth (`apps/web/lib/legal/`). Do not edit
> by hand - edit the source and run `pnpm gen:legal-docs`. The authoritative published
> version of every document is on the [QNSI Legal and Trust Center](https://qnsi.heossi.com/legal).

## Eligibility and commitment

This SLA applies only where the customer's checkout, subscription record, or Order Form expressly includes contractual SLA coverage. Free and developer plans may display availability targets without creating a service-credit entitlement. A signed Order Form may replace these terms.

| Eligible plan | Monthly availability commitment |
| --- | --- |
| Business Team / Advanced / Elite | 99.9% |
| Enterprise Standard / Pro | 99.95% |
| Enterprise Elite / Specialized | As stated in the Order Form |

## Measurement

Monthly Availability Percentage is 100 multiplied by the total minutes in the calendar month minus Downtime, divided by total minutes in that month. Downtime means a period of at least five consecutive minutes in which the covered QNSI production service is unable to serve valid requests because of a fault within HEOSSI's control, as measured by HEOSSI's monitoring and reasonably corroborated by customer request identifiers.

Covered services are the production edge gateway and the authentication, key-management, vault, storage, search, and audit services included in the affected subscription. A failure of one service does not make an unaffected service unavailable.

## Exclusions

- Scheduled or emergency maintenance handled consistently with the Support and Maintenance Policy.
- Customer systems, configuration, credentials, keys, identity providers, networks, integrations, quota exhaustion, unsupported use, or breach of the agreement.
- Internet or third-party services outside HEOSSI's reasonable control, including customer-selected external HSMs or customer-managed environments.
- Force majeure, government action, denial-of-service attacks despite reasonable protection, or suspension required for security, law, non-payment, or abuse.
- Beta, preview, free, evaluation, on-premises, air-gapped, or customer-managed components unless the Order Form expressly includes them.

## Service credits

Credits cannot exceed 50% of the affected monthly service fee, have no cash value, and apply to a future invoice. They are the sole contractual remedy for failure to meet this SLA, without limiting remedies that cannot lawfully be excluded.

| Monthly availability | Credit on affected monthly service fee |
| --- | --- |
| Below commitment and at least 99.0% | 10% |
| Below 99.0% and at least 95.0% | 25% |
| Below 95.0% | 50% |

## Claim procedure

Submit a claim to qnsi-support@heossi.com within 30 days after the end of the affected month. Include the tenant, service, timestamps, request identifiers, impact, and calculation. HEOSSI will compare the claim with service telemetry and explain any denial.
