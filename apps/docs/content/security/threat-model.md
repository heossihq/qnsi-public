---
title: Threat Model
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Threat Model

QNSI's security threat model and mitigations.

## Assets protected

- Encryption keys
- Secrets and credentials
- Encrypted data
- Audit logs
- Identity information

## Threat actors

### External attackers
- Network-based attacks
- Credential theft
- API abuse

### Malicious insiders
- Privileged access abuse
- Data exfiltration
- Unauthorized access

### Compromised workloads
- Container escape
- Supply chain attacks
- Malware

## Attack vectors

### Network attacks
| Threat | Mitigation |
|--------|------------|
| Man-in-the-middle | TLS 1.3, certificate pinning |
| DDoS | Rate limiting, WAF, CDN |
| API abuse | Authentication, rate limits |

### Authentication attacks
| Threat | Mitigation |
|--------|------------|
| Credential stuffing | Rate limiting, MFA |
| Token theft | Short TTL, secure storage |
| Session hijacking | Secure cookies, token binding |

### Cryptographic attacks
| Threat | Mitigation |
|--------|------------|
| Quantum attacks | PQC algorithms |
| Key extraction | HSM, enclave protection |
| Side channels | Constant-time implementations |

## Trust boundaries

1. External → Edge gateway
2. Edge gateway → Services
3. Services → HSM/Enclave
4. Services → Data stores

## Security controls

- Defense in depth
- Least privilege
- Zero trust
- Continuous monitoring
