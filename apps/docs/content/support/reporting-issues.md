---
title: Reporting Issues
version: 1.0.0
last_updated: 2026-04-23
copyright: © 2025–2026 HEOSSI (PTE.) LTD All rights reserved.
---

> **Note** — As of 2026-04-30, the per-service `@heossi/qnsi-vault-sdk` package is consolidated into the unified `@heossi/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossi/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.vault./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# Reporting Issues

This document describes how to report bugs, errors, security vulnerabilities, and feature requests for QNSI Cloud services.

## Report Types

| Type | Channel | Response |
|------|---------|----------|
| **Security Vulnerability** | qnsi-security@heossi.com | See [Vulnerability Disclosure](/security/vulnerability-disclosure) |
| **Service Outage** | [Status Page](https://qnsi.heossi.com#overview) + Support Portal | Per [Support Policy](/support/support-policy) |
| **Bug Report** | Support Portal or GitHub | Acknowledged within 48 hours |
| **Feature Request** | Support Portal or GitHub | Reviewed monthly |
| **Documentation Issue** | GitHub or contact@heossi.com | Acknowledged within 72 hours |

## Security Vulnerabilities

**DO NOT** report security vulnerabilities through public channels.

**Contact:** qnsi-security@heossi.com

See our [Vulnerability Disclosure Policy](/security/vulnerability-disclosure) for:
- Responsible disclosure guidelines
- Safe harbor provisions
- Response timeline commitments

## Bug Reports

### How to Report

1. **Support Portal** (recommended for customers):
   ```
   https://cloud.qnsi.heossi.com/support
   ```

2. **GitHub Issues** (for SDK/client bugs):
   ```
   https://github.com/heossihq/qnsi-public/issues
   ```

### What to Include

A complete bug report should include:

| Field | Description | Required |
|-------|-------------|----------|
| **Summary** | Brief description of the issue | Yes |
| **Environment** | Production, staging, or development | Yes |
| **Tenant ID** | Your QNSI tenant identifier | Yes |
| **Service** | Affected service (KMS, Vault, Storage, etc.) | Yes |
| **Steps to Reproduce** | Detailed steps to replicate the issue | Yes |
| **Expected Behavior** | What you expected to happen | Yes |
| **Actual Behavior** | What actually happened | Yes |
| **Request IDs** | From API error responses (X-Request-ID header) | If available |
| **Error Messages** | Full error text or codes | If available |
| **Logs/Screenshots** | Relevant evidence (redact sensitive data) | If available |
| **SDK Version** | If using QNSI SDKs | If applicable |
| **Workaround** | Any workaround you've found | If known |

### Bug Report Template

```markdown
## Summary
[Brief description]

## Environment
- [ ] Production
- [ ] Staging
- [ ] Development

## Tenant ID
[Your tenant ID - do NOT include API keys or secrets]

## Affected Service
[e.g., KMS, Vault, Storage, Search, Auth]

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Request IDs
[From X-Request-ID response header]

## Error Messages
```
[Paste error messages here]
```

## SDK Version (if applicable)
[e.g., @heossi/qnsi-vault-sdk@1.2.3]

## Additional Context
[Any other relevant information]
```

## Service Outages

### Check Status First

Before reporting, check the status page:
```
https://qnsi.heossi.com#overview
```

### If Service is Degraded

1. The status page will show ongoing incidents
2. Subscribe to updates via the status page
3. For urgent issues, contact support per your tier

### If Status Shows Normal

1. Submit a support ticket with:
   - Affected services
   - Error messages and request IDs
   - Time of occurrence (with timezone)
   - Impact description

2. We will investigate and update you per your support tier response times

## Feature Requests

### How to Submit

1. **Support Portal** (for customers):
   ```
   https://cloud.qnsi.heossi.com/support
   ```
   Select "Feature Request" as the ticket type.

2. **GitHub Discussions** (for community input):
   ```
   https://github.com/heossihq/qnsi-public/discussions
   ```

### What to Include

| Field | Description |
|-------|-------------|
| **Title** | Clear, concise feature name |
| **Problem Statement** | What problem does this solve? |
| **Proposed Solution** | How should it work? |
| **Use Case** | Your specific use case |
| **Alternatives Considered** | Other approaches you've considered |
| **Business Impact** | How this affects your operations |
| **Priority** | Your assessment (nice-to-have, important, critical) |

### Feature Request Template

```markdown
## Feature Title
[Clear, concise name]

## Problem Statement
[What problem are you trying to solve?]

## Proposed Solution
[How should this feature work?]

## Use Case
[Describe your specific use case]

## Alternatives Considered
[Other approaches you've considered]

## Business Impact
[How would this feature help your business?]

## Priority Assessment
- [ ] Nice-to-have
- [ ] Important
- [ ] Critical for adoption

## Additional Context
[Mockups, examples, references]
```

### Feature Review Process

1. **Acknowledgment**: Within 5 business days
2. **Initial Review**: Product team reviews within 2 weeks
3. **Prioritization**: Evaluated against roadmap quarterly
4. **Status Update**: You'll receive updates on accepted features
5. **Release**: Included in release notes when shipped

## Documentation Issues

### Reporting Documentation Bugs

- **Typos, errors, outdated content**: GitHub issue or contact@heossi.com
- **Missing documentation**: Feature request process
- **Clarification needed**: Support portal or GitHub discussions

### Contributing Corrections

Documentation contributions are welcome via GitHub pull requests for:
- Typo fixes
- Clarifications
- Example improvements
- Translation contributions

## Issue Tracking

### Ticket States

| State | Description |
|-------|-------------|
| **New** | Issue received, pending triage |
| **Triaged** | Assigned priority and owner |
| **In Progress** | Actively being worked on |
| **Pending Customer** | Awaiting your response |
| **Resolved** | Fix deployed or question answered |
| **Closed** | Issue completed or no response received |

### Following Up

- Reply to your existing ticket for updates
- Tickets with no response for 14 days may be auto-closed
- Closed tickets can be reopened if the issue recurs

## Escalation

If your issue is not being addressed satisfactorily:

1. **Reply to Ticket**: Request escalation in the ticket
2. **Account Manager**: Contact your account manager (Enterprise tiers)
3. **Emergency Escalation**: For Severity 1 issues:
   - Email: qnsi-incident@heossi.com
   - Include "URGENT" in subject line

See [Support Policy](/support/support-policy) for escalation procedures by tier.

## Response Expectations

| Issue Type | Initial Response | Resolution Target |
|------------|------------------|-------------------|
| Security Vulnerability | 24 hours | Per severity (see disclosure policy) |
| Severity 1 Bug | Per support tier | 24 hours |
| Severity 2 Bug | Per support tier | 72 hours |
| Severity 3 Bug | Per support tier | 2 weeks |
| Feature Request | 5 business days | Quarterly review |
| Documentation Issue | 72 hours | 2 weeks |

**Note:** Resolution targets are goals, not guarantees, and depend on issue complexity.

## Disclaimer

HEOSSI (PTE.) LTD reserves the right to:
- Prioritize issues based on severity and impact
- Decline feature requests that don't align with product direction
- Close issues that cannot be reproduced or lack sufficient information
- Modify these procedures with reasonable notice

Issue reporting does not create any obligation beyond the commitments in your subscription agreement and the applicable [Service Level Agreement](/legal/sla).

---

**HEOSSI (PTE.) LTD**

Registered Office: 552 Ang Mo Kio, Avenue 10, #21-1982, Cheng San Place, Singapore 560552

For general inquiries: contact@heossi.com
