---
title: Sub-processors
description: The current, complete list of third parties that process Customer Data on QNSI's behalf, their purpose, region, and cross-border transfer mechanism.
last_updated: 2026-07-13
copyright: © 2026 HEOSSI (PTE.) LTD. All rights reserved.
---
# Sub-processors

Last updated: 2026-07-13 · Effective: 2026-07-13

Draft pending review by qualified counsel. It must not be represented as counsel-approved.

> Generated from the single legal source of truth (`apps/web/lib/legal/`). Do not edit
> by hand - edit the source and run `pnpm gen:legal-docs`. The authoritative published
> version of every document is on the [QNSI Legal and Trust Center](https://qnsi.heossi.com/legal).

## Scope

HEOSSI (PTE.) LTD engages the sub-processors below to deliver QNSI Cloud. This list is maintained as the authoritative disclosure required by GDPR Article 28(2) and (4), the UK GDPR, and Singapore's Personal Data Protection Act (PDPA). It is incorporated by reference into the Data Processing Addendum.

Customer Data at rest is hosted exclusively in AWS Asia Pacific (Singapore) - ap-southeast-1. Sub-processors that cannot access Customer Data (infrastructure and distribution services that handle only metadata) are listed separately below for completeness.

## Sub-processors with access to Customer Data

| Sub-processor | Purpose | Region | Transfer mechanism |
| --- | --- | --- | --- |
| Amazon Web Services (AWS) | Primary cloud infrastructure for QNSI Cloud - compute (ECS, Lambda), storage (S3, RDS), networking (CloudFront, ELB), key management (KMS, Secrets Manager). | Singapore (ap-southeast-1) | EU SCCs + UK IDTA in place for EU/UK customer data routed through AWS edges. |
| Stripe | Subscription billing, payment processing, tax calculation, and invoicing for self-serve plans. | Global (controller-to-processor) | Stripe's published SCCs; cardholder data is tokenised and never touches QNSI infrastructure. |
| Namecheap (PrivateEmail) | Transactional email delivery for account verification, invoices, support correspondence, and incident notifications. | United States | EU SCCs in place for EU/UK recipient addresses. |

## Service providers without access to Customer Data

These providers support the platform but do not process Customer Data. They are disclosed for transparency.

| Provider | Purpose | Region | Transfer mechanism |
| --- | --- | --- | --- |
| Cloudflare | DNS authoritative resolution and DDoS protection for heossi.com and qnsi.heossi.com zones. | Global edge network | Cloudflare's data processing addendum + EU SCCs. |
| GitHub (Microsoft) | Source-code hosting and CI/CD orchestration for QNSI build pipelines. Customer Data is never stored in GitHub. | United States | Microsoft EU Data Boundary commitments + SCCs. |
| npm, Inc. (GitHub Packages) | Public SDK distribution. No Customer Data is processed; only published artifact metadata. | United States | Not applicable - public package registry. |

## Notification of changes and right to object

QNSI operates under a general written authorisation for sub-processors. Before a new sub-processor begins processing Customer Data, QNSI will update this page and notify affected customers at their account contact address.

Customers may object to a new sub-processor on reasonable data-protection grounds within the notice period stated in the Data Processing Addendum. Where an objection cannot be resolved, the customer may terminate the affected subscription without penalty for the remainder of the term.

To subscribe to sub-processor change notifications, or to raise an objection, contact qnsi-security@heossi.com.
