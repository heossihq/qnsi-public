---
title: Changelog
last_updated: 2026-07-20
copyright: © 2026 HEOSSI (PTE.) LTD. All rights reserved.
---
# Changelog

Curated, high-signal changes to the QNSI platform, SDKs, and developer surfaces.

> Generated from the single changelog source of truth. Do not edit by hand - edit
> `apps/web/lib/changelog.json` and run `pnpm gen:changelog-docs`.

## Recent changes

### 2026-07-20 - Native-PQC HSM positioning and migration guidance

**Release.** Published an evidence-backed guide to native-PQC provider adoption and QNSI's HSPK compatibility path. Public claims now distinguish native provider operations, module-certificate ownership, deployment qualification, and QNSI's current ML-DSA-44/65/87 software signing boundary under qualified PKCS#11 custody.

### 2026-07-20 - Durable and resumable host discovery

**Release.** Host scans now checkpoint their deterministic filesystem cursor, resume after interruption, spool signed reports durably, and export bounded signed evidence bundles for controlled transfer from disconnected estates. Import verifies tenant and agent identity, payload integrity, signature validity, revocation state, and bundle reuse before inventory processing.

### 2026-07-20 - Durable AI event intelligence and governed remediation

**Release.** Security operations can now retain and correlate AI and platform events, detect anomalies across services, build root-cause context, and prepare remediation behind tenant authorization and approval gates. The workflow preserves operator accountability instead of turning an AI recommendation into an unaudited production change.

### 2026-07-20 - Source-code cryptography discovery is live

**Release.** The QNSI CLI can scan a repository locally for classical, PQC, and hybrid cryptography usage, emit JSON or a local CBOM, and upload signed findings through a scoped scanner identity. Uploaded findings enter Crypto Inventory as code_repo/code_usage assets and flow into discovery runs, posture, CBOM, and audit evidence. Source code stays in the customer's environment; only normalized findings are uploaded.

### 2026-07-20 - Governed migration execution and recovery

**Release.** PQC migrations now support hash-bound dry runs, four-eyes approval, durable execution waves, pause/resume/cancel controls, per-asset cutover confirmation, lease-based crash recovery, and evidence-backed reconciliation when a provider outcome is ambiguous. Execution history remains readable even when new execution is feature-gated.

### 2026-07-20 - QNSI SDK 0.6.0 and MCP 0.2.0

**Release.** Published @heossihq/qnsi 0.6.0 with the source-code scanner and HSPK client methods, plus @heossihq/qnsi-mcp 0.2.0 with HSPK seal/sign tools. The current HSPK API binds ML-DSA-44/65/87 private-key custody at rest to a qualified PKCS#11 HSM while ML-DSA operations remain in QNSI software.

### 2026-07-07 - SDK @heossihq/qnsi 0.5.2

**Release.** PQC provider bumped to @noble/post-quantum 0.6.1 (the SDK's pure-JS cross-verification engine). NIST ACVP conformance unchanged (noble 435/435). Latest published npm release.

### 2026-06-16 - QNSI SDKs live on every registry

**Release.** One SDK per language, published and installable: @heossihq/qnsi (npm), qnsi (PyPI), qnsi (crates.io), com.heossi:qnsi (Maven Central), the Go module, plus the @heossihq/qnsi-mcp server.

### 2025-12-01 - Edge gateway and auth hardening

**Security.** Hardened public route handling and proxy behavior for signup, login, and tenant-lookup flows; reduced sensitive auth logging; removed committed signing material.

### 2025-11-01 - QNSI monorepo bootstrapped

**Release.** Consolidated the platform into the current monorepo; established the @heossihq/qnsi-* namespace and Changesets-based semantic versioning.

## Versioning

Changes follow semantic versioning: **major** = breaking changes, **minor** = new
features, **patch** = fixes.
