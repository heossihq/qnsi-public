---
title: Compliance Mapping
version: 0.0.1
last_updated: 2026-04-23
description: Map QNSI audit events to compliance controls for SOC 2, PCI DSS, HIPAA, and GDPR, linking auth, access, KMS, and security events to specific requirements.
copyright: © 2025 HEOSSI. All rights reserved.
---
# Compliance Mapping

How QNSI audit events map to compliance requirements.

## SOC 2

| Control | QNSI audit events |
|---------|-------------------|
| CC6.1 Logical access | `auth.login.*`, `access.*` |
| CC6.2 Access removal | `auth.token.revoked`, `access.policy.*` |
| CC6.3 Role-based access | `access.policy.evaluated` |
| CC7.1 Monitoring | All events |
| CC7.2 Anomaly detection | `security.*` |

## PCI DSS

| Requirement | QNSI audit events |
|-------------|-------------------|
| 10.1 Audit trails | All events with actor |
| 10.2 Automated audit | `auth.*`, `kms.*`, `access.*` |
| 10.3 Event attributes | All events (timestamp, actor, resource) |
| 10.5 Secure audit trails | Merkle checkpointing |
| 10.7 Retention | Configurable retention |

## HIPAA

| Safeguard | QNSI audit events |
|-----------|-------------------|
| Access controls | `auth.*`, `access.*` |
| Audit controls | All events |
| Integrity controls | `kms.*`, checksums |
| Transmission security | TLS events |

## GDPR

| Article | QNSI audit events |
|---------|-------------------|
| Art. 5 Accountability | All events |
| Art. 30 Records | Event exports |
| Art. 32 Security | `security.*`, `access.*` |
| Art. 33 Breach notification | `security.breach.*` |

## Compliance reports

Generate compliance-specific reports:
```
POST /audit/v1/reports
{
  "type": "soc2",
  "period": {
    "start": "2024-01-01",
    "end": "2024-03-31"
  }
}
```

Available report types:
- `soc2`
- `pci-dss`
- `hipaa`
- `gdpr`
- `iso27001`
