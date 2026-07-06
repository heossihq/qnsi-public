---
title: Migration Checklist
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2026 HEOSSI. All rights reserved.
---
# Migration Checklist

Use this checklist alongside [Migration Journey to QNSI](/migration/journey). The checklist is execution-oriented; the journey document explains the target operating model and the logic behind each stage.

## 1. Connect

- [ ] Set up the QNSI tenant, roles, and credentials
- [ ] Decide which discovery path is required per source: cloud/API connector, agent, or both
- [ ] Connect managed providers such as AWS, Azure, GCP, HashiCorp Vault, or CDN/TLS sources
- [ ] Install QNSI agents where sources are private, self-hosted, or only reachable from inside the environment
- [ ] Confirm the connected source list reflects the intended migration scope

## 2. Discover

- [ ] Run an initial discovery scan
- [ ] Verify assets appear in Asset Inventory
- [ ] Confirm certificates, keys, secrets, and cryptographic dependencies are being normalized
- [ ] Identify sources returning incomplete evidence or zero assets
- [ ] Re-run or fix source connectivity before using the inventory as a cutover baseline

## 3. Analyze

- [ ] Review Quantum Exposure
- [ ] Review Policy Violations
- [ ] Review the Migration Plan produced from discovered assets
- [ ] Separate platform-native assets from external assets still outside QNSI
- [ ] Mark unknown, deprecated, or insufficiently evidenced cryptographic usage for follow-up

## 4. Govern

- [ ] Define the target crypto policy tier
- [ ] Set algorithm, HSM, lifecycle, and transition requirements
- [ ] Decide which controls run in audit mode vs enforce mode
- [ ] Define exceptions and transition rules for systems that cannot cut over immediately
- [ ] Align certificate lifecycle and rotation policy with the QNSI target state

## 5. Migrate

- [ ] Create or import keys into QNSI KMS
- [ ] Migrate secrets into QNSI Vault
- [ ] Move certificate lifecycle management under QNSI policy
- [ ] Reconfigure workloads to call QNSI SDKs, APIs, or platform services
- [ ] Batch migration work into controllable cutover groups
- [ ] Use migration automation or managed agents where available in the tenant plan

## 6. Validate

- [ ] Verify production workloads are consuming QNSI trust services
- [ ] Confirm legacy providers are no longer serving production trust decisions
- [ ] Generate and review readiness evidence
- [ ] Generate and review CBOM, QBOM, and SBOM as separate evidence products
- [ ] Validate policy enforcement, audit evidence, and source freshness
- [ ] Confirm cutover with application owners before retiring fallback paths

## 7. Operate

- [ ] Enable continuous monitoring and drift/control validation
- [ ] Review agility score, monitoring, and lifecycle pages on an operating cadence
- [ ] Rotate migrated secrets and keys under the new policy
- [ ] Decommission legacy systems only after sustained stable operation
- [ ] Document the final cutover state and residual exceptions

## Migration success rule

- [ ] Production trust dependencies are consumed from QNSI and continuously validated, not merely mirrored into QNSI
