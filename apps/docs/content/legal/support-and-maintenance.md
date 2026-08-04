---
title: Support and Maintenance Policy
description: Support scope, severity handling, maintenance notices, and the difference between response targets and contractual guarantees.
last_updated: 2026-07-13
copyright: © 2026 HEOSSI (PTE.) LTD. All rights reserved.
---
# Support and Maintenance Policy

Last updated: 2026-07-13 · Effective: 2026-07-13

Draft pending review by qualified counsel. It must not be represented as counsel-approved.

> Generated from the single legal source of truth (`apps/web/lib/legal/`). Do not edit
> by hand - edit the source and run `pnpm gen:legal-docs`. The authoritative published
> version of every document is on the [QNSI Legal and Trust Center](https://qnsi.heossi.com/legal).

## Support channels and scope

Submit technical and account issues through the authenticated Cloud Portal or qnsi-support@heossi.com. Security incidents must be sent to qnsi-security@heossi.com. Include the tenant, impact, timestamps, request identifiers, and reproducible evidence, but never send passwords, private keys, API secrets, or unredacted sensitive data.

Support covers QNSI service behaviour, documented APIs and SDKs, and reasonable configuration guidance. It does not include developing your application, administering third-party infrastructure, legal advice, formal certification, or forensic services unless agreed in writing.

## Severity and response

Published or portal-displayed response times are targets unless an Order Form expressly makes them binding. A response means a substantive acknowledgement and triage; it is not a resolution commitment. HEOSSI may reclassify severity based on verified impact.

- Severity 1: production service is broadly unavailable, key material is inaccessible, or a confirmed active security incident creates critical impact.
- Severity 2: major production functionality is materially impaired without a reasonable workaround.
- Severity 3: limited impairment with a workaround, or a non-critical defect.
- Severity 4: general guidance, documentation, billing, or feature request.

## Maintenance

HEOSSI uses rolling deployment and health checks to reduce disruption. Planned maintenance that may materially affect availability will be announced through the status or account-notification channels when reasonably practicable. Emergency maintenance may occur without advance notice to address an active threat, vulnerability, legal requirement, or imminent service failure.

Maintenance treatment in availability calculations is governed only by the applicable SLA or Order Form. No maintenance window or notice period is guaranteed unless expressly stated there.
