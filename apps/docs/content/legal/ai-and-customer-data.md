---
title: AI and Customer Data
description: Whether QNSI trains models on your data (it does not), how customer AI workloads are isolated, and what leaves the enclave.
last_updated: 2026-07-13
copyright: © 2026 HEOSSI (PTE.) LTD. All rights reserved.
---
# AI and Customer Data

Last updated: 2026-07-13 · Effective: 2026-07-13

> Generated from the single legal source of truth (`apps/web/lib/legal/`). Do not edit
> by hand - edit the source and run `pnpm gen:legal-docs`. The authoritative published
> version of every document is on the [QNSI Legal and Trust Center](https://qnsi.heossi.com/legal).

## We do not train on your data

QNSI does not use Customer Data - content, prompts, keys, secrets, stored objects, search indexes, or audit records - to train, fine-tune, or evaluate any model that QNSI operates or distributes.

When you run an AI workload on QNSI, you are running YOUR model on YOUR data. QNSI orchestrates and isolates that workload; it does not learn from it.

## Isolation of AI workloads

- AI inference and fine-tuning run inside hardware-isolated enclaves (Intel SGX, AMD SEV, or AWS Nitro, depending on deployment), with attestation recorded before a workload is admitted.
- Enclave workloads are tenant-scoped. Cross-tenant access is denied at the edge gateway, at the service layer, and by the tenant claim in the token - a defence-in-depth boundary, not a single check.
- Model artefacts and prompts are encrypted at rest under the tenant's own key material.

## What is recorded

Metadata about an AI operation - that it happened, when, by which identity, against which key or model reference, and whether attestation passed - is written to the tamper-evident audit chain. The content of the prompt or the model output is not written to the audit chain.

## Third-party model providers

If you configure QNSI to call an external model provider, that provider becomes a recipient of whatever you send it, under that provider's terms - not ours. QNSI will tell you when a configuration does this. QNSI does not silently route Customer Data to a third-party model.
