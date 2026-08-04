---
title: Enterprise Diligence Index
description: Public QNSI architecture, security, cryptographic evidence, operations, licensing, provenance, and known-gap index.
---

# Enterprise Diligence Index

This page is a public index for technical evaluation. It identifies what can be inspected without a private repository or sales process and distinguishes public evidence, operational statements, source-backed contracts, deployment qualification, and unavailable independent assurance.

It is not a certification, audit opinion, legal opinion, customer-specific security response, or proof that every source-defined path executes in production.

## Evidence vocabulary

| Status                 | Meaning                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Public evidence        | A published artifact with a stated method and scope that can be independently inspected or rerun         |
| Operational statement  | QNSI describes a current practice or architecture; it is not an external auditor conclusion              |
| Source-implemented     | Relevant code or contract exists; deployment execution is not inferred                                   |
| Deployment-qualified   | Availability depends on observed evidence for the named environment, provider, device, and configuration |
| Statement of direction | Directional only and not presented as available                                                          |
| Not completed          | QNSI does not possess or publish the referenced independent artifact                                     |

## Architecture and responsibility

- [Enterprise reference architectures](../architecture/reference-architectures)
- [System overview](../architecture/system-overview)
- [Service boundaries](../architecture/service-boundaries)
- [Trust boundaries](../architecture/trust-boundaries)
- [Tenant isolation](../architecture/tenant-isolation)
- [Shared audit responsibility](../audit/shared-responsibility)

## Product maturity and source boundary

- [Canonical public capability registry](https://github.com/heossihq/qnsi-public/blob/main/apps/web/lib/public-capabilities.ts)
- [Public export manifest](https://github.com/heossihq/qnsi-public/blob/main/MANIFEST.json)
- [Public repository security policy](https://github.com/heossihq/qnsi-public/blob/main/SECURITY.md)
- [Public repository license](https://github.com/heossihq/qnsi-public/blob/main/LICENSE.md)

The public repository contains SDKs, agents, tooling, documentation, scenario catalogs, and reproducibility material. Hosted core services and infrastructure remain private. The exporter is denylisted and fail-closed.

## Cryptographic evidence

- [Live verification sandbox](https://qnsi.heossi.com/verify)
- [Conformance evidence](https://qnsi.heossi.com/verify/conformance)
- [Reproducible benchmarks](https://qnsi.heossi.com/benchmarks)
- [Algorithm catalog](https://qnsi.heossi.com/algorithms)
- [Cryptographic security assumptions](../crypto/primitives/security-assumptions)
- [Cryptographic attestation](./crypto-attestation)

Conformance and benchmark evidence applies to the recorded algorithm, provider, version, build, environment, method, and dataset. It is not CMVP certification and does not establish every production service path.

## Security and operations

- [Security overview](./README)
- [Threat model](./threat-model)
- [Incident response](./incident-response)
- [Vulnerability disclosure](./vulnerability-disclosure)
- [Security advisories](./advisories)
- [Production status](https://qnsi.heossi.com/status)

## Audit and compliance

- [Audit model](../audit/README)
- [Event model](../audit/event-model)
- [Merkle checkpointing](../audit/merkle-checkpointing)
- [Exports](../audit/exports)
- [Compliance mapping](../audit/compliance-mapping)
- [Public compliance page](https://qnsi.heossi.com/security/compliance)

Framework mappings are self-assessed engineering mappings. They are not certifications or legal conclusions.

## Known independent-assurance gaps

- No completed independent production-endpoint penetration-test report is published.
- QNSI does not publish or claim a SOC 2 report or SOC 2 certification.
- QNSI does not claim that its service plane is CMVP validated.
- Customer HSM support requires qualification of the exact device, service, firmware, mode, mechanisms, credentials, operations, interruption behavior, evidence path, and vendor-certificate scope.
- VPC-peered, private-endpoint, on-premises, air-gapped, and sovereign topologies require tenant-specific provisioning and qualification.
- Control mappings do not prove operating effectiveness or auditor acceptance.

## Request-scoped material

Active procurement reviews can request a scoped architecture response, security questionnaire, contractual documents, and evidence discussion through the [security review intake](https://qnsi.heossi.com/contact?topic=security-review). Requested material is represented as available only when it exists for the requested scope.
