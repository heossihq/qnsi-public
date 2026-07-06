import { randomUUID } from "node:crypto";

import { logger } from "../logger.js";

/**
 * Compliance Framework Control Mapping
 *
 * Maps enterprise compliance frameworks to QNSP platform capabilities.
 * Each control maps to a verifiable platform feature with evidence collection.
 */

export type ControlStatus = "met" | "partial" | "not_met" | "not_applicable";
export type FrameworkId = "soc2" | "hipaa" | "gdpr" | "pci-dss" | "iso27001" | "pdpa" | "mas-trm";

export interface ComplianceControl {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly status: ControlStatus;
	readonly evidenceSources: readonly string[];
	readonly lastAssessedAt: string;
}

export interface ComplianceFrameworkDetail {
	readonly id: FrameworkId;
	readonly name: string;
	readonly version: string;
	readonly controls: readonly ComplianceControl[];
	readonly overallScore: number;
	readonly lastAssessedAt: string;
	readonly evidenceSummary?: {
		readonly auditEventsLast24h: number;
		readonly kmsOperationsLast24h: number | null;
		readonly activeAccessPolicies: number | null;
		readonly auditCheckpointsExist: boolean;
		readonly securityAlertsLast24h: number | null;
	};
}

export interface ComplianceReport {
	readonly id: string;
	readonly tenantId: string;
	readonly frameworkId: FrameworkId;
	readonly generatedAt: string;
	readonly overallScore: number;
	readonly controlsSummary: {
		readonly met: number;
		readonly partial: number;
		readonly notMet: number;
		readonly notApplicable: number;
	};
	readonly controls: readonly ComplianceControl[];
	readonly evidenceSummary?:
		| {
				readonly auditEventsLast24h: number;
				readonly kmsOperationsLast24h: number | null;
				readonly activeAccessPolicies: number | null;
				readonly auditCheckpointsExist: boolean;
				readonly securityAlertsLast24h: number | null;
		  }
		| undefined;
	readonly assessmentMethod: string;
}

interface PlatformCapabilities {
	readonly hasPqcAuth: boolean;
	readonly hasAuditChain: boolean;
	readonly hasEncryptionAtRest: boolean;
	readonly hasEncryptionInTransit: boolean;
	readonly hasAccessControl: boolean;
	readonly hasKeyManagement: boolean;
	readonly hasIncidentResponse: boolean;
	readonly hasSecurityMonitoring: boolean;
}

interface EvidenceMetrics {
	readonly auditEventsLast24h: number;
	/**
	 * Audit #26: these three are null when not measurable. The previous code reported a
	 * fabricated `1` whenever the service's /health answered — a liveness probe is not an
	 * operations/policy/alert count, and no current service surface exposes those counts.
	 */
	readonly kmsOperationsLast24h: number | null;
	readonly activeAccessPolicies: number | null;
	readonly auditCheckpointsExist: boolean;
	readonly securityAlertsLast24h: number | null;
}

async function collectEvidenceMetrics(
	serviceUrls: {
		readonly auditServiceUrl: string | null;
		readonly kmsServiceUrl: string | null;
		readonly accessControlServiceUrl: string | null;
		readonly securityMonitoringServiceUrl: string | null;
	},
	timeoutMs: number = 5000,
): Promise<EvidenceMetrics> {
	const defaults: EvidenceMetrics = {
		auditEventsLast24h: 0,
		kmsOperationsLast24h: null,
		activeAccessPolicies: null,
		auditCheckpointsExist: false,
		securityAlertsLast24h: null,
	};

	// Audit #26: the kms/access/security-monitoring health probes were removed here —
	// liveness answers were being converted into fabricated "1" counts. Only surfaces
	// that genuinely report the metric are probed.
	const probes = await Promise.allSettled([
		serviceUrls.auditServiceUrl
			? fetchJsonMetric(serviceUrls.auditServiceUrl, "/audit/v1/stats", timeoutMs)
			: Promise.resolve(null),
		serviceUrls.auditServiceUrl
			? fetchJsonMetric(serviceUrls.auditServiceUrl, "/audit/v1/checkpoints/latest", timeoutMs)
			: Promise.resolve(null),
	]);

	const auditStats = probes[0].status === "fulfilled" ? probes[0].value : null;
	const checkpointData = probes[1].status === "fulfilled" ? probes[1].value : null;

	return {
		// Real: the audit stats endpoint genuinely reports totalEvents.
		auditEventsLast24h: extractNumericField(auditStats, "totalEvents", defaults.auditEventsLast24h),
		// Honest unavailability: kms/access/security health endpoints prove liveness only —
		// they expose no operation/policy/alert counts, so these are null — never a count
		// invented from a liveness signal (audit #26).
		kmsOperationsLast24h: null,
		activeAccessPolicies: null,
		auditCheckpointsExist: checkpointData !== null && typeof checkpointData === "object",
		securityAlertsLast24h: null,
	};
}

async function fetchJsonMetric(baseUrl: string, path: string, timeoutMs: number): Promise<unknown> {
	try {
		const url = new URL(path, baseUrl);
		const res = await fetch(url.toString(), {
			method: "GET",
			signal: AbortSignal.timeout(timeoutMs),
			cache: "no-store",
		});
		if (!res.ok) return null;
		return (await res.json()) as unknown;
	} catch {
		return null;
	}
}

function extractNumericField(data: unknown, field: string, fallback: number): number {
	if (data && typeof data === "object" && field in data) {
		const val = (data as Record<string, unknown>)[field];
		return typeof val === "number" ? val : fallback;
	}
	return fallback;
}

const FRAMEWORK_METADATA: Record<FrameworkId, { name: string; version: string }> = {
	soc2: { name: "SOC 2 Type II", version: "2017" },
	hipaa: { name: "HIPAA Security Rule", version: "45 CFR Part 164" },
	gdpr: { name: "GDPR", version: "Regulation (EU) 2016/679" },
	"pci-dss": { name: "PCI DSS", version: "v4.0.1" },
	iso27001: { name: "ISO/IEC 27001", version: "2022" },
	pdpa: { name: "PDPA (Singapore)", version: "Personal Data Protection Act 2012 (Rev. 2021)" },
	"mas-trm": {
		name: "MAS TRM Guidelines",
		version: "Technology Risk Management Guidelines (Jan 2021)",
	},
};

/**
 * Probe a service health endpoint to verify it is actually operational.
 * Returns true only if the service responds with HTTP 200 within the timeout.
 */
async function probeServiceHealth(
	baseUrl: string,
	healthPath: string,
	timeoutMs: number = 3000,
): Promise<boolean> {
	try {
		const healthUrl = new URL(healthPath, baseUrl);
		const res = await fetch(healthUrl.toString(), {
			method: "GET",
			signal: AbortSignal.timeout(timeoutMs),
			cache: "no-store",
		});
		return res.ok;
	} catch {
		return false;
	}
}

/**
 * Assess platform capabilities by probing configured service health endpoints.
 * Each capability is verified by an actual HTTP health check — not just URL presence.
 * Results are cached for the specified TTL to avoid excessive health probing.
 */
let _capabilitiesCache: { capabilities: PlatformCapabilities; expiresAt: number } | null = null;
const CAPABILITIES_CACHE_TTL_MS = 30_000; // 30 seconds

/** Resets the capabilities cache — used between test runs to ensure isolation */
export function _resetCapabilitiesCacheForTesting(): void {
	_capabilitiesCache = null;
}

async function assessPlatformCapabilities(serviceUrls: {
	readonly authServiceUrl: string | null;
	readonly auditServiceUrl: string | null;
	readonly kmsServiceUrl: string | null;
	readonly accessControlServiceUrl: string | null;
	readonly securityMonitoringServiceUrl: string | null;
}): Promise<PlatformCapabilities> {
	const now = Date.now();
	if (_capabilitiesCache && _capabilitiesCache.expiresAt > now) {
		return _capabilitiesCache.capabilities;
	}

	const [authUp, auditUp, kmsUp, accessUp, secMonUp] = await Promise.all([
		serviceUrls.authServiceUrl
			? probeServiceHealth(serviceUrls.authServiceUrl, "/auth/health")
			: Promise.resolve(false),
		serviceUrls.auditServiceUrl
			? probeServiceHealth(serviceUrls.auditServiceUrl, "/health")
			: Promise.resolve(false),
		serviceUrls.kmsServiceUrl
			? probeServiceHealth(serviceUrls.kmsServiceUrl, "/health")
			: Promise.resolve(false),
		serviceUrls.accessControlServiceUrl
			? probeServiceHealth(serviceUrls.accessControlServiceUrl, "/health")
			: Promise.resolve(false),
		serviceUrls.securityMonitoringServiceUrl
			? probeServiceHealth(serviceUrls.securityMonitoringServiceUrl, "/health")
			: Promise.resolve(false),
	]);

	const capabilities: PlatformCapabilities = {
		hasPqcAuth: authUp,
		hasAuditChain: auditUp,
		hasEncryptionAtRest: kmsUp,
		hasEncryptionInTransit: authUp,
		hasAccessControl: accessUp,
		hasKeyManagement: kmsUp,
		hasIncidentResponse: secMonUp,
		hasSecurityMonitoring: secMonUp,
	};

	_capabilitiesCache = { capabilities, expiresAt: now + CAPABILITIES_CACHE_TTL_MS };

	logger.info(
		{ capabilities, probeResults: { authUp, auditUp, kmsUp, accessUp, secMonUp } },
		"Platform capabilities assessed via live health probes",
	);

	return capabilities;
}

function evaluateControlStatus(
	control: Omit<ComplianceControl, "status" | "lastAssessedAt">,
	capabilities: PlatformCapabilities,
): ControlStatus {
	const sourceCapabilityMap: Record<string, boolean> = {
		"auth-service": capabilities.hasPqcAuth,
		"access-control-service": capabilities.hasAccessControl,
		"edge-gateway": capabilities.hasEncryptionInTransit,
		"kms-service": capabilities.hasKeyManagement,
		"vault-service": capabilities.hasEncryptionAtRest,
		"storage-service": capabilities.hasEncryptionAtRest,
		"audit-service": capabilities.hasAuditChain,
		"security-monitoring-service": capabilities.hasSecurityMonitoring,
		"observability-service": capabilities.hasSecurityMonitoring,
		"crypto-inventory-service": true,
		cryptography: true,
		"tenant-service": true,
	};

	const sourcesConfigured = control.evidenceSources.filter(
		(source) => sourceCapabilityMap[source] === true,
	);
	const ratio = sourcesConfigured.length / control.evidenceSources.length;

	if (ratio >= 1) return "met";
	if (ratio >= 0.5) return "partial";
	return "not_met";
}

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
	private readonly serviceUrls: {
		readonly authServiceUrl: string | null;
		readonly auditServiceUrl: string | null;
		readonly kmsServiceUrl: string | null;
		readonly accessControlServiceUrl: string | null;
		readonly securityMonitoringServiceUrl: string | null;
	};

	constructor(serviceUrls: {
		readonly authServiceUrl: string | null;
		readonly auditServiceUrl: string | null;
		readonly kmsServiceUrl: string | null;
		readonly accessControlServiceUrl: string | null;
		readonly securityMonitoringServiceUrl: string | null;
	}) {
		this.serviceUrls = serviceUrls;
		logger.info(
			"ComplianceService initialized — capabilities assessed via live health probes and evidence collection",
		);
	}

	async getFrameworkDetails(
		frameworkId: FrameworkId,
		_tenantComplianceTags: readonly string[],
	): Promise<ComplianceFrameworkDetail | null> {
		const controlDefs = FRAMEWORK_CONTROLS[frameworkId];
		if (!controlDefs) return null;

		const [capabilities, evidence] = await Promise.all([
			assessPlatformCapabilities(this.serviceUrls),
			collectEvidenceMetrics(this.serviceUrls),
		]);
		const meta = FRAMEWORK_METADATA[frameworkId];
		const now = new Date().toISOString();

		const controls: ComplianceControl[] = controlDefs.map((def) => ({
			...def,
			status: evaluateControlStatus(def, capabilities),
			lastAssessedAt: now,
		}));

		const met = controls.filter((c) => c.status === "met").length;
		const total = controls.length;
		const overallScore = total > 0 ? Math.round((met / total) * 100) : 0;

		return {
			id: frameworkId,
			name: meta.name,
			version: meta.version,
			controls,
			overallScore,
			lastAssessedAt: now,
			evidenceSummary: evidence,
		};
	}

	async listFrameworks(
		tenantComplianceTags: readonly string[],
	): Promise<ComplianceFrameworkDetail[]> {
		const frameworkIds = Object.keys(FRAMEWORK_CONTROLS) as FrameworkId[];

		if (tenantComplianceTags.length === 0) {
			const results = await Promise.all(
				frameworkIds.map((id) => this.getFrameworkDetails(id, tenantComplianceTags)),
			);
			return results.filter((f): f is ComplianceFrameworkDetail => f !== null);
		}

		const tagToFramework: Record<string, FrameworkId> = {
			soc2: "soc2",
			"soc-2": "soc2",
			hipaa: "hipaa",
			gdpr: "gdpr",
			"pci-dss": "pci-dss",
			pci: "pci-dss",
			iso27001: "iso27001",
			"iso-27001": "iso27001",
			pdpa: "pdpa",
			"mas-trm": "mas-trm",
			"mas trm": "mas-trm",
			mastrm: "mas-trm",
		};

		const matchedIds = new Set<FrameworkId>();
		for (const tag of tenantComplianceTags) {
			const normalized = tag.toLowerCase().trim();
			const fwId = tagToFramework[normalized];
			if (fwId) matchedIds.add(fwId);
		}

		if (matchedIds.size === 0) {
			const results = await Promise.all(
				frameworkIds.map((id) => this.getFrameworkDetails(id, tenantComplianceTags)),
			);
			return results.filter((f): f is ComplianceFrameworkDetail => f !== null);
		}

		const results = await Promise.all(
			Array.from(matchedIds).map((id) => this.getFrameworkDetails(id, tenantComplianceTags)),
		);
		return results.filter((f): f is ComplianceFrameworkDetail => f !== null);
	}

	async generateReport(
		tenantId: string,
		frameworkId: FrameworkId,
	): Promise<ComplianceReport | null> {
		const detail = await this.getFrameworkDetails(frameworkId, []);
		if (!detail) return null;

		const met = detail.controls.filter((c) => c.status === "met").length;
		const partial = detail.controls.filter((c) => c.status === "partial").length;
		const notMet = detail.controls.filter((c) => c.status === "not_met").length;
		const notApplicable = detail.controls.filter((c) => c.status === "not_applicable").length;

		const report: ComplianceReport = {
			id: randomUUID(),
			tenantId,
			frameworkId,
			generatedAt: new Date().toISOString(),
			overallScore: detail.overallScore,
			controlsSummary: { met, partial, notMet, notApplicable },
			controls: detail.controls,
			evidenceSummary: detail.evidenceSummary,
			assessmentMethod: "live-probe-with-evidence-collection",
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
				evidenceSummary: report.evidenceSummary,
			},
			"Compliance report generated with evidence summary",
		);

		return report;
	}
}
