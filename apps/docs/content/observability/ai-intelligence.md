---
title: AI Event Intelligence and Governed Remediation
description: Durable anomaly detection, cross-service correlation, root-cause context, and operator-approved remediation in QNSI.
---

# AI Event Intelligence and Governed Remediation

QNSI turns retained AI and platform events into operational evidence. The workflow is designed
for accountable security operations: it can identify and correlate signals, prepare root-cause
context, and propose remediation, but it does not bypass tenant authorization or configured
operator approval.

## What is available

- **Durable event retention** for AI and platform signals used by the intelligence workflow
- **Anomaly detection** across retained events
- **Cross-service correlation** that groups related signals into incidents
- **Root-cause context** generated from anomaly, correlation, and error-pattern evidence
- **Remediation proposals** that remain pending until an authorized operator approves or rejects them
- **Cryptographic verification** for signed dashboard evidence where enabled

The Cloud Portal exposes dedicated views for the intelligence dashboard, anomalies, correlation,
root-cause analysis, prompt security, bias, costs, compliance, scaling, errors, self-healing, and
remediation. Availability is controlled by the tenant's plan, feature flags, identity, and policy.

## Approval boundary

An AI recommendation is not a production change. QNSI keeps proposal generation separate from
approval and execution so the audit trail can show:

1. which retained evidence caused the proposal;
2. which root-cause context was presented;
3. who approved or rejected the proposal; and
4. which resulting action was attempted and observed.

This separation supports reviewable automation without turning model output into an unaudited
administrative action.

## Related documentation

- [Alerts](./alerts)
- [Logs](./logs)
- [Distributed Tracing](./tracing)
- [Governed Migration Execution](../migration/governed-execution)
- [Incident Response](../security/incident-response)
- [API Route Catalog](../api/route-catalog)
