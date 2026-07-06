---
title: Migration Journey to QNSI
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2026 HEOSSI. All rights reserved.
---
# Migration Journey to QNSI

QNSI is not just a reporting layer on top of your existing cryptography estate. The target operating model is that production trust dependencies are consumed from QNSI and continuously validated by QNSI.

The customer journey is:

**Connect → Discover → Analyze → Govern → Migrate → Validate → Operate**

That sequence is reflected in the cloud portal under Crypto Posture and in the evidence workflow exposed by QNSI.

## What “migrated to QNSI” actually means

A tenant is migrated only when production trust dependencies are consumed from QNSI and continuously validated, not merely mirrored into QNSI.

In practice that means:

- workloads use QNSI KMS for key operations
- workloads retrieve secrets from QNSI Vault
- certificates and lifecycle policies are governed by QNSI
- encrypted storage, search, AI workloads, and access policy are enforced by QNSI
- legacy external stores are no longer serving production trust decisions

## 1. Connect

Before QNSI can measure anything, it needs source visibility.

There are two discovery paths:

- **Cloud/API connectors** for managed providers such as AWS KMS, AWS ACM, Azure Key Vault, GCP KMS, HashiCorp Vault, Cloudflare, and other supported external systems
- **QNSI agents** installed in your environment for host-level, TLS, keystore, certificate, and on-prem or private-network discovery

Use connectors when the source already exposes usable APIs. Use agents when the source is private, self-hosted, on-premises, or when you need host-local evidence.

## 2. Discover

Once sources are connected, QNSI runs discovery and normalizes the resulting assets.

Discovery produces:

- asset inventory
- service and provider mapping
- algorithm and protocol identification
- certificate and key material metadata
- cryptographic dependency and exposure evidence

At this stage QNSI distinguishes between:

- platform-native assets already inside QNSI
- external assets still outside QNSI
- assets with incomplete evidence or stale source coverage

## 3. Analyze

After discovery, QNSI calculates the migration and risk picture.

This includes:

- quantum exposure
- policy violations
- migration urgency
- deprecated or non-target algorithm usage
- workload and environment cutover blockers

This is where the customer sees what is classical, hybrid, PQC-native, unknown, or insufficiently evidenced.

## 4. Govern

Before cutover, define the target state.

In QNSI this is not just a compliance exercise. It is the operating policy that future workloads must follow.

Typical governance decisions include:

- crypto policy tier
- allowed algorithms and key types
- certificate lifecycle constraints
- audit vs enforce mode
- transition exceptions
- HSM and residency requirements

## 5. Migrate

Migration is where assets and dependencies move into QNSI.

Typical migration work includes:

- creating or importing keys into QNSI KMS
- re-issuing or rotating secrets into QNSI Vault
- moving certificate lifecycle management under QNSI policy
- rewiring applications to call QNSI APIs and SDKs
- shifting encrypted storage and search flows to QNSI-managed services
- using migration automation and managed agents where enabled by plan or add-on

QNSI’s value is not that it can list external assets. The value is that it becomes the active trust service your workloads call.

## 6. Validate

Validation is both technical and evidentiary.

After migration, QNSI must prove:

- applications are actually consuming QNSI services
- legacy providers are no longer in the production trust path
- the configured policies are being enforced
- the underlying evidence is fresh and auditable

This is where QNSI produces operational and audit artifacts such as:

- readiness reports
- CBOM
- QBOM
- SBOM
- hardware inventory
- PQC readiness views
- algorithm deprecation reports

## 7. Operate

Once migrated, QNSI becomes the continuous control plane for trust operations.

Operational coverage includes:

- crypto security monitoring
- agility scoring
- certificate lifecycle management
- drift and control validation
- remediation and automation
- evidence freshness and continuous posture tracking

The steady-state promise is not just “migrated once.” It is “kept migrated.”

## Success criteria

The migration is complete only when:

- production workloads consume QNSI trust services
- cutover from legacy trust dependencies is validated
- evidence is current and auditable
- regression and drift are continuously monitored

That is the difference between “inventorying cryptography” and “running your trust stack on QNSI”.
