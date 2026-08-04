/**
 * Buyer use-case catalog.
 *
 * This is deliberately separate from:
 * - solutions-catalog.ts: ten long-form industry solution briefs;
 * - developer-use-cases.ts: source-linked implementation patterns.
 *
 * Here the unit of discovery is a concrete buyer problem: an industry
 * operating context crossed with a security programme. The 12 × 5 matrix
 * produces 60 distinct, internally linked evaluation paths without inventing
 * customer deployments or outcomes. Every page carries the same honest
 * boundary: it is a solution pattern until a named deployment has independent
 * production evidence.
 */

export type BuyerRole =
	| "CEO & board"
	| "CISO"
	| "CIO"
	| "CTO"
	| "Enterprise architect"
	| "Security architect"
	| "Risk & compliance"
	| "Data protection officer"
	| "DevSecOps & platform"
	| "Application engineering"
	| "AI & data leader"
	| "Procurement & vendor risk";

// Deployment began on 2026-07-28 in Singapore, which was still 2026-07-27
// UTC. Sitemap dates use UTC so crawlers never receive a future lastmod.
export const USE_CASE_CATALOG_PUBLISHED = "2026-07-27";

export interface UseCaseCapability {
	readonly label: string;
	readonly path: string;
}

interface IndustryContext {
	readonly slug: string;
	readonly name: string;
	readonly shortName: string;
	readonly solutionPath: string;
	readonly assets: readonly string[];
	readonly operatingContext: string;
	readonly regulatoryContext: string;
	readonly executiveConcern: string;
}

interface ScenarioPattern {
	readonly slug: string;
	readonly name: string;
	readonly titlePrefix: string;
	readonly roles: readonly BuyerRole[];
	readonly question: string;
	readonly trigger: string;
	readonly approach: string;
	readonly capabilities: readonly UseCaseCapability[];
	readonly workflow: readonly string[];
	readonly outcomes: readonly string[];
}

export interface BuyerUseCase {
	readonly slug: string;
	readonly name: string;
	readonly title: string;
	readonly summary: string;
	readonly seoDescription: string;
	readonly industry: string;
	readonly industrySlug: string;
	readonly solutionPath: string;
	readonly roles: readonly BuyerRole[];
	readonly question: string;
	readonly trigger: string;
	readonly problem: string;
	readonly regulatoryContext: string;
	readonly assets: readonly string[];
	readonly capabilities: readonly UseCaseCapability[];
	readonly workflow: readonly string[];
	readonly decisionQuestions: readonly string[];
	readonly outcomes: readonly string[];
	readonly evidenceBoundary: string;
	readonly keywords: readonly string[];
}

export const BUYER_ROLES: readonly {
	readonly role: BuyerRole;
	readonly concern: string;
}[] = [
	{
		role: "CEO & board",
		concern:
			"Translate quantum exposure into business continuity, customer trust, investment, and accountable risk decisions.",
	},
	{
		role: "CISO",
		concern:
			"Find cryptographic exposure, enforce target policy, contain compromise, and prove control effectiveness.",
	},
	{
		role: "CIO",
		concern:
			"Sequence migration across portfolios, vendors, cloud estates, data platforms, and operating budgets.",
	},
	{
		role: "CTO",
		concern:
			"Introduce cryptographic agility without freezing delivery or coupling every application to one provider.",
	},
	{
		role: "Enterprise architect",
		concern:
			"Map trust boundaries, dependencies, target architectures, compatibility gateways, and deployment topologies.",
	},
	{
		role: "Security architect",
		concern:
			"Design PQC-native trust paths, explicit hybrid boundaries, key custody, identity, and evidence flows.",
	},
	{
		role: "Risk & compliance",
		concern:
			"Connect obligations to measured controls, retained evidence, exceptions, recovery, and reporting workflows.",
	},
	{
		role: "Data protection officer",
		concern:
			"Protect long-lived personal and sensitive data while preserving residency, minimisation, and access evidence.",
	},
	{
		role: "DevSecOps & platform",
		concern:
			"Find cryptography in code and pipelines, govern signing, rotate material, and prevent silent fallback.",
	},
	{
		role: "Application engineering",
		concern:
			"Adopt stable APIs and SDKs for keys, secrets, storage, search, identity, and audit without crypto rewrites.",
	},
	{
		role: "AI & data leader",
		concern:
			"Protect models, prompts, embeddings, datasets, agents, and inference evidence across their full lifecycle.",
	},
	{
		role: "Procurement & vendor risk",
		concern:
			"Evaluate claims against reproducible evidence, deployment scope, custody boundaries, and contractual posture.",
	},
] as const;

const INDUSTRIES: readonly IndustryContext[] = [
	{
		slug: "banking-capital-markets",
		name: "Banking and capital markets",
		shortName: "banks and capital-markets firms",
		solutionPath: "/solutions/regulated-finance",
		assets: ["payment instructions", "KYC records", "transaction signatures", "trading archives"],
		operatingContext:
			"high-volume regulated transactions, long retention periods, cross-border data flows, and concentrated third-party trust",
		regulatoryContext:
			"MAS TRM, DORA, PCI DSS, GDPR or PDPA, ISO/IEC 27001, and institution-specific supervisory obligations",
		executiveConcern:
			"customer trust, payment continuity, systemic risk, regulator confidence, and multi-year confidentiality",
	},
	{
		slug: "insurance-asset-management",
		name: "Insurance and asset management",
		shortName: "insurers and asset managers",
		solutionPath: "/solutions/insurance-asset-management",
		assets: [
			"policyholder records",
			"claims evidence",
			"investment mandates",
			"actuarial datasets",
		],
		operatingContext:
			"decades-long records, delegated service providers, regulated investment operations, and sensitive analytics",
		regulatoryContext:
			"insurance supervisory rules, DORA, GDPR or PDPA, ISO/IEC 27001, and financial-sector outsourcing guidance",
		executiveConcern:
			"long-tail liability, third-party concentration, portfolio continuity, and defensible claims handling",
	},
	{
		slug: "healthcare-life-sciences",
		name: "Healthcare and life sciences",
		shortName: "healthcare and life-sciences organisations",
		solutionPath: "/solutions/healthcare-life-sciences",
		assets: [
			"patient records",
			"genomic data",
			"clinical-trial files",
			"medical-device credentials",
		],
		operatingContext:
			"highly sensitive data, clinical availability requirements, research collaboration, and long-lived patient histories",
		regulatoryContext:
			"HIPAA, GDPR or PDPA, clinical research obligations, medical-device security rules, and ISO/IEC 27001",
		executiveConcern:
			"patient safety, privacy, research integrity, continuity of care, and high-impact breach exposure",
	},
	{
		slug: "government-public-services",
		name: "Government and public services",
		shortName: "government and public-service bodies",
		solutionPath: "/solutions/government-sovereign-cloud",
		assets: [
			"citizen records",
			"digital identities",
			"inter-agency exchanges",
			"public-service archives",
		],
		operatingContext:
			"sovereignty requirements, multi-agency trust, public accountability, legacy estates, and long procurement cycles",
		regulatoryContext:
			"national security policy, public-sector procurement controls, privacy law, records legislation, and sovereign-hosting requirements",
		executiveConcern:
			"public trust, sovereign control, continuity of essential services, and accountable use of public data",
	},
	{
		slug: "defense-national-security",
		name: "Defense and national security",
		shortName: "defense and national-security organisations",
		solutionPath: "/solutions/defense-national-security",
		assets: [
			"mission data",
			"command workflows",
			"supply-chain artifacts",
			"long-life sensitive records",
		],
		operatingContext:
			"disconnected environments, long equipment lifecycles, coalition boundaries, and high-consequence authenticity requirements",
		regulatoryContext:
			"CNSA 2.0 transition policy, national cryptographic policy, export controls, supply-chain rules, and classified-system requirements",
		executiveConcern:
			"mission assurance, sovereign custody, supply-chain integrity, and confidentiality beyond current platform lifetimes",
	},
	{
		slug: "energy-utilities",
		name: "Energy and utilities",
		shortName: "energy and utility operators",
		solutionPath: "/solutions/critical-infrastructure",
		assets: [
			"control-plane credentials",
			"grid telemetry",
			"maintenance access",
			"safety and incident records",
		],
		operatingContext:
			"mixed OT and IT estates, long-lived equipment, remote access, safety constraints, and continuous-service obligations",
		regulatoryContext:
			"NIS2 or regional critical-infrastructure rules, sector resilience codes, incident reporting, and ISO/IEC 27001",
		executiveConcern:
			"physical continuity, safety, recovery time, vendor access, and national resilience",
	},
	{
		slug: "telecom-digital-infrastructure",
		name: "Telecom and digital infrastructure",
		shortName: "telecom and digital-infrastructure providers",
		solutionPath: "/solutions/critical-infrastructure",
		assets: [
			"network identities",
			"subscriber data",
			"edge credentials",
			"routing and orchestration secrets",
		],
		operatingContext:
			"distributed edge estates, massive identity scale, supplier diversity, low-latency operations, and critical-service dependencies",
		regulatoryContext:
			"telecommunications security rules, NIS2 or regional critical-infrastructure law, privacy obligations, and lawful-access governance",
		executiveConcern:
			"network availability, subscriber trust, supply-chain control, and cryptographic change at national scale",
	},
	{
		slug: "cloud-saas-software",
		name: "Cloud, SaaS, and software platforms",
		shortName: "cloud, SaaS, and software providers",
		solutionPath: "/solutions/multi-tenant-saas",
		assets: [
			"tenant data",
			"API credentials",
			"software artifacts",
			"service and workload identities",
		],
		operatingContext:
			"rapid releases, multi-tenant isolation, marketplace distribution, customer assurance, and multi-cloud dependencies",
		regulatoryContext:
			"SOC 2, ISO/IEC 27001, privacy law, the EU Cyber Resilience Act where applicable, and customer security schedules",
		executiveConcern:
			"revenue continuity, customer retention, secure releases, tenant trust, and enterprise procurement readiness",
	},
	{
		slug: "manufacturing-industrial",
		name: "Manufacturing and industrial systems",
		shortName: "manufacturers and industrial operators",
		solutionPath: "/solutions/manufacturing-ip-protection",
		assets: ["product IP", "firmware", "machine identities", "supplier and production records"],
		operatingContext:
			"long equipment lifetimes, global suppliers, embedded software, plant availability, and valuable engineering IP",
		regulatoryContext:
			"the EU Cyber Resilience Act where applicable, NIS2, product-security obligations, export controls, and ISO/IEC 27001",
		executiveConcern:
			"production continuity, intellectual-property loss, product liability, and supplier compromise",
	},
	{
		slug: "ai-data-platforms",
		name: "AI and data platforms",
		shortName: "AI and data-platform teams",
		solutionPath: "/solutions/sovereign-ai-labs",
		assets: [
			"model artifacts",
			"training datasets",
			"embeddings",
			"agent and inference credentials",
		],
		operatingContext:
			"fast-changing models, high-value datasets, autonomous tool use, distributed inference, and sovereign-AI requirements",
		regulatoryContext:
			"AI governance obligations, privacy law, sector-specific model controls, provenance requirements, and customer assurance commitments",
		executiveConcern:
			"model theft, data leakage, agent misuse, sovereign control, and explainable operational evidence",
	},
	{
		slug: "legal-professional-services",
		name: "Legal and professional services",
		shortName: "legal and professional-services firms",
		solutionPath: "/solutions/multi-tenant-saas",
		assets: ["client matters", "contracts", "deal rooms", "privileged communications"],
		operatingContext:
			"client confidentiality, external collaboration, matter-level access, long retention, and cross-border engagements",
		regulatoryContext:
			"professional secrecy, privacy law, client outside-counsel guidelines, records duties, and ISO/IEC 27001",
		executiveConcern:
			"privilege, client confidence, conflict containment, defensible custody, and reputation",
	},
	{
		slug: "education-research",
		name: "Education and research",
		shortName: "education and research institutions",
		solutionPath: "/solutions/education-research",
		assets: [
			"research datasets",
			"student records",
			"grant IP",
			"laboratory and collaboration credentials",
		],
		operatingContext:
			"open collaboration, decentralised administration, valuable pre-publication research, and constrained security teams",
		regulatoryContext:
			"education privacy law, research ethics, grant and export-control conditions, data-sharing agreements, and ISO/IEC 27001",
		executiveConcern:
			"research integrity, student privacy, grant continuity, international collaboration, and IP protection",
	},
] as const;

const SCENARIOS: readonly ScenarioPattern[] = [
	{
		slug: "crypto-inventory-migration-roadmap",
		name: "Cryptographic inventory and migration roadmap",
		titlePrefix: "Find cryptographic exposure and build a migration roadmap for",
		roles: ["CISO", "CIO", "Enterprise architect", "Risk & compliance"],
		question: "Where is vulnerable cryptography, who owns it, and what should move first?",
		trigger:
			"A board request, regulator question, merger, cloud programme, or supplier review reveals that no complete cryptographic inventory exists.",
		approach:
			"Use source, host, cloud, certificate, and key discovery to build a CBOM; relate assets to owners and data lifetimes; then govern migration waves by risk and dependency.",
		capabilities: [
			{ label: "Crypto inventory and CBOM", path: "/platform/crypto-inventory" },
			{ label: "Governed PQC migration", path: "/pqc-migration" },
			{ label: "Policy and readiness evidence", path: "/security/compliance" },
		],
		workflow: [
			"Connect approved discovery sources without treating a connector name as evidence of coverage.",
			"Normalize algorithms, certificates, keys, libraries, endpoints, owners, and data-lifetime context into a CBOM.",
			"Prioritize assets by confidentiality horizon, criticality, dependency, and migration feasibility.",
			"Create approval-gated waves with rollback anchors and retained reconciliation evidence.",
		],
		outcomes: [
			"A defensible inventory instead of a questionnaire-only estimate.",
			"A sequenced investment roadmap tied to business services and owners.",
			"Visible exceptions and compatibility boundaries rather than silent classical fallback.",
		],
	},
	{
		slug: "long-lived-data-hndl-protection",
		name: "Long-lived data and harvest-now-decrypt-later protection",
		titlePrefix: "Protect long-lived sensitive data from harvest-now-decrypt-later risk in",
		roles: ["CEO & board", "CISO", "Data protection officer", "Security architect"],
		question:
			"Which data must remain confidential beyond the useful life of today's public-key cryptography?",
		trigger:
			"Data-retention, sovereignty, privacy, or national-security requirements extend beyond the organisation's assumed quantum-migration window.",
		approach:
			"Classify data by confidentiality horizon, introduce PQC-established envelope protection and controlled storage paths, and record any unavoidable non-PQC external leg.",
		capabilities: [
			{ label: "Quantum-safe Vault", path: "/platform/secrets-management" },
			{ label: "encrypted storage", path: "/platform/encrypted-data" },
			{ label: "Entropy and key evidence", path: "/security/entropy" },
		],
		workflow: [
			"Identify records whose confidentiality requirement outlives the expected safety of current key establishment.",
			"Map every ingest, storage, search, export, backup, and recovery boundary for those records.",
			"Apply PQC-established envelope protection where QNSI controls the trust boundary and label external compatibility legs.",
			"Retain key-version, access, export, recovery, and deletion evidence for review.",
		],
		outcomes: [
			"A risk decision based on data lifetime rather than speculative Q-Day timing.",
			"Explicit ownership of compatibility gateways and residual exposure.",
			"Auditable custody and access history for the most durable data classes.",
		],
	},
	{
		slug: "key-secret-custody-rotation",
		name: "Key, secret, and signing-material custody",
		titlePrefix: "Govern keys, secrets, signing material, and rotation across",
		roles: ["CISO", "CTO", "Security architect", "DevSecOps & platform"],
		question:
			"Can the organisation prove who controls cryptographic material and what happens when it must rotate?",
		trigger:
			"Key sprawl, expiring credentials, a supplier change, compromise response, HSM strategy, or audit finding exposes fragmented custody.",
		approach:
			"Centralize policy and lifecycle evidence across KMS and Vault, qualify customer-managed custody where required, and execute controlled rollover with overlap and rollback.",
		capabilities: [
			{ label: "PQC key management", path: "/platform/key-management" },
			{ label: "Vault and secret lifecycle", path: "/platform/secrets-management" },
			{ label: "Customer HSM integration", path: "/platform/key-management" },
		],
		workflow: [
			"Inventory active material, owners, consumers, expiry, algorithms, custody providers, and recovery dependencies.",
			"Define permitted PQC algorithms, custody requirements, separation of duties, and exception handling.",
			"Roll material through staged overlap, consumer confirmation, retirement, and independently checked evidence.",
			"Exercise compromise, revocation, recovery, and signing-key rollover before an actual incident.",
		],
		outcomes: [
			"One governed lifecycle view across application and infrastructure trust material.",
			"Lower orphaned-key and expired-credential exposure.",
			"A customer-managed custody path that is claimed only after the selected device is qualified.",
		],
	},
	{
		slug: "application-identity-software-trust",
		name: "Application, workload, identity, and software trust modernization",
		titlePrefix: "Modernize application, identity, and software trust for",
		roles: [
			"CTO",
			"Enterprise architect",
			"Application engineering",
			"DevSecOps & platform",
			"AI & data leader",
		],
		question:
			"How can teams adopt PQC without embedding another generation of brittle crypto choices?",
		trigger:
			"A platform modernization, zero-trust programme, API redesign, software supply-chain initiative, or new AI workload creates a trust-boundary decision.",
		approach:
			"Use stable SDK and service contracts, policy-selected algorithms, workload identities, signed artifacts, and explicit compatibility gateways around third parties.",
		capabilities: [
			{ label: "Developer SDKs and APIs", path: "/developers" },
			{ label: "Identity and access architecture", path: "/security" },
			{ label: "Build patterns", path: "/developers/use-cases" },
		],
		workflow: [
			"Map user, service, workload, build, API, and external-provider trust boundaries.",
			"Separate application intent from algorithm and provider selection through centrally governed policy.",
			"Introduce PQC-native signing or key establishment on controlled paths and isolate classical external dependencies.",
			"Verify negative paths, downgrade resistance, revocation, observability, and audit ingestion before cutover.",
		],
		outcomes: [
			"Application teams integrate capabilities without owning raw cryptographic lifecycle logic.",
			"Hybrid or classical interoperability remains visible and separately governed.",
			"Software, workload, and identity changes leave a reviewable evidence trail.",
		],
	},
	{
		slug: "assurance-incident-regulator-evidence",
		name: "Assurance, incident response, and regulator evidence",
		titlePrefix: "Produce decision-ready assurance and incident evidence for",
		roles: ["CEO & board", "CISO", "Risk & compliance", "Procurement & vendor risk"],
		question:
			"Can leadership, customers, auditors, and regulators distinguish implemented controls from unverified claims?",
		trigger:
			"A customer questionnaire, statutory incident, audit, procurement review, board meeting, or regulatory examination requires current evidence.",
		approach:
			"Map obligations to measured controls and retained records; separate engineering completion, independent verification, legal approval, and accreditation status.",
		capabilities: [
			{ label: "Compliance and evidence", path: "/security/compliance" },
			{ label: "Public conformance evidence", path: "/verify/conformance" },
			{ label: "Live service status", path: "/status" },
		],
		workflow: [
			"Define the exact decision, audience, applicable obligation, system scope, and evidence period.",
			"Collect control records from production sources and preserve provenance, timestamps, signatures, and gaps.",
			"Run recovery and statutory-reporting exercises with counsel and accountable operators.",
			"Publish or export an evidence matrix that labels verified, engineering-complete, externally pending, and not verified states.",
		],
		outcomes: [
			"Faster, more honest responses to security reviews and procurement requests.",
			"Clear separation between operational telemetry, independent assurance, and legal opinion.",
			"Incident and recovery evidence prepared before statutory clocks begin.",
		],
	},
] as const;

const EVIDENCE_BOUNDARY =
	"This page is an evaluation pattern, not evidence that a customer deployment, regulatory outcome, or stated control has been completed. QNSI capabilities remain subject to the selected deployment, policy, integration, qualification, and independently verified production evidence.";

function buildUseCase(industry: IndustryContext, scenario: ScenarioPattern): BuyerUseCase {
	const title = `${scenario.titlePrefix} ${industry.name}`;
	const descriptionDraft = `${industry.name}: ${scenario.name.toLowerCase()} for ${industry.assets
		.slice(0, 3)
		.join(", ")}. Connect ${industry.executiveConcern} to an evidence-bound PQC evaluation.`;
	const seoDescription =
		descriptionDraft.length <= 158
			? descriptionDraft
			: `${descriptionDraft.slice(0, 155).replace(/\s+\S*$/, "")}…`;
	return {
		slug: `${industry.slug}-${scenario.slug}`,
		name: `${scenario.name} - ${industry.name}`,
		title,
		summary: `${scenario.approach} Applied to ${industry.operatingContext}.`,
		seoDescription,
		industry: industry.name,
		industrySlug: industry.slug,
		solutionPath: industry.solutionPath,
		roles: scenario.roles,
		question: scenario.question,
		trigger: scenario.trigger,
		problem: `${industry.name} must protect ${industry.assets.join(", ")} while managing ${industry.executiveConcern}. The operating environment combines ${industry.operatingContext}.`,
		regulatoryContext: industry.regulatoryContext,
		assets: industry.assets,
		capabilities: scenario.capabilities,
		workflow: scenario.workflow.map((step, index) => {
			if (index === 0) return `${step} Start with ${industry.assets.join(", ")}.`;
			if (index === 1)
				return `${step} Apply the evidence and decision requirements created by ${industry.regulatoryContext}.`;
			if (index === 2)
				return `${step} Keep ${industry.executiveConcern} visible as an explicit design constraint.`;
			return `${step} Record the accountable ${industry.name} owners, exceptions, and residual risk.`;
		}),
		decisionQuestions: [
			`Which ${industry.assets.join(", ")} are in scope, who owns them, and how long must their confidentiality or authenticity hold?`,
			`How do ${industry.regulatoryContext} change the required approvals, custody boundaries, recovery evidence, and reporting clock?`,
			`Which ${industry.name} technical and business owners are accountable for ${industry.executiveConcern}, including every external compatibility boundary?`,
		],
		outcomes: scenario.outcomes.map(
			(outcome) => `${industry.name}: ${outcome.charAt(0).toLowerCase()}${outcome.slice(1)}`,
		),
		evidenceBoundary: EVIDENCE_BOUNDARY,
		keywords: [
			`${scenario.name} ${industry.name}`,
			`post-quantum cryptography ${industry.name}`,
			`PQC ${industry.shortName}`,
			`quantum-safe ${industry.name}`,
			...scenario.roles.map((role) => `${role} post-quantum security`),
		],
	};
}

export const BUYER_USE_CASES: readonly BuyerUseCase[] = INDUSTRIES.flatMap((industry) =>
	SCENARIOS.map((scenario) => buildUseCase(industry, scenario)),
);

export const USE_CASE_INDUSTRIES = INDUSTRIES.map((industry) => ({
	slug: industry.slug,
	name: industry.name,
	solutionPath: industry.solutionPath,
	count: SCENARIOS.length,
})) as readonly {
	readonly slug: string;
	readonly name: string;
	readonly solutionPath: string;
	readonly count: number;
}[];

export function getBuyerUseCase(slug: string): BuyerUseCase | undefined {
	return BUYER_USE_CASES.find((entry) => entry.slug === slug);
}

export function getUseCasesForRole(role: BuyerRole): readonly BuyerUseCase[] {
	return BUYER_USE_CASES.filter((entry) => entry.roles.includes(role));
}

export function getUseCasesForIndustry(industrySlug: string): readonly BuyerUseCase[] {
	return BUYER_USE_CASES.filter((entry) => entry.industrySlug === industrySlug);
}
