---
title: Frequently Asked Questions
version: 0.0.2
last_updated: 2026-04-23
copyright: © 2025 HEOSSI. All rights reserved.
---

> **Note** - As of 2026-04-30, the per-service `@heossihq/qnsi-auth-sdk` package is consolidated into the unified `@heossihq/qnsi` SDK (one package per language). New integrations should use:
>
> ```typescript
> import { QnsiClient } from "@heossihq/qnsi";
> const qnsi = new QnsiClient({ apiKey: process.env.QNSI_API_KEY! });
> await qnsi.auth./* method */(...);
> ```
>
> See [SDK overview](../sdk/) for the consolidated package. The per-service shapes documented below remain accurate at the wire level (REST/gRPC) and are kept for reference.


# Frequently Asked Questions

Comprehensive answers to common questions about QNSI's quantum-native security platform.

## General

### What is QNSI?

QNSI (Quantum-Native Security Infrastructure) is an enterprise security platform providing post-quantum cryptography (PQC) protection for AI workloads, document management, and secrets vault services. Built by HEOSSI, QNSI delivers PQC-signed JWT authentication, quantum-resistant key management, tamper-evident audit chains, and encrypted storage with searchable encryption.

### When was QNSI created?

QNSI was conceived, architected, and engineered starting in December 2020. The current monorepo was bootstrapped in November 2025.

### What makes QNSI different from other security platforms?

QNSI is PQC-native by design, not retrofitted. Every component-from authentication tokens to storage encryption-uses NIST-standardized post-quantum algorithms (FIPS 203, 204, 205). The platform provides:
- Zero-trust ingress with PQC token validation at the edge
- Hardware enclave support (8 types: Intel SGX, AMD SEV, NVIDIA CC, Intel TDX, ARM TrustZone, ARM CCA, AWS Nitro, IBM Secure Execution)
- Cryptographic attestation with automated compliance checks (CNSA 2.0, FIPS 140-3)
- Tamper-evident audit trails with Merkle checkpointing and PQC signatures

### Is QNSI open source?

QNSI uses a multi-license model:
- **Public SDKs**: Apache-2.0 (12 TypeScript packages on npm)
- **Core platform**: BUSL-1.1 (Business Source License) with Change License to GPL-2.0-or-later
- **Patent materials**: Proprietary

## Post-Quantum Cryptography

### What PQC algorithms does QNSI use?

QNSI implements NIST-standardized PQC algorithms:


**Key Encapsulation (FIPS 203 - ML-KEM)**:
- ML-KEM-512 (Kyber-512): Security level 1
- ML-KEM-768 (Kyber-768): Security level 3 (default)
- ML-KEM-1024 (Kyber-1024): Security level 5

**Digital Signatures (FIPS 204 - ML-DSA)**:
- ML-DSA-44 (Dilithium-2): Security level 2 (default for JWTs)
- ML-DSA-65 (Dilithium-3): Security level 3
- ML-DSA-87 (Dilithium-5): Security level 5

**Hash-Based Signatures (FIPS 205 - SLH-DSA)**:
- SLH-DSA (SPHINCS+): Conservative hash-based signatures for maximum assurance

**Alternative Signatures**:
- Falcon-512: Compact signatures for bandwidth-constrained applications
- Falcon-1024: Higher security level with compact signatures

All algorithms are NIST-approved and production-ready.

### Why should I care about quantum computing threats now?

**Harvest Now, Decrypt Later (HNDL)** attacks are happening today. Adversaries collect encrypted data now and will decrypt it once cryptographically relevant quantum computers (CRQC) become available. The forecast window for CRQC is 2030-2035 (5-10 years from now).

Risk surface includes:
- Long-term data archives and backups
- AI training datasets and model weights
- Encrypted communications and stored messages
- Digital signatures on legal documents
- PKI certificates and key material

Organizations should treat long-lived confidential data as exposed unless PQC migration plans are actively underway.

### How does QNSI protect against quantum attacks?

QNSI uses a defense-in-depth approach:

1. **PQC-Native Encryption**: All data at rest encrypted with ML-KEM-768 (storage, vault, databases)
2. **PQC-Signed Tokens**: All JWTs signed with ML-DSA (Dilithium-2/3/5)
3. **PQC-TLS**: Hybrid TLS 1.3 with PQC key exchange at edge gateway
4. **Hardware Enclaves**: Encrypted AI training/inference in TEEs with attestation
5. **Cryptographic Attestation**: Real-time compliance monitoring and policy enforcement
6. **Tamper-Evident Audit**: Merkle-chained logs with PQC signatures

### Can I use classical cryptography instead of PQC?

No. QNSI is PQC-native by design. Classical fallbacks are disabled by default to prevent downgrade attacks. This is a deliberate security decision-organizations using QNSI are explicitly choosing quantum-resistant protection.

### What is the performance impact of PQC?

PQC algorithms have larger key sizes and signatures compared to classical algorithms:
- ML-KEM-768 public keys: ~1.2KB (vs RSA-2048: 256 bytes)
- ML-DSA-65 (Dilithium-3) signatures: ~3.3KB (vs ECDSA P-256: 64 bytes)

However, QNSI optimizes performance through:
- Hardware acceleration where available
- Efficient caching strategies (5-minute default TTL for auth tokens)
- Batch operations for bulk encryption/signing
- Enclave pre-warming for AI workloads

In practice, the performance impact is negligible for most workloads (<5% overhead).

## Pricing & Tiers

### How does the free tier work?

The free tier is **free forever** for everyone-from individual users to global enterprises. No credit card required, no time limits.

**Free tier includes**:
- 10GB quantum-secure storage
- 50,000 API calls/month
- PQC storage + limited KMS (20 keys, 20,000 ops/month)
- 25 vault secrets and 3 API keys
- Full access to all 15 TypeScript SDKs
- Community support

Perfect for POCs, pilots, and small-scale production workloads.

### What happens when I exceed free tier limits?

When you approach your limits, you'll receive notifications via the cloud portal. Your account will be rate-limited until you upgrade or your monthly quota resets. There's no automatic overage billing.

### Can I upgrade or downgrade my plan?

Yes. You can upgrade anytime through the cloud portal with immediate effect. Downgrades take effect at the end of your current billing period. Annual plans offer 15-20% savings compared to monthly billing.

### What features require paid tiers?


**Feature tier requirements** (aligned with the shared SDK gate contract):

| Feature | Minimum Tier | Description |
|---------|--------------|-------------|
| Storage | Free | Quantum-secure storage (all tiers) |
| Search | Free | Full-text and vector search (all tiers) |
| Vault | Free | Secrets management with envelope encryption |
| SSE | Dev Pro | Server-side encryption for search |
| AI Inference | Dev Pro | AI inference (non-enclave) |
| Enclaves | Enterprise Standard | Secure enclave execution (8 hardware types) |
| AI Training | Enterprise Pro | Encrypted AI training and fine-tuning |

### What SDKs are available?

QNSI publishes one unified SDK per supported language:

- **TypeScript / Node.js:** `@heossihq/qnsi` 0.6.0 on npm. It exposes all 11 service clients and installs the `qnsi` command-line interface.
- **Python:** `qnsi` 0.4.2 on PyPI.
- **Go:** `github.com/heossihq/qnsi-public/sdks/go/qnsi`.
- **Rust:** `qnsi` 0.3.0 on crates.io.
- **JVM / Android:** `com.heossi:qnsi` 0.4.0 on Maven Central.
- **AI tooling:** `@heossihq/qnsi-mcp` 0.2.0 on npm.

The original TypeScript per-service packages remain available only for migration compatibility; new integrations should use `@heossihq/qnsi`. Host-agent deployment artifacts are provided through tenant onboarding rather than advertised as a public npm install. See the [SDK overview](/sdk/) for registry links and installation commands.

### What are the tier storage and API limits?

| Tier | Storage | API Calls/Month | Price |
|------|---------|-----------------|-------|
| Free | 10GB | 50,000 | $0 forever |
| Dev Starter | 100GB | 100,000 | $149/mo |
| Dev Pro | 250GB | 500,000 | $590/mo |
| Dev Elite | 500GB | 750,000 | $790/mo |
| Dev Team | 1TB | 1M | $1,499/mo |
| Business Team | 5TB | 1.5M | $2,199/mo |
| Business Advanced | 10TB | 7.5M | $5,499/mo |
| Business Elite | 15TB | 10M | $8,499/mo |
| Enterprise Standard | 20TB | 15M | $12,999/mo |
| Enterprise Pro | 25TB | 30M | $19,999/mo |
| Enterprise Elite | Unlimited | Unlimited | Custom |
| Specialized | Custom | Custom | Custom |

Annual pricing is catalog-defined per tier. Enterprise Elite and Specialized tiers include custom configurations.

## Technical Implementation

### What hardware enclaves does QNSI support?

QNSI supports 8 hardware enclave types with cryptographic attestation:

1. **Intel SGX (MEE)** - Memory Encryption Engine
2. **AMD SEV** - Memory Guard + SEV-SNP
3. **NVIDIA CC** - GPU memory encryption
4. **Intel TDX (TME)** - Total Memory Encryption (supports Google Cloud Confidential VMs/GKE)
5. **ARM TrustZone** - ARM secure world isolation
6. **ARM CCA/RME** - Confidential Compute Architecture (supports Google Cloud Confidential GKE)
7. **AWS Nitro Enclaves** - AWS-specific enclave technology
8. **IBM Secure Execution** - IBM Z and LinuxONE secure execution

All enclaves provide hardware-backed isolation and attestation. Available on Enterprise Standard tier and above.

### How does QNSI integrate with HSMs?

QNSI supports PKCS#11 integration with major HSM vendors:
- **Thales Luna** - Network HSM and PCIe HSM
- **Entrust nShield** - Connect and Edge HSMs
- **AWS CloudHSM** - FIPS 140-2 Level 3 validated
- **Azure Dedicated HSM** - Thales Luna-based

The certification level depends on your selected HSM and deployment environment. Root keys can be HSM-backed for high-security deployments. HSM integration is configured via environment variables in KMS service.

### Can I use QNSI APIs without SDKs?

Yes. QNSI provides REST APIs with OpenAPI specifications and WebSocket APIs for real-time operations. However, the TypeScript SDKs handle:
- PQC token management and refresh
- Automatic retry logic with exponential backoff
- Request signing and authentication
- Type-safe interfaces
- Tier-aware feature gating

Using SDKs is strongly recommended for production deployments.

### What authentication methods does QNSI support?

**User Authentication**:
- Email/password with PQC-signed JWTs
- FIDO2 passkeys (WebAuthn)
- OAuth 2.0 / OIDC federation (SSO)
- Multi-factor authentication (MFA)

**Service Authentication**:
- Service accounts with long-lived credentials
- Personal Access Tokens (PATs) with PQC tier-aware signing
- Capability tokens for fine-grained access control

**Token Details**:
- Access tokens: 15 minutes TTL (default)
- Refresh tokens: 30 days TTL (default)
- All JWTs signed with ML-DSA (Dilithium-2/3/5)

### How does searchable encryption work?

QNSI implements server-side encryption (SSE) for search:

1. **Client-side**: Generate SSE key (AES-256-GCM)
2. **Indexing**: Documents encrypted with SSE key before indexing
3. **Search**: Query tokens encrypted with same SSE key
4. **Results**: Encrypted results returned, decrypted client-side

SSE ensures the search service never sees plaintext data. Available on Dev Pro tier and above.

### What is the audit trail architecture?

QNSI provides tamper-evident audit trails with:

**Event Logging**:
- 59 crypto-critical event types across 12 services
- Structured JSON format with requestId/traceId propagation
- Severity levels: info → critical

**Cryptographic Protection**:
- Each event signed with ML-DSA-65 (Dilithium-3)
- SHA3-256 hash chains linking events
- Merkle tree checkpoints every N events
- Checkpoint signatures for batch verification

**Compliance Export**:
- SIEM integration (Splunk, Datadog)
- 6 additional integrations (Slack, GitHub, AWS, Azure, GCP, Okta)
- Configurable retention policies
- Immutable storage with WORM guarantees

### What is Cryptographic Attestation?

Cryptographic Attestation provides real-time visibility into your cryptographic posture:

**Features**:
- NIST algorithm registry with lifecycle status (Final/Draft/Deprecated)
- CBOM (Cryptographic Bill of Materials) export with SHA3-256 hash
- Automated compliance checks (CNSA 2.0, FIPS 140-3)
- Policy enforcement: audit mode or hard-block mode
- Migration planning for deprecated algorithms

**Access**:
- Public runtime and transport posture: `/platform/v1/crypto/posture/public`
- Public ALB transport evidence: `/platform/v1/crypto/tls/evidence/public`
- Admin dashboard: Cloud portal → Security → Crypto Attestation

## Deployment & Operations

### What deployment options are available?

**QNSI Cloud** (Fully managed SaaS):
- Multi-tenant shared infrastructure
- Available regions: Singapore (ap-southeast-1), N. Virginia (us-east-1), Ireland (eu-west-1)
- Public endpoints: `api.qnsi.heossi.com`
- Free tier available immediately

**Private/VPC** (Customer-controlled cloud):
- Single-tenant compute in your AWS/Azure/GCP account
- Full network isolation with VPC peering or PrivateLink
- Custom compliance configurations
- Available on Enterprise tiers

**On-Premises** (Air-gapped/sovereign):
- Partner-delivered installations
- Air-gapped operation support
- Custom HSM integration
- Sovereign cloud requirements
- Available on Specialized tier

All deployment models support the same APIs and SDKs.

### Can I self-host QNSI?

Yes. Enterprise and government customers can deploy QNSI in private/VPC environments or on-premises through partner-delivered installations. Self-hosted deployments support:
- Air-gapped operation
- Custom HSM integration
- Sovereign cloud requirements
- Data residency controls
- Offline signing workflows

Contact qnsi-sales@heossi.com for self-hosted deployment options.

### Does QNSI support multi-region deployments?

Yes. Business Advanced tier and above include multi-region PQC support. You can:
- Specify primary region for data storage
- Configure allowed regions for processing
- Set replication restrictions
- Enforce data residency requirements

Enterprise tiers support custom region configurations and cross-region disaster recovery.

### What is the platform uptime guarantee?

Uptime commitments (if any) are defined in your subscription terms and, for Enterprise, in your signed agreement.

SLO targets for hosted production are documented in the observability section. SLA coverage and credits depend on plan and contract.

Monitor real-time service health:
- Status page: [qnsi.heossi.com#overview](https://qnsi.heossi.com#overview)
- Live metrics: Cloud portal dashboard
- Public health endpoints: `/health` and `/ready` on all services

### How do I monitor QNSI services?

**Observability Stack**:
- OTLP streaming for metrics and traces
- Prometheus-compatible metrics endpoints
- Structured JSON logging with correlation IDs
- Health checks: `/health` (liveness), `/ready` (readiness)

**Integration Options**:
- Datadog, Splunk, New Relic, Grafana
- AWS CloudWatch, Azure Monitor, Google Cloud Monitoring
- Custom OTLP collectors

**Key Metrics**:
- Request latency (p50, p95, p99)
- Error rates by service and endpoint
- Token issuance and validation rates
- Storage and KMS operation throughput
- Enclave attestation success rates

## Compliance & Security

### Is QNSI FIPS 140-3 certified?

QNSI uses NIST-standardized PQC algorithms (FIPS 203, 204, 205). For deployments requiring FIPS 140-3 certification, you can integrate customer-managed HSMs that hold the appropriate certification level.

**FIPS-Approved Algorithms**:
- ML-KEM (FIPS 203): Key encapsulation
- ML-DSA (FIPS 204): Digital signatures
- SLH-DSA (FIPS 205): Hash-based signatures

Certification level depends on your selected HSM and deployment environment.

### Does QNSI support GDPR and data residency?

Yes. QNSI supports:
- **Data residency controls**: Specify primary region and allowed processing regions
- **Right to be forgotten**: Crypto shredding for instant data deletion
- **Data minimization**: Configurable retention policies
- **Access logging**: Complete audit trail of data access
- **Encryption at rest**: All data encrypted with PQC algorithms
- **Tenant isolation**: Strict multi-tenant boundaries

Multi-region deployments allow you to enforce EU data residency for GDPR compliance.

### Is QNSI FedRAMP authorized?

No - QNSI is not currently FedRAMP authorized; FedRAMP is on our compliance roadmap. The platform is architected to align with FedRAMP controls. For classified or sensitive government workloads, we offer:
- Private/VPC deployments
- Air-gapped installations
- Customer-controlled HSM integration
- Customer-controlled data residency

Contact qnsi-sales@heossi.com for government deployment options.

### What compliance certifications does QNSI have?

**Current Status**:
- SOC 2 Type II: In progress
- ISO 27001 (ISMS): In progress
- ISO 9001 (QMS): In progress
- ISO 14001 (EMS): In progress
- ISO 45001 (OH&S): In progress
- ISO 22301 (BCMS): In progress
- HIPAA: Compliant architecture (BAA available for Enterprise)
- GDPR: Compliant
- PCI DSS: Not applicable (no payment card processing)

**Compliance Frameworks Supported**:
- NIST Cybersecurity Framework
- NIST 800-53 controls
- CIS Controls
- CNSA 2.0 (Commercial National Security Algorithm Suite)

### How does QNSI handle security incidents?

**Incident Response**:
1. **Detection**: Real-time monitoring and alerting
2. **Containment**: Automatic token revocation and resource quarantine
3. **Remediation**: 5-step key compromise response (record → rotate → rewrap → revoke → audit)
4. **Recovery**: Automated failover and service restoration
5. **Post-mortem**: Root cause analysis and prevention measures

**Key Compromise Response** (automated):
- Record compromise event in audit log
- Rotate affected keys via KMS
- Rewrap encrypted data with new keys
- Revoke capability tokens
- Generate correlation report across services

**Downgrade Attack Remediation**:
- Protocol tracking: PQC-TLS → TLS 1.3 → TLS 1.2
- Algorithm monitoring: ML-DSA → ECDSA downgrades
- Automatic IP/user blocking on critical severity
- Escalation to key compromise handler

### How do I report a security vulnerability?

**Security Contact**: qnsi-security@heossi.com

**Responsible Disclosure**:
1. Email details to qnsi-security@heossi.com
2. Include: vulnerability description, reproduction steps, impact assessment
3. Allow 90 days for remediation before public disclosure
4. We'll acknowledge within 48 hours

**Bug Bounty**: Coming soon (post-GA)

## Migration & Integration

### How do I migrate from HashiCorp Vault?

QNSI provides migration tooling for Vault:

1. **Inventory**: Use crypto-inventory-service to discover Vault secrets
2. **Export**: Export secrets from Vault (requires admin access)
3. **Import**: Bulk import to QNSI Vault with PQC encryption
4. **Validation**: Verify secret integrity and access policies
5. **Cutover**: Update applications to use QNSI SDKs

See [Migration Guide](/migration/checklist) for detailed steps.

### How do I migrate from AWS KMS/Secrets Manager?

Similar process to Vault migration:

1. **Discovery**: Inventory AWS KMS keys and Secrets Manager secrets
2. **BYOK**: Import existing keys to QNSI KMS (optional)
3. **Rewrap**: Re-encrypt data with PQC keys
4. **Update**: Modify applications to use QNSI SDKs
5. **Validate**: Test encryption/decryption workflows

QNSI supports BYOK (Bring Your Own Key) for smooth migration.

### Can I use QNSI with existing CI/CD pipelines?

Yes. QNSI integrates with:
- **GitHub Actions**: Use service accounts or PATs for authentication
- **GitLab CI**: Environment variables for credentials
- **Jenkins**: Credential plugins for secret injection
- **CircleCI**: Context-based secret management

**Best Practices**:
- Use service accounts (not user credentials) in CI/CD
- Rotate PATs regularly (30-90 days)
- Scope tokens to minimum required permissions
- Store tokens in CI/CD secret managers (not in code)

### Does QNSI support Terraform?

Yes. QNSI provides Terraform provider for infrastructure-as-code:

```hcl
provider "qnsi" {
  api_url = "https://api.qnsi.heossi.com"
  token   = var.qnsi_token
}

resource "qnsi_tenant" "example" {
  name = "acme-corp"
  tier = "business-advanced"
}
```

See [Integrations → Terraform](/integrations/terraform) for full documentation.

### Can I use QNSI with Kubernetes?

Yes. QNSI supports Kubernetes deployments:

**Secrets Injection**:
- CSI driver for secret mounting
- Init containers for secret fetching
- Sidecar pattern for secret rotation

**Service Mesh Integration**:
- Istio: mTLS with PQC certificates
- Linkerd: PQC-signed service identities
- Consul: PQC-encrypted service discovery

**Operator** (coming soon):
- Automated tenant provisioning
- Secret lifecycle management
- Policy enforcement

## Support & Resources

### What support channels are available?

**Community Support** (Free tier):
- Documentation: [docs.qnsi.heossi.com](https://docs.qnsi.heossi.com)
- GitHub Discussions: Best-effort community help
- Stack Overflow: Tag `qnsi`

**Email Support** (Dev tiers):
- Response time: 24 hours
- Email: contact@heossi.com

**Priority Support** (Business tiers):
- Response time: 4-8 hours
- Email, portal, chat

**Dedicated Support** (Enterprise tiers):
- Response time: 1-2 hours
- Dedicated support engineer
- Phone support
- 24/7 incident escalation

### Where can I find API documentation?

- **API Reference**: [docs.qnsi.heossi.com/api/overview](https://docs.qnsi.heossi.com/api/overview)
- **SDK Documentation**: Each SDK package on npm includes README with examples
- **OpenAPI Specs**: Available at `/openapi.json` on each service
- **Postman Collection**: Coming soon

### How do I get started?

**Quick Start** (5 minutes):

1. **Sign up**: [cloud.qnsi.heossi.com/auth](https://cloud.qnsi.heossi.com/auth)
2. **Create tenant**: Provision your workspace
3. **Install SDK**: `pnpm add @heossihq/qnsi` (or any SDK)
4. **Authenticate**: Get API token from cloud portal
5. **First API call**: Upload a document or create a secret

See [Getting Started Guide](/getting-started/overview) for detailed walkthrough.

### Where can I see the platform status?

- **Live Status**: [qnsi.heossi.com#overview](https://qnsi.heossi.com#overview)
- **Service Health**: Cloud portal dashboard
- **Incident History**: Status page archives
- **Planned Maintenance**: Announced 7 days in advance

### How do I request enterprise features?

**Enterprise Inquiries**: qnsi-sales@heossi.com

**Include in your request**:
- Intended workload (AI, data, identity, search)
- Deployment model (cloud, private/VPC, sovereign)
- Data residency or compliance requirements
- Post-quantum cryptography migration scope

**Response Time**: 1 business day for initial contact

---

## Still have questions?

- **General inquiries**: contact@heossi.com
- **Security issues**: qnsi-security@heossi.com
- **Enterprise sales**: qnsi-sales@heossi.com
- **Technical support**: [cloud.qnsi.heossi.com/support](https://cloud.qnsi.heossi.com/support)
