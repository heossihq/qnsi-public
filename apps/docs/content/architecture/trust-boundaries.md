---
title: Trust Boundaries
version: 0.0.1
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---
# Trust Boundaries

QNSI defines explicit trust boundaries between components.

## External boundary

The edge gateway is the sole external entry point:
- TLS termination
- Authentication validation
- Rate limiting
- WAF and bot protection

## Internal boundaries

### Service-to-service
- Internal services trust edge gateway authentication
- Service tokens for internal calls
- mTLS in production deployments

### Enclave boundary
- Sensitive operations in TEE enclaves
- Attestation required for enclave access
- Key material never leaves enclave

### HSM boundary
- Root keys stored in HSM
- PKCS#11 interface
- Key operations within HSM

## Trust assumptions

- Edge gateway is trusted to authenticate requests
- Services trust token claims after validation
- HSM/enclave attestation is verified
- Audit logs are append-only
