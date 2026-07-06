# @heossi/qnsi-docs-site

## 0.2.2

### Patch Changes

- dcd861b: Add comprehensive AI Intelligence Service documentation explaining all 8 AI modules, capabilities, and how they help users with self-healing infrastructure, anomaly detection, predictive scaling, smart rate limiting, compliance auditing, intelligent caching, natural language API, and error resolution.
- dcd861b: Comprehensive documentation README updates with verified production information. Updated main docs/README.md with complete production status, service inventory, critical documentation links, AI Intelligence Service overview, and important policies. Updated docs/production/README.md with detailed service status table including ports and health endpoints, deployment checklist, and production safety rules. All information verified against live production deployment (February 14, 2026).
- a4b81ab: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- ad6d0d4: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- b7599c7: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 778cd0e: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- be1dd80: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 7eee8ba: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 3a0f16c: Align all SDK documentation, cloud portal UI, web marketing pages, API routes, email templates, deployment docs, pricing docs, compliance docs, and business docs with the full 90-algorithm PQC registry, 12 SDKs, and 18 services.

  ## SDK Documentation (9 SDKs)

  - Updated all 9 SDK docs (auth, audit, vault, storage, kms-client, access-control, tenant, crypto-inventory, overview) to reflect the complete 90-algorithm ALGORITHM_TO_NIST mapping across 14 PQC families
  - All SDK docs updated to 2026-02-16 last_updated date

  ## Cloud Portal

  - Replaced hardcoded algorithm name mappings in PQC status route with canonical toNistAlgorithmName from @heossi/qnsi-tenant-sdk
  - Replaced hardcoded algorithmToNist map in storage-client.tsx with canonical toNistAlgorithmName
  - Updated crypto policy tier descriptions to use NIST standard names (ML-KEM, ML-DSA, SLH-DSA, FN-DSA)
  - Updated KMS page algorithm badges to include FN-DSA and HQC families
  - Updated auth-client algorithm family listing to include NTRU, NTRU-Prime, UOV, SNOVA
  - Fixed auth-client algorithm count from 59 to 90 and microservice count from 14 to 18
  - Fixed developers page: SDK count 12→11, services 16→18, PQC algorithms 4→90
  - Fixed billing upgrade page: SDK count 10→11

  ## Web Marketing

  - Updated HeroSection algorithm count from 59 to 90 and added missing families
  - Updated page.tsx: services 17→18, added AI Intelligence Service
  - Updated cryptographic policy engine features and FAQ with full algorithm coverage
  - Updated quantum-imperative.ts timeline text with current FIPS references and 90-algorithm count

  ## Email Templates

  - Fixed auth-service email-service.ts: "10 SDKs included" → "12 SDKs included" in both HTML and plain text welcome email templates

  ## Documentation Alignment (Comprehensive)

  - Fixed docs/business/FINAL-PRICING-STRUCTURE.md: all 11 "10 SDKs" → "12 SDKs" references across all pricing tiers
  - Fixed docs/business/EXECUTIVE-SUMMARY.md: "10 SDK/client packages" → "12 SDK/client packages"
  - Fixed docs/business/QNSI-PITCH-DECK.md: "14 microservices" → "18 microservices", "60+ algorithms across 10 families" → "90 algorithms across 14 families"
  - Fixed docs/business/qnsp-whitepaper.md: all "20+ microservices" → "18 microservices", "60+ algorithms across 10 families" → "90 algorithms across 14 families", Falcon → FN-DSA naming
  - Fixed docs/business/company-profile.md: "17+ microservices" → "18 microservices", "60+ algorithms across 10 families" → "90 algorithms across 14 families"
  - Fixed docs/business/enterprise-sales-playbook.md: "60+ algorithms across 10 families" → "90 algorithms across 14 families"
  - Fixed docs/compliance/NIST-CSF-2.0-MAPPING.md: "SDK catalog (10 SDKs)" → "SDK catalog (12 SDKs)", "14 microservices" → "18 microservices"
  - Fixed docs/compliance/FIPS-140-3-VALIDATION-STATUS.md: FALCON → FN-DSA naming
  - Fixed docs/compliance/HIPAA-2025-NPRM-REQUIREMENTS.md: FALCON → FN-DSA naming
  - Fixed docs/production/deployments/AUTOMATED-DEPLOYMENT.md: "17 services" → "18 services", added ai-intelligence-service to service list and ECS mapping table
  - Fixed docs/production/deployments/DEPLOY.md: "17 services" → "18 services"
  - Fixed docs/production/deployments/ECS-DEPLOYMENT-GUIDE.md: "17 services" → "18 services"
  - Fixed docs/production/deployments/PQC-DEPLOYMENT.md: FALCON → FN-DSA naming
  - Fixed docs/ops/SSL-VERIFY-FULL-ROLLOUT.md: "16 service Dockerfiles" → "18 service Dockerfiles"
  - Fixed docs/architecture/PQC-ARCHITECTURE.md: "60+ variants across 10 families" → "90 variants across 14 families"
  - Fixed docs/README.md: FALCON → FN-DSA naming
  - Fixed docs/\_archive/marketing/LAUNCH-POSTS-FINAL.md: all "10 SDKs" → "12 SDKs", "14 microservices" → "18 microservices"
  - Updated docs/specs/product-knowledge.md evidence trail

- c4d6bbb: Add comprehensive FAQ system with improved UX. Docs site includes 50+ questions based on codebase analysis. Marketing page features collapsible FAQ (12 questions, minimized by default) and contact information moved to Engage section with four contact options: contact@heossi.com (general inquiries), enterprise@heossi.com (enterprise sales), security@heossi.com (security issues - private reporting), and GitHub Issues (bug reports - public). FAQ can be expanded on-demand to keep the page clean while providing quick access to answers. Separates security vulnerability reporting (private email) from general bug reports (public GitHub) following security best practices.
- Updated dependencies [ad6d0d4]
- Updated dependencies [b7599c7]
- Updated dependencies [be1dd80]
  - @heossi/qnsi-portal-design-system@0.0.3

## 0.2.1

### Patch Changes

- 239d8d5: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 239d8d5: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 239d8d5: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 3802b90: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- a1795fc: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- cf0aa66: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 68474e4: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- e491808: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 503023e: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 64dd8d6: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 17b9099: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 628379e: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- d933225: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- 5a9e573: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- d22c3d6: Automated changeset generated for staged code updates to keep release workflows fully synchronized.
- Updated dependencies [2a530af]
- Updated dependencies [d933225]
- Updated dependencies [8cd2896]
  - @heossi/qnsi-portal-design-system@0.0.2
