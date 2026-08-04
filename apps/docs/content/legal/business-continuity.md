---
title: Business Continuity and Disaster Recovery
description: How QNSI is architected to survive failure, how we recover, and what we do not yet promise.
last_updated: 2026-07-13
copyright: © 2026 HEOSSI (PTE.) LTD. All rights reserved.
---
# Business Continuity and Disaster Recovery

Last updated: 2026-07-13 · Effective: 2026-07-13

> Generated from the single legal source of truth (`apps/web/lib/legal/`). Do not edit
> by hand - edit the source and run `pnpm gen:legal-docs`. The authoritative published
> version of every document is on the [QNSI Legal and Trust Center](https://qnsi.heossi.com/legal).

## Architecture

QNSI Cloud runs on AWS Asia Pacific (Singapore) - ap-southeast-1. Backend services run as managed containers behind a hardened edge gateway; the database is a managed Postgres instance with automated backups; frontends are served from a global CDN. Services are health-gated on deploy and roll back automatically when a new revision fails to become healthy.

## Backups

- Database backups are automated and encrypted at rest.
- Key material is held in managed key stores and, on the higher crypto-policy tiers, in customer-controlled HSMs - so a QNSI-side failure does not, by itself, put a customer's root keys at risk.
- Restores are exercised, not assumed.

## What we do not claim

QNSI does not currently claim a multi-region active-active topology or a contractual RTO/RPO on self-serve plans. Where a customer requires a specific RTO/RPO, region failover, or an air-gapped or on-premise topology, that is an enterprise engagement with commitments written into the contract - not a marketing promise made on a public page.

We would rather publish a smaller true commitment than a larger one we cannot evidence.
