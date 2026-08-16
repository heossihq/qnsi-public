/**
 * Solutions catalog - per-industry vertical landing pages under
 * /solutions/[slug]. Audience: buyer / CISO / compliance lead /
 * regulatory affairs. Companion to lib/developer-use-cases.ts (which
 * targets engineers).
 *
 * Each entry powers:
 *   - One row on /solutions (catalog)
 *   - One programmatic page at /solutions/[slug] (per-vertical detail)
 *   - One per-page OG via /solutions/[slug]/opengraph-image.tsx
 *   - Service + Article JSON-LD on the detail page
 *
 * Industry coverage decision (10 verticals, 2026-05-15): Fortanix
 * (https://www.fortanix.com) ships 5, Thales CipherTrust
 * (https://cpl.thalesgroup.com) ships 12. We chose 10 - focused enough
 * to read differentiated, broad enough to cover QNSI's real ICP.
 *
 * Compliance-anchor policy: anchors pointing at /security/compliance
 * resolve only for the three company frameworks published in
 * apps/audit-service/src/services/compliance-service.ts (soc2, hipaa,
 * gdpr, pci-dss, iso27001, pdpa, mas-trm). Frameworks beyond that
 * (CNSA 2.0, FedRAMP, NIS2, NERC CIP, FERPA, SOX, DORA, FIPS
 * 140-3, NIST 800-208) render as plain-text labels until they are
 * added to the live evaluator.
 */

export interface SolutionThreatModel {
	readonly title: string;
	readonly description: string;
}

export interface SolutionComplianceTag {
	readonly framework: string;
	readonly anchor: string; // anchor on /security/compliance - empty string = plain-text label
	readonly relevance: string;
}

export interface SolutionCapabilityLink {
	readonly capability: string;
	readonly path: string;
	readonly relevance: string;
}

export interface SolutionDeveloperPatternLink {
	readonly slug: string;
	readonly label: string;
}

export interface SolutionVertical {
	readonly slug: string;
	readonly name: string;
	readonly longName: string;
	readonly tagline: string;
	readonly summary: string;
	readonly buyerPersona: readonly string[];
	readonly minTier:
		| "dev-starter"
		| "business-team"
		| "business-advanced"
		| "enterprise-standard"
		| "enterprise-pro"
		| "enterprise-elite"
		| "specialized";
	readonly cryptoPolicyTier: "default" | "strict" | "maximum" | "government";
	readonly threatModel: readonly SolutionThreatModel[];
	readonly compliance: readonly SolutionComplianceTag[];
	readonly qnspPatterns: readonly SolutionCapabilityLink[];
	readonly developerPatterns: readonly SolutionDeveloperPatternLink[];
	readonly outcomes: readonly string[];
	readonly keywords: readonly string[];
}

export const SOLUTIONS_CATALOG: readonly SolutionVertical[] = [
	{
		slug: "regulated-finance",
		name: "Regulated Finance & Banking",
		longName: "QNSI for Regulated Finance & Banking",
		tagline:
			"PQC for retail/wholesale banking, broker-dealers, and payment processors under PCI DSS, MAS TRM, DORA, and FedRAMP equivalents.",
		summary:
			"Source-backed key-management, audit, vault, and compliance-mapping surfaces for banks, broker-dealers, and payment processors evaluating PCI DSS v4.0.1, MAS TRM, DORA, and emerging PQC obligations. Health-derived status is operational telemetry, not certification or control-effectiveness proof.",
		buyerPersona: ["CISO", "Head of Compliance", "Head of Crypto/PKI", "Chief Data Officer"],
		minTier: "business-advanced",
		cryptoPolicyTier: "strict",
		threatModel: [
			{
				title: "Harvest-now, decrypt-later on long-life records",
				description:
					"Transaction records, KYC files, and customer correspondence are retained for 7-30+ years. Anything captured in transit today becomes exposed if a cryptographically relevant quantum computer arrives. No authoritative arrival date exists; NIST transition guidance removes quantum-vulnerable algorithms by 2035, with high-risk systems moving earlier.",
			},
			{
				title: "Cross-border data movement under conflicting regimes",
				description:
					"A Singapore bank operating in the EU and US faces MAS TRM + GDPR + DORA + PCI DSS simultaneously. Snapshot-style annual audits leave gaps; regulators increasingly demand continuous evidence.",
			},
			{
				title: "Vendor-key concentration risk",
				description:
					"When one cloud KMS holds keys for KYC, settlement, and SWIFT messaging, a single compromise blast-radiuses every downstream regulator filing. Per-tenant cryptographic isolation contains the blast radius.",
			},
		],
		compliance: [
			{
				framework: "PCI DSS v4.0.1",
				anchor: "pci-dss",
				relevance:
					"Section 3 (Protect Account Data) maps to QNSI vault + crypto-policy enforcement; Section 10 (Log and Monitor) maps to audit-service immutable chains.",
			},
			{
				framework: "MAS TRM (Singapore)",
				anchor: "mas-trm",
				relevance:
					"Cryptographic Controls and Audit Logging sections require key-lifecycle evidence and tamper-evident logs - both produced by QNSI audit-service.",
			},
			{
				framework: "DORA (EU financial)",
				anchor: "",
				relevance:
					"ICT third-party risk and incident-reporting obligations: QNSI exports continuous evidence packs; multi-region failover is provisioned per tenant on enterprise engagement.",
			},
			{
				framework: "ISO/IEC 27001:2022",
				anchor: "iso27001",
				relevance:
					"A.8 (Asset management) and A.10 (Cryptography) anchored on QNSI crypto-inventory (CBOM) and crypto-policy-enforcement.",
			},
			{
				framework: "SOC 2 Type II",
				anchor: "soc2",
				relevance:
					"Common Criteria CC6 (Logical Access) and CC7 (System Operations) - RBAC, tenant isolation, real-time control evaluation.",
			},
		],
		qnspPatterns: [
			{
				capability: "PQC Key Management (KMS)",
				path: "/platform/key-management",
				relevance:
					"ML-KEM-768/1024 + ML-DSA-65/87 for transaction signing, rotation automation, BYOH HSM support",
			},
			{
				capability: "Quantum-Safe Vault",
				path: "/platform/secrets-management",
				relevance:
					"Versioned secret-storage and retention contracts with a PQC-envelope migration target; end-to-end execution remains NOT VERIFIED",
			},
			{
				capability: "Audit Service",
				path: "/platform/audit-evidence",
				relevance:
					"Source-defined Merkle aggregation and ML-DSA checkpoint signing; complete event ingestion and verification remain deployment-specific",
			},
			{
				capability: "Crypto Policy Enforcement",
				path: "/platform/key-management",
				relevance:
					"Strict tier locks the bank to FIPS-finalized algorithms only; per-tenant policy",
			},
			{
				capability: "Crypto Inventory (CBOM)",
				path: "/platform/crypto-inventory",
				relevance:
					"Continuous inventory of every cryptographic asset across the estate - including legacy RSA/ECDSA",
			},
		],
		developerPatterns: [
			{ slug: "investment-broker-dealer-archives", label: "WORM archive pattern" },
			{ slug: "multi-tenant-b2b-platform", label: "Multi-tenant B2B platform" },
			{ slug: "service-to-service-mtls", label: "Service-to-service PQC mTLS" },
		],
		outcomes: [
			"Strict crypto-policy tier - every signing operation uses ML-DSA-65 or stronger, every KEM uses ML-KEM-768 or stronger",
			"Tamper-evident audit chain that survives regulator review without bespoke evidence assembly",
			"Per-tenant isolation across business lines (retail / commercial / wealth) - single compromise does not cascade",
			"Continuous compliance evidence (PCI DSS, SOC 2, ISO 27001, MAS TRM) - not annual snapshots",
		],
		keywords: [
			"PQC finance",
			"post-quantum banking",
			"PCI DSS PQC",
			"MAS TRM compliance",
			"DORA quantum-safe",
			"broker-dealer PQC",
			"payment processor PQC",
			"KYC encryption PQC",
		],
	},
	{
		slug: "defense-national-security",
		name: "Defense & National Security",
		longName: "QNSI for Defense & National Security",
		tagline:
			"Air-gapped, CNSA 2.0-aligned PQC for defense contractors, intelligence agencies, and classified workloads.",
		summary:
			"Air-gapped or on-prem QNSI deployments with offline ML-DSA-87 signing, distributed edge routing, and tamper-evident audit replay. Aligned to CNSA 2.0 mandates and NSS classifications; designed for IL5-class environments. Government crypto-policy tier locks to FIPS-finalized algorithms only.",
		buyerPersona: ["CISO", "Authorizing Official", "PKI Lead", "Security Officer"],
		minTier: "specialized",
		cryptoPolicyTier: "government",
		threatModel: [
			{
				title: "Classified data with multi-decade confidentiality",
				description:
					"NSS data retained under TOP SECRET for 50+ years is a primary harvest-now-decrypt-later target. Capture in 2025, decrypt circa 2035 - operationally relevant for an entire human generation.",
			},
			{
				title: "Hostile cryptanalytic adversary with sustained budget",
				description:
					"Threat model assumes a nation-state-scale adversary running coordinated capture programmes against allied infrastructure. Algorithm agility and rapid rotation are not optional.",
			},
			{
				title: "Supply-chain attack on the root of trust",
				description:
					"If keys never leave a customer-controlled HSM (Thales Luna, Entrust nShield - FIPS 140-3 validated), a compromised vendor cannot weaponise downstream signatures.",
			},
			{
				title: "Air-gap operational necessity",
				description:
					"Classified, special-access, and sensitive-compartmented environments cannot depend on internet-reachable services. Offline signing, distributed edge routing, and tamper-evident audit replay are baseline requirements.",
			},
		],
		compliance: [
			{
				framework: "CNSA 2.0",
				anchor: "",
				relevance:
					"NSA mandate to transition NSS to ML-KEM, ML-DSA, SLH-DSA by 2030-2033. Government tier locks QNSI to exactly the CNSA 2.0 algorithm subset.",
			},
			{
				framework: "FIPS 140-3",
				anchor: "",
				relevance:
					"Module-level validation roadmap; QNSI architecturally targets FIPS 140-3 via NIST CAVP algorithm validation (in progress with NIST CAVP).",
			},
			{
				framework: "NIST SP 800-208",
				anchor: "",
				relevance:
					"Stateful hash-based signatures (XMSS, LMS) for code-signing and firmware - QNSI supports SLH-DSA family.",
			},
			{
				framework: "DoD IL5-class",
				anchor: "",
				relevance:
					"Designed for Impact Level 5-class sensitive-unclassified workloads via air-gapped + customer-managed HSM topology (IL5 authorization not held).",
			},
		],
		qnspPatterns: [
			{
				capability: "Air-Gapped Deployment",
				path: "/platform/deployment-resilience",
				relevance: "Fully disconnected on-prem with offline signing and distributed edge routing",
			},
			{
				capability: "BYOH HSM Integration",
				path: "/platform/key-management",
				relevance:
					"Capability-gated customer HSM connectors with per-device qualification evidence",
			},
			{
				capability: "Government Crypto Policy",
				path: "/platform/key-management",
				relevance:
					"Locks to ML-KEM-1024 + ML-DSA-87 + SLH-DSA-256f - FIPS-finalized only, no draft standards",
			},
			{
				capability: "Tamper-Evident Audit Replay",
				path: "/platform/audit-evidence",
				relevance:
					"Cryptographically chained audit logs verifiable offline against pinned ML-DSA-87 public key",
			},
		],
		developerPatterns: [{ slug: "service-to-service-mtls", label: "Service-to-service PQC mTLS" }],
		outcomes: [
			"Government crypto-policy tier - ML-KEM-1024 + ML-DSA-87 + SLH-DSA-256f, FIPS-finalized only",
			"Customer-managed HSM custody after live device qualification",
			"Air-gapped operation - no internet dependency, distributed edge routing",
			"Tamper-evident audit chain verifiable offline for IG and OIG review",
		],
		keywords: [
			"defense PQC",
			"CNSA 2.0 PQC",
			"air-gapped PQC",
			"IL5-class PQC",
			"NSS PQC",
			"intelligence PQC",
			"federal PQC",
		],
	},
	{
		slug: "healthcare-life-sciences",
		name: "Healthcare & Life Sciences",
		longName: "QNSI for Healthcare & Life Sciences",
		tagline:
			"HIPAA + GDPR + PDPA-aligned PQC for hospitals, pharma research, clinical trials, and PHI exchanges.",
		summary:
			"PHI-safe encrypted storage, PQC-authenticated research data exchanges, and de-identification controls for hospitals, pharma R&D, clinical trial networks, and health information exchanges. Meets HIPAA Security Rule, GDPR, and PDPA Singapore through data-layer policying.",
		buyerPersona: ["CISO", "HIPAA Security Officer", "Clinical Data Lead", "DPO"],
		minTier: "business-advanced",
		cryptoPolicyTier: "strict",
		threatModel: [
			{
				title: "PHI with lifetime confidentiality requirement",
				description:
					"Genomic, psychiatric, reproductive-health, and HIV records retain confidentiality value across a patient's lifetime - and often their children's. Multi-decade HNDL exposure is real.",
			},
			{
				title: "Cross-institution research data exchange",
				description:
					"Clinical trials and rare-disease consortia move de-identified PHI across borders and institutions. PQC signatures on every exchange let receivers verify authenticity without trusting the transport.",
			},
			{
				title: "Insider-attack on bulk PHI",
				description:
					"Tenant isolation + per-record encryption + per-access audit means an exfiltrated database dump is plaintext-empty; the attacker must also breach the per-key access boundary.",
			},
		],
		compliance: [
			{
				framework: "HIPAA Security Rule",
				anchor: "hipaa",
				relevance:
					"§164.312(a)(2)(iv) Encryption - addressable safeguards met via QNSI vault + SSE-X with ML-KEM-768 wrapping AES-256-GCM data keys.",
			},
			{
				framework: "GDPR",
				anchor: "gdpr",
				relevance:
					"Article 32 (Security of processing) - pseudonymisation, encryption, integrity, and resilience via QNSI de-identification + audit chain.",
			},
			{
				framework: "PDPA (Singapore)",
				anchor: "pdpa",
				relevance:
					"Protection Obligation (§24) and Notification Obligation (§26) - QNSI vault encryption-at-rest and tamper-evident breach evidence.",
			},
			{
				framework: "ISO/IEC 27001:2022",
				anchor: "iso27001",
				relevance:
					"A.5.34 (Privacy and protection of PII) and A.8.24 (Use of cryptography) - QNSI crypto-policy enforcement.",
			},
			{
				framework: "21 CFR Part 11 (FDA)",
				anchor: "",
				relevance:
					"Electronic records and signatures for clinical trials - ML-DSA-65 signatures on every record meet the authenticity and non-repudiation requirements.",
			},
		],
		qnspPatterns: [
			{
				capability: "Quantum-Safe Vault",
				path: "/platform/secrets-management",
				relevance:
					"Per-patient encryption keys; vault retention locks meet HIPAA 6-year audit-log requirements",
			},
			{
				capability: "SSE-X Encrypted Search",
				path: "/platform/encrypted-data",
				relevance:
					"Search across encrypted clinical records without decrypting bulk data - supports cohort discovery",
			},
			{
				capability: "Tenant Isolation",
				path: "/platform/identity-access",
				relevance: "Per-hospital / per-trial-arm isolation prevents cross-tenant PHI bleed",
			},
			{
				capability: "Audit Service",
				path: "/platform/audit-evidence",
				relevance:
					"Every PHI access produces an immutable audit entry - meets §164.312(b) audit-controls requirement",
			},
		],
		developerPatterns: [
			{ slug: "healthcare-phi-records", label: "PHI patient-records pattern" },
			{ slug: "browser-sdk-e2e", label: "Browser SDK end-to-end PQC" },
		],
		outcomes: [
			"HIPAA Security Rule addressable safeguards met without bespoke encryption infrastructure",
			"Per-record encryption - bulk database exfiltration is plaintext-empty",
			"PQC-signed cross-institution exchanges with verifiable provenance",
			"Continuous compliance evidence for HIPAA, GDPR, PDPA - not annual snapshots",
		],
		keywords: [
			"healthcare PQC",
			"HIPAA PQC",
			"PHI quantum-safe",
			"clinical trial encryption",
			"pharma R&D PQC",
			"genomic data PQC",
			"21 CFR Part 11 PQC",
		],
	},
	{
		slug: "government-sovereign-cloud",
		name: "Government & Sovereign Cloud",
		longName: "QNSI for Government & Sovereign Cloud",
		tagline:
			"FedRAMP, NIS2, and sovereign-residency PQC for federal, state, municipal, and supranational deployments.",
		summary:
			"Sovereign-residency PQC deployments for federal/state/municipal agencies and supranational bodies under FedRAMP, NIS2, and equivalent mandates. Customer-controlled VPC, customer-managed HSM, and audit chains that survive jurisdictional review.",
		buyerPersona: ["CISO", "Authorizing Official", "Privacy Officer", "Records Officer"],
		minTier: "enterprise-pro",
		cryptoPolicyTier: "maximum",
		threatModel: [
			{
				title: "Data-residency under sovereign jurisdiction",
				description:
					"Citizen records, tax data, and inter-agency correspondence must remain under the originating jurisdiction's legal control. VPC-pinned QNSI deployments enforce residency at the infrastructure layer.",
			},
			{
				title: "Long-cycle public records",
				description:
					"Title deeds, court records, and benefits-history span 30-80+ years. HNDL exposure is asymptotically certain on this timeframe without PQC.",
			},
			{
				title: "Adversarial-state harvest of inter-agency traffic",
				description:
					"Diplomatic cables and inter-agency briefings captured in transit today have ongoing value as historical intelligence. A proven PQC or hybrid transport deployment can reduce that exposure; QNSI production negotiation requires observed evidence.",
			},
		],
		compliance: [
			{
				framework: "FedRAMP (Moderate / High)",
				anchor: "",
				relevance:
					"QNSI architecturally targets FedRAMP Moderate and High; the 3PAO process is the gating step. Aligned to NIST SP 800-53 Rev 5 SC-13 (cryptographic protection).",
			},
			{
				framework: "NIS2 (EU)",
				anchor: "",
				relevance:
					"Article 21 risk-management measures and Article 23 incident reporting - QNSI continuous evidence and tamper-evident incident logs.",
			},
			{
				framework: "FIPS 140-3",
				anchor: "",
				relevance: "Module-level validation roadmap; CAVP algorithm validation in progress.",
			},
			{
				framework: "ISO/IEC 27001:2022",
				anchor: "iso27001",
				relevance: "A.5.34 Privacy and protection of PII; A.8.24 Use of cryptography.",
			},
			{
				framework: "CJIS Security Policy",
				anchor: "",
				relevance:
					"Section 5.10 (Cryptography) for criminal-justice information - supported via maximum crypto-policy tier and BYOH HSM.",
			},
		],
		qnspPatterns: [
			{
				capability: "Private VPC Deployment",
				path: "/platform/deployment-resilience",
				relevance: "Deploy into customer-owned AWS/Azure/GCP VPC under sovereign jurisdiction",
			},
			{
				capability: "Maximum Crypto Policy",
				path: "/platform/key-management",
				relevance:
					"ML-KEM-1024 + ML-DSA-87 + FN-DSA-1024 + SLH-DSA-256f - strongest FIPS-finalized parameter sets",
			},
			{
				capability: "BYOH HSM",
				path: "/platform/key-management",
				relevance: "Customer-controlled HSM custody after live device qualification",
			},
			{
				capability: "Audit Service",
				path: "/platform/audit-evidence",
				relevance: "Cryptographically chained logs verifiable by IG / GAO / equivalent reviewers",
			},
		],
		developerPatterns: [{ slug: "govtech-public-records", label: "Public-records / FOIA pattern" }],
		outcomes: [
			"Maximum crypto-policy tier - strongest FIPS-finalized parameter sets across KEM and signature",
			"Sovereign data residency controls with a qualified customer-HSM custody option",
			"Audit chain verifiable by IG / GAO / equivalent independent reviewer",
			"Architecturally aligned to FedRAMP, NIS2, CJIS, ISO 27001 - continuous evidence",
		],
		keywords: [
			"government PQC",
			"FedRAMP PQC",
			"sovereign cloud PQC",
			"NIS2 PQC",
			"public sector PQC",
			"CJIS PQC",
			"municipal PQC",
		],
	},
	{
		slug: "sovereign-ai-labs",
		name: "Sovereign AI Labs",
		longName: "QNSI for Sovereign AI Labs & Model Marketplaces",
		tagline:
			"Encrypted model training, GPU-enclave orchestration, and PQC-signed inference for sovereign AI labs and model marketplaces.",
		summary:
			"Encrypted model training pipelines in customer-controlled sovereign cloud, VPC, or on-prem environments. GPU enclave orchestration (Intel SGX, AMD SEV-SNP, AWS Nitro Enclaves), PQC-signed inference APIs, and zero plaintext exposure of training sets.",
		buyerPersona: ["CTO", "ML Platform Lead", "AI Safety Officer", "Head of Research"],
		minTier: "enterprise-pro",
		cryptoPolicyTier: "maximum",
		threatModel: [
			{
				title: "Training-data extraction from the model",
				description:
					"Membership-inference and gradient-leakage attacks recover training samples from served weights. End-to-end encryption from data lake to enclave neutralises the bulk-exposure risk.",
			},
			{
				title: "Model exfiltration from the inference path",
				description:
					"Served models are themselves IP. Enclave-bound inference + ML-DSA-signed responses make black-box weight extraction provably tamper-evident.",
			},
			{
				title: "Cross-tenant leakage on shared GPUs",
				description:
					"GPU enclaves (SGX, SEV-SNP, Nitro) plus QNSI tenant isolation give each customer cryptographic separation even on shared hardware.",
			},
			{
				title: "Supply-chain attack on training data",
				description:
					"PQC-signed dataset attestations - every input training file carries an ML-DSA signature that traces to its source.",
			},
		],
		compliance: [
			{
				framework: "ISO/IEC 27001:2022",
				anchor: "iso27001",
				relevance: "A.8 cryptography controls for AI training and inference pipelines.",
			},
			{
				framework: "SOC 2 Type II",
				anchor: "soc2",
				relevance:
					"Logical access, tenant isolation, audit-trail integrity for shared AI infrastructure.",
			},
			{
				framework: "EU AI Act",
				anchor: "",
				relevance:
					"High-risk AI system requirements include data-governance, traceability, and security - QNSI audit chain and PQC provenance signatures support each.",
			},
			{
				framework: "NIST AI RMF",
				anchor: "",
				relevance:
					"Govern → Map → Measure → Manage; QNSI gives the cryptographic substrate for each.",
			},
		],
		qnspPatterns: [
			{
				capability: "GPU Enclave Orchestration",
				path: "/platform/ai-security",
				relevance:
					"Intel SGX, AMD SEV-SNP, AWS Nitro Enclaves - attestation-verified training and inference",
			},
			{
				capability: "PQC-Signed Inference",
				path: "/platform/ai-security",
				relevance:
					"Every inference response carries an ML-DSA-65 signature; clients verify provenance independently",
			},
			{
				capability: "Encrypted Vector Search",
				path: "/platform/encrypted-data",
				relevance:
					"RAG over encrypted vector indexes - embeddings never leave the encryption boundary",
			},
			{
				capability: "Tenant Isolation",
				path: "/platform/identity-access",
				relevance: "Per-tenant model artifacts, per-tenant inference quotas, per-tenant audit",
			},
		],
		developerPatterns: [{ slug: "ai-agent-mcp-integration", label: "AI agent / MCP integration" }],
		outcomes: [
			"Maximum crypto-policy tier - strongest parameter sets across training and inference",
			"GPU-enclave attestation - training and inference run on verified hardware",
			"PQC-signed inference responses - verifiable provenance from served model to consumer",
			"Per-tenant isolation on shared GPU infrastructure",
		],
		keywords: [
			"sovereign AI PQC",
			"confidential AI inference",
			"PQC AI training",
			"GPU enclave PQC",
			"AI model marketplace PQC",
			"SGX AI",
			"SEV-SNP AI",
			"Nitro Enclaves AI",
		],
	},
	{
		slug: "critical-infrastructure",
		name: "Critical Infrastructure",
		longName: "QNSI for Critical Infrastructure",
		tagline:
			"PQC for utilities, energy grids, telecommunications, and transport systems under NIS2 and NERC CIP.",
		summary:
			"Quantum-safe key management for utilities (electricity/water/gas), energy producers, telecom operators, and transport networks operating under NIS2 (EU), NERC CIP (North America), and equivalent national-security frameworks. Long-cycle equipment, harvest-now-decrypt-later exposure, regulator-grade audit chains.",
		buyerPersona: ["CISO", "OT Security Lead", "Regulatory Affairs", "Operations Director"],
		minTier: "enterprise-standard",
		cryptoPolicyTier: "maximum",
		threatModel: [
			{
				title: "OT equipment with multi-decade service life",
				description:
					"SCADA controllers, smart-meters, and grid telemetry endpoints deployed today run for 15-25 years. They will face CRQC during their service life - algorithm agility is mandatory.",
			},
			{
				title: "Nation-state grid-disruption objective",
				description:
					"Energy and telecom are top-priority adversary targets. Captured-now command-and-control traffic decrypted on a future quantum platform yields operational blueprints.",
			},
			{
				title: "IT/OT boundary as the soft target",
				description:
					"IT-side compromise → OT command injection is the documented attack chain. QNSI audit chains across the boundary make lateral movement tamper-evident.",
			},
		],
		compliance: [
			{
				framework: "NIS2 (EU)",
				anchor: "",
				relevance:
					"Article 21 risk-management measures specifically including cryptography and incident-handling. Article 23 24-hour incident reporting - QNSI audit-service produces the evidence pack.",
			},
			{
				framework: "NERC CIP-005-7 / CIP-007-6",
				anchor: "",
				relevance:
					"Electronic Security Perimeter and System Security Management. QNSI defines an edge transport-policy target and audit-retention contracts; deployment-specific negotiation and retention effects require evidence.",
			},
			{
				framework: "ISO/IEC 27001:2022",
				anchor: "iso27001",
				relevance: "A.8.24 Use of cryptography across IT and OT estates.",
			},
			{
				framework: "MAS TRM (Singapore)",
				anchor: "mas-trm",
				relevance:
					"Applies to Singapore CII operators - see MAS Notices on TRM for critical infrastructure.",
			},
		],
		qnspPatterns: [
			{
				capability: "PQC-TLS at the OT/IT Boundary",
				path: "/platform/deployment-resilience",
				relevance:
					"Hybrid X25519MLKEM768 termination at edge-gateway between corporate IT and OT systems",
			},
			{
				capability: "Crypto Inventory (CBOM)",
				path: "/platform/crypto-inventory",
				relevance:
					"Continuous inventory of cryptographic assets across IT + OT - including legacy industrial protocols",
			},
			{
				capability: "Long-Cycle Audit Retention",
				path: "/platform/audit-evidence",
				relevance: "7-year audit retention add-on for regulator review of incident timelines",
			},
			{
				capability: "BYOH HSM",
				path: "/platform/key-management",
				relevance: "Sovereign control of root keys for nationally significant infrastructure",
			},
		],
		developerPatterns: [{ slug: "service-to-service-mtls", label: "Service-to-service PQC mTLS" }],
		outcomes: [
			"Inventory and govern IT/OT transport boundaries; end-to-end PQC-native execution requires boundary-specific production evidence",
			"Continuous CBOM inventory across both IT and legacy OT systems",
			"Tamper-evident incident-evidence packs for NIS2 24-hour reporting",
			"Qualified sovereign HSM custody path for nationally significant infrastructure",
		],
		keywords: [
			"critical infrastructure PQC",
			"NIS2 PQC",
			"NERC CIP PQC",
			"utility PQC",
			"telecom PQC",
			"energy grid PQC",
			"SCADA PQC",
			"OT PQC",
		],
	},
	{
		slug: "insurance-asset-management",
		name: "Insurance & Asset Management",
		longName: "QNSI for Insurance & Asset Management",
		tagline:
			"PQC for insurers, reinsurers, asset managers, and pension funds with multi-decade data-retention obligations.",
		summary:
			"Long-cycle PQC for insurers, reinsurers, wealth managers, and pension funds whose data retention obligations span 30-50+ years - making them prime harvest-now-decrypt-later targets. SOX, MAS TRM, and DORA-aligned audit chains.",
		buyerPersona: ["CISO", "Head of Compliance", "Data Retention Lead", "Risk Officer"],
		minTier: "business-advanced",
		cryptoPolicyTier: "strict",
		threatModel: [
			{
				title: "Multi-decade policy retention",
				description:
					"Life insurance, annuities, and pension records are routinely retained 30-80 years. Any record in transit today that an adversary captures is decryptable on the buyer's likely CRQC arrival horizon.",
			},
			{
				title: "Claim-record integrity over a lifetime",
				description:
					"A 1995-issued policy must still be cryptographically authenticatable in 2055. PQC signatures applied today survive that timeline; RSA-2048 does not.",
			},
			{
				title: "Reinsurance and broker exchange",
				description:
					"Sensitive actuarial data moves across reinsurers, brokers, and underwriters. PQC-signed exchange and per-counterparty key isolation contain breach scope.",
			},
		],
		compliance: [
			{
				framework: "SOX",
				anchor: "",
				relevance:
					"Sections 302 and 404 - internal controls over financial reporting. QNSI audit-service for tamper-evident operational logs.",
			},
			{
				framework: "MAS TRM (Singapore)",
				anchor: "mas-trm",
				relevance:
					"Applies to Singapore insurers under the Insurance Act - cryptographic controls and audit logging.",
			},
			{
				framework: "DORA (EU financial)",
				anchor: "",
				relevance:
					"ICT third-party risk and operational-resilience - covers insurers/asset managers as financial entities.",
			},
			{
				framework: "ISO/IEC 27001:2022",
				anchor: "iso27001",
				relevance: "A.5.34 Privacy and protection of PII; A.8.24 Use of cryptography.",
			},
			{
				framework: "SOC 2 Type II",
				anchor: "soc2",
				relevance:
					"Service organizations holding insurance/asset records - Common Criteria CC6 + CC7.",
			},
		],
		qnspPatterns: [
			{
				capability: "Long-Retention Audit Trails",
				path: "/platform/audit-evidence",
				relevance:
					"7-year retention add-on standard; longer retention available for pension/life-insurance horizons",
			},
			{
				capability: "Quantum-Safe Vault",
				path: "/platform/secrets-management",
				relevance: "Per-policy / per-portfolio encryption keys with retention-aligned rotation",
			},
			{
				capability: "PQC-Signed Documents",
				path: "/platform/key-management",
				relevance: "ML-DSA-65 signatures applied at issuance - survive the entire policy life",
			},
			{
				capability: "Crypto Inventory (CBOM)",
				path: "/platform/crypto-inventory",
				relevance: "Identify all RSA/ECDSA assets in legacy actuarial systems requiring migration",
			},
		],
		developerPatterns: [
			{ slug: "investment-broker-dealer-archives", label: "WORM archive pattern" },
		],
		outcomes: [
			"PQC signatures applied today remain cryptographically authenticatable across the policy life",
			"Long-retention audit chain for regulator review (SOX, MAS, DORA)",
			"Per-counterparty key isolation in reinsurance and broker exchanges",
			"Continuous CBOM inventory to plan legacy RSA/ECDSA retirement",
		],
		keywords: [
			"insurance PQC",
			"asset management PQC",
			"pension fund PQC",
			"HNDL insurance",
			"long-term data retention PQC",
			"actuarial data PQC",
			"reinsurance PQC",
		],
	},
	{
		slug: "multi-tenant-saas",
		name: "Multi-Tenant SaaS Platforms",
		longName: "QNSI for Multi-Tenant SaaS Platforms",
		tagline:
			"PQC primitives, tenant isolation, and usage metering for SaaS platforms serving regulated buyers.",
		summary:
			"PQC primitives, audit-grade isolation, and tenant-scoped crypto-policy for SaaS platforms whose customers are themselves regulated (finance/healthcare/government). Ship faster by outsourcing encryption, compliance controls, and tenant isolation to QNSI.",
		buyerPersona: ["CTO", "VP Engineering", "Head of Security", "Head of Compliance"],
		minTier: "business-team",
		cryptoPolicyTier: "strict",
		threatModel: [
			{
				title: "Single regulated customer breaches your platform",
				description:
					"One enterprise breach drags every other tenant into the regulator response. Per-tenant cryptographic isolation contains the blast radius to a single tenant's data.",
			},
			{
				title: "Bring-your-own-customer-compliance burden",
				description:
					"Customers in finance/healthcare push their compliance requirements onto you. QNSI per-tenant crypto-policy gives you the lever to satisfy strict-tier customers without forcing the cost onto everyone.",
			},
			{
				title: "Privileged-access bulk exfiltration",
				description:
					"A compromised internal account that can read every tenant's data is a regulator-level event. QNSI per-tenant keys, RBAC, and audit-service make bulk reads observable and rate-limitable.",
			},
		],
		compliance: [
			{
				framework: "SOC 2 Type II",
				anchor: "soc2",
				relevance:
					"The default audit demanded by enterprise SaaS buyers - QNSI gives Common Criteria CC6 and CC7 evidence.",
			},
			{
				framework: "ISO/IEC 27001:2022",
				anchor: "iso27001",
				relevance:
					"A.5 (Information security policies) through A.18 (Compliance) - broad coverage via QNSI primitives.",
			},
			{
				framework: "GDPR",
				anchor: "gdpr",
				relevance:
					"Article 32 (Security of processing) and Article 28 (Processors) - QNSI as the encryption substrate satisfies both.",
			},
			{
				framework: "HIPAA (if PHI customers)",
				anchor: "hipaa",
				relevance: "BAA-compatible deployment with QNSI for SaaS serving covered entities.",
			},
			{
				framework: "PCI DSS (if cardholder data)",
				anchor: "pci-dss",
				relevance: "Section 3 encryption requirements met via QNSI vault.",
			},
		],
		qnspPatterns: [
			{
				capability: "Per-Tenant Crypto Policy",
				path: "/platform/key-management",
				relevance:
					"Strict tier for finance/healthcare customers; default tier for low-touch customers; same SaaS codebase",
			},
			{
				capability: "Tenant Isolation",
				path: "/platform/identity-access",
				relevance:
					"SPIFFE-based service identity; per-tenant keys, per-tenant audit, per-tenant entitlements",
			},
			{
				capability: "Quota Service",
				path: "/platform/identity-access",
				relevance:
					"Per-tenant rate-limiting and usage metering for billing across thousands of tenants",
			},
			{
				capability: "Browser SDK",
				path: "/platform/developer-security",
				relevance: "Pure-JS PQC for end-to-end encryption in customer-facing web apps",
			},
		],
		developerPatterns: [
			{ slug: "multi-tenant-b2b-platform", label: "Multi-tenant B2B platform" },
			{ slug: "browser-sdk-e2e", label: "Browser SDK end-to-end PQC" },
		],
		outcomes: [
			"Per-tenant crypto-policy lets you serve regulated and unregulated tenants on one codebase",
			"Tenant isolation contains breach blast radius to a single tenant",
			"Audit chain produces SOC 2 / ISO 27001 / GDPR evidence continuously",
			"Browser SDK gives end-to-end PQC to customer-facing web apps",
		],
		keywords: [
			"multi-tenant SaaS PQC",
			"B2B SaaS encryption",
			"tenant isolation PQC",
			"SaaS compliance PQC",
			"per-tenant crypto policy",
		],
	},
	{
		slug: "education-research",
		name: "Education & Research",
		longName: "QNSI for Education & Research Institutions",
		tagline:
			"FERPA + PDPA-aligned PQC for universities, K-12, EdTech platforms, and research consortia.",
		summary:
			"FERPA-aligned PQC for universities, K-12 districts, EdTech platforms, and multi-institution research consortia. Long retention windows for transcripts, controlled access to student records, encrypted research data exchanges across institutional boundaries.",
		buyerPersona: ["CISO", "Registrar", "Research IT Lead", "DPO"],
		minTier: "business-team",
		cryptoPolicyTier: "strict",
		threatModel: [
			{
				title: "Lifetime-retention student records",
				description:
					"Transcripts, degrees, and disciplinary records are retained indefinitely. They identify the individual across their entire career - HNDL exposure is multi-decade.",
			},
			{
				title: "Cross-institution research data movement",
				description:
					"Genomics, social-science, and clinical-research datasets move across institutions and borders. PQC signatures + tenant isolation contain bleed between consortium members.",
			},
			{
				title: "Mass-stalking risk from student-record leaks",
				description:
					"Student PII at scale is a frequently abused dataset for stalking, doxxing, and identity theft. Per-record encryption defeats bulk exfiltration.",
			},
		],
		compliance: [
			{
				framework: "FERPA",
				anchor: "",
				relevance:
					"US Family Educational Rights and Privacy Act - directory and education records protected by per-record encryption and audited access.",
			},
			{
				framework: "PDPA (Singapore)",
				anchor: "pdpa",
				relevance:
					"Personal Data Protection Act 2012 - applies to Singapore educational institutions.",
			},
			{
				framework: "GDPR",
				anchor: "gdpr",
				relevance:
					"Article 32 (Security of processing) - applies to all EU institutions and to international students of EU origin.",
			},
			{
				framework: "SOC 2 Type II",
				anchor: "soc2",
				relevance:
					"EdTech vendors increasingly require SOC 2 to sell into school districts and universities.",
			},
		],
		qnspPatterns: [
			{
				capability: "Quantum-Safe Vault",
				path: "/platform/secrets-management",
				relevance: "Per-student / per-cohort encryption keys; FERPA-aligned retention",
			},
			{
				capability: "SSE-X Encrypted Search",
				path: "/platform/encrypted-data",
				relevance: "Search across encrypted coursework and research data without bulk decryption",
			},
			{
				capability: "Tenant Isolation",
				path: "/platform/identity-access",
				relevance: "Per-institution isolation for multi-tenant EdTech and consortium platforms",
			},
			{
				capability: "Audit Service",
				path: "/platform/audit-evidence",
				relevance: "Every transcript or record access produces an immutable audit entry",
			},
		],
		developerPatterns: [{ slug: "edtech-secure-lms", label: "EdTech secure LMS" }],
		outcomes: [
			"FERPA-aligned per-student encryption and audited access",
			"PDPA + GDPR coverage for cross-border students and researchers",
			"Cross-institution research exchanges with PQC-signed provenance",
			"Per-record encryption defeats bulk student-data exfiltration",
		],
		keywords: [
			"EdTech PQC",
			"FERPA PQC",
			"university PQC",
			"research data PQC",
			"student records encryption",
			"K-12 PQC",
		],
	},
	{
		slug: "manufacturing-ip-protection",
		name: "Manufacturing & IP Protection",
		longName: "QNSI for Manufacturing & IP-Intensive Industries",
		tagline:
			"Trade-secret protection, CAD/CAM file vaulting, and supply-chain PQC for manufacturers and IP-heavy industries.",
		summary:
			"Trade-secret protection for manufacturers, automotive OEMs, semiconductor design houses, and IP-intensive industries. Long-life CAD/CAM file vaulting (multi-decade retention), supply-chain PQC handshakes, and signed firmware distribution.",
		buyerPersona: ["CISO", "IP Counsel", "OT Security Lead", "Supply Chain Security"],
		minTier: "business-advanced",
		cryptoPolicyTier: "strict",
		threatModel: [
			{
				title: "Trade-secret exfiltration over decades",
				description:
					"A captured CAD file or process recipe today is exploitable on a 5-50 year horizon. PQC vaulting today neutralises HNDL exposure on the IP itself.",
			},
			{
				title: "Supply-chain firmware tampering",
				description:
					"OT/IoT firmware signed with RSA-2048 today is vulnerable when CRQC arrives. ML-DSA-87 signatures on firmware survive that transition.",
			},
			{
				title: "Multi-jurisdiction manufacturing partnerships",
				description:
					"OEM ↔ tier-1 ↔ tier-2 IP flows across borders. Per-partner PQC keys + tenant isolation contain breach scope to a single partner.",
			},
		],
		compliance: [
			{
				framework: "ISO/IEC 27001:2022",
				anchor: "iso27001",
				relevance:
					"A.5.13 (Labelling), A.8.10 (Information deletion), A.8.24 (Use of cryptography).",
			},
			{
				framework: "SOC 2 Type II",
				anchor: "soc2",
				relevance: "Common Criteria CC6 + CC7 for tenant isolation and operational integrity.",
			},
			{
				framework: "GDPR",
				anchor: "gdpr",
				relevance:
					"Applies to manufacturer-held employee and customer PII data even outside the EU.",
			},
		],
		qnspPatterns: [
			{
				capability: "Quantum-Safe Vault",
				path: "/platform/secrets-management",
				relevance:
					"CAD/CAM files and process recipes encrypted with ML-KEM-1024-wrapped AES-256-GCM",
			},
			{
				capability: "PQC-Signed Firmware",
				path: "/platform/key-management",
				relevance: "ML-DSA-87 signatures on firmware distributed to OT/IoT - survives CRQC arrival",
			},
			{
				capability: "Crypto Inventory (CBOM)",
				path: "/platform/crypto-inventory",
				relevance: "Inventory of RSA/ECDSA assets across OEM and tier-N supply chain",
			},
			{
				capability: "Tenant Isolation",
				path: "/platform/identity-access",
				relevance: "Per-partner cryptographic isolation across OEM ↔ tier-1 ↔ tier-2 flows",
			},
		],
		developerPatterns: [{ slug: "service-to-service-mtls", label: "Service-to-service PQC mTLS" }],
		outcomes: [
			"versioned vault with a PQC-envelope targeting of CAD/CAM files and process recipes - multi-decade HNDL-safe",
			"ML-DSA-87 firmware signatures that survive CRQC arrival",
			"Per-partner cryptographic isolation across OEM ↔ supplier flows",
			"Continuous CBOM inventory across the manufacturing supply chain",
		],
		keywords: [
			"manufacturing PQC",
			"trade secret PQC",
			"IP protection PQC",
			"CAD vault PQC",
			"supply chain PQC",
			"firmware signing PQC",
			"OEM PQC",
		],
	},
] as const;

export function findSolutionVertical(slug: string): SolutionVertical | undefined {
	return SOLUTIONS_CATALOG.find((v) => v.slug === slug);
}

export function solutionSlugs(): readonly string[] {
	return SOLUTIONS_CATALOG.map((v) => v.slug);
}
