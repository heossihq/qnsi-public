import { randomUUID } from "node:crypto";

import { logger } from "../logger.js";

/**
 * Compliance Framework Control Mapping
 *
 * Maps enterprise compliance frameworks to QNSP platform capabilities.
 * Each control maps to a verifiable platform feature with evidence collection.
 */

export type ControlStatus = "met" | "partial" | "not_met" | "not_applicable" | "not_verified";
export type FrameworkId =
	| "iso27001"
	| "iso42001"
	| "iso19790"
	| "soc2"
	| "hipaa"
	| "gdpr"
	| "pci-dss"
	| "pdpa"
	| "mas-trm";

export interface ComplianceControl {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly status: ControlStatus;
	readonly evidenceSources: readonly string[];
	readonly lastAssessedAt: string;
}

export interface EvidenceRequestContext {
	readonly tenantId: string;
	readonly traceId: string;
}

export interface ComplianceEvidenceSummary {
	/** The stats endpoint does not expose a 24-hour event count. */
	readonly auditEventsLast24h: null;
	/** Tenant-scoped all-time count reported by the protected audit stats endpoint. */
	readonly auditEventsTotal: number | null;
	readonly kmsOperationsLast24h: number | null;
	readonly activeAccessPolicies: number | null;
	/** Checkpoint payloads embed signer keys and are not accepted as trusted evidence. */
	readonly auditCheckpointsExist: null;
	readonly securityAlertsLast24h: number | null;
}

export interface ComplianceFrameworkDetail {
	readonly id: FrameworkId;
	readonly name: string;
	readonly version: string;
	readonly controls: readonly ComplianceControl[];
	readonly overallScore: number | null;
	readonly lastAssessedAt: string;
	readonly evidenceSummary?: ComplianceEvidenceSummary;
}

export interface ComplianceReport {
	readonly id: string;
	readonly tenantId: string;
	readonly frameworkId: FrameworkId;
	readonly generatedAt: string;
	readonly overallScore: number | null;
	readonly controlsSummary: {
		readonly met: number;
		readonly partial: number;
		readonly notMet: number;
		readonly notApplicable: number;
		readonly notVerified: number;
	};
	readonly controls: readonly ComplianceControl[];
	readonly evidenceSummary?: ComplianceEvidenceSummary | undefined;
	readonly assessmentMethod: string;
}

interface ComplianceServiceConfig {
	readonly authServiceUrl: string | null;
	readonly auditServiceUrl: string | null;
	readonly kmsServiceUrl: string | null;
	readonly accessControlServiceUrl: string | null;
	readonly securityMonitoringServiceUrl: string | null;
	readonly serviceId?: string | null;
	readonly serviceSecret?: string | null;
}

const UNAVAILABLE_EVIDENCE: ComplianceEvidenceSummary = {
	auditEventsLast24h: null,
	auditEventsTotal: null,
	kmsOperationsLast24h: null,
	activeAccessPolicies: null,
	auditCheckpointsExist: null,
	securityAlertsLast24h: null,
};

async function requestInternalServiceToken(
	config: ComplianceServiceConfig,
	timeoutMs: number,
): Promise<string | null> {
	if (!config.authServiceUrl || !config.serviceId || !config.serviceSecret) return null;

	try {
		const response = await fetch(new URL("/auth/service-token", config.authServiceUrl), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.serviceSecret}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				serviceId: config.serviceId,
				audience: "internal-service",
			}),
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (!response.ok) return null;
		const payload = (await response.json()) as { accessToken?: unknown };
		return typeof payload.accessToken === "string" && payload.accessToken.length > 0
			? payload.accessToken
			: null;
	} catch {
		return null;
	}
}

async function collectEvidenceMetrics(
	config: ComplianceServiceConfig,
	context: EvidenceRequestContext | undefined,
	timeoutMs: number = 5_000,
): Promise<ComplianceEvidenceSummary> {
	if (!context || !config.auditServiceUrl) return UNAVAILABLE_EVIDENCE;

	const token = await requestInternalServiceToken(config, timeoutMs);
	if (!token) return UNAVAILABLE_EVIDENCE;

	try {
		const response = await fetch(new URL("/audit/v1/stats", config.auditServiceUrl), {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"x-tenant-id": context.tenantId,
				"x-qnsp-tenant": context.tenantId,
				"x-qnsp-trace-id": context.traceId,
			},
			signal: AbortSignal.timeout(timeoutMs),
			cache: "no-store",
		});
		if (!response.ok) return UNAVAILABLE_EVIDENCE;
		const payload = (await response.json()) as unknown;
		return {
			...UNAVAILABLE_EVIDENCE,
			auditEventsTotal: extractNumericField(payload, "totalEvents"),
		};
	} catch {
		return UNAVAILABLE_EVIDENCE;
	}
}

function extractNumericField(data: unknown, field: string): number | null {
	if (!data || typeof data !== "object" || !(field in data)) return null;
	const value = (data as Record<string, unknown>)[field];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const FRAMEWORK_METADATA: Record<FrameworkId, { name: string; version: string }> = {
	soc2: { name: "SOC 2 Type II", version: "2017" },
	hipaa: { name: "HIPAA Security Rule", version: "45 CFR Part 164" },
	gdpr: { name: "GDPR", version: "Regulation (EU) 2016/679" },
	"pci-dss": { name: "PCI DSS", version: "v4.0.1" },
	iso27001: { name: "ISO/IEC 27001", version: "2022" },
	iso42001: { name: "ISO/IEC 42001", version: "2023" },
	iso19790: { name: "ISO/IEC 19790", version: "2025" },
	pdpa: { name: "PDPA (Singapore)", version: "Personal Data Protection Act 2012 (Rev. 2021)" },
	"mas-trm": {
		name: "MAS TRM Guidelines",
		version: "Technology Risk Management Guidelines (Jan 2021)",
	},
};

/**
 * Retained for compatibility with existing tests/callers. Compliance effectiveness is no
 * longer cached or derived from service health, so there is no cache to reset.
 */
export function _resetCapabilitiesCacheForTesting(): void {}

type ControlDef = Omit<ComplianceControl, "status" | "lastAssessedAt">;

const FRAMEWORK_CONTROLS: Record<FrameworkId, readonly ControlDef[]> = {
	soc2: [
		{
			id: "CC6.1",
			name: "Logical Access Controls",
			description: "Restrict logical access to information assets",
			evidenceSources: ["auth-service", "access-control-service"],
		},
		{
			id: "CC6.6",
			name: "Encryption in Transit",
			description: "Protect data in transit using encryption",
			evidenceSources: ["edge-gateway", "cryptography"],
		},
		{
			id: "CC6.7",
			name: "Encryption at Rest",
			description: "Protect data at rest using encryption",
			evidenceSources: ["vault-service", "kms-service", "storage-service"],
		},
		{
			id: "CC7.2",
			name: "Security Monitoring",
			description: "Monitor system components for anomalies",
			evidenceSources: ["security-monitoring-service", "observability-service"],
		},
		{
			id: "CC8.1",
			name: "Change Management",
			description: "Manage changes to infrastructure and software",
			evidenceSources: ["audit-service", "crypto-inventory-service"],
		},
		{
			id: "CC9.1",
			name: "Risk Mitigation",
			description: "Identify and mitigate risks",
			evidenceSources: ["security-monitoring-service", "crypto-inventory-service"],
		},
	],
	hipaa: [
		{
			id: "164.312(a)(1)",
			name: "Access Control",
			description: "Implement access controls for ePHI",
			evidenceSources: ["auth-service", "access-control-service"],
		},
		{
			id: "164.312(a)(2)(iv)",
			name: "Encryption and Decryption",
			description: "Encrypt and decrypt ePHI",
			evidenceSources: ["vault-service", "kms-service", "cryptography"],
		},
		{
			id: "164.312(b)",
			name: "Audit Controls",
			description: "Record and examine access to ePHI",
			evidenceSources: ["audit-service"],
		},
		{
			id: "164.312(c)(1)",
			name: "Integrity Controls",
			description: "Protect ePHI from improper alteration",
			evidenceSources: ["audit-service", "cryptography"],
		},
		{
			id: "164.312(d)",
			name: "Person Authentication",
			description: "Verify identity of persons seeking access",
			evidenceSources: ["auth-service"],
		},
		{
			id: "164.312(e)(1)",
			name: "Transmission Security",
			description: "Guard against unauthorized access during transmission",
			evidenceSources: ["edge-gateway", "cryptography"],
		},
	],
	gdpr: [
		{
			id: "Art.25",
			name: "Data Protection by Design",
			description: "Implement data protection by design and default",
			evidenceSources: ["cryptography", "vault-service", "kms-service"],
		},
		{
			id: "Art.30",
			name: "Records of Processing",
			description: "Maintain records of processing activities",
			evidenceSources: ["audit-service"],
		},
		{
			id: "Art.32",
			name: "Security of Processing",
			description: "Implement appropriate technical measures",
			evidenceSources: ["auth-service", "edge-gateway", "vault-service", "kms-service"],
		},
		{
			id: "Art.33",
			name: "Breach Notification",
			description: "Notify supervisory authority of breaches",
			evidenceSources: ["security-monitoring-service"],
		},
		{
			id: "Art.35",
			name: "Impact Assessment",
			description: "Carry out data protection impact assessments",
			evidenceSources: ["crypto-inventory-service", "security-monitoring-service"],
		},
	],
	"pci-dss": [
		{
			id: "Req.3",
			name: "Protect Stored Data",
			description: "Protect stored account data",
			evidenceSources: ["vault-service", "kms-service", "storage-service"],
		},
		{
			id: "Req.4",
			name: "Encrypt Transmissions",
			description: "Encrypt transmission of cardholder data",
			evidenceSources: ["edge-gateway", "cryptography"],
		},
		{
			id: "Req.7",
			name: "Restrict Access",
			description: "Restrict access to cardholder data by business need",
			evidenceSources: ["access-control-service", "auth-service"],
		},
		{
			id: "Req.8",
			name: "Identify Users",
			description: "Identify users and authenticate access",
			evidenceSources: ["auth-service"],
		},
		{
			id: "Req.10",
			name: "Track and Monitor",
			description: "Log and monitor all access to network resources",
			evidenceSources: ["audit-service", "security-monitoring-service"],
		},
		{
			id: "Req.12",
			name: "Security Policy",
			description: "Maintain an information security policy",
			evidenceSources: ["crypto-inventory-service", "security-monitoring-service"],
		},
	],
	iso27001: [
		{
			id: "A.9.1",
			name: "Access Control Policy",
			description: "Establish access control policy",
			evidenceSources: ["access-control-service", "auth-service"],
		},
		{
			id: "A.10.1",
			name: "Cryptographic Controls",
			description: "Use cryptographic controls to protect information",
			evidenceSources: ["cryptography", "kms-service", "vault-service"],
		},
		{
			id: "A.12.4",
			name: "Logging and Monitoring",
			description: "Record events and generate evidence",
			evidenceSources: ["audit-service", "observability-service"],
		},
		{
			id: "A.13.1",
			name: "Network Security",
			description: "Manage and control networks to protect information",
			evidenceSources: ["edge-gateway"],
		},
		{
			id: "A.14.1",
			name: "Security in Development",
			description: "Ensure security is designed into information systems",
			evidenceSources: ["crypto-inventory-service", "cryptography"],
		},
		{
			id: "A.18.1",
			name: "Compliance",
			description: "Avoid breaches of legal and contractual obligations",
			evidenceSources: ["audit-service", "crypto-inventory-service", "security-monitoring-service"],
		},
	],
	iso42001: [
		{
			id: "AIMS-4",
			name: "Organizational context",
			description:
				"Assess the defined scope, interested parties, and context of the AI management system",
			evidenceSources: ["ai-orchestrator", "audit-service"],
		},
		{
			id: "AIMS-5",
			name: "Leadership and policy",
			description: "Assess leadership accountability, roles, and documented AI policy",
			evidenceSources: ["ai-orchestrator", "access-control-service", "audit-service"],
		},
		{
			id: "AIMS-6",
			name: "Risk and objective planning",
			description: "Assess AI risk treatment, objectives, and planned changes",
			evidenceSources: ["ai-orchestrator", "security-monitoring-service", "audit-service"],
		},
		{
			id: "AIMS-7",
			name: "Support and documented information",
			description: "Assess resources, competence, communication, and controlled documentation",
			evidenceSources: ["ai-orchestrator", "audit-service"],
		},
		{
			id: "AIMS-8",
			name: "Operational controls",
			description:
				"Assess lifecycle controls for responsible development, provision, and use of AI systems",
			evidenceSources: ["ai-orchestrator", "security-monitoring-service", "audit-service"],
		},
		{
			id: "AIMS-9",
			name: "Performance evaluation",
			description: "Assess monitoring, measurement, internal audit, and management review evidence",
			evidenceSources: ["ai-orchestrator", "observability-service", "audit-service"],
		},
		{
			id: "AIMS-10",
			name: "Improvement",
			description: "Assess nonconformity handling, corrective action, and continual improvement",
			evidenceSources: ["ai-orchestrator", "audit-service"],
		},
	],
	iso19790: [
		{
			id: "CM-1",
			name: "Cryptographic module specification",
			description: "Assess the declared module boundary, interfaces, and approved operating modes",
			evidenceSources: ["kms-service", "crypto-inventory-service", "audit-service"],
		},
		{
			id: "CM-2",
			name: "Roles, services, and authentication",
			description: "Assess authorized roles, services, and authentication controls for module use",
			evidenceSources: ["auth-service", "access-control-service", "kms-service"],
		},
		{
			id: "CM-3",
			name: "Sensitive security parameter management",
			description: "Assess lifecycle protection for keys and other sensitive security parameters",
			evidenceSources: ["kms-service", "vault-service", "audit-service"],
		},
		{
			id: "CM-4",
			name: "Self-tests and lifecycle assurance",
			description:
				"Assess self-tests, configuration control, delivery, operation, and maintenance evidence",
			evidenceSources: ["kms-service", "security-monitoring-service", "audit-service"],
		},
	],
	pdpa: [
		{
			id: "PDPA-S13",
			name: "Consent Obligation",
			description:
				"Obtain consent before collecting, using, or disclosing personal data (Section 13-17)",
			evidenceSources: ["audit-service", "tenant-service"],
		},
		{
			id: "PDPA-S18",
			name: "Purpose Limitation",
			description:
				"Collect, use, or disclose personal data only for purposes a reasonable person would consider appropriate (Section 18)",
			evidenceSources: ["audit-service"],
		},
		{
			id: "PDPA-S22",
			name: "Access and Correction",
			description:
				"Provide individuals access to and correction of their personal data (Sections 21-22)",
			evidenceSources: ["auth-service", "tenant-service"],
		},
		{
			id: "PDPA-S24",
			name: "Protection Obligation",
			description:
				"Protect personal data with reasonable security arrangements against unauthorized access, collection, use, disclosure, or similar risks (Section 24)",
			evidenceSources: ["vault-service", "kms-service", "edge-gateway", "cryptography"],
		},
		{
			id: "PDPA-S25",
			name: "Retention Limitation",
			description:
				"Cease retention of personal data when no longer necessary for legal or business purposes (Section 25)",
			evidenceSources: ["audit-service", "storage-service"],
		},
		{
			id: "PDPA-S26B",
			name: "Data Breach Notification",
			description:
				"Notify PDPC and affected individuals of notifiable data breaches (Section 26B-26E)",
			evidenceSources: ["security-monitoring-service", "audit-service"],
		},
		{
			id: "PDPA-S26",
			name: "Transfer Limitation",
			description:
				"Ensure adequate protection for personal data transferred outside Singapore (Section 26)",
			evidenceSources: ["edge-gateway", "cryptography"],
		},
		{
			id: "PDPA-S11",
			name: "Data Protection Officer",
			description:
				"Designate a data protection officer and make business contact information available (Section 11(3))",
			evidenceSources: ["tenant-service"],
		},
		{
			id: "PDPA-S12",
			name: "Data Protection Policies",
			description:
				"Develop and implement policies and practices to meet PDPA obligations (Section 12)",
			evidenceSources: ["audit-service", "crypto-inventory-service"],
		},
	],
	"mas-trm": [
		{
			id: "TRM-4.1",
			name: "IT Governance and Oversight",
			description:
				"Board and senior management oversight of technology risk management (Section 4.1)",
			evidenceSources: ["audit-service", "security-monitoring-service"],
		},
		{
			id: "TRM-5.1",
			name: "Technology Risk Management Framework",
			description:
				"Establish a sound and robust technology risk management framework (Section 5.1)",
			evidenceSources: ["security-monitoring-service", "crypto-inventory-service"],
		},
		{
			id: "TRM-6.1",
			name: "IT Project Management and Security-by-Design",
			description:
				"Incorporate security requirements in the design of IT systems (Section 6.1-6.3)",
			evidenceSources: ["cryptography", "crypto-inventory-service"],
		},
		{
			id: "TRM-7.1",
			name: "System Security",
			description:
				"Implement robust security measures for IT systems including access controls and encryption (Section 7)",
			evidenceSources: ["auth-service", "access-control-service", "kms-service", "vault-service"],
		},
		{
			id: "TRM-8.1",
			name: "Cryptography",
			description:
				"Adopt robust and sound cryptographic algorithms and key management practices (Section 8)",
			evidenceSources: ["kms-service", "cryptography", "vault-service"],
		},
		{
			id: "TRM-9.1",
			name: "Data and Infrastructure Security",
			description:
				"Implement measures to protect data confidentiality, integrity, and availability (Section 9)",
			evidenceSources: ["vault-service", "storage-service", "edge-gateway", "kms-service"],
		},
		{
			id: "TRM-10.1",
			name: "Access Control",
			description: "Implement strong authentication and access control mechanisms (Section 10)",
			evidenceSources: ["auth-service", "access-control-service"],
		},
		{
			id: "TRM-11.1",
			name: "Cyber Security Operations",
			description:
				"Establish cyber security operations centre for continuous monitoring and incident response (Section 11)",
			evidenceSources: ["security-monitoring-service", "observability-service"],
		},
		{
			id: "TRM-12.1",
			name: "Cyber Incident Management",
			description:
				"Establish incident management and response plan for cyber incidents (Section 12)",
			evidenceSources: ["security-monitoring-service", "audit-service"],
		},
		{
			id: "TRM-13.1",
			name: "Audit Logging and Monitoring",
			description:
				"Implement audit logging and monitoring to detect anomalous activities (Section 13)",
			evidenceSources: ["audit-service", "observability-service", "security-monitoring-service"],
		},
	],
};

export class ComplianceService {
	private readonly config: ComplianceServiceConfig;

	constructor(config: ComplianceServiceConfig) {
		this.config = config;
		logger.info(
			"ComplianceService initialized - control effectiveness requires protected evidence and is independent of service liveness",
		);
	}

	async getFrameworkDetails(
		frameworkId: FrameworkId,
		_tenantComplianceTags: readonly string[],
		evidenceContext?: EvidenceRequestContext,
	): Promise<ComplianceFrameworkDetail | null> {
		const controlDefs = FRAMEWORK_CONTROLS[frameworkId];
		if (!controlDefs) return null;

		const evidence = await collectEvidenceMetrics(this.config, evidenceContext);
		const meta = FRAMEWORK_METADATA[frameworkId];
		const now = new Date().toISOString();

		const controls: ComplianceControl[] = controlDefs.map((def) => ({
			...def,
			status: "not_verified",
			lastAssessedAt: now,
		}));

		return {
			id: frameworkId,
			name: meta.name,
			version: meta.version,
			controls,
			overallScore: null,
			lastAssessedAt: now,
			evidenceSummary: evidence,
		};
	}

	async listFrameworks(
		tenantComplianceTags: readonly string[],
		evidenceContext?: EvidenceRequestContext,
	): Promise<ComplianceFrameworkDetail[]> {
		const frameworkIds: readonly FrameworkId[] = ["iso27001", "iso42001", "iso19790"];

		if (tenantComplianceTags.length === 0) {
			const results = await Promise.all(
				frameworkIds.map((id) =>
					this.getFrameworkDetails(id, tenantComplianceTags, evidenceContext),
				),
			);
			return results.filter((f): f is ComplianceFrameworkDetail => f !== null);
		}

		const tagToFramework: Record<string, FrameworkId> = {
			iso27001: "iso27001",
			"iso-27001": "iso27001",
			iso42001: "iso42001",
			"iso-42001": "iso42001",
			iso19790: "iso19790",
			"iso-19790": "iso19790",
		};

		const matchedIds = new Set<FrameworkId>();
		for (const tag of tenantComplianceTags) {
			const normalized = tag.toLowerCase().trim();
			const fwId = tagToFramework[normalized];
			if (fwId) matchedIds.add(fwId);
		}

		const selectedIds = matchedIds.size === 0 ? frameworkIds : Array.from(matchedIds);
		const results = await Promise.all(
			selectedIds.map((id) => this.getFrameworkDetails(id, tenantComplianceTags, evidenceContext)),
		);
		return results.filter((f): f is ComplianceFrameworkDetail => f !== null);
	}

	async generateReport(
		tenantId: string,
		frameworkId: FrameworkId,
		traceId: string = randomUUID(),
	): Promise<ComplianceReport | null> {
		const detail = await this.getFrameworkDetails(frameworkId, [], { tenantId, traceId });
		if (!detail) return null;

		const met = detail.controls.filter((c) => c.status === "met").length;
		const partial = detail.controls.filter((c) => c.status === "partial").length;
		const notMet = detail.controls.filter((c) => c.status === "not_met").length;
		const notApplicable = detail.controls.filter((c) => c.status === "not_applicable").length;
		const notVerified = detail.controls.filter((c) => c.status === "not_verified").length;

		const report: ComplianceReport = {
			id: randomUUID(),
			tenantId,
			frameworkId,
			generatedAt: new Date().toISOString(),
			overallScore: detail.overallScore,
			controlsSummary: { met, partial, notMet, notApplicable, notVerified },
			controls: detail.controls,
			evidenceSummary: detail.evidenceSummary,
			assessmentMethod: "protected-evidence-only; unsupported-controls-not-verified",
		};

		logger.info(
			{
				reportId: report.id,
				tenantId,
				frameworkId,
				overallScore: report.overallScore,
				met,
				partial,
				notMet,
				notVerified,
				evidenceSummary: report.evidenceSummary,
			},
			"Compliance report generated from protected evidence; unsupported controls remain not verified",
		);

		return report;
	}
}
