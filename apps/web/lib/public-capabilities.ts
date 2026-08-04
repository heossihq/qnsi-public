/**
 * Canonical buyer-facing capability registry.
 *
 * This is deliberately separate from service manifests. A manifest proves that
 * source exists; it does not prove route reachability, deployment-specific
 * execution, or independent production assurance. Public pages project this
 * registry so capability names, maturity boundaries, evidence, and journeys do
 * not drift across navigation, sitemap, JSON-LD, use cases, and sales content.
 */

export type PublicCapabilityStatus =
	| "production-surface"
	| "source-implemented"
	| "deployment-qualified"
	| "statement-of-direction";

export interface PublicCapabilityLink {
	readonly label: string;
	readonly href: string;
	readonly external?: boolean;
}

export interface PublicCapabilityArea {
	readonly slug: string;
	readonly name: string;
	readonly shortName: string;
	readonly description: string;
	readonly buyerOutcome: string;
	readonly audience: readonly string[];
	readonly status: PublicCapabilityStatus;
	readonly statusLabel: string;
	readonly evidenceBoundary: string;
	readonly capabilities: readonly string[];
	readonly workflow: readonly {
		readonly title: string;
		readonly description: string;
	}[];
	readonly integrations: readonly string[];
	readonly evidence: readonly PublicCapabilityLink[];
	readonly related: readonly PublicCapabilityLink[];
	readonly faq: readonly {
		readonly question: string;
		readonly answer: string;
	}[];
}

export const PUBLIC_CAPABILITY_AREAS: readonly PublicCapabilityArea[] = [
	{
		slug: "crypto-inventory",
		name: "Cryptographic Discovery & Inventory",
		shortName: "Discovery & Inventory",
		description:
			"Find cryptographic dependencies across cloud infrastructure, hosts, TLS endpoints, certificates, secret managers, Kubernetes, repositories, and imported inventories.",
		buyerOutcome:
			"Create an accountable migration backlog from observed cryptographic assets instead of spreadsheets, vendor assumptions, or incomplete cloud-only scans.",
		audience: ["CISO", "Cryptography lead", "Enterprise architect", "Security engineering"],
		status: "source-implemented",
		statusLabel: "Source-backed · deployment evidence required",
		evidenceBoundary:
			"Connector, local-scanning, normalization, classification, checkpoint, and export contracts exist in source. Complete estate coverage, classification accuracy, connector execution, and deployment-specific behavior remain NOT VERIFIED unless linked evidence says otherwise.",
		capabilities: [
			"Cloud, certificate, TLS, secret-manager, Kubernetes, host, and repository discovery contracts",
			"Local source-code scanning without uploading repository contents",
			"Durable checkpoints and signed offline evidence transfer for disconnected estates",
			"Cryptographic Bill of Materials (CBOM) with CycloneDX export",
			"Separate QBOM and SBOM evidence views for migration validation",
			"HNDL exposure scoring, lifecycle posture, and policy evaluation",
		],
		workflow: [
			{
				title: "Connect or import",
				description:
					"Attach an eligible discovery source, run the local CLI, or submit a normalized inventory through the API.",
			},
			{
				title: "Classify",
				description:
					"Normalize algorithms, protocols, providers, certificates, keys, and code usages into an evidence-bearing inventory.",
			},
			{
				title: "Prioritize",
				description:
					"Apply policy, data-lifetime, exposure, expiry, and dependency context to form a migration backlog.",
			},
			{
				title: "Export and reconcile",
				description:
					"Produce CBOM, QBOM, SBOM, and signed findings for review, migration planning, and later cutover validation.",
			},
		],
		integrations: [
			"AWS, Azure, GCP, IBM, Oracle, Alibaba, Akamai, Cloudflare, Fastly, DigitalOcean",
			"HashiCorp Vault",
			"Kubernetes and host agents",
			"QNSI CLI and normalized inventory API",
			"CycloneDX",
		],
		evidence: [
			{ label: "PQC migration guide", href: "/pqc-migration" },
			{
				label: "Source-code scanning documentation",
				href: "https://docs.qnsi.heossi.com/crypto/source-code-scanning",
				external: true,
			},
			{
				label: "Host discovery documentation",
				href: "https://docs.qnsi.heossi.com/discovery/host-discovery",
				external: true,
			},
		],
		related: [
			{ label: "Governed migration", href: "/pqc-migration" },
			{ label: "Compliance mapping", href: "/security/compliance" },
			{ label: "Developer platform", href: "/developers" },
		],
		faq: [
			{
				question: "Does QNSI require repository upload for source-code discovery?",
				answer:
					"The CLI source defines local parsing and normalized-finding upload contracts. Repository contents do not need to be uploaded for local analysis. Payload exclusion, signing, ingestion, materialization, and deployment behavior still require deployment-specific verification.",
			},
			{
				question: "Are CBOM, QBOM, and SBOM the same artifact?",
				answer:
					"No. CBOM describes cryptographic assets and dependencies, QBOM records quantum-readiness context, and SBOM describes software components. QNSI keeps them separate so a release can bind software, cryptography, and migration evidence without implying that one inventory proves the others.",
			},
		],
	},
	{
		slug: "key-management",
		name: "Post-Quantum Key Management & Custody",
		shortName: "Keys & Custody",
		description:
			"Govern key creation, rotation, signing, verification, wrapping, import, policy, and qualified customer-managed custody from one tenant-scoped control surface.",
		buyerOutcome:
			"Move cryptographic control away from application code while preserving explicit policy, authorization, custody boundaries, and reproducible evidence.",
		audience: ["CISO", "PKI lead", "Cloud security", "Platform engineering"],
		status: "source-implemented",
		statusLabel: "Source-backed · qualified paths identified",
		evidenceBoundary:
			"KMS routes, policy contracts, BYOK, rotation, signing, wrapping, and eight capability-gated custody connectors exist in source. Complete route execution and platform-wide enforcement remain NOT VERIFIED. The current escrow route is not threshold recovery and is not presented as available.",
		capabilities: [
			"ML-KEM, ML-DSA, and SLH-DSA operations through tenant-scoped policy",
			"BYOK import, scheduled rotation, signing, verification, wrap, and unwrap contracts",
			"Six PKCS#11 and two REST customer-managed custody connector implementations",
			"HSM-Sealed Post-Quantum Keys for ML-DSA-44/65/87 compatibility",
			"Usage analytics, lifecycle policy, and cryptographic transition controls",
			"Fail-closed HSM requirements until the selected device and configuration qualify",
		],
		workflow: [
			{
				title: "Select the trust policy",
				description:
					"Choose the permitted algorithm set, assurance tier, approval requirements, and custody boundary.",
			},
			{
				title: "Create or import",
				description:
					"Generate new material or import eligible customer-controlled material through an authorized path.",
			},
			{
				title: "Operate and rotate",
				description:
					"Use stable key identifiers while policy governs signing, verification, wrapping, versions, and rotation.",
			},
			{
				title: "Qualify custody",
				description:
					"Prove module loading, capability discovery, operations, interruption handling, audit effects, and certificate scope before naming a hardware path supported.",
			},
		],
		integrations: [
			"AWS CloudHSM",
			"Azure Dedicated HSM",
			"Thales Luna",
			"Entrust nShield",
			"Utimaco CryptoServer",
			"Marvell LiquidSecurity",
			"HashiCorp Vault Transit",
			"Fortanix DSM",
		],
		evidence: [
			{ label: "Algorithm catalog", href: "/algorithms" },
			{ label: "Conformance evidence", href: "/verify/conformance" },
			{
				label: "HSM integration documentation",
				href: "https://docs.qnsi.heossi.com/kms/hsm-integration",
				external: true,
			},
		],
		related: [
			{ label: "Secrets management", href: "/platform/secrets-management" },
			{ label: "Cryptographic inventory", href: "/platform/crypto-inventory" },
			{ label: "Compare key platforms", href: "/compare" },
		],
		faq: [
			{
				question: "Do all eight HSM integrations execute QNSI algorithms in hardware?",
				answer:
					"No. Six connectors use PKCS#11 and two use REST. Hardware mechanisms, firmware, configuration, validation scope, and supported operations vary. A connector is compatibility code; a named deployment becomes supported only after the published qualification path succeeds.",
			},
			{
				question: "Does QNSI currently provide M-of-N threshold key recovery?",
				answer:
					"No. The current escrow route does not create threshold shares or reconstruct a key, so QNSI does not present threshold recovery as available. Any future recovery workflow must be implemented, exercised, and independently evidenced before that claim changes.",
			},
		],
	},
	{
		slug: "secrets-management",
		name: "Quantum-Safe Secrets Management",
		shortName: "Secrets Management",
		description:
			"Manage secret versions, rotation, dynamic credentials, leakage findings, access policy, and audit context behind a consistent tenant boundary.",
		buyerOutcome:
			"Reduce static credential exposure and give security teams a traceable lifecycle for secrets used by people, workloads, automation, and AI agents.",
		audience: ["Security engineering", "DevSecOps", "Platform engineering", "Application teams"],
		status: "source-implemented",
		statusLabel: "Source-backed · end-to-end envelope path not verified",
		evidenceBoundary:
			"Secret CRUD, version, rotation, dynamic-secret, and leakage-detection routes exist in source and portal surfaces. Genuine ML-KEM envelope migration and complete production execution are NOT VERIFIED.",
		capabilities: [
			"Versioned secret storage with per-version history",
			"Rotation and dynamic credential contracts",
			"Leakage detection across eligible logs, code, and stored objects",
			"Tenant-scoped authorization and policy checks",
			"Audit context for reads, writes, rotation, and administrative actions",
			"Migration target for secrets currently split across application and cloud stores",
		],
		workflow: [
			{
				title: "Inventory secret dependencies",
				description:
					"Identify owners, consumers, rotation constraints, expiry, and recovery expectations before migration.",
			},
			{
				title: "Store and version",
				description:
					"Create a tenant-scoped record with explicit policy, metadata, and version history.",
			},
			{
				title: "Issue and rotate",
				description:
					"Use static or eligible dynamic-secret paths and rotate without embedding lifecycle logic in each application.",
			},
			{
				title: "Detect and investigate",
				description:
					"Correlate leakage findings with versions, access records, ownership, and remediation decisions.",
			},
		],
		integrations: ["QNSI SDKs", "REST API", "MCP tools", "Audit service", "Access-control service"],
		evidence: [
			{ label: "Developer integration patterns", href: "/developers/use-cases" },
			{ label: "Security program", href: "/security" },
			{
				label: "Vault documentation",
				href: "https://docs.qnsi.heossi.com/vault",
				external: true,
			},
		],
		related: [
			{ label: "Keys and custody", href: "/platform/key-management" },
			{ label: "Encrypted data", href: "/platform/encrypted-data" },
			{ label: "Identity and access", href: "/platform/identity-access" },
		],
		faq: [
			{
				question: "Are all stored secrets already protected by a proven post-quantum envelope?",
				answer:
					"No. The source defines a PQC-native target and related lifecycle contracts, but genuine KEM envelope migration and complete end-to-end production behavior remain NOT VERIFIED. Public copy must keep that distinction visible.",
			},
			{
				question: "What does leakage detection prove?",
				answer:
					"A leakage finding records that a configured detector observed a matching signal in an eligible source. It does not prove exhaustive scanning, absence of other copies, compromise attribution, or successful remediation.",
			},
		],
	},
	{
		slug: "encrypted-data",
		name: "Encrypted Storage & Search",
		shortName: "Encrypted Data",
		description:
			"Combine governed object storage, retention and replication controls with full-text and vector-search contracts designed for confidential data workflows.",
		buyerOutcome:
			"Keep data lifecycle, search, tenant isolation, and cryptographic policy in one accountable architecture instead of bolting search onto an unrelated storage boundary.",
		audience: [
			"Data platform",
			"Application architecture",
			"AI engineering",
			"Security engineering",
		],
		status: "source-implemented",
		statusLabel: "Source-backed · cryptographic execution boundary not verified",
		evidenceBoundary:
			"Storage, upload, version, retention, replication, classification, indexing, full-text, and vector-search routes exist in source and portal surfaces. End-to-end searchable-encryption guarantees, plaintext boundaries, and genuine PQC envelope execution remain NOT VERIFIED.",
		capabilities: [
			"Tenant-scoped object and document storage",
			"Multipart upload, folders, versions, download, and lifecycle controls",
			"Retention, replication, classification, pipeline, and hot-tier surfaces",
			"Full-text and vector-search contracts",
			"Search indexing, isolation, analytics, health, and synonym management",
			"Audit and policy integration across eligible data operations",
		],
		workflow: [
			{
				title: "Classify the workload",
				description:
					"Define sensitivity, retention, residency, search, recovery, and access requirements.",
			},
			{
				title: "Store and govern",
				description:
					"Upload through tenant-scoped APIs and apply eligible policy, version, classification, and retention controls.",
			},
			{
				title: "Index",
				description:
					"Build the selected full-text or vector index while recording the data and cryptographic boundary being asserted.",
			},
			{
				title: "Search and evidence",
				description:
					"Authorize queries, preserve audit context, and validate the deployed plaintext and key-handling boundary.",
			},
		],
		integrations: ["QNSI SDKs", "REST API", "AI orchestrator", "Vault", "Audit service"],
		evidence: [
			{ label: "Developer patterns", href: "/developers/use-cases" },
			{
				label: "Storage documentation",
				href: "https://docs.qnsi.heossi.com/storage",
				external: true,
			},
			{
				label: "Search documentation",
				href: "https://docs.qnsi.heossi.com/search",
				external: true,
			},
		],
		related: [
			{ label: "AI security", href: "/platform/ai-security" },
			{ label: "Secrets management", href: "/platform/secrets-management" },
			{ label: "Deployment and resilience", href: "/platform/deployment-resilience" },
		],
		faq: [
			{
				question: "Does encrypted search mean the service can never see plaintext?",
				answer:
					"Not automatically. The answer depends on the selected index, client, enclave, key-establishment, query, and deployment path. QNSI documents the target architecture, but end-to-end plaintext exclusion must be proven for the exact deployment.",
			},
			{
				question: "What search modes are represented in the platform?",
				answer:
					"The source includes full-text and vector-search services plus indexing, isolation, health, analytics, and synonym-management surfaces. Availability and cryptographic guarantees still depend on the deployed route and evidence.",
			},
		],
	},
	{
		slug: "identity-access",
		name: "Identity, Access & Workload Trust",
		shortName: "Identity & Access",
		description:
			"Apply tenant-scoped identity, authentication, entitlement, policy-decision, quota, JIT access, simulation, federation, and workload-identity controls.",
		buyerOutcome:
			"Give human and machine access the same explicit policy, short-lived authorization, revocation, and evidence model.",
		audience: ["IAM", "CISO", "Platform engineering", "AI governance"],
		status: "source-implemented",
		statusLabel: "Source-backed · deployment effectiveness not verified",
		evidenceBoundary:
			"Authentication, access-control, PDP, quota, tenant, federation, JIT, simulation, and agent-identity routes exist in source. Complete policy coverage, provider configuration, and deployment-specific enforcement remain NOT VERIFIED.",
		capabilities: [
			"Human, service, and AI-agent identity contracts",
			"Role and policy management with entitlement decisions",
			"Just-in-time access and short-lived signed grants",
			"Dry-run policy simulation and cross-tenant analysis",
			"SAML, OIDC, SCIM, WebAuthn, FIDO2, and passkey integration surfaces",
			"Quota and capability-token enforcement",
		],
		workflow: [
			{
				title: "Establish identity",
				description:
					"Authenticate a user, workload, or agent through an eligible local, passkey, or federated path.",
			},
			{
				title: "Resolve entitlement",
				description:
					"Combine tenant, role, policy, subscription, resource, and contextual signals.",
			},
			{
				title: "Simulate or approve",
				description:
					"Dry-run policy changes or require JIT approval before creating a short-lived grant.",
			},
			{
				title: "Enforce and audit",
				description:
					"Apply the decision at an eligible service boundary and retain the decision context for review.",
			},
		],
		integrations: ["SAML", "OIDC", "SCIM", "WebAuthn/FIDO2", "QNSI SDKs", "MCP"],
		evidence: [
			{
				label: "Authentication-flow documentation",
				href: "https://docs.qnsi.heossi.com/identity/authentication-flows",
				external: true,
			},
			{
				label: "OIDC federation documentation",
				href: "https://docs.qnsi.heossi.com/identity/oidc",
				external: true,
			},
			{ label: "Security program", href: "/security" },
		],
		related: [
			{ label: "AI security", href: "/platform/ai-security" },
			{ label: "Security operations", href: "/platform/security-operations" },
			{ label: "Audit and evidence", href: "/platform/audit-evidence" },
		],
		faq: [
			{
				question: "Does QNSI treat AI agents as identities?",
				answer:
					"The source includes first-class agent and workload identity contracts with tenant scope, credentials, permissions, revocation, and audit context. End-to-end enforcement depends on the calling service and deployment configuration.",
			},
			{
				question: "Can a team test an access-policy change before enforcing it?",
				answer:
					"Policy-simulation routes are represented in the platform so teams can compare proposed decisions with selected historical or synthetic inputs. Simulation does not prove future policy effectiveness or complete event coverage.",
			},
		],
	},
	{
		slug: "ai-security",
		name: "AI Security & Confidential Compute",
		shortName: "AI Security",
		description:
			"Protect model, prompt, agent, training, inference, and event-intelligence workflows with explicit identity, policy, provenance, enclave, and operator-approval boundaries.",
		buyerOutcome:
			"Give AI teams an operational security layer that connects model governance and runtime signals to existing cryptographic, identity, audit, and response controls.",
		audience: ["Chief AI Officer", "CISO", "ML platform", "AI governance"],
		status: "source-implemented",
		statusLabel: "Source-backed · production attestation not verified",
		evidenceBoundary:
			"AI orchestration, model registry, prompt-injection, bias, governance, correlation, root-cause, and remediation-proposal routes exist in source. Production enclave attestation, model behavior, detection effectiveness, and end-to-end automated enforcement remain NOT VERIFIED. Remediation proposals do not bypass authorization or operator approval.",
		capabilities: [
			"Model registry and provenance contracts",
			"Prompt-injection pattern, configuration, and incident surfaces",
			"Bias monitoring, drift, cost, scaling, error, and compliance views",
			"Durable anomaly detection, correlation, and root-cause context",
			"Approval-gated remediation proposals",
			"Confidential-compute architecture across supported enclave families",
		],
		workflow: [
			{
				title: "Register and govern",
				description:
					"Record model identity, provenance, owner, policy, permitted providers, and deployment intent.",
			},
			{
				title: "Authorize the workload",
				description:
					"Bind users, agents, models, data, tools, and enclave requirements to an explicit tenant policy.",
			},
			{
				title: "Observe and correlate",
				description:
					"Retain eligible events for anomaly detection, prompt-security signals, cross-service correlation, and root-cause context.",
			},
			{
				title: "Propose and approve",
				description:
					"Generate a remediation proposal, then apply normal authorization and configured operator approval before execution.",
			},
		],
		integrations: [
			"Intel SGX and TDX",
			"AMD SEV-SNP",
			"AWS Nitro Enclaves",
			"NVIDIA Confidential Computing",
			"ARM TrustZone and CCA/RME",
			"IBM Secure Execution",
			"MCP",
		],
		evidence: [
			{
				label: "AI event-intelligence documentation",
				href: "https://docs.qnsi.heossi.com/observability/ai-intelligence",
				external: true,
			},
			{ label: "AI integration pattern", href: "/developers/use-cases/ai-agent-mcp-integration" },
			{ label: "MCP server", href: "/mcp" },
		],
		related: [
			{ label: "Identity and workload trust", href: "/platform/identity-access" },
			{ label: "Encrypted data", href: "/platform/encrypted-data" },
			{ label: "Observability", href: "/platform/observability" },
		],
		faq: [
			{
				question: "Does QNSI automatically remediate AI incidents without approval?",
				answer:
					"No. The event-intelligence design produces remediation proposals. It does not bypass tenant authorization or configured operator-approval policy. Any automated execution claim requires evidence for the exact rule, permission, and deployment.",
			},
			{
				question: "Does listing an enclave prove that a workload ran inside it?",
				answer:
					"No. An enclave integration or architecture option is not runtime attestation. A deployment claim requires a valid attestation bound to the workload, code identity, configuration, time, and verification policy.",
			},
		],
	},
	{
		slug: "security-operations",
		name: "Security Operations & Cryptographic Response",
		shortName: "Security Operations",
		description:
			"Connect cryptographic posture, findings, attack paths, certificate lifecycle, key-compromise response, SIEM delivery, webhooks, and approval-aware response workflows.",
		buyerOutcome:
			"Turn cryptographic and platform signals into prioritized, accountable response work without treating a dashboard status as proof that remediation occurred.",
		audience: ["SOC", "Incident response", "CISO", "Security engineering"],
		status: "source-implemented",
		statusLabel: "Source-backed · response execution requires evidence",
		evidenceBoundary:
			"Findings, alerts, breach, attack-path, certificate, SIEM, webhook, key-compromise, policy, and remediation-rule routes exist in source. Detection completeness, causal attribution, response effects, and deployment-specific execution remain NOT VERIFIED.",
		capabilities: [
			"Cryptographic findings and policy-violation workflows",
			"Graph-based attack-path analysis",
			"Key-compromise response planning and controlled execution",
			"Certificate lifecycle and migration planning",
			"SIEM, webhook, and streaming integration surfaces",
			"Dry-run and approval-aware remediation rules",
		],
		workflow: [
			{
				title: "Detect",
				description:
					"Ingest an eligible finding, alert, breach, drift, certificate, or cryptographic posture signal.",
			},
			{
				title: "Correlate",
				description:
					"Relate the signal to identities, keys, policies, services, resources, and other retained events.",
			},
			{
				title: "Plan",
				description:
					"Select an applicable response, preview affected resources, and apply approval requirements.",
			},
			{
				title: "Execute and verify",
				description:
					"Run only through authorized service operations, then confirm observed results and preserve evidence separately from intent.",
			},
		],
		integrations: ["SIEM", "Webhooks", "Audit streaming", "KMS", "Vault", "Identity and access"],
		evidence: [
			{ label: "Security program", href: "/security" },
			{ label: "TrustHub", href: "/trust" },
			{
				label: "Security documentation",
				href: "https://docs.qnsi.heossi.com/security",
				external: true,
			},
		],
		related: [
			{ label: "Audit and evidence", href: "/platform/audit-evidence" },
			{ label: "Observability", href: "/platform/observability" },
			{ label: "Keys and custody", href: "/platform/key-management" },
		],
		faq: [
			{
				question: "Does a remediation rule prove that a response ran?",
				answer:
					"No. A rule, playbook, or proposal records intended behavior. Trust the returned service result, timestamps, affected resources, authorization record, and independently reviewable evidence for the actual execution.",
			},
			{
				question: "Can QNSI replace a SIEM?",
				answer:
					"QNSI provides cryptographic and platform security signals plus streaming and webhook integration surfaces. It is not presented as a universal replacement for an enterprise SIEM, case-management system, or incident-response team.",
			},
		],
	},
	{
		slug: "audit-evidence",
		name: "Tamper-Evident Audit & Assurance Evidence",
		shortName: "Audit & Evidence",
		description:
			"Preserve service events, cryptographic context, retention policy, signed checkpoints, streaming, evidence packs, and replay-oriented verification boundaries.",
		buyerOutcome:
			"Give engineering, security, auditors, and regulators a shared record that separates configured controls, observed events, generated reports, validation, and external assurance.",
		audience: ["Audit", "Compliance", "CISO", "Platform operations"],
		status: "source-implemented",
		statusLabel: "Source-backed · complete event coverage not verified",
		evidenceBoundary:
			"Audit ingestion, chaining, checkpoint signing, retention, streaming, reporting, and evidence-pack contracts exist in source. Complete service-event coverage, checkpoint publication, replay, and independent production verification remain NOT VERIFIED.",
		capabilities: [
			"Hash-linked event-ledger architecture",
			"ML-DSA checkpoint-signing contracts",
			"Tenant-scoped retention and streaming surfaces",
			"Evidence packs and framework-control mappings",
			"Receipt and replay-oriented verification contracts",
			"Explicit assurance states: mapped, observed, validated, externally assessed",
		],
		workflow: [
			{
				title: "Record",
				description:
					"Accept an eligible event with tenant, actor, resource, operation, result, and cryptographic context.",
			},
			{
				title: "Link and checkpoint",
				description:
					"Extend the configured chain and create a signed checkpoint according to the implemented policy.",
			},
			{
				title: "Retain and stream",
				description:
					"Apply the tenant retention target and deliver eligible events to configured downstream systems.",
			},
			{
				title: "Package and verify",
				description:
					"Generate an evidence package while keeping report generation, signature validation, and external assurance as separate states.",
			},
		],
		integrations: [
			"SIEM and WebSocket consumers",
			"Compliance mapping",
			"KMS",
			"Vault",
			"Access control",
		],
		evidence: [
			{ label: "Public verification", href: "/verify" },
			{ label: "Compliance mapping", href: "/security/compliance" },
			{ label: "TrustHub", href: "/trust" },
		],
		related: [
			{ label: "Security operations", href: "/platform/security-operations" },
			{ label: "Observability", href: "/platform/observability" },
			{ label: "Legal and policy library", href: "/legal" },
		],
		faq: [
			{
				question: "Does generating an evidence pack prove compliance?",
				answer:
					"No. A report packages recorded observations and workflow state. Signature validity, evidence completeness, control effectiveness, legal applicability, certification, and regulator acceptance are distinct questions.",
			},
			{
				question: "Is every QNSI operation proven to enter the audit chain?",
				answer:
					"No. The audit architecture and event contracts are source-backed, but complete production ingestion across every service and operation remains NOT VERIFIED unless a deployment-specific evidence set proves it.",
			},
		],
	},
	{
		slug: "observability",
		name: "Observability, SLOs & Operational Intelligence",
		shortName: "Observability",
		description:
			"Bring service health, metrics, traces, logs, SLOs, anomalies, costs, security context, and deployment-specific evidence into one operational view.",
		buyerOutcome:
			"Distinguish healthy, degraded, unavailable, unknown, and not-discovered states instead of converting missing telemetry into a reassuring green dashboard.",
		audience: ["SRE", "Platform operations", "CISO", "FinOps"],
		status: "production-surface",
		statusLabel: "Live portal surface · data depends on connected telemetry",
		evidenceBoundary:
			"The portal fetches live observability and related security-monitoring APIs and explicitly represents unknown or unavailable data. Dashboard presence does not prove service availability, SLO attainment, complete telemetry, or corrective action.",
		capabilities: [
			"Service-health and latency views",
			"SLO status and breach context",
			"Structured metrics, traces, and logs",
			"Anomaly and risk signals",
			"Cost and usage intelligence",
			"Deployment-specific observability boundaries for private environments",
		],
		workflow: [
			{
				title: "Connect telemetry",
				description:
					"Configure eligible service sources and deployment-specific observability endpoints.",
			},
			{
				title: "Normalize state",
				description:
					"Preserve healthy, degraded, down, unknown, unavailable, and not-discovered distinctions.",
			},
			{
				title: "Correlate",
				description:
					"Relate operational, security, AI, cost, and compliance context without inferring missing evidence.",
			},
			{
				title: "Investigate",
				description:
					"Move from the aggregate view to timestamps, source responses, alerts, traces, and service-specific evidence.",
			},
		],
		integrations: [
			"OpenTelemetry",
			"Service health APIs",
			"Security monitoring",
			"Audit streaming",
			"Cost services",
		],
		evidence: [
			{ label: "Public service status", href: "/status" },
			{
				label: "Observability documentation",
				href: "https://docs.qnsi.heossi.com/observability",
				external: true,
			},
			{
				label: "AI event intelligence",
				href: "https://docs.qnsi.heossi.com/observability/ai-intelligence",
				external: true,
			},
		],
		related: [
			{ label: "Security operations", href: "/platform/security-operations" },
			{ label: "Audit and evidence", href: "/platform/audit-evidence" },
			{ label: "Deployment and resilience", href: "/platform/deployment-resilience" },
		],
		faq: [
			{
				question: "Why does QNSI show an unknown service state?",
				answer:
					"Unknown means the portal lacks enough current evidence to classify the service as healthy, degraded, or down. It can reflect a missing source, authorization problem, timeout, unsupported probe, or unavailable upstream response and should not be silently treated as healthy.",
			},
			{
				question: "Does an SLO dashboard prove the contractual SLA was met?",
				answer:
					"No. An SLO view is operational telemetry. Contract scope, exclusions, measurement window, credits, source completeness, and signed commercial terms determine an SLA outcome.",
			},
		],
	},
	{
		slug: "developer-security",
		name: "Developer Platform & Secure Delivery",
		shortName: "Developer Platform",
		description:
			"Integrate QNSI through first-party SDKs, REST, CLI, MCP, WebSockets, browser patterns, source scanning, code signing, and secure build-pipeline surfaces.",
		buyerOutcome:
			"Let application and platform teams adopt governed cryptography through stable interfaces without embedding algorithm lifecycle decisions throughout the codebase.",
		audience: ["Developers", "Platform engineering", "DevSecOps", "Security architecture"],
		status: "production-surface",
		statusLabel: "Published SDKs · operation support varies by service",
		evidenceBoundary:
			"TypeScript, Python, Rust, JVM/Android, Go, and MCP distribution surfaces are published or documented. Package availability does not prove every SDK method, backend route, cryptographic effect, audit effect, or deployment behavior.",
		capabilities: [
			"TypeScript/Node, Python, Go, Rust, and JVM/Android SDK surfaces",
			"REST API and OpenAPI documentation",
			"QNSI CLI with local source-code discovery",
			"MCP tools for tenant-scoped engineering operations",
			"WebSocket and event-stream integration",
			"Browser reference architecture, code-signing, and build-pipeline patterns",
		],
		workflow: [
			{
				title: "Choose the interface",
				description:
					"Select the supported SDK, REST, CLI, MCP, browser, or event-stream surface for the workload.",
			},
			{
				title: "Authenticate and scope",
				description:
					"Bind the client to a tenant, identity, audience, entitlement, and least-privilege operation set.",
			},
			{
				title: "Call a governed service",
				description:
					"Use stable resource identifiers while server-side policy selects permitted operations and algorithms.",
			},
			{
				title: "Test negative paths",
				description:
					"Verify authorization failures, downgrade rejection, rotation, revocation, retry, audit, and unavailable-service behavior.",
			},
		],
		integrations: [
			"TypeScript/Node",
			"Python",
			"Go",
			"Rust",
			"JVM/Android",
			"MCP",
			"REST",
			"WebSockets",
		],
		evidence: [
			{ label: "Developer hub", href: "/developers" },
			{ label: "Build patterns", href: "/developers/use-cases" },
			{
				label: "Public source and examples",
				href: "https://github.com/heossihq/qnsi-public",
				external: true,
			},
		],
		related: [
			{ label: "MCP server", href: "/mcp" },
			{ label: "Algorithm catalog", href: "/algorithms" },
			{ label: "Cryptographic discovery", href: "/platform/crypto-inventory" },
		],
		faq: [
			{
				question: "Does every SDK expose every backend operation?",
				answer:
					"No. The packages share wire contracts and common service clients, but language, version, backend route, entitlement, and deployment support can differ. Verify the published package version and exact operation required.",
			},
			{
				question: "Is the browser SDK proof of production PQC transport?",
				answer:
					"No. A browser package or reference architecture does not prove the public edge negotiated a PQC or hybrid group. Transport claims require an observed handshake and deployment-specific evidence.",
			},
		],
	},
	{
		slug: "deployment-resilience",
		name: "Deployment, Isolation & Resilience",
		shortName: "Deployment & Resilience",
		description:
			"Define the network, tenancy, region, compute, custody, observability, continuity, and operational boundaries for QNSI Cloud or a customer-specific deployment.",
		buyerOutcome:
			"Turn deployment requirements into explicit architecture and contractual commitments instead of assuming that a public-cloud diagram proves sovereignty, failover, or recovery.",
		audience: ["Enterprise architecture", "CISO", "Infrastructure", "Procurement"],
		status: "deployment-qualified",
		statusLabel: "Cloud live · dedicated topologies are engagement-specific",
		evidenceBoundary:
			"QNSI Cloud is the current public service. Private VPC, on-premises, air-gapped, sovereign, isolated-tenancy, failover, GPU, and customer-custody patterns are engagement-specific architecture options. They are not generally available or proven for a customer until provisioned, tested, evidenced, and contractually scoped.",
		capabilities: [
			"QNSI Cloud public service",
			"Customer-VPC and private connectivity architecture",
			"Isolated-tenancy and residency controls",
			"On-premises, air-gapped, and sovereign architecture options",
			"Region, failover, backup, recovery, and observability planning",
			"CPU, enclave, GPU, and customer-managed custody selection",
		],
		workflow: [
			{
				title: "Classify requirements",
				description:
					"Record data, key, operator, network, jurisdiction, availability, recovery, and evidence constraints.",
			},
			{
				title: "Select topology",
				description:
					"Choose the service, tenancy, connectivity, region, compute, and custody pattern that meets those constraints.",
			},
			{
				title: "Qualify",
				description:
					"Exercise access, key operations, failure, recovery, observability, audit, and support procedures in the exact environment.",
			},
			{
				title: "Contract and operate",
				description:
					"Put SLA, RTO/RPO, residency, support, shared responsibility, and evidence obligations in the signed agreement.",
			},
		],
		integrations: [
			"AWS",
			"Customer VPC",
			"PKCS#11 and REST custody",
			"Private observability",
			"Infrastructure as code",
		],
		evidence: [
			{ label: "Platform architecture", href: "/platform" },
			{ label: "Business continuity policy", href: "/legal/business-continuity" },
			{ label: "Service status", href: "/status" },
		],
		related: [
			{ label: "Keys and custody", href: "/platform/key-management" },
			{ label: "Observability", href: "/platform/observability" },
			{ label: "Contact enterprise architecture", href: "/contact" },
		],
		faq: [
			{
				question: "Are private VPC, sovereign, and air-gapped deployments generally available?",
				answer:
					"No. They are engagement-specific architecture options. A topology becomes a customer capability only after it is provisioned, qualified, evidenced, and included in the signed commercial and operational scope.",
			},
			{
				question: "Does QNSI publish a universal RTO or RPO?",
				answer:
					"No. QNSI does not currently claim a universal public RTO/RPO or multi-region active-active topology. Customer-specific continuity commitments belong in the applicable signed agreement after the deployment design is qualified.",
			},
		],
	},
] as const;

export function findPublicCapability(slug: string): PublicCapabilityArea | undefined {
	return PUBLIC_CAPABILITY_AREAS.find((area) => area.slug === slug);
}

export const LEGACY_CAPABILITY_DESTINATIONS: Readonly<Record<string, string>> = {
	access: "/platform/identity-access",
	"ai-orchestrator": "/platform/ai-security",
	audit: "/platform/audit-evidence",
	"browser-sdk": "/platform/developer-security",
	byoh: "/platform/key-management",
	cbom: "/platform/crypto-inventory",
	"crypto-policy": "/platform/key-management",
	deployment: "/platform/deployment-resilience",
	enclaves: "/platform/ai-security",
	hsm: "/platform/key-management",
	kms: "/platform/key-management",
	"pqc-tls": "/platform/deployment-resilience",
	quota: "/platform/identity-access",
	"sse-x": "/platform/encrypted-data",
	tenant: "/platform/identity-access",
	vault: "/platform/secrets-management",
};
