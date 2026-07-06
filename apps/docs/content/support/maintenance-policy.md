---
title: Maintenance Policy
version: 1.0.0
last_updated: 2026-04-23
copyright: © 2025–2026 HEOSSI (PTE.) LTD All rights reserved.
---

# Maintenance Policy

This document describes how HEOSSI (PTE.) LTD ("HEOSSI") performs scheduled and emergency maintenance for QNSI Cloud services.

This Maintenance Policy is subject to the [Terms of Service](https://qnsi.heossi.com/terms) and the applicable [Service Level Agreement](/legal/sla).

## 1. Maintenance Types

### 1.1 Scheduled Maintenance

Planned maintenance for updates, upgrades, and infrastructure improvements.

- **Frequency:** As needed, typically 1–2 times per month
- **Duration:** Typically under 30 minutes
- **Impact:** Zero-downtime deployments are the goal; brief latency increases may occur

### 1.2 Emergency Maintenance

Unplanned maintenance required for security patches or critical fixes.

- **Frequency:** As needed
- **Duration:** Variable based on issue severity
- **Impact:** May cause brief service interruption

## 2. Maintenance Windows

### 2.1 Standard Maintenance Window

Scheduled maintenance is performed during low-traffic periods:

| Region | Maintenance Window (Local Time) |
|--------|--------------------------------|
| Asia-Pacific (Singapore) | Tuesday/Thursday 02:00–06:00 SGT |
| Additional regions | As defined per region |

### 2.2 Window Preferences

Enterprise Elite and Specialized customers may request custom maintenance windows as part of their agreement.

## 3. Notification Schedule

### 3.1 Scheduled Maintenance

| Notice Period | Maintenance Type |
|---------------|------------------|
| 7 days | Major infrastructure changes, potential impact |
| 3 days | Standard maintenance, minimal impact |
| 24 hours | Reminder notification |

### 3.2 Emergency Maintenance

| Notice Period | Situation |
|---------------|-----------|
| Immediate | Active security threat or critical system failure |
| 1 hour | Urgent security patch with known exploit |
| 4 hours | Important security patch, no known active exploit |

## 4. Notification Channels

Maintenance notifications are communicated through:

1. **Status Page:** https://qnsi.heossi.com#overview
2. **Email:** Sent to account administrators
3. **Cloud Portal:** Banner notifications
4. **API Header:** `X-QNSI-Maintenance-Scheduled` header on responses (when applicable)

### 4.1 Subscribing to Notifications

To receive maintenance notifications:
- Log in to Cloud Portal → Settings → Notifications
- Enable "Maintenance Notifications" for your preferred channels

## 5. Zero-Downtime Deployment

QNSI Cloud is designed for zero-downtime deployments:

### 5.1 Rolling Deployments

- Services are deployed incrementally across availability zones
- Traffic is drained from instances before updates
- Health checks verify service availability before routing traffic

### 5.2 Database Migrations

- Schema changes are backward-compatible
- Migrations run during low-traffic windows
- Rollback procedures are tested before each deployment

### 5.3 API Compatibility

- API changes follow the versioning policy
- Deprecated endpoints remain available for the announced deprecation period
- Breaking changes require major version increments

## 6. Maintenance Exclusions from SLA

Scheduled maintenance during announced maintenance windows is excluded from SLA availability calculations, provided:

1. Maintenance was announced with the required notice period
2. Maintenance occurred within the designated window
3. Maintenance duration did not exceed the announced duration by more than 50%

Emergency maintenance is excluded from SLA calculations when:
1. Required to address an active security threat
2. Required to prevent imminent service failure
3. Announced as soon as reasonably possible

## 7. Post-Maintenance Verification

After each maintenance window:

1. **Automated Health Checks:** All services verified operational
2. **Smoke Tests:** Critical paths tested automatically
3. **Monitoring:** Enhanced monitoring for 2 hours post-maintenance
4. **Status Update:** Status page updated to confirm completion

## 8. Maintenance for Enterprise Deployments

### 8.1 VPC Deployments

- Maintenance coordinated with customer change management processes
- Custom maintenance windows available
- Customer approval required for changes to customer-managed components

### 8.2 Air-Gapped Deployments

- Maintenance performed by customer or with customer coordination
- Update packages provided with release notes and rollback procedures
- Remote support available during maintenance (where connectivity permits)

## 9. Requesting Maintenance Deferral

Business and Enterprise customers may request deferral of non-critical maintenance:

1. Submit request at least 48 hours before scheduled maintenance
2. Provide business justification
3. Deferrals are subject to approval and security considerations
4. Maximum deferral period: 14 days

## 10. Disclaimers

1. While HEOSSI strives to minimize service disruption, maintenance may occasionally cause brief unavailability or performance degradation.

2. Scheduled maintenance during announced windows is excluded from SLA availability calculations as described in the [Service Level Agreement](/legal/sla).

3. HEOSSI reserves the right to perform emergency maintenance without advance notice when required to address security threats or prevent service degradation.

4. This Maintenance Policy is governed by the laws of Singapore.

---

**HEOSSI (PTE.) LTD**

Registered Office: 552 Ang Mo Kio, Avenue 10, #21-1982, Cheng San Place, Singapore 560552

UEN: 202532790K

**Effective Date:** February 24, 2026

**Document Version:** 1.0.0

For questions about maintenance, contact: qnsi-ops@heossi.com
