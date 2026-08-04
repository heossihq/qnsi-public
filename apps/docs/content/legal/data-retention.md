---
title: Data Retention and Deletion
description: How long QNSI keeps each class of data, what happens when you delete something or close your account, and the limits of deletion in a tamper-evident system.
last_updated: 2026-07-13
copyright: © 2026 HEOSSI (PTE.) LTD. All rights reserved.
---
# Data Retention and Deletion

Last updated: 2026-07-13 · Effective: 2026-07-13

Draft pending review by qualified counsel. It must not be represented as counsel-approved.

> Generated from the single legal source of truth (`apps/web/lib/legal/`). Do not edit
> by hand - edit the source and run `pnpm gen:legal-docs`. The authoritative published
> version of every document is on the [QNSI Legal and Trust Center](https://qnsi.heossi.com/legal).

## Principle

We keep Customer Data for as long as you have an account and the retention you have selected, and no longer. Where law requires a longer period (tax, anti-money-laundering, litigation hold), that legal minimum governs and we will say so.

## Retention by data class

| Data class | Retention | On deletion |
| --- | --- | --- |
| Vault secrets, KMS key material, stored objects, search indexes | For the life of the account, unless you delete them sooner. | Cryptographically erased - the wrapping key is destroyed, rendering the ciphertext unrecoverable. |
| Audit records | Per your plan's audit-retention entitlement (extended retention is available as an add-on). | Expired records are purged on schedule; the hash chain remains verifiable across the purge boundary. |
| Account, billing, and invoice records | Retained for the statutory period required by Singapore tax and accounting law after the account closes. | Not deletable before the statutory period ends. |
| Operational logs and metrics | Short-lived; retained only as long as needed to operate and secure the service. | Purged on rotation. |

## Account closure

On workspace deletion, QNSI applies a grace period during which the workspace can be restored. At the end of the grace period a purge worker deletes tenant data across every service that holds it. Backups age out on their own schedule; a record already written to an immutable backup is removed when that backup expires, not before.

## The honest limit of deletion

QNSI's audit trail is tamper-evident by design: records are hash-chained and checkpointed so that neither we nor an attacker can silently rewrite history. That property is the point of the product - and it means we cannot surgically excise an individual entry from the chain without destroying the integrity guarantee everyone else relies on.

Where an erasure request touches audit records, we suppress and de-identify the entry rather than rewrite the chain, and we will explain exactly what was done. We would rather tell you the true limit than promise a deletion we cannot perform.
