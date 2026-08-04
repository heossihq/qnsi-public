---
title: Cryptography
description: Cryptographic primitives - algorithm agility, policy tiers, cross-verification, and PQC migration.
---

# Cryptography

Cryptographic primitives - algorithm agility, policy tiers, cross-verification, and PQC migration.

Start here to decide which part of the cryptographic lifecycle you are
changing. Algorithm selection alone is not a migration plan: inventory,
custody, protocol compatibility, authorization, recovery and evidence must
move together.

## Pages

- [Algorithm Agility](./algorithm-agility)
- [Crypto-Shredding](./crypto-shredding)
- [Algorithm Decommissioning](./decommissioning)
- [Forward Secrecy](./forward-secrecy)
- [Hybrid Cryptography Strategy](./hybrid-crypto-strategy)
- [Key Generation](./key-generation)
- [Key Hierarchy](./key-hierarchy)
- [Key Revocation](./key-revocation)
- [Key Rotation](./key-rotation)
- [Key Storage](./key-storage)
- [Key Usage](./key-usage)
- [Cryptographic Trust Model](./trust-model)

## Sections

- [Primitives](./primitives)
## Discovery

- [Source-Code Cryptography Scanning](./source-code-scanning)

## Choose the right path

- Use **Algorithm Agility** when an application needs stable interfaces while
  algorithms and policy tiers change.
- Use **Hybrid Cryptography Strategy** when a peer or edge dependency cannot
  yet operate a PQC-only protocol.
- Use **Key Hierarchy**, **Key Storage** and **Key Usage** to define custody
  and authorization boundaries.
- Use **Key Rotation**, **Key Revocation** and **Algorithm
  Decommissioning** for operational change and compromise response.
- Use **Source-Code Cryptography Scanning** to find embedded algorithms,
  libraries, certificates and protocol assumptions before planning cutover.

## Evidence boundaries

QNSI publishes algorithm-level conformance and runtime evidence, but those
artifacts answer different questions:

- an ACVP vector result demonstrates the tested implementation produced the
  expected algorithm result;
- a provider or key record demonstrates configured runtime state;
- an audit event demonstrates that a recorded operation passed through the
  audited path;
- none of those, alone, proves a customer's entire application used PQC
  end-to-end.

For an HSM-backed deployment, distinguish a native-PQC mechanism from an
HSM-sealed compatibility construction. The exact device, firmware, approved
mode and mechanism must be qualified before making a hardware or certification
claim.

## Migration sequence

1. Inventory cryptography in code, infrastructure, identities and data flows.
2. Classify confidentiality lifetime and interoperability constraints.
3. Select the target policy and identify explicit hybrid boundaries.
4. Approve a bounded migration wave with rollback criteria.
5. Rotate or create material using the selected custody profile.
6. Validate the application path and retain returned evidence.
7. Reconcile the inventory, exceptions and recovery state.

Use the public [PQC migration guide](https://qnsi.heossi.com/pqc-migration)
for the programme view and [Cryptographic Trust Model](./trust-model) for
deployment qualification.
