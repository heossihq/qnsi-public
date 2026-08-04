import { USE_CASE_SOURCE_BY_ID } from "./sources";

export type QnsiUseCase = {
	slug: string;
	title: string;
	sector: string;
	owner: string;
	decision: string;
	pain: string;
	trigger: string;
	qnsiAction: string;
	deliverable: string;
	validation: string;
	sourceIds: readonly string[];
	keywords: readonly string[];
};

export const QNSI_USE_CASES: readonly QnsiUseCase[] = [
	{
		slug: "bank-payment-rail-cryptography-inventory",
		title: "Map cryptography across a bank payment rail before migration",
		sector: "Banking & payments",
		owner: "CISO · Head of Payments · Cryptography Lead",
		decision:
			"Which payment services can move first without breaking clearing, fraud, or settlement dependencies?",
		pain: "Certificates, HSM keys, message signatures, and TLS dependencies are spread across gateways, switches, batch jobs, and counterparties, so a migration plan built from CMDB labels alone misses live cryptographic use.",
		trigger:
			"A board quantum-readiness deadline or payment-platform modernization programme needs a defensible scope.",
		qnsiAction:
			"Use QNSI inventory and policy records to classify payment-path algorithms, owners, data lifetime, and migration constraints, then stage approved NIST-standardized targets.",
		deliverable:
			"A payment-rail cryptographic dependency register with owners, exception reasons, and an ordered transition backlog.",
		validation:
			"The bank must validate scheme rules, counterparty interoperability, latency, HSM boundaries, and change-window controls.",
		sourceIds: ["cisa-quantum", "mas-psn05"],
		keywords: [
			"bank cryptographic inventory",
			"payment rail PQC migration",
			"MAS TRM cryptography",
		],
	},
	{
		slug: "bank-hsm-signing-key-rollover",
		title: "Rehearse an HSM-backed signing-key rollover without payment downtime",
		sector: "Banking & payments",
		owner: "PKI Lead · HSM Operations · Payments SRE",
		decision:
			"Can old and new signing trust coexist long enough to rotate safely across every payment participant?",
		pain: "A key rollover can strand terminals or counterparties when trust stores, key identifiers, validation code, and rollback ownership change at different speeds.",
		trigger: "Key expiry, algorithm deprecation, suspected compromise, or an HSM estate refresh.",
		qnsiAction:
			"Model key states and policy transitions in QNSI, record dual-validation windows, and exercise the customer-controlled custody path before production cutover.",
		deliverable:
			"A signed rollover runbook with prechecks, trust-overlap evidence, abort thresholds, and retirement confirmation.",
		validation:
			"Operations must prove the exact provider, module, firmware, mechanism, certificate owner, and recovery procedure in its deployment.",
		sourceIds: ["nist-key-management", "pci-dss"],
		keywords: ["bank HSM rollover", "payment signing key rotation", "dual trust validation"],
	},
	{
		slug: "open-banking-api-hybrid-pqc",
		title: "Introduce hybrid post-quantum protection at an open-banking API boundary",
		sector: "Banking & payments",
		owner: "API Security Architect · Open Banking Product Owner",
		decision:
			"Where can quantum-resistant handshakes be introduced while legacy aggregators still require classical interoperability?",
		pain: "The bank controls its gateway but not every client library, certificate stack, or third-party aggregator, making an all-at-once protocol cutover commercially unsafe.",
		trigger:
			"A new API gateway, long-lived consent data, or a regulated partner asks for a quantum-safe roadmap.",
		qnsiAction:
			"Use QNSI policy tiers and conformance evidence to define native-PQC, hybrid, and exception cohorts without claiming that telemetry alone proves PQC transport.",
		deliverable:
			"A partner-by-partner negotiation matrix with downgrade rules, test vectors, expiry dates, and evidence gaps.",
		validation:
			"Each client path requires packet-level verification, performance testing, certificate-policy review, and explicit downgrade acceptance.",
		sourceIds: ["nist-ir-8547", "dora"],
		keywords: ["open banking post quantum", "hybrid PQC API", "bank API crypto agility"],
	},
	{
		slug: "bank-cyber-incident-materiality-evidence",
		title: "Assemble cryptographic evidence for a bank cyber-incident materiality decision",
		sector: "Banking & payments",
		owner: "Incident Commander · General Counsel · Disclosure Committee",
		decision:
			"What cryptographic assets, data paths, and business services were affected, and when was that known?",
		pain: "Materiality and regulator clocks run while responders reconcile key logs, service ownership, data classifications, and contradictory timestamps from separate teams.",
		trigger:
			"Compromise of a certificate authority, signing service, API credential, or key-management administrator.",
		qnsiAction:
			"Correlate QNSI inventory, key lifecycle, control state, and audit references into a time-bounded incident evidence package.",
		deliverable:
			"A disclosure-ready chronology linking affected crypto assets to systems, owners, containment actions, and unresolved facts.",
		validation:
			"Counsel and the regulated entity decide materiality, filing content, privilege, jurisdiction, and statutory deadlines.",
		sourceIds: ["sec-incident", "nydfs"],
		keywords: [
			"bank incident evidence",
			"cyber materiality cryptography",
			"SEC incident disclosure",
		],
	},
	{
		slug: "digital-asset-custody-signing-policy",
		title: "Separate digital-asset custody approval from signing execution",
		sector: "Digital assets & fintech",
		owner: "Custody CTO · Wallet Security Lead · Risk Officer",
		decision:
			"Which people, services, thresholds, and key stores may authorize each class of asset movement?",
		pain: "Wallet systems often collapse business approval, key access, and transaction signing into one privileged path, enlarging the blast radius of operator or service compromise.",
		trigger: "Launch of institutional custody, a new chain integration, or a key-control finding.",
		qnsiAction:
			"Represent signing policies, key identifiers, service identities, and auditable authorization events in QNSI while preserving the customer's custody boundary.",
		deliverable:
			"An asset-tier signing policy matrix and evidence trail that distinguishes approval from cryptographic execution.",
		validation:
			"The custodian must validate chain semantics, quorum enforcement, transaction pre-execution checks, hardware execution, and legal custody controls.",
		sourceIds: ["nist-key-management", "sg-pdpa"],
		keywords: [
			"digital asset custody signing",
			"wallet key policy",
			"institutional crypto controls",
		],
	},
	{
		slug: "wallet-recovery-key-lifecycle",
		title: "Design a recoverable wallet-key lifecycle without creating a master-key shortcut",
		sector: "Digital assets & fintech",
		owner: "Wallet Platform Lead · Business Continuity Manager",
		decision:
			"How can the service recover from device loss or operator unavailability without introducing an ungoverned universal recovery secret?",
		pain: "Recovery designs can silently defeat tenant isolation when shards, wrapping keys, break-glass accounts, or backup media share the same uncontrolled root.",
		trigger: "A custody product adds recovery, inheritance, or enterprise administrator functions.",
		qnsiAction:
			"Use QNSI key metadata and policy boundaries to document recovery roles, wrapped-material locations, rotation conditions, and tenant-specific separation.",
		deliverable:
			"A recovery trust map with separation-of-duty checks, rehearsal results, and residual single points of compromise.",
		validation:
			"Independent reviewers must test reconstruction thresholds, deletion, regional failure, insider resistance, and customer agreements.",
		sourceIds: ["nist-key-management", "nist-zero-trust"],
		keywords: ["wallet recovery security", "key shard governance", "crypto custody recovery"],
	},
	{
		slug: "fintech-partner-api-key-isolation",
		title: "Contain fintech partner API credentials by product and counterparty",
		sector: "Digital assets & fintech",
		owner: "Platform Engineering · Third-Party Risk · Fraud Operations",
		decision:
			"Can one compromised integration credential be prevented from reaching every product, ledger, and partner?",
		pain: "Shared secrets and broadly trusted service accounts let a breach in one aggregator or treasury connector cross customer and product boundaries.",
		trigger:
			"Rapid partner onboarding, credential leakage, or a move from a monolith to platform APIs.",
		qnsiAction:
			"Inventory partner cryptographic identities in QNSI and bind rotation, algorithm, environment, and ownership policy to each integration boundary.",
		deliverable:
			"A counterparty credential register with least-privilege scope, rotation proof, and orphan detection.",
		validation:
			"The fintech must test authorization enforcement, revocation propagation, fraud controls, and partner-side secret handling.",
		sourceIds: ["nist-zero-trust", "ftc-safeguards"],
		keywords: ["fintech API key isolation", "partner credential rotation", "fintech zero trust"],
	},
	{
		slug: "stablecoin-reserve-report-signatures",
		title: "Preserve authenticity of stablecoin reserve and reconciliation reports",
		sector: "Digital assets & fintech",
		owner: "Controller · Treasury Systems · Internal Audit",
		decision:
			"Can a reviewer prove which system produced each reserve snapshot and whether the file changed after approval?",
		pain: "Reserve, bank, ledger, and attestation files move through spreadsheets, object stores, and external firms where filenames and access logs do not establish content authenticity.",
		trigger: "A new attestation cadence, banking-partner change, or reconciliation discrepancy.",
		qnsiAction:
			"Apply QNSI-supported signature policy and provenance records to report artifacts, generation services, and approval handoffs.",
		deliverable:
			"A verifiable manifest connecting each reserve report hash, signer identity, algorithm, timestamp, and source system.",
		validation:
			"Auditors must confirm source completeness, valuation logic, segregation of duties, and that signatures cover the final disclosed artifact.",
		sourceIds: ["nist-key-management", "sec-incident"],
		keywords: [
			"stablecoin reserve integrity",
			"signed reconciliation report",
			"digital asset audit evidence",
		],
	},
	{
		slug: "insurer-policy-archive-quantum-exposure",
		title: "Prioritize quantum exposure in life-policy archives",
		sector: "Insurance & asset management",
		owner: "CISO · Records Officer · Chief Actuary",
		decision:
			"Which policy, medical, beneficiary, and actuarial records remain sensitive beyond the life of today's public-key protection?",
		pain: "Life and annuity records can outlive several cryptographic generations, yet archive projects often classify retention without mapping how records were encrypted or transported.",
		trigger:
			"Archive consolidation, long-term confidentiality review, or post-quantum board reporting.",
		qnsiAction:
			"Use QNSI inventory to join data-retention horizons with algorithms, certificates, interfaces, and accountable owners.",
		deliverable:
			"A long-life insurance exposure register ranked by confidentiality horizon and migration feasibility.",
		validation:
			"The insurer determines legal retention, data sensitivity, archive re-encryption method, key destruction, and restoration performance.",
		sourceIds: ["cisa-quantum", "dora"],
		keywords: ["insurance quantum risk", "life policy archive encryption", "HNDL insurance"],
	},
	{
		slug: "claims-document-signature-integrity",
		title: "Prove the integrity of claims evidence from intake to settlement",
		sector: "Insurance & asset management",
		owner: "Claims CTO · Fraud Lead · Litigation Counsel",
		decision:
			"Can the insurer distinguish an original claimant artifact from later transformation, annotation, or fraud-review output?",
		pain: "Photos, medical records, adjuster notes, and model outputs are copied and transformed across portals and vendors, weakening chain-of-custody arguments.",
		trigger:
			"Automation of claims intake, disputed evidence, or expansion of external adjusting partners.",
		qnsiAction:
			"Create QNSI-compatible signature and provenance records at capture, transformation, review, and settlement checkpoints.",
		deliverable:
			"A claims-evidence lineage bundle showing artifact hashes, responsible services, signature state, and gaps.",
		validation:
			"Claims and legal teams confirm admissibility, identity proofing, timestamp authority, source authenticity, and records policy.",
		sourceIds: ["nist-key-management", "nist-identity"],
		keywords: [
			"claims evidence integrity",
			"insurance document signing",
			"claims chain of custody",
		],
	},
	{
		slug: "insurer-saas-cryptographic-concentration",
		title: "Measure cryptographic concentration across an insurer's SaaS estate",
		sector: "Insurance & asset management",
		owner: "Third-Party Risk · Enterprise Architecture · Procurement",
		decision:
			"Which critical business processes depend on the same certificate authority, cloud KMS, identity provider, or unsupported algorithm?",
		pain: "Vendor reviews happen contract by contract, obscuring shared cryptographic dependencies that can fail across underwriting, claims, finance, and customer service together.",
		trigger:
			"DORA register preparation, a strategic-provider review, or an outage with cross-vendor impact.",
		qnsiAction:
			"Normalize vendor crypto dependencies, key-custody claims, assurance status, and service ownership in a QNSI-backed inventory.",
		deliverable:
			"A concentration heat map linking cryptographic providers to critical insurance processes and exit constraints.",
		validation:
			"Procurement verifies vendor evidence, contractual audit rights, substitutability, data export, and tested exit plans.",
		sourceIds: ["dora", "nist-csrm"],
		keywords: [
			"insurance SaaS concentration",
			"cryptographic third party risk",
			"DORA crypto inventory",
		],
	},
	{
		slug: "cyber-insurance-pqc-underwriting-evidence",
		title: "Replace a PQC underwriting checkbox with measurable evidence",
		sector: "Insurance & asset management",
		owner: "Cyber Underwriting · Risk Engineering · Broker",
		decision:
			"Has the applicant identified material cryptographic exposure and funded a credible transition, or only adopted a policy statement?",
		pain: "Questionnaires ask whether a company is quantum-ready but rarely capture asset coverage, unsupported dependencies, tested migrations, or accountable exceptions.",
		trigger: "A cyber policy renewal, high-limit placement, or new quantum-risk endorsement.",
		qnsiAction:
			"Export scoped QNSI inventory coverage, policy exceptions, conformance references, and remediation age without presenting them as certification.",
		deliverable:
			"An underwriting evidence schedule that separates observed controls, applicant assertions, and not-yet-verified deployment claims.",
		validation:
			"The carrier defines underwriting criteria, samples evidence, checks completeness, and decides pricing or coverage.",
		sourceIds: ["cisa-quantum", "nist-ir-8547"],
		keywords: [
			"PQC cyber insurance",
			"quantum readiness underwriting",
			"cryptographic evidence schedule",
		],
	},
	{
		slug: "hospital-ephi-cryptography-discovery",
		title: "Find ungoverned cryptography around a hospital's ePHI",
		sector: "Healthcare providers",
		owner: "Healthcare CISO · Privacy Officer · Clinical Applications",
		decision:
			"Where is ePHI encrypted, signed, transmitted, or left dependent on unknown cryptographic components?",
		pain: "ePHI crosses EHR interfaces, imaging, labs, portals, backup systems, and research exports, while risk inventories often stop at application names.",
		trigger: "HIPAA risk analysis, an acquisition, or replacement of an EHR integration engine.",
		qnsiAction:
			"Use QNSI inventory records to associate algorithms, keys, certificates, interfaces, data classes, and system owners across the ePHI flow.",
		deliverable:
			"An ePHI cryptography map with uncovered interfaces, expiring trust, and prioritized remediation owners.",
		validation:
			"The covered entity confirms complete ePHI scope, risk ratings, reasonable safeguards, and HIPAA applicability.",
		sourceIds: ["hhs-risk", "cisa-quantum"],
		keywords: ["ePHI cryptographic inventory", "HIPAA encryption risk analysis", "hospital PQC"],
	},
	{
		slug: "hospital-medical-device-pki-transition",
		title: "Transition medical-device PKI without interrupting clinical care",
		sector: "Healthcare providers",
		owner: "Clinical Engineering · PKI Team · Patient Safety",
		decision:
			"Which device cohorts can accept new certificates or algorithms, and which require compensating controls until replacement?",
		pain: "Long-lived devices, vendor-managed firmware, embedded trust anchors, and narrow maintenance windows make a uniform certificate migration unsafe.",
		trigger:
			"Certificate expiry, vendor end-of-support, network segmentation, or post-quantum planning.",
		qnsiAction:
			"Classify device identities, trust anchors, supported mechanisms, care criticality, and exception expiry in QNSI migration policy.",
		deliverable:
			"A clinical PKI cohort plan tied to maintenance windows, rollback paths, and patient-safety sign-off.",
		validation:
			"Biomedical engineers and manufacturers must test device behavior, warranty, safety impact, clinical continuity, and regulatory constraints.",
		sourceIds: ["fda-devices", "nist-ir-8547"],
		keywords: [
			"medical device PKI migration",
			"hospital certificate rotation",
			"clinical device PQC",
		],
	},
	{
		slug: "health-cloud-customer-key-custody",
		title: "Evaluate customer-managed key custody for a healthcare cloud workload",
		sector: "Healthcare providers",
		owner: "Cloud Security · Privacy Officer · Infrastructure",
		decision:
			"Does customer-managed custody materially reduce risk without making recovery or clinical availability fragile?",
		pain: "A bring-your-own-key label can hide provider control-plane access, wrapping-key dependencies, unsupported PQC operations, and untested disaster recovery.",
		trigger: "Migration of imaging, analytics, or patient-engagement data to a cloud service.",
		qnsiAction:
			"Use QNSI connector evidence and guardrails to document custody operations, provider boundaries, key states, and qualification gaps.",
		deliverable:
			"A custody decision record comparing provider-native, customer-managed, and external-HSM paths for the workload.",
		validation:
			"The organization tests recovery, availability, revocation, support access, performance, and the exact validated cryptographic boundary.",
		sourceIds: ["hhs-cloud", "nist-key-management"],
		keywords: ["healthcare customer managed keys", "HIPAA BYOK", "cloud HSM healthcare"],
	},
	{
		slug: "health-breach-crypto-scope",
		title: "Determine cryptographic scope during a healthcare breach",
		sector: "Healthcare providers",
		owner: "Incident Response · Privacy · Clinical Operations",
		decision:
			"Was compromised ePHI actually protected, were relevant keys exposed, and which records fall inside the incident boundary?",
		pain: "Encryption status is often inferred from platform configuration even when exports, caches, backups, or accessible keys change the real exposure.",
		trigger: "Ransomware, stolen credentials, lost media, or unauthorized cloud access.",
		qnsiAction:
			"Correlate QNSI asset, key, algorithm, owner, and audit records with the incident timeline and affected data stores.",
		deliverable:
			"A breach cryptography worksheet that documents protected paths, key exposure, exceptions, and confidence levels.",
		validation:
			"Privacy counsel decides notification duties and whether encryption renders data unusable under applicable law.",
		sourceIds: ["hhs-risk", "sg-pdpa"],
		keywords: [
			"healthcare breach encryption scope",
			"HIPAA key exposure",
			"ePHI incident evidence",
		],
	},
	{
		slug: "medical-device-secure-boot-signing",
		title: "Qualify post-quantum signing for medical-device secure boot",
		sector: "Medical devices",
		owner: "Device Security Architect · Firmware Lead · Quality",
		decision:
			"Can the boot chain verify a new signature scheme within memory, timing, safety, and update constraints?",
		pain: "A standards-compliant signature implementation does not prove that a constrained device, boot ROM, recovery image, and manufacturing process form a safe deployable trust chain.",
		trigger:
			"A new device platform, secure-boot redesign, or threat model extending beyond the product's service life.",
		qnsiAction:
			"Use QNSI algorithm and conformance evidence to select candidate signatures and record test results without claiming hardware execution.",
		deliverable:
			"A secure-boot qualification dossier covering signer custody, image format, verification timing, rollback, and failure behavior.",
		validation:
			"The manufacturer performs safety analysis, hardware tests, regulatory review, and production-key ceremony validation.",
		sourceIds: ["fda-devices", "nist-pqc"],
		keywords: [
			"medical device PQC secure boot",
			"ML-DSA firmware signing",
			"device boot qualification",
		],
	},
	{
		slug: "medical-device-sbom-signature-chain",
		title: "Bind a medical-device SBOM to the exact released firmware",
		sector: "Medical devices",
		owner: "Product Security · Quality Systems · Regulatory Affairs",
		decision:
			"Can a hospital or assessor verify that the SBOM, vulnerability status, and firmware image describe the same release?",
		pain: "SBOM files are often generated separately from release artifacts and lose trustworthy linkage after vendor portals, distributors, or service teams copy them.",
		trigger:
			"Premarket submission, vulnerability disclosure, field update, or customer security review.",
		qnsiAction:
			"Record signature policy and provenance for firmware, SBOM, build evidence, and release approval using QNSI-supported primitives.",
		deliverable:
			"A signed release manifest linking component inventory, firmware digest, signer, build identity, and approval state.",
		validation:
			"The manufacturer proves SBOM completeness, build reproducibility, vulnerability triage, signing-key protection, and distribution integrity.",
		sourceIds: ["fda-devices", "nist-ssdf"],
		keywords: [
			"medical device SBOM signing",
			"firmware provenance healthcare",
			"FDA cyber evidence",
		],
	},
	{
		slug: "medical-device-field-update-trust",
		title: "Rotate field-update trust on devices that cannot all reconnect",
		sector: "Medical devices",
		owner: "Fleet Operations · Device Engineering · Customer Support",
		decision:
			"How can offline or intermittently connected devices learn a new update key without accepting an attacker-controlled root?",
		pain: "Devices in homes, clinics, and remote sites may miss intermediate updates, leaving trust-anchor replacement dependent on insecure manual exceptions.",
		trigger:
			"Signing-key expiry, compromise response, manufacturer acquisition, or algorithm transition.",
		qnsiAction:
			"Track device cohorts, accepted signer generations, overlap windows, and recovery policy as migration evidence in QNSI.",
		deliverable:
			"A fleet trust-transition matrix with last-safe versions, staged bundles, fallback media, and retirement criteria.",
		validation:
			"Device owners test every supported upgrade path, anti-rollback behavior, offline recovery, and patient-safety impact.",
		sourceIds: ["fda-devices", "nist-key-management"],
		keywords: [
			"medical device update key rotation",
			"offline firmware trust",
			"device fleet certificate migration",
		],
	},
	{
		slug: "medical-device-premarket-crypto-file",
		title: "Build the cryptography section of a medical-device premarket file",
		sector: "Medical devices",
		owner: "Regulatory Affairs · Product Security · Systems Engineering",
		decision:
			"Is every cryptographic claim connected to a design requirement, implementation, verification result, and residual risk?",
		pain: "Algorithm lists and architecture diagrams fail review when they omit key generation, update, recovery, certificate, third-party, and lifecycle evidence.",
		trigger: "A connected-device submission or significant cybersecurity design change.",
		qnsiAction:
			"Export scoped QNSI algorithm, key, policy, provenance, and conformance references into the manufacturer's controlled technical file.",
		deliverable:
			"A traceable crypto evidence index mapping claims to tests, artifacts, owners, and unresolved qualification work.",
		validation:
			"The manufacturer owns the quality record, threat model, safety case, submission conclusions, and regulator interaction.",
		sourceIds: ["fda-devices", "nist-ssdf"],
		keywords: [
			"medical device premarket cryptography",
			"FDA cybersecurity technical file",
			"device crypto evidence",
		],
	},
	{
		slug: "clinical-trial-data-signature-longevity",
		title: "Keep clinical-trial signatures verifiable through the study lifecycle",
		sector: "Pharma & life sciences",
		owner: "Clinical Systems · Quality Assurance · Biostatistics",
		decision:
			"Will consent, source-data, analysis, and submission signatures remain attributable and verifiable years after systems change?",
		pain: "Long-running trials cross vendors, countries, and platform migrations, while signature evidence can become inseparable from retired identity and timestamp services.",
		trigger:
			"A decentralized trial, e-signature platform replacement, or long-term archive design.",
		qnsiAction:
			"Inventory signature algorithms, signer identities, certificate chains, timestamps, and archive dependencies in QNSI.",
		deliverable:
			"A trial-signature longevity register with revalidation checkpoints and evidence-preservation actions.",
		validation:
			"Quality and regulatory teams confirm electronic-record requirements, identity proofing, timestamp trust, retention, and admissibility.",
		sourceIds: ["nist-key-management", "nist-identity"],
		keywords: [
			"clinical trial signature longevity",
			"pharma PQC records",
			"eclinical signature migration",
		],
	},
	{
		slug: "laboratory-instrument-machine-identity",
		title: "Give laboratory instruments distinct, rotatable machine identities",
		sector: "Pharma & life sciences",
		owner: "Laboratory IT · Quality Control · OT Security",
		decision:
			"Can each instrument authenticate without shared credentials that outlive ownership or calibration status?",
		pain: "Legacy analyzers and lab middleware commonly share certificates or service passwords, making attribution and revocation unreliable.",
		trigger: "Lab network segmentation, LIMS replacement, or an integrity investigation.",
		qnsiAction:
			"Register instrument certificates, keys, owners, methods, and rotation constraints in QNSI policy and inventory.",
		deliverable:
			"An instrument identity ledger linking cryptographic identity to asset, calibration, software, and responsible laboratory.",
		validation:
			"The lab validates instrument support, method impact, time synchronization, revocation, and regulated change control.",
		sourceIds: ["nist-zero-trust", "nist-key-management"],
		keywords: [
			"laboratory instrument identity",
			"LIMS certificate rotation",
			"pharma OT cryptography",
		],
	},
	{
		slug: "pharma-research-ip-quantum-risk",
		title: "Prioritize harvest-now-decrypt-later risk in drug-discovery data",
		sector: "Pharma & life sciences",
		owner: "Research CISO · Intellectual Property Counsel · Data Platform",
		decision:
			"Which target, compound, genomic, and partnership datasets retain economic value past current encryption assumptions?",
		pain: "Research repositories are classified by project secrecy but rarely by confidentiality horizon and the cryptography protecting transfers, notebooks, backups, and partner exchanges.",
		trigger:
			"A strategic research partnership, data-lake consolidation, or quantum-readiness programme.",
		qnsiAction:
			"Join QNSI crypto discovery with data owners, patent milestones, collaboration paths, and sensitivity duration.",
		deliverable:
			"An R&D quantum-exposure portfolio ranking datasets by value horizon, capture surface, and remediation option.",
		validation:
			"Research and legal owners decide data value, export controls, collaboration constraints, and acceptable re-protection methods.",
		sourceIds: ["cisa-quantum", "nist-ir-8547"],
		keywords: ["pharma quantum risk", "drug discovery encryption", "research IP PQC"],
	},
	{
		slug: "regulated-lab-record-provenance",
		title: "Prove provenance of transformed regulated laboratory records",
		sector: "Pharma & life sciences",
		owner: "Quality Systems · Data Integrity · Validation Lead",
		decision:
			"Can an inspector follow a result from instrument output through parsing, normalization, review, and final report?",
		pain: "Middleware transformations can alter format or metadata without a durable cryptographic link to the raw record and approved software version.",
		trigger:
			"A data-integrity observation, laboratory automation project, or vendor middleware upgrade.",
		qnsiAction:
			"Use QNSI-supported signatures and inventory identifiers to bind raw files, transformations, service versions, and approvals.",
		deliverable:
			"A laboratory provenance chain showing hashes, transformations, signers, software identity, and review status.",
		validation:
			"The regulated organization validates system behavior, audit-trail completeness, record retention, and procedural controls.",
		sourceIds: ["nist-ssdf", "nist-key-management"],
		keywords: [
			"laboratory data provenance",
			"regulated record integrity",
			"pharma audit trail signing",
		],
	},
	{
		slug: "government-piv-dual-stack-migration",
		title: "Pilot a dual-stack post-quantum PIV migration",
		sector: "Government",
		owner: "Agency CIO · Identity Programme · PKI Authority",
		decision:
			"How can new credentials and services be tested without locking out users or breaking relying applications?",
		pain: "PIV authentication, signing, encryption, middleware, readers, and relying systems evolve on different procurement and accreditation schedules.",
		trigger:
			"PIV refresh planning, new federal guidance, or a major identity-platform replacement.",
		qnsiAction:
			"Use QNSI inventory and policy to identify credential use, relying-party compatibility, algorithm cohorts, and exception lifetimes.",
		deliverable:
			"A PIV dual-stack pilot plan with relying-party matrix, test identities, rollback, and retirement gates.",
		validation:
			"The agency and accredited assessors approve profile conformance, issuance, middleware, accessibility, and authorization impacts.",
		sourceIds: ["nist-identity", "nist-ir-8547"],
		keywords: [
			"PIV post quantum migration",
			"government identity PQC",
			"dual stack credential pilot",
		],
	},
	{
		slug: "government-procurement-cryptographic-bom",
		title: "Require a cryptographic bill of materials in government procurement",
		sector: "Government",
		owner: "Procurement · Agency Security · System Owner",
		decision:
			"Does a proposed product expose enough algorithm, library, certificate, and key-custody detail to plan future transition?",
		pain: "Security questionnaires produce broad assurances while opaque dependencies and fixed cryptographic choices appear only after award.",
		trigger: "A major software, cloud, device, or managed-service solicitation.",
		qnsiAction:
			"Define QNSI-compatible CBOM fields and evidence status for bidders, then normalize accepted product records into the agency inventory.",
		deliverable:
			"A scored procurement schedule covering crypto components, ownership, agility, conformance, support dates, and qualification gaps.",
		validation:
			"The agency verifies supplier evidence, contract remedies, update commitments, accessibility, and mission-specific requirements.",
		sourceIds: ["nist-csrm", "cisa-quantum"],
		keywords: [
			"government cryptographic bill of materials",
			"CBOM procurement",
			"PQC acquisition requirements",
		],
	},
	{
		slug: "government-citizen-record-confidentiality",
		title: "Protect citizen records with confidentiality horizons longer than system life",
		sector: "Government",
		owner: "Chief Data Officer · Privacy · Records Management",
		decision:
			"Which identity, tax, health, benefits, and justice records need protection beyond the next platform replacement?",
		pain: "Government modernization moves data repeatedly while retention, public-record, archive, and privacy duties make simple deletion impossible.",
		trigger: "Cloud migration, records consolidation, or quantum-risk assessment.",
		qnsiAction:
			"Map QNSI-observed cryptography to record series, retention, transfer paths, owners, and future re-protection decisions.",
		deliverable:
			"A citizen-record confidentiality horizon map with priority transfers, archives, and accountable exceptions.",
		validation:
			"Records, privacy, and legal authorities decide classification, disclosure, retention, sovereign location, and acceptable encryption.",
		sourceIds: ["irs-1075", "cisa-quantum"],
		keywords: ["government records quantum risk", "citizen data encryption", "public sector PQC"],
	},
	{
		slug: "interagency-api-trust-transition",
		title: "Transition cryptographic trust across an interagency API",
		sector: "Government",
		owner: "API Platform · Mission Owner · Security Authorization",
		decision:
			"Which agency owns issuer trust, version negotiation, revocation, and failure response when algorithms change?",
		pain: "An API can be technically upgraded yet remain unusable because partner agencies depend on different certificate authorities, gateways, release cycles, and authorization packages.",
		trigger:
			"A shared service launch, certificate-authority change, or deprecation of a public-key algorithm.",
		qnsiAction:
			"Record trust anchors, service identities, algorithms, owners, test evidence, and transition states through QNSI.",
		deliverable:
			"An interagency trust contract with compatibility evidence, failure ownership, sunset dates, and signed acceptance.",
		validation:
			"Every participating authority tests its endpoint and approves security, privacy, operational, and records impacts.",
		sourceIds: ["nist-zero-trust", "nist-key-management"],
		keywords: [
			"interagency API trust",
			"government certificate migration",
			"public sector crypto agility",
		],
	},
	{
		slug: "defense-cnsa-system-inventory",
		title: "Scope a CNSA 2.0 transition for a national-security system",
		sector: "Defense & national security",
		owner: "Authorizing Official · ISSM · Cryptographic Modernization",
		decision:
			"Which mission components, interfaces, and data lifetimes fall inside the transition boundary?",
		pain: "A system-level algorithm list misses embedded cryptography in tactical links, identity, management planes, vendor appliances, and disconnected enclaves.",
		trigger: "A mandated CNSA transition milestone, system recertification, or capability upgrade.",
		qnsiAction:
			"Use QNSI inventory structure to catalogue algorithms, keys, protocols, ownership, mission impact, and unavailable evidence.",
		deliverable:
			"A system-specific CNSA transition inventory with mission dependencies, waivers, and acquisition actions.",
		validation:
			"The responsible national-security authority determines applicability, approved products, classified evidence, and authorization.",
		sourceIds: ["nsa-cnsa", "cisa-quantum"],
		keywords: [
			"CNSA 2.0 inventory",
			"national security system PQC",
			"defense cryptographic modernization",
		],
	},
	{
		slug: "defense-coalition-crypto-interoperability",
		title: "Test post-quantum interoperability for a coalition mission network",
		sector: "Defense & national security",
		owner: "Mission Network Architect · Coalition Interoperability · Crypto Custodian",
		decision:
			"Can partners negotiate approved protection without exposing the mission to silent downgrade or incompatible credentials?",
		pain: "Coalition networks combine sovereign PKIs, releasability rules, legacy radios, gateways, and nationally approved products.",
		trigger: "A multinational exercise, new mission partner, or cross-domain gateway refresh.",
		qnsiAction:
			"Use QNSI conformance references and policy tiers to document tested algorithm combinations, trust anchors, exceptions, and downgrade behavior.",
		deliverable:
			"A coalition interoperability evidence matrix tied to endpoints, national constraints, packet captures, and exercise results.",
		validation:
			"Each national authority approves its cryptographic products, keying, classification, interoperability, and operational risk.",
		sourceIds: ["nsa-cnsa", "nist-pqc"],
		keywords: [
			"coalition PQC interoperability",
			"defense hybrid cryptography",
			"mission network crypto",
		],
	},
	{
		slug: "defense-software-release-signing",
		title: "Modernize signing for defense software delivered into disconnected enclaves",
		sector: "Defense & national security",
		owner: "DevSecOps · Release Authority · Configuration Management",
		decision:
			"How will an offline enclave verify the release, signer authority, dependency evidence, and revocation state?",
		pain: "Air-gapped delivery removes online validation while long-lived trust stores and removable media amplify the consequences of a compromised build signer.",
		trigger:
			"Software-factory accreditation, signing-key rotation, or adoption of post-quantum release signatures.",
		qnsiAction:
			"Bind QNSI-supported signature evidence to release manifests, build provenance, signer generation, and offline trust bundles.",
		deliverable:
			"An enclave-verifiable release packet containing artifact digests, signer chain, SBOM reference, revocation snapshot, and expiry.",
		validation:
			"The programme validates build isolation, media handling, approved algorithms, key ceremony, offline verification, and rollback.",
		sourceIds: ["nist-ssdf", "nsa-cnsa"],
		keywords: ["air gapped software signing", "defense release provenance", "PQC code signing"],
	},
	{
		slug: "defense-supplier-crypto-attestation",
		title: "Challenge a defense supplier's cryptographic assurance claims",
		sector: "Defense & national security",
		owner: "Supply Chain Risk · Programme Protection · Contracting",
		decision:
			"Which supplier claims are independently evidenced, configuration-specific, inherited, or still unqualified?",
		pain: "Statements such as quantum-safe or FIPS validated can blur the product, module, firmware, operation, certificate owner, and deployed configuration.",
		trigger: "Source selection, critical-design review, or a supplier cryptographic change notice.",
		qnsiAction:
			"Use QNSI-style evidence boundaries to capture the exact claim, source, scope, configuration, test, and unresolved dependency.",
		deliverable:
			"A claim-by-claim supplier assurance ledger with acceptance status and contract follow-up.",
		validation:
			"The government verifies certificates, approved-product status, lab evidence, provenance, ownership, and classified applicability.",
		sourceIds: ["nist-csrm", "nsa-cnsa"],
		keywords: [
			"defense supplier cryptography",
			"FIPS claim verification",
			"PQC supply chain evidence",
		],
	},
	{
		slug: "cloud-tenant-kms-separation",
		title: "Prove tenant separation in a multi-tenant cloud key service",
		sector: "Cloud & data centres",
		owner: "Cloud Platform · Security Architecture · SaaS Assurance",
		decision:
			"Can an operator, software defect, or compromised tenant cross the intended cryptographic boundary?",
		pain: "Per-tenant key labels do not prove separate authorization, wrapping hierarchy, audit visibility, backup, and deletion behavior.",
		trigger:
			"Enterprise onboarding, shared-service redesign, or a customer asks for customer-managed custody.",
		qnsiAction:
			"Use QNSI key and policy records to identify tenant ownership, provider boundary, operations, access roles, and lifecycle evidence.",
		deliverable:
			"A tenant-custody assurance map with tested isolation cases, privileged paths, and residual shared dependencies.",
		validation:
			"The provider must perform adversarial authorization tests, recovery tests, deletion verification, and independent architecture review.",
		sourceIds: ["nist-zero-trust", "nist-key-management"],
		keywords: ["multi tenant KMS isolation", "cloud key separation", "SaaS cryptographic tenancy"],
	},
	{
		slug: "service-mesh-certificate-agility",
		title: "Make service-mesh certificate rotation measurable before PQC change",
		sector: "Cloud & data centres",
		owner: "Platform SRE · Service Mesh · PKI",
		decision:
			"Can every workload receive, activate, validate, and retire new trust without hidden static certificates?",
		pain: "Automated issuance creates a false sense of agility when sidecars, batch jobs, appliances, bootstrap credentials, and offline workers escape normal rotation.",
		trigger:
			"Mesh migration, CA replacement, certificate outage, or post-quantum transport experiment.",
		qnsiAction:
			"Inventory workload identities, issuers, algorithms, TTLs, exceptions, and last-observed rotation in QNSI.",
		deliverable:
			"A mesh crypto-agility scorecard with stale identity owners, rotation SLOs, and blocked migration cohorts.",
		validation:
			"Platform teams test live rotation, failure modes, time skew, control-plane outage, and cryptographic negotiation.",
		sourceIds: ["nist-zero-trust", "nist-ir-8547"],
		keywords: ["service mesh certificate rotation", "workload identity PQC", "mesh crypto agility"],
	},
	{
		slug: "data-centre-certificate-expiry-response",
		title: "Prevent a data-centre certificate expiry from becoming a regional outage",
		sector: "Cloud & data centres",
		owner: "Data Centre Operations · Network Engineering · Incident Management",
		decision:
			"Which internal and external services depend on the expiring chain, and can replacement be rolled back safely?",
		pain: "Load balancers, BMCs, storage fabrics, monitoring, and partner links may use different stores and renewal tooling, leaving expiry exposure invisible until failure.",
		trigger: "A certificate enters its change window or the issuing CA announces a trust change.",
		qnsiAction:
			"Track certificate ownership, chain, endpoint, environment, renewal path, and dependent services in QNSI inventory.",
		deliverable:
			"A region-specific expiry action plan with dependency blast radius, test sequence, and verified retirement.",
		validation:
			"Operators test every endpoint, client trust store, failover region, monitoring alarm, and emergency reissue procedure.",
		sourceIds: ["nist-key-management", "sg-cybersecurity-act"],
		keywords: [
			"data center certificate expiry",
			"regional outage PKI",
			"certificate dependency inventory",
		],
	},
	{
		slug: "singapore-fdi-incident-evidence",
		title: "Prepare incident evidence for a Singapore foundational digital infrastructure operator",
		sector: "Cloud & data centres",
		owner: "Security Operations · Regulatory Affairs · Data Centre Management",
		decision:
			"Can the operator rapidly identify affected cryptographic services, supplied functions, customers, and containment actions?",
		pain: "A control-plane or key-service incident can affect many tenants, while evidence is fragmented across infrastructure, managed-service, and customer teams.",
		trigger:
			"A reportable incident, suspected key compromise, or regulator exercise under Singapore's amended Cybersecurity Act.",
		qnsiAction:
			"Export QNSI crypto asset ownership, key state, control mapping, and audit references into the operator's incident workflow.",
		deliverable:
			"A time-stamped regulatory evidence appendix distinguishing confirmed impact, inherited dependencies, and open investigation.",
		validation:
			"The designated operator and counsel determine reporting scope, timing, classification, customer notice, and regulator communication.",
		sourceIds: ["sg-cybersecurity-act", "sg-incident-forms"],
		keywords: [
			"Singapore FDI cyber incident",
			"data centre regulatory evidence",
			"cloud key compromise report",
		],
	},
	{
		slug: "cra-product-technical-file-cryptography",
		title: "Create the cryptography evidence index for a CRA product technical file",
		sector: "Software & SaaS",
		owner: "Product Security · Engineering · EU Compliance",
		decision:
			"Can every material cryptographic design claim be traced to implementation, test evidence, lifecycle support, and residual risk?",
		pain: "Product files become narrative collections that omit embedded libraries, default settings, signing infrastructure, vulnerability handling, and unsupported deployment assumptions.",
		trigger: "EU market entry, a substantial product modification, or CRA readiness review.",
		qnsiAction:
			"Export scoped QNSI inventory, algorithm policy, provenance, control mappings, and conformance links as an indexed evidence input.",
		deliverable:
			"A CRA cryptography annex mapping product components and claims to evidence owners, versions, tests, and open gaps.",
		validation:
			"The manufacturer and counsel determine product scope, conformity route, essential requirements, support period, and declaration content.",
		sourceIds: ["cra-summary", "nist-ssdf"],
		keywords: [
			"CRA technical file cryptography",
			"EU product cyber evidence",
			"software PQC documentation",
		],
	},
	{
		slug: "cra-vulnerability-reporting-workflow",
		title: "Connect a product cryptography incident to the CRA reporting clock",
		sector: "Software & SaaS",
		owner: "PSIRT · Legal · Product Operations",
		decision:
			"Does an exploited vulnerability or severe incident meet reporting criteria, and what is known at each deadline?",
		pain: "Engineering severity, active exploitation, affected versions, signing-key exposure, and customer impact evolve faster than manual reporting documents.",
		trigger:
			"Confirmed exploitation, compromised release infrastructure, or a severe product incident.",
		qnsiAction:
			"Link QNSI asset, algorithm, key, version, and audit evidence to early-warning, notification, and final-report checkpoints.",
		deliverable:
			"A CRA reporting packet with version scope, cryptographic impact, mitigation chronology, confidence, and unresolved facts.",
		validation:
			"The manufacturer and counsel decide reportability, recipients, deadlines, confidentiality, and corrective action.",
		sourceIds: ["cra-reporting", "cra-summary"],
		keywords: [
			"CRA vulnerability reporting",
			"EU product incident workflow",
			"signing key compromise CRA",
		],
	},
	{
		slug: "saas-release-signing-provenance",
		title: "Give SaaS customers verifiable release-signing provenance",
		sector: "Software & SaaS",
		owner: "Release Engineering · Product Security · Customer Trust",
		decision:
			"Can a customer verify which build produced an artifact and which authorized identity approved it?",
		pain: "A valid package signature alone does not expose source revision, dependency set, build worker, approval, or whether the key was used outside policy.",
		trigger:
			"Enterprise procurement, software-supply-chain review, or migration to post-quantum signatures.",
		qnsiAction:
			"Bind QNSI-supported signature metadata to artifact digests, build provenance, key generation, and release approval.",
		deliverable:
			"A customer-verifiable release manifest with artifact, source, builder, signer, algorithm, and evidence links.",
		validation:
			"The vendor validates build isolation, source controls, dependency integrity, key custody, transparency, and verification tooling.",
		sourceIds: ["nist-ssdf", "cisa-product-security"],
		keywords: ["SaaS release signing", "software provenance PQC", "customer verifiable build"],
	},
	{
		slug: "saas-dependency-crypto-inventory",
		title: "Find hidden cryptography in a SaaS dependency graph",
		sector: "Software & SaaS",
		owner: "Application Security · Platform Engineering · Architecture",
		decision:
			"Which libraries, runtimes, services, and managed dependencies will block a cryptographic transition?",
		pain: "SBOM package names do not reliably reveal certificates, protocol defaults, bundled providers, transitive crypto libraries, or runtime configuration.",
		trigger:
			"PQC roadmap, framework upgrade, merger integration, or a vulnerable cryptographic dependency.",
		qnsiAction:
			"Combine QNSI cryptographic discovery with software component and runtime ownership records to identify actual use and uncertainty.",
		deliverable:
			"A dependency-level crypto migration backlog with observed use, package origin, upgrade path, and false-positive status.",
		validation:
			"Engineering reproduces findings, tests upgraded dependencies, checks licensing, and verifies production negotiation and behavior.",
		sourceIds: ["nist-ssdf", "cisa-quantum"],
		keywords: [
			"SaaS cryptographic dependency inventory",
			"SBOM crypto discovery",
			"PQC software migration",
		],
	},
	{
		slug: "telecom-5g-network-function-pki",
		title: "Inventory PKI dependencies across 5G network functions",
		sector: "Telecommunications",
		owner: "Mobile Core Security · Network Architecture · PKI",
		decision:
			"Which network functions, vendors, and interfaces depend on shared trust anchors or non-agile certificate profiles?",
		pain: "Cloud-native 5G adds workload identities while legacy operations, roaming, vendor appliances, and management systems retain separate PKI paths.",
		trigger:
			"Standalone core rollout, vendor swap, certificate incident, or quantum-readiness assessment.",
		qnsiAction:
			"Use QNSI to map certificate issuers, algorithms, endpoints, vendors, management domains, and rotation ownership.",
		deliverable:
			"A 5G trust-domain map highlighting shared roots, stranded functions, and testable migration cohorts.",
		validation:
			"The operator validates 3GPP profiles, vendor support, roaming interoperability, performance, and lawful operational requirements.",
		sourceIds: ["nist-zero-trust", "fcc-cpni"],
		keywords: ["5G PKI inventory", "telecom certificate migration", "network function PQC"],
	},
	{
		slug: "telecom-esim-provisioning-signatures",
		title: "Plan long-lived signature agility for eSIM provisioning",
		sector: "Telecommunications",
		owner: "eSIM Platform · Device Certification · Roaming Security",
		decision:
			"How will profile-signing and trust anchors evolve across devices that remain deployed for a decade?",
		pain: "Device hardware, eUICC certification, subscription managers, OEM releases, and operator trust stores cannot be upgraded on one timetable.",
		trigger: "New IoT fleet, signature deprecation, or eSIM platform replacement.",
		qnsiAction:
			"Track signing profiles, certificate chains, device cohorts, algorithm support, and retirement dates in QNSI policy records.",
		deliverable:
			"An eSIM trust-evolution plan with cohort compatibility, overlap periods, issuer rollover, and stranded-device treatment.",
		validation:
			"Operators, OEMs, and accredited labs validate specifications, profiles, hardware, certification, and remote recovery.",
		sourceIds: ["nist-key-management", "sg-iot"],
		keywords: ["eSIM signature agility", "telecom provisioning PKI", "IoT SIM post quantum"],
	},
	{
		slug: "telecom-cpni-archive-quantum-risk",
		title: "Reduce long-term quantum exposure in telecom subscriber records",
		sector: "Telecommunications",
		owner: "Privacy · Data Governance · Telecom CISO",
		decision:
			"Which call-detail, location, account, and network records remain sensitive long enough to justify early re-protection?",
		pain: "Subscriber datasets are replicated through billing, analytics, fraud, lawful process, and backup platforms with inconsistent crypto ownership.",
		trigger:
			"CPNI review, data-platform migration, retention redesign, or quantum-readiness programme.",
		qnsiAction:
			"Join QNSI cryptographic inventory to subscriber-data flows, retention periods, access domains, and export paths.",
		deliverable:
			"A CPNI quantum-exposure map ranking record stores and transfers by lifetime, capture risk, and migration effort.",
		validation:
			"The carrier confirms legal retention, disclosure, minimization, encryption, deletion, and jurisdiction-specific obligations.",
		sourceIds: ["fcc-cpni", "cisa-quantum"],
		keywords: ["CPNI quantum risk", "telecom subscriber encryption", "call detail record PQC"],
	},
	{
		slug: "telecom-network-software-signing",
		title: "Verify network-function software before carrier rollout",
		sector: "Telecommunications",
		owner: "Network Cloud · Vendor Assurance · Change Authority",
		decision:
			"Does the candidate image originate from the approved vendor build and match the tested configuration?",
		pain: "Images pass through vendor portals, integrators, registries, and staging systems where a checksum copied beside the file is weak provenance.",
		trigger:
			"Core upgrade, emergency vendor patch, or introduction of disaggregated network software.",
		qnsiAction:
			"Attach QNSI-supported signatures and provenance metadata to image digest, vendor identity, SBOM, validation run, and rollout approval.",
		deliverable:
			"A deployment admission record proving the image, signer, evidence set, test status, and authorized target.",
		validation:
			"The carrier verifies vendor keys, secure boot, registry controls, compatibility, rollback, and network acceptance tests.",
		sourceIds: ["nist-ssdf", "nist-csrm"],
		keywords: [
			"telecom software signing",
			"network function provenance",
			"carrier image verification",
		],
	},
	{
		slug: "grid-control-centre-crypto-inventory",
		title: "Map cryptography between grid control centres and substations",
		sector: "Energy & electric grid",
		owner: "OT Security · Transmission Operations · CIP Compliance",
		decision:
			"Which operational links and devices can migrate, and which must be isolated until replacement?",
		pain: "Control networks mix modern IP links, serial gateways, vendor tunnels, engineering access, and devices with decades-long service life.",
		trigger:
			"NERC CIP assessment, control-centre refresh, or post-quantum infrastructure programme.",
		qnsiAction:
			"Record algorithms, certificates, keys, vendors, physical locations, owners, criticality, and observed evidence in QNSI.",
		deliverable:
			"A control-path cryptographic asset register with replacement cohorts and documented compensating controls.",
		validation:
			"The utility tests protection-system timing, vendor support, safety, recovery, approved change windows, and CIP applicability.",
		sourceIds: ["nerc-cip", "cisa-quantum"],
		keywords: ["electric grid cryptographic inventory", "substation PQC", "NERC CIP cryptography"],
	},
	{
		slug: "substation-device-certificate-rollover",
		title: "Rotate substation device certificates inside narrow outage windows",
		sector: "Energy & electric grid",
		owner: "Substation Engineering · PKI · Field Operations",
		decision:
			"Can relay, gateway, and engineering trust change without creating a protection or visibility gap?",
		pain: "Remote assets may require truck rolls, vendor tools, synchronized trust updates, and rollback under strict operational switching plans.",
		trigger:
			"Certificate expiry, CA migration, merger of utility trust domains, or compromise response.",
		qnsiAction:
			"Use QNSI lifecycle records to group assets by issuer, mechanism, access path, outage window, and rollback readiness.",
		deliverable:
			"A substation rollover schedule with field package, trust overlap, pretest, abort criteria, and post-change proof.",
		validation:
			"Grid operations validates relay behavior, remote access, fail-safe state, communications, and restoration procedure.",
		sourceIds: ["nerc-cip", "nist-key-management"],
		keywords: ["substation certificate rotation", "utility PKI rollover", "relay trust migration"],
	},
	{
		slug: "grid-blackstart-key-recovery",
		title: "Test cryptographic key recovery during a grid blackstart scenario",
		sector: "Energy & electric grid",
		owner: "Business Continuity · Control Systems · Key Custodians",
		decision:
			"Can essential operators and systems recover credentials when normal identity, network, and key services are unavailable?",
		pain: "Recovery plans often assume reachable cloud KMS, synchronized directories, healthy certificate authorities, and staff who may be inaccessible.",
		trigger: "Blackstart exercise, regional disaster planning, or dependency review.",
		qnsiAction:
			"Use QNSI key ownership and dependency records to design offline recovery sets, authorization roles, expiry, and reconciliation.",
		deliverable:
			"A blackstart crypto-recovery exercise report with dependency failures, recovered services, elapsed decisions, and remediation.",
		validation:
			"The utility proves secure storage, dual control, facility access, restoration sequencing, revocation, and post-event reconciliation.",
		sourceIds: ["nerc-cip", "nist-key-management"],
		keywords: [
			"grid blackstart key recovery",
			"utility disaster cryptography",
			"offline PKI recovery",
		],
	},
	{
		slug: "grid-supplier-remote-access-trust",
		title: "Constrain supplier remote-access trust in electric operations",
		sector: "Energy & electric grid",
		owner: "OT Access Management · Vendor Risk · Operations",
		decision:
			"Which supplier identity can reach which asset, for what task, using which credential and approval?",
		pain: "Emergency vendor accounts and shared support certificates persist across substations and generation sites after the original work ends.",
		trigger: "Supplier onboarding, access recertification, merger, or remote-access incident.",
		qnsiAction:
			"Inventory supplier cryptographic identities, endpoints, issuers, validity, owner, and authorized service window in QNSI.",
		deliverable:
			"A vendor trust ledger exposing shared credentials, expired work orders, overbroad reach, and revocation evidence.",
		validation:
			"The operator tests enforcement at jump hosts and endpoints, session monitoring, emergency approval, and contract controls.",
		sourceIds: ["nerc-cip", "nist-zero-trust"],
		keywords: [
			"utility vendor remote access",
			"OT supplier certificates",
			"NERC CIP third party access",
		],
	},
	{
		slug: "pipeline-remote-access-cryptography",
		title: "Inventory cryptographic trust in pipeline remote access",
		sector: "Oil, gas & pipelines",
		owner: "Pipeline Cybersecurity · Control Room · Field Engineering",
		decision:
			"Which human and machine credentials can cross from enterprise access paths into operational pipeline systems?",
		pain: "Vendor VPNs, cellular gateways, jump servers, and emergency accounts accumulate different certificates and shared secrets that outlast projects and personnel.",
		trigger: "TSA assessment, remote-access redesign, acquisition, or suspected credential misuse.",
		qnsiAction:
			"Map remote-access certificates, algorithms, issuers, endpoints, owners, and rotation status in QNSI.",
		deliverable:
			"A pipeline trust-path register linking every credential to a user or service, approved asset, purpose, and expiry.",
		validation:
			"The operator tests network enforcement, session control, emergency access, field connectivity, safety, and directive applicability.",
		sourceIds: ["tsa-pipeline", "nist-zero-trust"],
		keywords: [
			"pipeline remote access security",
			"OT credential inventory",
			"TSA pipeline cryptography",
		],
	},
	{
		slug: "pipeline-controller-firmware-signing",
		title: "Verify firmware before it reaches a pipeline controller",
		sector: "Oil, gas & pipelines",
		owner: "OT Engineering · Product Security · Maintenance",
		decision:
			"Can field staff prove that a controller image is authentic, approved, and compatible before installation?",
		pain: "Firmware may travel through vendor portals, laptops, removable media, and staging shares where hashes are copied separately and approval context disappears.",
		trigger:
			"Safety patch, controller refresh, vulnerability response, or introduction of post-quantum signing.",
		qnsiAction:
			"Bind QNSI-supported signature metadata to firmware digest, vendor identity, target model, test record, and maintenance approval.",
		deliverable:
			"A field-verifiable firmware manifest with signer, algorithm, device compatibility, evidence, and rollback image.",
		validation:
			"The operator validates vendor keys, controller behavior, safety logic, media handling, offline verification, and rollback.",
		sourceIds: ["tsa-pipeline", "nist-ssdf"],
		keywords: [
			"pipeline firmware signing",
			"PLC update provenance",
			"OT secure software deployment",
		],
	},
	{
		slug: "oilfield-sensor-identity-lifecycle",
		title: "Control identity over the lifetime of remote oilfield sensors",
		sector: "Oil, gas & pipelines",
		owner: "Field IoT · Production Technology · Asset Integrity",
		decision:
			"How will each sensor authenticate, rotate trust, and be retired when physical access is costly?",
		pain: "Remote sensors can share factory credentials, depend on intermittent links, and remain deployed longer than the certificate or algorithm design.",
		trigger:
			"Large-scale sensor deployment, satellite-network change, or discovery of cloned device credentials.",
		qnsiAction:
			"Track device identity, manufacturing source, key ownership, algorithm support, last contact, and retirement state through QNSI.",
		deliverable:
			"A field-device identity lifecycle ledger with unreachable cohorts, shared roots, and truck-roll priorities.",
		validation:
			"Engineering tests enrollment, offline rotation, anti-cloning, gateway behavior, environmental reliability, and secure disposal.",
		sourceIds: ["sg-iot", "nist-key-management"],
		keywords: ["oilfield sensor identity", "remote IoT key rotation", "energy device certificates"],
	},
	{
		slug: "pipeline-cyber-incident-regulatory-pack",
		title: "Produce a pipeline cyber-incident evidence pack during operations",
		sector: "Oil, gas & pipelines",
		owner: "Incident Commander · Pipeline Operations · Regulatory Affairs",
		decision:
			"Which operational assets and cryptographic controls were affected, and what containment is safe while product continues to move?",
		pain: "Responders must join corporate identity, vendor access, SCADA, field device, and key-management evidence without disrupting safety-critical operations.",
		trigger:
			"Compromised remote account, ransomware, signing-key exposure, or anomalous controller change.",
		qnsiAction:
			"Correlate QNSI crypto ownership, key state, service dependencies, and audit references with operational incident milestones.",
		deliverable:
			"A regulator-facing appendix separating confirmed impact, containment, unavailable telemetry, safety constraints, and follow-up tests.",
		validation:
			"The operator and counsel decide regulatory reporting, operational actions, privilege, public communication, and recovery acceptance.",
		sourceIds: ["tsa-pipeline", "sg-incident-forms"],
		keywords: ["pipeline incident evidence", "OT regulatory reporting", "SCADA key compromise"],
	},
	{
		slug: "water-scada-crypto-baseline",
		title: "Establish a cryptographic baseline for a water SCADA network",
		sector: "Water & wastewater",
		owner: "Utility Manager · SCADA Engineering · Cybersecurity",
		decision:
			"Where does cryptography protect control, telemetry, engineering, and business interfaces-and where is it absent?",
		pain: "Small teams inherit vendor appliances, radio links, remote sites, and unmanaged certificates without a consolidated technical baseline.",
		trigger: "EPA cybersecurity assessment, treatment-plant modernization, or insurer requirement.",
		qnsiAction:
			"Capture protocols, certificates, keys, algorithms, locations, vendors, owners, and confidence levels in QNSI inventory.",
		deliverable:
			"A water-system crypto baseline showing protected paths, plaintext exposure, unsupported assets, and practical first actions.",
		validation:
			"The utility confirms field observations, process-safety effects, vendor support, budgets, and risk-treatment priorities.",
		sourceIds: ["epa-water", "cisa-quantum"],
		keywords: [
			"water SCADA cryptographic inventory",
			"wastewater cyber assessment",
			"utility PQC baseline",
		],
	},
	{
		slug: "water-remote-plc-certificate-rotation",
		title: "Rotate certificates on remote water PLC gateways",
		sector: "Water & wastewater",
		owner: "SCADA Operations · Field Maintenance · PKI",
		decision: "Can trust be replaced across unmanned sites without losing telemetry or control?",
		pain: "Intermittent communications, seasonal access, shared gateway images, and limited staff make certificate expiry a physical operations problem.",
		trigger:
			"Issuer migration, certificate expiry, gateway replacement, or a vendor credential incident.",
		qnsiAction:
			"Group gateway certificates by site access, issuer, firmware, connectivity, redundancy, and rollback readiness in QNSI.",
		deliverable:
			"A site-by-site rotation route with preloaded trust, outage coordination, validation call, and deferred-risk register.",
		validation:
			"Operators test local control, telemetry continuity, alarm delivery, remote recovery, and water-quality safeguards.",
		sourceIds: ["epa-water", "nist-key-management"],
		keywords: ["water PLC certificate rotation", "remote SCADA PKI", "utility gateway trust"],
	},
	{
		slug: "water-disaster-key-recovery",
		title: "Recover treatment-system keys during a flood or facility loss",
		sector: "Water & wastewater",
		owner: "Emergency Management · SCADA · Infrastructure",
		decision:
			"Can an alternate control location authenticate and decrypt essential systems when the primary site is inaccessible?",
		pain: "Backups may exist but depend on the same facility, directory, network, or key service affected by the disaster.",
		trigger: "Flood exercise, resilience grant, new alternate control room, or recovery audit.",
		qnsiAction:
			"Use QNSI dependency and key-ownership records to identify recovery prerequisites, offline material, roles, and expiry.",
		deliverable:
			"A treatment continuity exercise report showing recovered functions, missing dependencies, custody events, and corrective work.",
		validation:
			"The utility proves secure storage, dual authorization, restoration order, process safety, post-recovery rotation, and reconciliation.",
		sourceIds: ["epa-water", "nist-key-management"],
		keywords: [
			"water utility key recovery",
			"SCADA disaster recovery",
			"treatment plant cyber resilience",
		],
	},
	{
		slug: "water-vendor-connection-governance",
		title: "Expire vendor cryptographic access after water-system maintenance",
		sector: "Water & wastewater",
		owner: "Maintenance Manager · Procurement · Cybersecurity",
		decision: "Does each vendor credential terminate when the approved service task ends?",
		pain: "Integrators need rapid support access, but reusable certificates and shared VPN accounts remain active across multiple facilities.",
		trigger:
			"Vendor recertification, support-contract renewal, or discovery of dormant external access.",
		qnsiAction:
			"Register vendor credentials, certificate chains, service scope, approved dates, facility reach, and responsible sponsor in QNSI.",
		deliverable:
			"A maintenance-access ledger with orphaned trust, overbroad facility scope, and revocation confirmation.",
		validation:
			"The utility verifies access-control enforcement, session evidence, break-glass handling, contract clauses, and emergency support.",
		sourceIds: ["epa-water", "nist-zero-trust"],
		keywords: [
			"water vendor access security",
			"SCADA contractor certificates",
			"utility maintenance credentials",
		],
	},
	{
		slug: "factory-machine-identity-segmentation",
		title: "Use machine identity to enforce factory-cell boundaries",
		sector: "Manufacturing",
		owner: "OT Architecture · Plant Engineering · Identity",
		decision:
			"Can a machine authenticate only to the controllers, brokers, and services required for its production role?",
		pain: "Cloned images, shared certificates, and flat broker credentials let one compromised machine impersonate peers or cross production cells.",
		trigger: "Smart-factory rollout, segmentation programme, or line reconfiguration.",
		qnsiAction:
			"Map machine identities, issuers, algorithms, authorized services, line ownership, and rotation constraints in QNSI.",
		deliverable:
			"A cell-level machine trust matrix with shared identities, unauthorized reach, and enrollment remediation.",
		validation:
			"The manufacturer tests enforcement, production timing, fail-safe behavior, maintenance access, and recovery.",
		sourceIds: ["nist-zero-trust", "sg-iot"],
		keywords: [
			"factory machine identity",
			"manufacturing zero trust certificates",
			"OT cell segmentation",
		],
	},
	{
		slug: "factory-robot-firmware-provenance",
		title: "Verify robot firmware and configuration before a line restart",
		sector: "Manufacturing",
		owner: "Automation Engineering · Quality · Plant Cybersecurity",
		decision: "Does the robot image match the approved safety-tested build and cell configuration?",
		pain: "Integrators exchange firmware, parameters, and backups through service laptops and shares that lose signer and approval provenance.",
		trigger: "Robot controller replacement, emergency patch, or production-line recovery.",
		qnsiAction:
			"Sign and inventory artifact digests, target controller, configuration revision, test result, and release authority using QNSI-supported evidence.",
		deliverable:
			"A restart admission bundle linking firmware, parameters, signer, validation, and authorized production cell.",
		validation:
			"Engineering verifies safety functions, calibration, compatibility, vendor authorization, rollback, and quality release.",
		sourceIds: ["nist-ssdf", "nist-csrm"],
		keywords: [
			"robot firmware provenance",
			"factory software signing",
			"industrial controller integrity",
		],
	},
	{
		slug: "digital-twin-data-integrity",
		title: "Protect the integrity of data feeding a manufacturing digital twin",
		sector: "Manufacturing",
		owner: "Industrial Data Platform · Process Engineering · Quality",
		decision:
			"Can planners identify which sensors, transformations, and models produced a decision-driving analytical output?",
		pain: "A digital twin aggregates telemetry and engineering models across vendors; silent substitution can change maintenance or production conclusions.",
		trigger: "Predictive-maintenance rollout, autonomous optimization, or disputed model output.",
		qnsiAction:
			"Use QNSI-supported identities and provenance records to bind sensor batches, transformations, model versions, and approval events.",
		deliverable:
			"A twin-input provenance graph showing signed origins, processing stages, algorithm state, and unverifiable sources.",
		validation:
			"Process owners validate sensor accuracy, model fitness, time alignment, safety limits, and human approval.",
		sourceIds: ["nist-ai-rmf", "nist-key-management"],
		keywords: [
			"digital twin data integrity",
			"manufacturing provenance",
			"signed industrial telemetry",
		],
	},
	{
		slug: "manufacturing-supplier-certificate-risk",
		title: "Find certificate concentration across an OEM supplier network",
		sector: "Manufacturing",
		owner: "Supplier Quality · Product Security · Procurement",
		decision:
			"Which products and factories depend on a supplier root, signing service, or unsupported crypto library?",
		pain: "Component reviews are organized by part number, hiding shared trust infrastructure that can affect many models and plants at once.",
		trigger: "Supplier merger, CA incident, new product platform, or cryptographic transition.",
		qnsiAction:
			"Normalize supplier certificates, firmware signers, algorithms, libraries, products, sites, and evidence status in QNSI.",
		deliverable:
			"A supplier cryptographic concentration map with affected bills of material, substitutes, and contract actions.",
		validation:
			"The OEM verifies supplier evidence, product compatibility, change notification, replacement capacity, and production impact.",
		sourceIds: ["nist-csrm", "cisa-quantum"],
		keywords: [
			"manufacturing supplier PKI",
			"OEM cryptographic concentration",
			"industrial supply chain PQC",
		],
	},
	{
		slug: "automotive-ota-signing-transition",
		title: "Transition vehicle OTA signing across mixed model years",
		sector: "Automotive & mobility",
		owner: "Vehicle Cybersecurity · OTA Platform · Homologation",
		decision:
			"Which vehicles can verify a new signing scheme, and how will older fleets receive trusted updates?",
		pain: "Bootloaders, ECUs, telematics units, regional variants, and dealer tools create incompatible trust paths across a long-lived fleet.",
		trigger:
			"Signing-key rotation, algorithm transition, platform consolidation, or key compromise.",
		qnsiAction:
			"Track vehicle cohorts, ECU trust anchors, signer generations, algorithm support, update paths, and exceptions in QNSI.",
		deliverable:
			"A model-year OTA trust migration plan with dual-signing windows, dealer recovery, and retirement thresholds.",
		validation:
			"The manufacturer tests vehicle safety, update timing, anti-rollback, offline recovery, regulatory approval, and field support.",
		sourceIds: ["nhtsa-auto", "nist-key-management"],
		keywords: ["automotive OTA PQC signing", "vehicle update key rotation", "ECU trust migration"],
	},
	{
		slug: "vehicle-v2x-pki-agility",
		title: "Measure PKI agility for vehicle-to-everything communications",
		sector: "Automotive & mobility",
		owner: "Connected Vehicle Architecture · PKI · Roadside Infrastructure",
		decision:
			"Can vehicles and roadside units adopt new certificate and signature profiles without losing safety-message interoperability?",
		pain: "Vehicle lifetimes, regional trust domains, roadside refresh cycles, privacy certificates, and constrained message timing resist coordinated change.",
		trigger: "V2X deployment, trust-domain federation, or post-quantum feasibility study.",
		qnsiAction:
			"Inventory issuers, certificate profiles, algorithms, device cohorts, message uses, and verification constraints in QNSI.",
		deliverable:
			"A V2X crypto-agility matrix with latency budgets, compatibility cohorts, privacy impacts, and unqualified assumptions.",
		validation:
			"Transport authorities and OEMs test safety performance, spectrum profiles, privacy, interoperability, and certification.",
		sourceIds: ["nhtsa-auto", "nist-pqc"],
		keywords: ["V2X PQC", "connected vehicle PKI", "roadside unit cryptography"],
	},
	{
		slug: "vehicle-diagnostic-access-identity",
		title: "Replace shared vehicle diagnostic credentials with accountable identities",
		sector: "Automotive & mobility",
		owner: "Aftersales Security · Dealer Systems · Vehicle Engineering",
		decision:
			"Which technician, tool, and service action is authorized for a specific vehicle and time window?",
		pain: "Reusable workshop credentials and cloned diagnostic tools weaken attribution and can unlock functions across an entire fleet.",
		trigger: "Dealer-platform upgrade, right-to-repair design, or abuse of diagnostic access.",
		qnsiAction:
			"Register tool and service identities, certificate issuers, privileges, target cohorts, and rotation status in QNSI.",
		deliverable:
			"A diagnostic trust ledger linking technician authorization, tool identity, vehicle scope, action, and expiry.",
		validation:
			"The manufacturer tests offline workshops, emergency repair, privacy, authorization enforcement, revocation, and regulatory access.",
		sourceIds: ["nhtsa-auto", "nist-identity"],
		keywords: [
			"vehicle diagnostic identity",
			"dealer tool certificates",
			"automotive service access",
		],
	},
	{
		slug: "automotive-tier-supplier-crypto-evidence",
		title: "Trace cryptographic evidence through automotive tier suppliers",
		sector: "Automotive & mobility",
		owner: "Product Cybersecurity · Supplier Assurance · Platform Engineering",
		decision:
			"Which supplier component introduces each algorithm, key, certificate, or software signer into the vehicle?",
		pain: "OEM evidence breaks across tier-one modules, tier-two firmware, open-source libraries, and manufacturing provisioning.",
		trigger:
			"Vehicle platform launch, supplier change, vulnerability response, or quantum-transition planning.",
		qnsiAction:
			"Normalize supplier crypto manifests, signing identities, software versions, product placement, and evidence confidence in QNSI.",
		deliverable:
			"A vehicle-platform cryptographic lineage from library and key service through ECU and model variant.",
		validation:
			"The OEM samples supplier evidence, tests components, verifies key ceremonies, and enforces change-notification contracts.",
		sourceIds: ["nhtsa-auto", "nist-csrm"],
		keywords: ["automotive supplier cryptography", "vehicle CBOM", "ECU supply chain evidence"],
	},
	{
		slug: "vessel-shore-communications-crypto-map",
		title: "Map cryptography across vessel-to-shore communications",
		sector: "Maritime & ports",
		owner: "Fleet CISO · Marine Operations · Communications",
		decision:
			"Which satellite, radio, VPN, identity, and application paths protect operational and commercial data?",
		pain: "Ships combine legacy bridge systems, crew networks, satellite providers, port applications, and intermittent connectivity under different owners.",
		trigger:
			"Safety-management cyber review, fleet connectivity refresh, or post-quantum assessment.",
		qnsiAction:
			"Record algorithms, certificates, endpoints, providers, vessel classes, owners, and evidence freshness in QNSI.",
		deliverable:
			"A vessel-shore cryptographic route map with capture exposure, shared trust, unsupported equipment, and migration cohorts.",
		validation:
			"The operator validates maritime safety, flag and port requirements, bandwidth, failover, vendor support, and onboard procedures.",
		sourceIds: ["imo-maritime", "cisa-quantum"],
		keywords: ["maritime cryptographic inventory", "vessel shore PQC", "ship satellite encryption"],
	},
	{
		slug: "ship-navigation-update-signing",
		title: "Verify navigation-data updates before bridge installation",
		sector: "Maritime & ports",
		owner: "Marine Assurance · Navigation Systems · Fleet IT",
		decision:
			"Can bridge staff prove the update source, content, approval, and target system while offline?",
		pain: "Charts and navigation updates travel through portals, agents, removable media, and shipboard systems where provenance can be separated from the file.",
		trigger:
			"Scheduled chart update, vendor certificate change, or navigation-data integrity alert.",
		qnsiAction:
			"Bind QNSI-supported signature metadata to update digest, publisher identity, vessel entitlement, validity, and bridge acceptance.",
		deliverable:
			"An offline-verifiable navigation update manifest with signer chain, expiry, target version, and installation record.",
		validation:
			"The operator confirms authorized publishers, equipment compatibility, navigation safety, media control, and fallback.",
		sourceIds: ["imo-maritime", "nist-key-management"],
		keywords: [
			"ECDIS update signing",
			"maritime navigation integrity",
			"ship offline software verification",
		],
	},
	{
		slug: "port-ot-machine-identity",
		title: "Assign rotatable identities to port cranes and gate systems",
		sector: "Maritime & ports",
		owner: "Port OT · Terminal Operations · Automation",
		decision:
			"Can each crane, gate, scanner, and control service be authenticated without shared terminal credentials?",
		pain: "Expansion projects and multiple equipment vendors leave shared certificates and service accounts across safety and cargo systems.",
		trigger: "Terminal automation, network segmentation, or vendor-access incident.",
		qnsiAction:
			"Inventory machine identities, issuers, keys, algorithms, terminal zones, vendor ownership, and rotation constraints in QNSI.",
		deliverable:
			"A port machine-trust register exposing cloned identities, cross-zone reach, and renewal dependencies.",
		validation:
			"The terminal tests operational timing, safety interlocks, failover, vendor support, revocation, and manual fallback.",
		sourceIds: ["imo-maritime", "nist-zero-trust"],
		keywords: ["port OT machine identity", "crane certificates", "terminal zero trust"],
	},
	{
		slug: "cargo-document-signature-provenance",
		title: "Preserve signature provenance for electronic cargo documents",
		sector: "Maritime & ports",
		owner: "Trade Digitization · Legal · Port Community Systems",
		decision:
			"Can parties prove who issued, endorsed, transformed, and presented each cargo record?",
		pain: "Bills, manifests, releases, and customs messages pass through carriers, banks, ports, agents, and platforms with different identity and archive systems.",
		trigger:
			"Electronic bill rollout, cross-platform interoperability, dispute, or signing-algorithm transition.",
		qnsiAction:
			"Capture QNSI-compatible signer identity, algorithm, document digest, endorsement sequence, and verification evidence.",
		deliverable:
			"A cargo-document provenance envelope with chain order, system handoffs, signature state, and unresolved identity gaps.",
		validation:
			"Trading parties and counsel determine legal recognition, authority, timestamping, title transfer, jurisdiction, and archive rules.",
		sourceIds: ["imo-maritime", "nist-identity"],
		keywords: [
			"electronic bill signature",
			"cargo document provenance",
			"maritime trade cryptography",
		],
	},
	{
		slug: "aircraft-software-signing-chain",
		title: "Verify the signing chain for aircraft-loadable software",
		sector: "Aviation",
		owner: "Airworthiness · Aircraft Cybersecurity · Configuration Control",
		decision:
			"Does each loadable part originate from an approved configuration and authorized release identity?",
		pain: "Aircraft software crosses design organizations, suppliers, maintenance systems, portable loaders, and tail-specific configuration control.",
		trigger:
			"Fleet software update, supplier-key change, cybersecurity finding, or algorithm-transition study.",
		qnsiAction:
			"Use QNSI-supported signatures and inventory records to connect artifact, part number, source, signer, algorithm, approval, and aircraft applicability.",
		deliverable:
			"An aircraft-loadable provenance dossier with configuration effectivity, verification steps, and custody history.",
		validation:
			"Approved organizations validate airworthiness, safety assessment, certification basis, loader security, and maintenance procedures.",
		sourceIds: ["easa-part-is", "nist-ssdf"],
		keywords: ["aircraft software signing", "loadable software provenance", "aviation PQC"],
	},
	{
		slug: "airport-ot-certificate-inventory",
		title: "Inventory certificates across airport operational technology",
		sector: "Aviation",
		owner: "Airport CISO · Baggage Systems · Airfield Operations",
		decision:
			"Which safety or continuity functions share issuers, expired trust, or unmanaged vendor certificates?",
		pain: "Baggage, bridges, fuel, access, surveillance, airfield lighting, and facilities systems are procured separately but operate as one interconnected airport.",
		trigger: "Part-IS readiness, terminal expansion, or certificate-driven outage.",
		qnsiAction:
			"Map airport OT certificates, algorithms, endpoints, vendors, owners, renewal paths, and operational criticality in QNSI.",
		deliverable:
			"An airport certificate concentration map with common roots, renewal failures, and safety-linked priorities.",
		validation:
			"The airport tests operational continuity, safety interfaces, supplier support, failover, and regulated change.",
		sourceIds: ["easa-part-is", "nist-key-management"],
		keywords: [
			"airport OT certificate inventory",
			"aviation Part-IS cryptography",
			"baggage system PKI",
		],
	},
	{
		slug: "aviation-maintenance-record-integrity",
		title: "Prove integrity of digital aircraft maintenance records",
		sector: "Aviation",
		owner: "Continuing Airworthiness · MRO IT · Quality",
		decision:
			"Can a reviewer establish who created, changed, approved, and transferred each maintenance record?",
		pain: "Records cross airline, MRO, OEM, lessor, and authority systems over the life of an aircraft, outliving platforms and signer credentials.",
		trigger:
			"Paperless maintenance rollout, lease return, records migration, or authenticity dispute.",
		qnsiAction:
			"Bind QNSI-supported signature and provenance metadata to record digests, author identity, approval, transfer, and archive state.",
		deliverable:
			"A maintenance-record lineage showing signer authority, transformations, verification status, and evidence gaps.",
		validation:
			"Airworthiness and legal teams approve electronic-record rules, identity, retention, transfer, and evidentiary acceptance.",
		sourceIds: ["easa-part-is", "nist-identity"],
		keywords: [
			"aircraft maintenance record integrity",
			"MRO digital signatures",
			"aviation records provenance",
		],
	},
	{
		slug: "airline-identity-federation-agility",
		title: "Modernize identity trust across an airline partner ecosystem",
		sector: "Aviation",
		owner: "Identity Architecture · Airport Partnerships · Crew Systems",
		decision:
			"How can crew, ground handlers, alliance partners, and contractors authenticate without permanent overbroad federation?",
		pain: "Operational access spans employers and airports, while shared accounts and long-lived federation keys weaken revocation and attribution.",
		trigger:
			"Identity-provider replacement, new ground handler, alliance integration, or credential incident.",
		qnsiAction:
			"Inventory federation signers, certificate chains, service audiences, algorithms, owners, and rotation evidence in QNSI.",
		deliverable:
			"An airline federation trust map with audience scope, partner dependencies, stale signers, and transition windows.",
		validation:
			"Partners test identity proofing, federation semantics, operational fallback, revocation, privacy, and safety impact.",
		sourceIds: ["easa-part-is", "nist-identity"],
		keywords: [
			"airline identity federation",
			"crew authentication security",
			"aviation partner PKI",
		],
	},
	{
		slug: "rail-signalling-pki-transition",
		title: "Stage a PKI transition for rail signalling support systems",
		sector: "Rail & public transit",
		owner: "Rail Cybersecurity · Signalling Engineering · Safety Assurance",
		decision:
			"Which support, management, and communications components can change trust without affecting safe train movement?",
		pain: "Long-lived signalling estates combine safety-certified equipment, vendor maintenance tools, control centres, and telecom links with limited test windows.",
		trigger:
			"Certificate expiry, signalling renewal, supplier change, or cryptographic modernization.",
		qnsiAction:
			"Group certificates, algorithms, issuers, equipment baselines, safety criticality, and maintenance windows in QNSI.",
		deliverable:
			"A signalling-support trust transition plan with lab evidence, rollout cohorts, rollback, and deferred assets.",
		validation:
			"The operator and safety authority validate scope, fail-safe behavior, certification impact, test coverage, and operational acceptance.",
		sourceIds: ["nist-key-management", "cisa-quantum"],
		keywords: ["rail signalling PKI", "transit certificate migration", "railway PQC"],
	},
	{
		slug: "transit-fare-payment-key-lifecycle",
		title: "Rotate fare-system keys across gates, validators, and mobile wallets",
		sector: "Rail & public transit",
		owner: "Fare Systems · Payments Security · Station Operations",
		decision:
			"Can new keys become active across every channel without rejecting riders or extending old trust indefinitely?",
		pain: "Offline validators, concession devices, account-based systems, bank interfaces, and mobile credentials update at different rates.",
		trigger: "Payment-scheme change, key expiry, new fare medium, or suspected compromise.",
		qnsiAction:
			"Track key generations, device cohorts, activation windows, algorithms, issuers, and last-seen validation in QNSI.",
		deliverable:
			"A fare-key cutover plan with overlap limits, station readiness, offline acceptance, fraud monitoring, and retirement proof.",
		validation:
			"The authority tests payment compliance, passenger impact, revenue protection, offline behavior, settlement, and rollback.",
		sourceIds: ["pci-dss", "nist-key-management"],
		keywords: [
			"transit fare key rotation",
			"ticket validator cryptography",
			"public transport payment security",
		],
	},
	{
		slug: "rail-maintenance-work-order-signing",
		title: "Sign rail maintenance work orders at safety-critical handoffs",
		sector: "Rail & public transit",
		owner: "Asset Management · Maintenance Control · Safety",
		decision:
			"Can the operator prove which technician completed, inspected, and released work on a specific asset?",
		pain: "Mobile, depot, contractor, and enterprise systems can transform work records without preserving signer authority and final release context.",
		trigger:
			"Digital maintenance rollout, contractor expansion, audit finding, or disputed release.",
		qnsiAction:
			"Apply QNSI-supported signature policy to work-order digest, asset, technician identity, inspection, release, and system handoff.",
		deliverable:
			"A maintenance authorization chain with immutable checkpoints, signer roles, timestamps, and verification status.",
		validation:
			"The operator validates identity proofing, competency, offline use, safety rules, record retention, and legal acceptance.",
		sourceIds: ["nist-identity", "nist-key-management"],
		keywords: [
			"rail maintenance digital signature",
			"work order integrity",
			"transit asset provenance",
		],
	},
	{
		slug: "rail-supplier-remote-diagnostics",
		title: "Time-bound supplier remote diagnostics for rolling stock",
		sector: "Rail & public transit",
		owner: "Fleet Engineering · Vendor Management · Security Operations",
		decision:
			"Can a supplier diagnose one fleet subsystem without retaining access to other trains or depots?",
		pain: "Shared vendor certificates and persistent tunnels can outlive faults, contracts, staff, and fleet ownership.",
		trigger: "Remote condition monitoring, new maintenance contract, or third-party access review.",
		qnsiAction:
			"Register supplier identities, target assets, certificates, privileges, approved windows, and sponsor ownership in QNSI.",
		deliverable:
			"A rolling-stock diagnostic access register with scope violations, dormant trust, and revocation evidence.",
		validation:
			"The operator tests endpoint enforcement, session capture, safety boundaries, emergency support, and contract remedies.",
		sourceIds: ["nist-zero-trust", "nist-csrm"],
		keywords: [
			"rail vendor remote access",
			"rolling stock diagnostics security",
			"transit supplier identity",
		],
	},
	{
		slug: "smart-city-device-identity-enrollment",
		title: "Enroll unique identities for a citywide sensor fleet",
		sector: "IoT & smart cities",
		owner: "Smart City Platform · Device Operations · Procurement",
		decision:
			"Can each camera, meter, light, and environmental sensor be traced to an authorized manufacturing and enrollment event?",
		pain: "Mass procurement encourages shared bootstrap credentials and opaque vendor roots that undermine revocation and device attribution.",
		trigger: "New city platform, multi-vendor tender, or discovery of cloned device credentials.",
		qnsiAction:
			"Track device identity, manufacturing source, issuer, algorithm, owner, location, and enrollment evidence in QNSI.",
		deliverable:
			"A municipal device identity ledger with duplicate credentials, unapproved issuers, and enrollment confidence.",
		validation:
			"The city tests factory provisioning, anti-cloning, privacy, physical replacement, revocation, and supplier evidence.",
		sourceIds: ["sg-iot", "nist-csrm"],
		keywords: [
			"smart city device identity",
			"IoT certificate enrollment",
			"municipal sensor security",
		],
	},
	{
		slug: "iot-gateway-secure-communications",
		title: "Prove secure communications from constrained devices through an IoT gateway",
		sector: "IoT & smart cities",
		owner: "IoT Architecture · Network Security · Device Vendor",
		decision:
			"Where does end-to-end protection terminate, and which gateway can see or modify device data?",
		pain: "Marketing describes encrypted devices while protocol translation, broker termination, and cloud ingestion create plaintext or re-signing boundaries.",
		trigger: "IoT platform selection, privacy review, or post-quantum gateway pilot.",
		qnsiAction:
			"Map algorithms, keys, session termination, gateway identities, transformations, and evidence status in QNSI.",
		deliverable:
			"A device-to-cloud cryptographic boundary diagram with plaintext points, trust changes, and test captures.",
		validation:
			"Architects verify protocol negotiation, gateway hardening, device limits, data authenticity, latency, and key storage.",
		sourceIds: ["sg-iot", "nist-zero-trust"],
		keywords: [
			"IoT gateway encryption boundary",
			"device cloud cryptography",
			"smart city secure communications",
		],
	},
	{
		slug: "iot-fleet-ota-key-rollover",
		title: "Rollover OTA signing trust across a fragmented IoT fleet",
		sector: "IoT & smart cities",
		owner: "Device Fleet · Firmware Security · Customer Support",
		decision:
			"Which deployed devices can learn a new signer before the current key or algorithm becomes unsafe?",
		pain: "Dormant devices, reseller inventory, abandoned firmware branches, and intermittent networks turn a simple signing-key rotation into a multi-year fleet problem.",
		trigger: "Key expiry, vendor acquisition, algorithm deprecation, or compromise rehearsal.",
		qnsiAction:
			"Track firmware branches, device cohorts, trusted signer generations, last contact, and recovery options in QNSI.",
		deliverable:
			"An OTA trust rollover dashboard with reachable population, dual-signing period, stranded devices, and support decisions.",
		validation:
			"The manufacturer tests anti-rollback, power loss, offline recovery, secure boot, support obligations, and customer communication.",
		sourceIds: ["sg-iot", "cra-summary"],
		keywords: ["IoT OTA key rollover", "device signing migration", "stranded device security"],
	},
	{
		slug: "iot-support-period-crypto-evidence",
		title: "Align IoT cryptographic support with the promised support period",
		sector: "IoT & smart cities",
		owner: "Product Management · Product Security · EU Compliance",
		decision:
			"Can the manufacturer maintain keys, certificates, libraries, and update trust for the whole declared support period?",
		pain: "A support promise can exceed certificate validity, cloud dependencies, component maintenance, and the device's ability to adopt safer algorithms.",
		trigger: "CRA technical-file preparation, product launch, or support-period revision.",
		qnsiAction:
			"Join QNSI crypto inventory and lifecycle metadata to component support, key plans, update mechanisms, and product variants.",
		deliverable:
			"A support-period crypto schedule exposing expiry cliffs, unsupported dependencies, and funded transition work.",
		validation:
			"The manufacturer and counsel approve support commitments, vulnerability handling, update feasibility, and market obligations.",
		sourceIds: ["cra-summary", "sg-iot"],
		keywords: [
			"IoT CRA support period",
			"device cryptographic lifecycle",
			"connected product compliance",
		],
	},
	{
		slug: "university-student-record-quantum-risk",
		title: "Classify quantum exposure in lifetime student records",
		sector: "Education & research",
		owner: "University CISO · Registrar · Privacy",
		decision:
			"Which transcripts, identity, disability, conduct, and financial records remain sensitive for decades?",
		pain: "Student records persist across SIS migrations, archives, alumni services, and third parties without a joined view of retention and cryptographic protection.",
		trigger: "SIS replacement, archive project, privacy review, or quantum-readiness planning.",
		qnsiAction:
			"Map record lifetimes and owners to QNSI-observed algorithms, certificates, keys, transfers, and unresolved coverage.",
		deliverable:
			"A student-record quantum exposure register ranking stores and interfaces by confidentiality horizon and migration effort.",
		validation:
			"The institution determines education-record scope, lawful access, retention, re-encryption, and acceptable operational impact.",
		sourceIds: ["cisa-quantum", "sg-pdpa"],
		keywords: ["student records PQC", "university quantum risk", "education data encryption"],
	},
	{
		slug: "research-consortium-data-provenance",
		title: "Preserve provenance across a multi-university research consortium",
		sector: "Education & research",
		owner: "Research IT · Principal Investigator · Data Steward",
		decision:
			"Can collaborators prove which institution, instrument, pipeline, and researcher produced each dataset version?",
		pain: "Research data is copied, transformed, and re-hosted across institutions while identity, software, and signature context is lost.",
		trigger:
			"New consortium, reproducibility requirement, IP dispute, or regulated-data collaboration.",
		qnsiAction:
			"Use QNSI-supported signatures and inventory identifiers to bind datasets, instruments, pipelines, institutions, and approvals.",
		deliverable:
			"A consortium provenance manifest showing custody, transformations, signers, software versions, and unverifiable contributions.",
		validation:
			"Partners agree authorship, ethics, data-use, export, retention, identity, and reproducibility rules.",
		sourceIds: ["nist-ssdf", "nist-key-management"],
		keywords: [
			"research data provenance",
			"university consortium signatures",
			"scientific dataset integrity",
		],
	},
	{
		slug: "campus-federated-identity-key-rotation",
		title: "Rotate federation signing keys across campus and research services",
		sector: "Education & research",
		owner: "Identity Management · Library IT · Research Computing",
		decision:
			"Which relying services will reject a new federation signer, and how quickly can stale metadata be corrected?",
		pain: "Departments and external research services cache metadata differently, turning a key rollover into widespread login failure.",
		trigger:
			"Identity-provider migration, scheduled rollover, compromise, or merger of institutions.",
		qnsiAction:
			"Inventory federation keys, relying parties, metadata refresh, audiences, algorithms, owners, and last verification in QNSI.",
		deliverable:
			"A campus federation rollover matrix with test accounts, metadata lag, escalation owners, and retirement proof.",
		validation:
			"The institution tests authentication assurance, accessibility, privacy, emergency login, external partners, and help-desk readiness.",
		sourceIds: ["nist-identity", "nist-key-management"],
		keywords: [
			"university federation key rotation",
			"campus SSO signing",
			"research identity migration",
		],
	},
	{
		slug: "research-instrument-signing-identity",
		title: "Authenticate data from shared scientific instruments",
		sector: "Education & research",
		owner: "Core Facility · Research Integrity · Instrument IT",
		decision:
			"Can a result be attributed to the correct instrument, configuration, operator, and acquisition session?",
		pain: "Shared facilities export files through vendor workstations and removable media that do not preserve trustworthy machine or session identity.",
		trigger:
			"Core-facility automation, contested result, accreditation, or cross-border data exchange.",
		qnsiAction:
			"Associate QNSI-supported machine signatures with instrument asset, calibration state, method, operator session, and file digest.",
		deliverable:
			"An instrument-origin evidence record linking raw data to equipment identity, configuration, and acquisition context.",
		validation:
			"The facility validates calibration, method controls, operator identity, timestamping, vendor software, and research policy.",
		sourceIds: ["nist-identity", "nist-key-management"],
		keywords: [
			"scientific instrument identity",
			"research data signing",
			"laboratory provenance university",
		],
	},
	{
		slug: "law-firm-evidence-signature-longevity",
		title: "Keep signed legal evidence verifiable after algorithms and firms change",
		sector: "Legal & professional services",
		owner: "Litigation Technology · Records Counsel · CISO",
		decision:
			"What must be preserved so a future reviewer can validate signer authority and document integrity?",
		pain: "Matter archives outlive certificate providers, staff, software, and cryptographic algorithms, leaving detached signatures without validation context.",
		trigger: "Long-term archive redesign, e-discovery dispute, merger, or post-quantum planning.",
		qnsiAction:
			"Inventory signature algorithms, chains, timestamps, signer roles, validation material, and archive dependencies in QNSI.",
		deliverable:
			"A legal-signature preservation plan with renewal events, evidence bundles, custody, and revalidation policy.",
		validation:
			"Counsel determines admissibility, privilege, legal signature effect, retention, timestamp authority, and jurisdiction.",
		sourceIds: ["nist-key-management", "nist-identity"],
		keywords: ["legal signature longevity", "law firm PQC", "evidence archive cryptography"],
	},
	{
		slug: "law-firm-client-archive-hndl",
		title: "Prioritize harvest-now-decrypt-later exposure in client archives",
		sector: "Legal & professional services",
		owner: "Law Firm CISO · General Counsel · Records",
		decision:
			"Which privileged matters retain strategic, personal, or commercial sensitivity beyond current public-key protection?",
		pain: "Client files move through email, deal rooms, backup, discovery, and archives while matter classification is disconnected from transport and key inventories.",
		trigger: "Client security demand, archive migration, or quantum-readiness programme.",
		qnsiAction:
			"Join QNSI crypto discovery to matter sensitivity, data lifetime, transfer channels, custodians, and jurisdiction.",
		deliverable:
			"A privilege-focused quantum exposure register with priority matters, capture surfaces, and re-protection options.",
		validation:
			"The firm and client decide privilege, retention, ethical duties, key control, cross-border restrictions, and remediation.",
		sourceIds: ["cisa-quantum", "sg-pdpa"],
		keywords: ["law firm quantum risk", "privileged archive encryption", "legal HNDL"],
	},
	{
		slug: "deal-room-customer-key-boundary",
		title: "Evaluate customer-controlled keys for a transaction deal room",
		sector: "Legal & professional services",
		owner: "M&A Technology · Client Security · Deal Counsel",
		decision:
			"Can the client revoke provider access without making the deal room unrecoverable during a transaction?",
		pain: "BYOK promises can obscure provider metadata, search indexes, backups, emergency support, wrapping keys, and key-loss consequences.",
		trigger:
			"High-sensitivity transaction, sovereign client demand, or deal-room vendor selection.",
		qnsiAction:
			"Use QNSI custody evidence boundaries to document operations, providers, key states, tenant separation, and unverified paths.",
		deliverable:
			"A deal-room key-control decision record with access boundaries, recovery model, revocation test, and residual provider trust.",
		validation:
			"Client and provider test deletion, recovery, search behavior, support access, performance, legal hold, and contractual allocation.",
		sourceIds: ["nist-key-management", "nist-zero-trust"],
		keywords: ["deal room customer managed keys", "M&A data room BYOK", "legal cloud key custody"],
	},
	{
		slug: "forensic-chain-of-custody-signing",
		title: "Sign forensic evidence at every custody handoff",
		sector: "Legal & professional services",
		owner: "Digital Forensics · Investigations Counsel · Evidence Custodian",
		decision:
			"Can every acquisition, copy, analysis, export, and transfer be linked to an authorized actor and unchanged content?",
		pain: "Case tools record audit events but exports and inter-firm transfers can detach evidence hashes from identity, method, and custody context.",
		trigger:
			"Internal investigation, litigation hold, regulator production, or law-enforcement handoff.",
		qnsiAction:
			"Create QNSI-supported signature records for evidence digest, acquisition tool, operator, transformation, container, and recipient.",
		deliverable:
			"A cryptographic custody envelope with ordered handoffs, method versions, signatures, and verification results.",
		validation:
			"Investigators and counsel validate acquisition method, identity, storage, repeatability, admissibility, and privilege.",
		sourceIds: ["cjis", "nist-key-management"],
		keywords: [
			"digital forensics chain of custody",
			"signed evidence handoff",
			"forensic provenance",
		],
	},
	{
		slug: "retail-card-data-crypto-inventory",
		title: "Find cryptography that actually touches a retailer's card-data environment",
		sector: "Retail & ecommerce",
		owner: "Retail CISO · Payments · PCI Programme",
		decision:
			"Which terminals, gateways, token services, applications, and vendors are inside or connected to the cryptographic scope?",
		pain: "Network diagrams and SAQs miss keys and certificates in integrations, support tools, batch settlement, ecommerce plugins, and backup.",
		trigger: "PCI assessment, payment-platform change, acquisition, or cryptographic migration.",
		qnsiAction:
			"Use QNSI inventory to associate algorithms, keys, endpoints, owners, vendors, and observed data paths with the CDE.",
		deliverable:
			"A card-data cryptography register with scope rationale, unsupported dependencies, key owners, and evidence status.",
		validation:
			"The merchant and assessor determine PCI scope, segmentation, compensating controls, key ceremonies, and compliance.",
		sourceIds: ["pci-dss", "nist-key-management"],
		keywords: ["retail PCI cryptographic inventory", "card data keys", "ecommerce PQC"],
	},
	{
		slug: "pos-firmware-signing-provenance",
		title: "Verify point-of-sale firmware before store deployment",
		sector: "Retail & ecommerce",
		owner: "Store Technology · Payment Security · Vendor Management",
		decision:
			"Does each terminal image come from the authorized vendor release and match the approved device model?",
		pain: "POS updates pass through processors, acquirers, device vendors, management servers, and field technicians where provenance can fragment.",
		trigger: "Fleet patch, payment-kernel update, device refresh, or supply-chain alert.",
		qnsiAction:
			"Bind QNSI-supported signature metadata to image digest, signer, device cohort, test result, and rollout approval.",
		deliverable:
			"A POS deployment manifest with artifact identity, vendor signer, target estate, verification, and rollback.",
		validation:
			"The merchant validates PCI requirements, terminal certification, secure boot, field process, compatibility, and fraud monitoring.",
		sourceIds: ["pci-dss", "nist-ssdf"],
		keywords: ["POS firmware signing", "payment terminal provenance", "retail device integrity"],
	},
	{
		slug: "retail-loyalty-data-quantum-risk",
		title: "Assess quantum exposure in loyalty and customer-profile data",
		sector: "Retail & ecommerce",
		owner: "Privacy · Loyalty Platform · Data Governance",
		decision:
			"Which behavior, identity, location, and preference records remain exploitable long after collection?",
		pain: "Loyalty data is copied into marketing, personalization, fraud, analytics, and partner systems with different encryption and retention.",
		trigger:
			"Privacy review, loyalty-platform migration, cross-brand merger, or quantum-risk programme.",
		qnsiAction:
			"Map QNSI-observed cryptography to customer-data stores, transfers, retention, consent domains, and owners.",
		deliverable:
			"A loyalty-data confidentiality horizon map with long-lived exposure, partner paths, and deletion or re-protection actions.",
		validation:
			"The retailer decides lawful purpose, minimization, retention, transfer, consent, and encryption requirements.",
		sourceIds: ["sg-pdpa", "cisa-quantum"],
		keywords: [
			"retail loyalty quantum risk",
			"customer profile encryption",
			"ecommerce privacy PQC",
		],
	},
	{
		slug: "marketplace-seller-app-credential-isolation",
		title: "Contain seller-app credentials in an ecommerce marketplace",
		sector: "Retail & ecommerce",
		owner: "Marketplace Platform · Seller Risk · Fraud",
		decision:
			"Can one compromised seller application be prevented from reading other merchants, orders, payouts, or customer data?",
		pain: "Broad API tokens and shared integration secrets turn a single plugin compromise into cross-merchant exposure.",
		trigger: "Seller ecosystem growth, credential leak, API redesign, or third-party risk review.",
		qnsiAction:
			"Inventory application identities, key ownership, scopes, environments, algorithms, expiry, and rotation evidence in QNSI.",
		deliverable:
			"A seller-credential isolation ledger with excessive scope, shared secrets, stale apps, and revocation tests.",
		validation:
			"The marketplace tests API authorization, tenant separation, fraud controls, secret storage, rate limits, and incident response.",
		sourceIds: ["nist-zero-trust", "ftc-safeguards"],
		keywords: [
			"marketplace seller API security",
			"merchant credential isolation",
			"ecommerce third party tokens",
		],
	},
	{
		slug: "media-content-provenance-signing",
		title: "Sign media provenance from capture through publication",
		sector: "Media & digital content",
		owner: "Newsroom Technology · Content Authenticity · Editorial",
		decision:
			"Can audiences and partners verify which device, editor, and publishing system produced an asset?",
		pain: "Images, audio, and video undergo edits, transcodes, AI processing, and syndication that can break provenance or preserve only a platform assertion.",
		trigger:
			"Authenticity initiative, election coverage, synthetic-media policy, or disputed publication.",
		qnsiAction:
			"Use QNSI-supported signatures to bind asset digests, capture identity, edit sequence, model use, approval, and publication.",
		deliverable:
			"A content provenance manifest with transformation lineage, signer roles, algorithms, and verification status.",
		validation:
			"The publisher validates capture trust, editorial policy, identity, disclosure, interoperability, and preservation.",
		sourceIds: ["nist-ai-rmf", "nist-key-management"],
		keywords: ["media content provenance", "signed journalism", "digital content authenticity"],
	},
	{
		slug: "broadcast-archive-signature-preservation",
		title: "Preserve authenticity of a broadcast archive across format migration",
		sector: "Media & digital content",
		owner: "Archive · Broadcast Engineering · Rights Management",
		decision:
			"Can the archive prove an asset's origin and editorial state after storage and codec migrations?",
		pain: "Transcoding and restoration necessarily change files, while old signatures, certificates, metadata, and playback systems expire.",
		trigger: "Archive digitization, cloud migration, rights dispute, or cryptographic transition.",
		qnsiAction:
			"Record QNSI-compatible signatures for source asset, preservation master, transformation method, operator, and validation material.",
		deliverable:
			"An archive authenticity chain distinguishing original, preservation, restored, and distribution derivatives.",
		validation:
			"Archivists and counsel define authenticity, rights, preservation metadata, acceptable transformations, and retention.",
		sourceIds: ["nist-key-management", "cisa-quantum"],
		keywords: [
			"broadcast archive authenticity",
			"media preservation signatures",
			"long term content integrity",
		],
	},
	{
		slug: "newsroom-source-confidentiality-horizon",
		title: "Protect confidential newsroom sources against future decryption",
		sector: "Media & digital content",
		owner: "Newsroom Security · Investigations Editor · Legal",
		decision:
			"Which communications and source records remain dangerous if captured now and decrypted years later?",
		pain: "Secure messaging, email, file transfer, notes, cloud backup, and collaborator tools have different cryptographic and retention boundaries.",
		trigger: "Sensitive investigation, source-protection review, or quantum-readiness planning.",
		qnsiAction:
			"Map QNSI-observed algorithms, keys, services, devices, transfers, owners, and retention to the source-protection workflow.",
		deliverable:
			"A source confidentiality threat map with capture points, data lifetimes, migration options, and deletion decisions.",
		validation:
			"Journalists and counsel decide source risk, operational security, legal duties, usability, and acceptable tools.",
		sourceIds: ["cisa-quantum", "nist-zero-trust"],
		keywords: [
			"journalist source quantum risk",
			"newsroom encryption",
			"confidential source protection",
		],
	},
	{
		slug: "streaming-distribution-key-rotation",
		title: "Rotate streaming distribution keys without blacking out licensed audiences",
		sector: "Media & digital content",
		owner: "Streaming Platform · Content Protection · Rights Operations",
		decision:
			"Can origin, CDN, packager, player, and partner trust change within rights and availability constraints?",
		pain: "Multiple DRM systems, device generations, regions, and distribution partners create long overlap windows and orphaned keys.",
		trigger: "Key compromise, rights-provider change, major live event, or platform migration.",
		qnsiAction:
			"Track distribution key generations, algorithms, services, regions, partners, activation, and retirement evidence in QNSI.",
		deliverable:
			"A rights-aware key cutover plan with compatibility cohorts, overlap limits, revocation, monitoring, and rollback.",
		validation:
			"The service tests playback, entitlements, DRM, CDN propagation, regional rights, piracy controls, and availability.",
		sourceIds: ["nist-key-management", "nist-zero-trust"],
		keywords: [
			"streaming key rotation",
			"DRM cryptographic lifecycle",
			"media distribution security",
		],
	},
	{
		slug: "ai-model-artifact-signing",
		title: "Verify an AI model artifact before production loading",
		sector: "AI & data platforms",
		owner: "ML Platform · AI Security · Model Risk",
		decision:
			"Does the model match the approved training run, evaluation, code, and release authority?",
		pain: "Model files move through training clusters, registries, optimization jobs, vendor hubs, and deployment pipelines where checksums lack accountable provenance.",
		trigger:
			"Model promotion, third-party model adoption, fine-tune release, or registry incident.",
		qnsiAction:
			"Bind QNSI-supported signatures to model digest, dataset reference, code revision, evaluation, builder identity, and approval.",
		deliverable:
			"A model admission manifest with artifact, provenance, signer, policy, evaluation evidence, and target environment.",
		validation:
			"The operator validates training integrity, evaluation fitness, model behavior, supply chain, key custody, and rollback.",
		sourceIds: ["nist-ai-rmf", "nist-ssdf"],
		keywords: ["AI model signing", "model artifact provenance", "ML supply chain security"],
	},
	{
		slug: "ai-training-data-provenance",
		title: "Trace training data from source agreement to model run",
		sector: "AI & data platforms",
		owner: "Data Governance · ML Engineering · Responsible AI",
		decision:
			"Which dataset version, license, transformation, and approval contributed to a specific model?",
		pain: "Data pipelines merge snapshots, synthetic outputs, labels, and vendor datasets while contractual and technical provenance diverge.",
		trigger: "Foundation-model training, rights challenge, model audit, or data-removal request.",
		qnsiAction:
			"Use QNSI-supported identities and signatures to connect dataset manifests, transformations, storage versions, pipeline jobs, and model runs.",
		deliverable:
			"A training lineage graph with signed dataset checkpoints, rights references, transformations, and unverifiable inputs.",
		validation:
			"Data and legal owners verify rights, consent, privacy, representativeness, removal, quality, and model impact.",
		sourceIds: ["nist-ai-rmf", "eu-ai-act"],
		keywords: ["AI training data provenance", "signed dataset manifest", "model lineage evidence"],
	},
	{
		slug: "high-risk-ai-log-integrity",
		title: "Protect integrity of logs supporting a high-risk AI review",
		sector: "AI & data platforms",
		owner: "AI Governance · Compliance · ML Operations",
		decision:
			"Can reviewers trust the model version, input context, human intervention, and output recorded for each consequential decision?",
		pain: "Application, model, feature, and workflow logs are mutable, differently retained, and difficult to bind to the model actually served.",
		trigger: "High-risk AI deployment, conformity assessment, adverse event, or regulator request.",
		qnsiAction:
			"Apply QNSI-supported signing and key policy to decision-event bundles, model identity, workflow state, and evidence exports.",
		deliverable:
			"A tamper-evident AI decision record with model version, input references, output, oversight event, and signature state.",
		validation:
			"The deployer determines legal scope, logging necessity, privacy, accuracy, retention, human oversight, and conformity.",
		sourceIds: ["eu-ai-act", "nist-ai-rmf"],
		keywords: ["high risk AI log integrity", "EU AI Act evidence", "signed model decision logs"],
	},
	{
		slug: "ai-agent-credential-lifecycle",
		title: "Govern credentials used by autonomous AI agents",
		sector: "AI & data platforms",
		owner: "AI Platform · Identity Security · Application Owners",
		decision:
			"Which agent instance may call which tool, with what credential, data boundary, and expiration?",
		pain: "Long-lived API keys and shared service accounts let an agent's prompt or plugin compromise become broad infrastructure access.",
		trigger: "Agent rollout, MCP integration, tool expansion, or credential misuse.",
		qnsiAction:
			"Inventory agent and tool identities, keys, scopes, algorithms, owners, environments, and rotation events in QNSI.",
		deliverable:
			"An agent credential register with least-privilege scope, per-tool trust, session lifetime, revocation, and orphan detection.",
		validation:
			"The operator tests authorization, prompt-injection containment, secret isolation, human approval, audit completeness, and shutdown.",
		sourceIds: ["nist-ai-rmf", "nist-zero-trust"],
		keywords: ["AI agent credential security", "MCP key management", "autonomous agent zero trust"],
	},
] as const;

export function getQnsiUseCase(slug: string): QnsiUseCase | undefined {
	return QNSI_USE_CASES.find((useCase) => useCase.slug === slug);
}

export function getQnsiUseCaseSources(useCase: QnsiUseCase) {
	return useCase.sourceIds.map((id) => {
		const source = USE_CASE_SOURCE_BY_ID.get(id);
		if (!source) throw new Error(`Unknown use-case source: ${id}`);
		return source;
	});
}
