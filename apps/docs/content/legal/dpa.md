---
title: Data Processing Addendum
description: Processor terms for Customer Data, including the sub-processor disclosure.
last_updated: 2026-06-01
copyright: © 2026 HEOSSI (PTE.) LTD. All rights reserved.
---
# Data Processing Addendum

Last updated: 2026-06-01 · Effective: 2026-06-01

**The authoritative Data Processing Addendum is published at [https://qnsi.heossi.com/dpa](https://qnsi.heossi.com/dpa).**

This documentation page intentionally does not restate the terms of that document. Two
versions of a binding instrument is how they drift apart, and a stale copy of a contract
is worse than no copy. Read the authoritative version at the link above.

## Sub-processors (current)

The complete, current sub-processor disclosure required by GDPR Article 28(2) and (4) is
generated below from the same source the DPA page itself uses - so this page cannot name
a different set of vendors than the contract does. Last updated: 2026-07-13.

| Sub-processor | Purpose | Region | Processes Customer Data |
| --- | --- | --- | --- |
| Amazon Web Services (AWS) | Primary cloud infrastructure for QNSI Cloud - compute (ECS, Lambda), storage (S3, RDS), networking (CloudFront, ELB), key management (KMS, Secrets Manager). | Singapore (ap-southeast-1) | Yes |
| Stripe | Subscription billing, payment processing, tax calculation, and invoicing for self-serve plans. | Global (controller-to-processor) | Yes |
| Namecheap (PrivateEmail) | Transactional email delivery for account verification, invoices, support correspondence, and incident notifications. | United States | Yes |
| Cloudflare | DNS authoritative resolution and DDoS protection for heossi.com and qnsi.heossi.com zones. | Global edge network | No |
| GitHub (Microsoft) | Source-code hosting and CI/CD orchestration for QNSI build pipelines. Customer Data is never stored in GitHub. | United States | No |
| npm, Inc. (GitHub Packages) | Public SDK distribution. No Customer Data is processed; only published artifact metadata. | United States | No |

Full disclosure, including transfer mechanisms and the right to object:
[https://qnsi.heossi.com/legal/sub-processors](https://qnsi.heossi.com/legal/sub-processors).

> Generated from the single legal source of truth (`apps/web/lib/legal/`). Do not edit
> by hand - edit the source and run `pnpm gen:legal-docs`. The authoritative published
> version of every document is on the [QNSI Legal and Trust Center](https://qnsi.heossi.com/legal).
