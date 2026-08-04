---
title: Control Plane vs Data Plane
version: 0.0.1
last_updated: 2026-07-28
copyright: © 2025 HEOSSI. All rights reserved.
---
# Control Plane vs Data Plane

QNSI separates control plane operations from data plane operations.

The distinction is about responsibility and failure handling, not simply which
URL receives the request. Both planes require authenticated tenant context,
authorization and audit correlation.

## Control plane

Management operations that configure the system:

- Tenant provisioning
- Key creation and rotation policies
- Access control policy updates
- Service account management
- Audit configuration

Control plane operations are:
- Lower throughput
- Strongly consistent
- Fully audited

Changes in this plane can affect many later data-plane operations. Apply
approval, idempotency and reconciliation to provisioning, policy and rotation
changes so a retry cannot silently create a second resource or skip a required
transition.

## Data plane

Runtime operations that process data:

- Encrypt/decrypt operations
- Secret retrieval
- Storage read/write
- Search queries
- Token validation

Data plane operations are:
- High throughput
- Eventually consistent where safe
- Optimized for latency

Data-plane responses must still fail closed when identity, policy, key state or
the required upstream service is unavailable. Low latency is not permission to
fall back to a weaker algorithm, another tenant or an unaudited key.

## Isolation

Control and data plane share authentication but have separate:
- Rate limit pools
- Failure domains
- Scaling characteristics

They may also have different recovery objectives and rate limits. A healthy
control plane does not prove that encryption or secret retrieval is available,
and a healthy data plane does not prove a recent policy change was fully
reconciled.

## Example: governed key rotation

1. An operator submits a rotation request to the control plane.
2. Authorization and any required approvals are evaluated.
3. The operation is recorded with an idempotency or correlation identifier.
4. The KMS creates or activates the next key version.
5. Data-plane callers begin using the approved version.
6. Verification checks a real encrypt/decrypt or sign/verify path.
7. Reconciliation records success, rollback state and dependent resources.

Steps 1-3 are primarily governance. Steps 4-6 cross into the data path. The
final record connects them for audit and recovery.

## Failure analysis

When an operation fails, identify the plane before retrying:

- a policy, approval or entitlement failure belongs to control-plane state;
- a key-use, storage or search failure belongs to the data path;
- an unavailable identity, audit or dependency service may affect both;
- a timeout with an unknown outcome requires reconciliation before replay.

Preserve the correlation identifier across the boundary. Do not infer that an
operation failed merely because the client did not receive its response.

## Verification checklist

- Confirm control-plane mutations are idempotent.
- Confirm unauthorized mutations and data operations are denied.
- Confirm data operations use the policy version approved for the resource.
- Exercise dependency loss and recovery without weakening policy.
- Verify audit records connect approval, execution and reconciliation.

See [Architecture](../architecture), [Idempotency](../api/idempotency) and
[Business Continuity and Disaster Recovery](../legal/business-continuity).
