---
title: Shared Responsibility
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Shared Responsibility

Audit responsibilities between QNSI and customers.

## QNSI responsibilities

### Platform audit
- Capture all platform events
- Ensure event integrity
- Maintain immutability
- Provide export capabilities
- Secure audit infrastructure

### Event generation
- Consistent event format
- Complete event attributes
- Accurate timestamps
- Reliable delivery

### Storage and retention
- Secure storage
- Configurable retention
- Compliance with retention policies
- Deletion when required

## Customer responsibilities

### Configuration
- Set appropriate retention periods
- Configure export destinations
- Define alerting rules
- Manage access to audit data

### Monitoring
- Review audit logs regularly
- Investigate anomalies
- Respond to alerts
- Maintain SIEM integration

### Compliance
- Determine applicable regulations
- Configure retention for compliance
- Generate required reports
- Provide auditor access

## Shared responsibilities

### Access control
- QNSI: Enforce RBAC on audit access
- Customer: Define who can access audit logs

### Export security
- QNSI: Encrypt exports in transit
- Customer: Secure export destinations

### Incident response
- QNSI: Detect platform-level incidents
- Customer: Investigate tenant-level incidents

## Support

For audit-related issues:
- Configuration: Standard support
- Compliance questions: Compliance team
- Incident investigation: Security team
