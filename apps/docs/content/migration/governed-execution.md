---
title: Governed Migration Execution
description: Execute PQC migration plans with hash-bound review, four-eyes approval, durable waves, recovery, and reconciliation evidence.
last_updated: 2026-07-20
source_files:
  - /apps/crypto-inventory-service/src/routes/migration-execution.ts
  - /apps/crypto-inventory-service/src/routes/migration-cutover.ts
  - /apps/crypto-inventory-service/src/services/migration-execution-service.ts
  - /apps/crypto-inventory-service/src/services/migration-asset-action-store.ts
---

# Governed Migration Execution

QNSI treats cryptographic migration as a controlled change, not a bulk key-rotation button.
The execution workflow binds operator approval to an exact dry-run, records every control
event, divides large estates into durable waves, and stops ambiguous provider outcomes from
being reported as successful without evidence.

New execution is entitlement and feature gated. Read-only execution history remains available
so operators can investigate prior work even when the execution feature is disabled.

## Control flow

1. **Discover and assess.** Complete discovery and review the assets selected by the current
   migration plan.
2. **Dry-run.** QNSI returns targeted assets, connector availability, warnings, estimated
   duration, and a SHA-256 `planSnapshotHash`.
3. **Request execution.** Submit that exact hash. QNSI recomputes the plan and rejects the
   request with `409` if anything changed.
4. **Approve.** A different authenticated operator approves the pending execution. The
   requester cannot approve their own change.
5. **Execute in waves.** QNSI dispatches durable per-asset actions in bounded waves and records
   progress, rollback metadata, and control events.
6. **Confirm or reconcile.** Customer-driven cutovers require confirmation. Ambiguous managed
   provider outcomes require verification evidence before their state can advance.
7. **Export evidence.** Execution, wave, action, control-event, and reconciliation records feed
   the migration evidence pack.

## Dry-run and hash confirmation

```bash
curl -sS -X POST \
  https://api.qnsi.heossi.com/proxy/crypto/v1/migration/dry-run \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-qnsp-tenant: $TENANT_ID"
```

Preserve the returned `planSnapshotHash`, review the target counts and warnings, then request
execution:

```bash
curl -sS -X POST \
  https://api.qnsi.heossi.com/proxy/crypto/v1/migration/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-qnsp-tenant: $TENANT_ID" \
  -H "content-type: application/json" \
  --data '{"planSnapshotHash":"<64-hex-character-hash>"}'
```

A hash mismatch means the estate or plan changed after review. Run a new dry-run; do not reuse
or override the old confirmation.

## Four-eyes approval

The execution enters a pending-approval state. A second operator with `migration:execute`
permission approves it:

```bash
curl -sS -X POST \
  "https://api.qnsi.heossi.com/proxy/crypto/v1/migration/executions/$EXECUTION_ID/approve" \
  -H "Authorization: Bearer $APPROVER_TOKEN" \
  -H "x-qnsp-tenant: $TENANT_ID"
```

QNSI records requester, approver, timestamps, the approved plan hash, and the authenticated
principal behind each control action.

## Pause, resume, and cancel

Pause stops dispatching new asset actions while preserving completed work and durable state:

```bash
curl -sS -X POST \
  "https://api.qnsi.heossi.com/proxy/crypto/v1/migration/executions/$EXECUTION_ID/pause" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-qnsp-tenant: $TENANT_ID" \
  -H "content-type: application/json" \
  --data '{"reason":"Change window closed pending application validation"}'
```

Resume and cancel use:

```text
POST /crypto/v1/migration/executions/:id/resume
POST /crypto/v1/migration/executions/:id/cancel
```

Every pause, resume, approval, cancellation, cutover confirmation, and reconciliation is
written to both the execution control ledger and the tenant audit stream.

## Durable waves and recovery

Large estates are divided into ordered migration waves. Inspect them together with per-asset
actions:

```text
GET /crypto/v1/migration/executions/:id/waves
GET /crypto/v1/migration/executions/:id/asset-actions
GET /crypto/v1/migration/executions/:id/control-events
GET /crypto/v1/migration/cutover-progress
```

Workers claim execution through a renewable lease. If a worker exits, QNSI recovers pending or
lease-expired work without discarding completed actions. Recovery does not silently convert an
unknown provider result into success.

## Customer-driven cutover

Some providers or workloads require the customer to switch an application reference after
QNSI prepares the destination key. The asset remains `awaiting_cutover` until an authorized
operator confirms it:

```text
POST /crypto/v1/migration/asset-actions/:id/confirm-cutover
```

Confirm only after the application uses the destination key reference and rollback has been
validated.

## Reconcile ambiguous provider outcomes

A timeout after sending a provider request does not prove failure: the provider may have
applied the change before the response was lost. QNSI marks that action as requiring
verification. An operator then supplies evidence:

```bash
curl -sS -X POST \
  "https://api.qnsi.heossi.com/proxy/crypto/v1/migration/asset-actions/$ACTION_ID/reconcile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-qnsp-tenant: $TENANT_ID" \
  -H "content-type: application/json" \
  --data '{
    "outcome":"confirmed_completed",
    "evidence":{
      "providerRequestId":"provider-request-123",
      "verificationMethod":"Read destination key metadata from provider API",
      "verifiedAt":"2026-07-20T00:00:00.000Z",
      "artifactHash":"<sha256-of-retained-verification-artifact>"
    }
  }'
```

Allowed outcomes are `confirmed_completed` and `confirmed_not_applied`. Reconciliation records
are immutable and available at:

```text
GET /crypto/v1/migration/executions/:id/reconciliation-events
```

## Operating checklist

- Complete discovery before trusting posture or migration targets.
- Store the dry-run and plan hash with the change ticket.
- Use separate requester and approver identities.
- Start with a bounded wave and validate application behavior before expanding.
- Pause when the change window closes; do not cancel merely to stop dispatch.
- Treat `verification_required` as unresolved until provider evidence is retained and hashed.
- Export the evidence pack after the final wave and keep it with the rollback record.

See [Migration Checklist](./checklist), [Migration Journey](./journey), and [API Route
Catalog](../api/route-catalog) for the complete customer workflow and wire surface.
