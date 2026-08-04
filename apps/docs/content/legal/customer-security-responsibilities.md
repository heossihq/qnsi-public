---
title: Customer Security Responsibilities
description: The shared-responsibility boundary for accounts, keys, applications, users, integrations, and regulated workloads.
last_updated: 2026-07-13
copyright: © 2026 HEOSSI (PTE.) LTD. All rights reserved.
---
# Customer Security Responsibilities

Last updated: 2026-07-13 · Effective: 2026-07-13

Draft pending review by qualified counsel. It must not be represented as counsel-approved.

> Generated from the single legal source of truth (`apps/web/lib/legal/`). Do not edit
> by hand - edit the source and run `pnpm gen:legal-docs`. The authoritative published
> version of every document is on the [QNSI Legal and Trust Center](https://qnsi.heossi.com/legal).

## Shared responsibility

HEOSSI secures the managed QNSI service and its underlying cloud configuration. You secure your identities, endpoints, applications, integrations, data classification, access decisions, and configuration choices. Security features do not transfer your legal or operational responsibility for your workload to HEOSSI.

## Your minimum responsibilities

- Use unique accounts, strong authentication, least privilege, and multi-factor authentication where available; protect recovery factors and administrator access.
- Keep API keys, signing keys, service credentials, recovery material, and exported data confidential; rotate or revoke them promptly after suspected exposure.
- Configure tenant membership, roles, policies, retention, regions, integrations, webhooks, and customer-managed HSMs correctly and review audit events.
- Patch and secure your applications, SDK dependencies, browsers, endpoints, networks, and identity providers.
- Maintain a lawful basis and required notices or consents for Customer Data, and do not place data in QNSI that the selected service, tier, or agreement is not authorised to process.
- Test recovery and business-continuity procedures, maintain appropriate exports or backups, and validate changes before production use.
- Notify HEOSSI promptly of suspected compromise and cooperate in containment and investigation.

## High-risk and regulated use

Do not treat a framework mapping, security feature, or cryptographic conformance result as a certification of your system. You are responsible for determining whether your configuration and agreement satisfy sector-specific rules, licences, approvals, residency duties, and human-oversight requirements.
