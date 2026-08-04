export type UseCaseSource = {
	id: string;
	publisher: string;
	title: string;
	url: string;
	relevance: string;
};

/**
 * Primary and regulator sources used by the QNSI scenario library.
 *
 * These sources establish the external pain point or assurance obligation. They
 * do not endorse HEOSSI, certify QNSI, or determine legal applicability for a
 * particular customer.
 */
export const USE_CASE_SOURCES: readonly UseCaseSource[] = [
	{
		id: "nist-pqc",
		publisher: "NIST",
		title: "Post-Quantum Cryptography project",
		url: "https://csrc.nist.gov/Projects/post-quantum-cryptography",
		relevance: "NIST-standardized post-quantum algorithms and migration context.",
	},
	{
		id: "nist-ir-8547",
		publisher: "NIST",
		title: "Transition to Post-Quantum Cryptography Standards",
		url: "https://csrc.nist.gov/pubs/ir/8547/ipd",
		relevance: "Transition planning from quantum-vulnerable public-key standards.",
	},
	{
		id: "nist-key-management",
		publisher: "NIST",
		title: "Key Management Guidelines",
		url: "https://csrc.nist.gov/projects/key-management/key-management-guidelines",
		relevance: "Key metadata, lifecycle, policy, protection, and organizational practices.",
	},
	{
		id: "nist-zero-trust",
		publisher: "NIST",
		title: "SP 800-207 Zero Trust Architecture",
		url: "https://csrc.nist.gov/pubs/sp/800/207/final",
		relevance: "Resource-focused access decisions for users, devices, services, and workloads.",
	},
	{
		id: "nist-identity",
		publisher: "NIST",
		title: "SP 800-63-4 Digital Identity Guidelines",
		url: "https://www.nist.gov/publications/nist-sp-800-63-4-digital-identity-guidelines",
		relevance: "Identity proofing, authentication, federation, and assurance levels.",
	},
	{
		id: "nist-ssdf",
		publisher: "NIST",
		title: "SP 800-218 Secure Software Development Framework",
		url: "https://csrc.nist.gov/pubs/sp/800/218/final",
		relevance: "Secure software development practices and supply-chain evidence.",
	},
	{
		id: "nist-csrm",
		publisher: "NIST",
		title: "SP 800-161 Rev. 1 Cybersecurity Supply Chain Risk Management",
		url: "https://csrc.nist.gov/pubs/sp/800/161/r1/upd1/final",
		relevance: "Supply-chain risk identification, assessment, and control.",
	},
	{
		id: "nist-ai-rmf",
		publisher: "NIST",
		title: "AI Risk Management Framework",
		url: "https://www.nist.gov/itl/ai-risk-management-framework",
		relevance: "Govern, map, measure, and manage risks across the AI lifecycle.",
	},
	{
		id: "nsa-cnsa",
		publisher: "NSA",
		title: "CNSA 2.0 quantum-resistant algorithm requirements",
		url: "https://www.nsa.gov/Press-Room/Press-Releases-Statements/Press-Release-View/Article/3148990/nsa-releases-future-quantum-resistant-qr-algorithm-requirements-for-national-se/",
		relevance: "National Security System algorithm transition requirements.",
	},
	{
		id: "cisa-quantum",
		publisher: "CISA, NSA, and NIST",
		title: "Quantum-Readiness: Migration to Post-Quantum Cryptography",
		url: "https://www.cisa.gov/sites/default/files/2023-08/Quantum-Readiness%20-%20Migration%20to%20Post-Quantum%20Cryptography_508c.pdf",
		relevance:
			"Cryptographic inventory, roadmaps, supply-chain engagement, and migration preparation.",
	},
	{
		id: "cisa-product-security",
		publisher: "CISA and FBI",
		title: "Product Security Bad Practices",
		url: "https://www.cisa.gov/news-events/alerts/2025/01/17/cisa-and-fbi-release-updated-guidance-product-security-bad-practices",
		relevance:
			"Avoidable product-security practices affecting critical infrastructure and software buyers.",
	},
	{
		id: "cra-summary",
		publisher: "European Commission",
		title: "Cyber Resilience Act summary",
		url: "https://digital-strategy.ec.europa.eu/en/policies/cra-summary",
		relevance:
			"Lifecycle cybersecurity, vulnerability handling, support periods, and product obligations.",
	},
	{
		id: "cra-reporting",
		publisher: "European Commission",
		title: "Cyber Resilience Act reporting",
		url: "https://digital-strategy.ec.europa.eu/en/policies/cra-reporting",
		relevance: "Early warning, notification, and final-report workflow for reportable events.",
	},
	{
		id: "dora",
		publisher: "European Commission",
		title: "DORA Level 2 measures",
		url: "https://finance.ec.europa.eu/document/download/7a2d42d8-4b48-4e2e-9b4c-c4e9107686d1_en?filename=dora-level-2-measures-full_en.pdf",
		relevance:
			"ICT risk management, incident, resilience testing, and third-party oversight for finance.",
	},
	{
		id: "eudi",
		publisher: "European Commission",
		title: "European Digital Identity Regulation",
		url: "https://digital-strategy.ec.europa.eu/en/policies/eudi-regulation",
		relevance: "Wallet interoperability, security, privacy, and cross-border digital identity.",
	},
	{
		id: "eu-ai-act",
		publisher: "European Union",
		title: "Regulation (EU) 2024/1689 - Artificial Intelligence Act",
		url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689",
		relevance:
			"Lifecycle risk management, documentation, logging, and conformity duties for covered AI.",
	},
	{
		id: "sg-cybersecurity-act",
		publisher: "Cyber Security Agency of Singapore",
		title: "Cybersecurity Act",
		url: "https://www.csa.gov.sg/legislation/cybersecurity-act/",
		relevance:
			"Singapore CII, foundational digital infrastructure, incident, and supplier obligations.",
	},
	{
		id: "sg-incident-forms",
		publisher: "Cyber Security Agency of Singapore",
		title: "Cybersecurity Act forms and incident reporting",
		url: "https://www.csa.gov.sg/legislation/forms/",
		relevance: "Operational forms and time-bound incident notification pathways.",
	},
	{
		id: "sg-pdpa",
		publisher: "Personal Data Protection Commission Singapore",
		title: "PDPA data protection obligations",
		url: "https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act/data-protection-obligations",
		relevance:
			"Protection, retention, transfer, access, correction, and breach-notification obligations.",
	},
	{
		id: "sg-iot",
		publisher: "IMDA Singapore",
		title: "Internet of Things standards and frameworks",
		url: "https://www.imda.gov.sg/regulations-and-licensing-listing/ict-standards-and-quality-of-service/it-standards-and-frameworks/internet-of-things",
		relevance: "IoT security, threat modelling, interoperability, and lifecycle requirements.",
	},
	{
		id: "mas-psn05",
		publisher: "Monetary Authority of Singapore",
		title: "PSN05 Technology Risk Management Notice",
		url: "https://www.mas.gov.sg/-/media/mas-media-library/regulation/notices/trpd/psn05/psn05-technology-risk-management-notice---6-feb-2024.pdf",
		relevance:
			"Critical-system availability, incident, and technology-risk obligations for payment services.",
	},
	{
		id: "hhs-risk",
		publisher: "U.S. Department of Health and Human Services",
		title: "HIPAA Security Rule risk analysis guidance",
		url: "https://www.hhs.gov/hipaa/for-professionals/security/guidance/guidance-risk-analysis/index.html",
		relevance:
			"Complete ePHI scope, risk documentation, transmission protection, and data authentication.",
	},
	{
		id: "hhs-cloud",
		publisher: "U.S. Department of Health and Human Services",
		title: "HIPAA and cloud computing",
		url: "https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html",
		relevance: "Shared responsibility, cloud service arrangements, and safeguards for ePHI.",
	},
	{
		id: "fda-devices",
		publisher: "U.S. Food and Drug Administration",
		title: "Cybersecurity in Medical Devices",
		url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cybersecurity-medical-devices-quality-management-system-considerations-and-content-premarket",
		relevance: "Quality-system and premarket cybersecurity evidence for connected medical devices.",
	},
	{
		id: "pci-dss",
		publisher: "PCI Security Standards Council",
		title: "PCI DSS v4.0 SAQ D for service providers",
		url: "https://www.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-D-Service-Provider.pdf",
		relevance:
			"Cryptography, keys, access, logging, testing, and service-provider evidence for card data.",
	},
	{
		id: "sec-incident",
		publisher: "U.S. Securities and Exchange Commission",
		title: "Cybersecurity risk management and incident disclosure rules",
		url: "https://www.sec.gov/newsroom/press-releases/2023-139",
		relevance: "Material incident disclosure and annual cybersecurity risk-management disclosures.",
	},
	{
		id: "ftc-safeguards",
		publisher: "U.S. Federal Trade Commission",
		title: "Safeguards Rule",
		url: "https://www.ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know",
		relevance:
			"Written security programs, encryption, provider oversight, and reporting for financial data.",
	},
	{
		id: "nydfs",
		publisher: "New York State Department of Financial Services",
		title: "Cybersecurity Resource Center",
		url: "https://www.dfs.ny.gov/industry_guidance/cybersecurity",
		relevance:
			"Cybersecurity governance, controls, certification, and incident reporting for covered entities.",
	},
	{
		id: "irs-1075",
		publisher: "U.S. Internal Revenue Service",
		title: "Publication 1075 encryption requirements",
		url: "https://www.irs.gov/privacy-disclosure/encryption-requirements-of-publication-1075",
		relevance:
			"Key establishment, cryptographic protection, PKI, and FIPS requirements for federal tax data.",
	},
	{
		id: "fedramp",
		publisher: "FedRAMP",
		title: "Continuous Reporting Standard",
		url: "https://www.fedramp.gov/rfcs/0008/",
		relevance: "Objective, data-driven continuous monitoring reports for federal cloud services.",
	},
	{
		id: "cjis",
		publisher: "Federal Bureau of Investigation",
		title: "CJIS Security Policy",
		url: "https://le.fbi.gov/file-repository/cjis_security_policy_v5-9-5_20240709.pdf",
		relevance:
			"Minimum safeguards for criminal justice information at rest, in transit, and across its lifecycle.",
	},
	{
		id: "epa-water",
		publisher: "U.S. Environmental Protection Agency",
		title: "Cybersecurity for the Water Sector",
		url: "https://www.epa.gov/cyberwater",
		relevance:
			"Water and wastewater cybersecurity assessment, planning, incident, and resilience resources.",
	},
	{
		id: "nerc-cip",
		publisher: "North American Electric Reliability Corporation",
		title: "Critical Infrastructure Protection standards",
		url: "https://www.nerc.com/standards/reliability-standards/cip",
		relevance:
			"Electric-system categorization, perimeter, incident, recovery, information, and supply-chain controls.",
	},
	{
		id: "tsa-pipeline",
		publisher: "Transportation Security Administration",
		title: "Pipeline Security Guidelines",
		url: "https://www.tsa.gov/sites/default/files/pipeline_security_guidelines.pdf",
		relevance:
			"Pipeline cybersecurity governance, access, monitoring, incident response, and recovery.",
	},
	{
		id: "imo-maritime",
		publisher: "International Maritime Organization",
		title: "Maritime cyber risk",
		url: "https://www.imo.org/en/ourwork/security/pages/cyber-security.aspx",
		relevance: "Cyber risk across shipboard IT and operational technology under safety management.",
	},
	{
		id: "nhtsa-auto",
		publisher: "National Highway Traffic Safety Administration",
		title: "Cybersecurity Best Practices for the Safety of Modern Vehicles",
		url: "https://www.nhtsa.gov/sites/nhtsa.gov/files/2022-09/cybersecurity-best-practices-safety-modern-vehicles-2022-tag.pdf",
		relevance:
			"Layered vehicle cybersecurity, lifecycle processes, incident response, and supply-chain practices.",
	},
	{
		id: "easa-part-is",
		publisher: "European Union Aviation Safety Agency",
		title: "Part-IS information security rules",
		url: "https://www.easa.europa.eu/en/newsroom-and-events/news/part-regulation-published-completing-regulatory-framework-cyber-resilient",
		relevance:
			"Aviation information-security risk, event detection, response, and recovery with safety impact.",
	},
	{
		id: "fcc-cpni",
		publisher: "U.S. Federal Communications Commission",
		title: "Customer Proprietary Network Information protection",
		url: "https://apps.fcc.gov/eb/CPNI/",
		relevance:
			"Carrier safeguards and annual certification for sensitive subscriber network information.",
	},
] as const;

export const USE_CASE_SOURCE_BY_ID = new Map(
	USE_CASE_SOURCES.map((source) => [source.id, source] as const),
);
