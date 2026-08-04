---
title: Incident Response and Breach Notification
description: How QNSI detects, contains, and communicates a security incident - including the notification timelines we commit to.
last_updated: 2026-07-13
copyright: © 2026 HEOSSI (PTE.) LTD. All rights reserved.
---
# Incident Response and Breach Notification

Last updated: 2026-07-13 · Effective: 2026-07-13

Draft pending review by qualified counsel. It must not be represented as counsel-approved.

> Generated from the single legal source of truth (`apps/web/lib/legal/`). Do not edit
> by hand - edit the source and run `pnpm gen:legal-docs`. The authoritative published
> version of every document is on the [QNSI Legal and Trust Center](https://qnsi.heossi.com/legal).

## Detection

QNSI source defines security-event producers, tamper-evident audit contracts, runtime anomaly detection, alerting, and approval-gated containment controls. Complete production ingestion and successful execution across every service and incident path require deployment-specific exercise evidence and remain NOT VERIFIED until recorded.

## Response stages

- Triage - confirm, classify severity, and assign an incident lead.
- Contain - stop the bleeding, preserve evidence, protect key material first.
- Eradicate and recover - remove the cause, restore service, verify integrity of the audit chain.
- Notify - see the timelines below.
- Post-incident - root-cause analysis and a committed regression guard so the same failure cannot recur silently.

## Notification commitments

Where QNSI, acting as processor, becomes aware of a personal-data breach affecting your data, we will notify you without undue delay so that you can assess and meet your own GDPR Article 33, PDPA, or other notification duties.

Notification will include, as far as it is known at the time: what happened, which data categories and roughly how many records are affected, the likely consequences, and the measures we have taken or propose. If we do not yet know something, we will say that rather than guess - and we will follow up.

## Key-compromise

A suspected compromise of key material is treated as the highest severity. The response is: revoke, rotate, re-wrap, and re-attest - in that order - with every step written to the audit chain so that you can independently verify what was done.

## Contact

Security incidents: qnsi-security@heossi.com (see also the Vulnerability Disclosure Policy).
