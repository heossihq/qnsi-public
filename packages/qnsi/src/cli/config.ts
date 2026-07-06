import { config as loadDotenv } from "dotenv";
import { bridgeQnsiEnv } from "../internal/env-aliases.js";

// Accept both QNSI_* (canonical) and legacy QNSP_* user env vars.
bridgeQnsiEnv();

const shouldLoadDotenv =
	(process.env["NODE_ENV"] ?? "development") !== "production" ||
	process.env["QNSI_LOAD_ENV_FILE_IN_PROD"] === "true";

if (shouldLoadDotenv) {
	loadDotenv();
}

export interface CliConfig {
	readonly edgeGatewayUrl: string | null;
	readonly cloudPortalUrl: string;
	readonly authServiceUrl: string;
	readonly serviceId: string | null;
	readonly serviceSecret: string | null;
	readonly tenantId: string | null;
	readonly kmsServiceUrl: string;
	readonly vaultServiceUrl: string;
	readonly auditServiceUrl: string;
	readonly tenantServiceUrl: string;
	readonly billingServiceUrl: string;
	readonly accessControlServiceUrl: string;
	readonly securityMonitoringServiceUrl: string;
	readonly storageServiceUrl: string;
	readonly searchServiceUrl: string;
	readonly observabilityServiceUrl: string;
	readonly outputFormat: "json" | "table" | "yaml";
	readonly verbose: boolean;
}

function deriveViaEdgeGateway(options: {
	edgeGatewayUrl: string | null;
	envVar: string;
	proxyPath: string;
	localDefault: string;
}): string {
	const explicit = process.env[options.envVar];
	if (explicit && explicit.length > 0) {
		return explicit;
	}
	if (options.edgeGatewayUrl) {
		return `${options.edgeGatewayUrl.replace(/\/$/, "")}/proxy${options.proxyPath}`;
	}
	return options.localDefault;
}

export function loadConfig(overrides?: Partial<CliConfig>): CliConfig {
	const edgeGatewayUrl = process.env["QNSI_EDGE_GATEWAY_URL"] ?? null;
	const cloudPortalUrl = process.env["QNSI_CLOUD_PORTAL_URL"] ?? "https://cloud.qnsi.heossi.com";

	const defaults: CliConfig = {
		edgeGatewayUrl,
		cloudPortalUrl,
		authServiceUrl:
			process.env["QNSI_AUTH_SERVICE_URL"] ?? edgeGatewayUrl ?? "http://localhost:8081",
		serviceId: process.env["QNSI_SERVICE_ID"] ?? null,
		serviceSecret: process.env["QNSI_SERVICE_SECRET"] ?? null,
		tenantId: process.env["QNSI_TENANT_ID"] ?? null,
		kmsServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_KMS_SERVICE_URL",
			proxyPath: "/kms",
			localDefault: "http://localhost:8095",
		}),
		vaultServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_VAULT_SERVICE_URL",
			proxyPath: "/vault",
			localDefault: "http://localhost:8090",
		}),
		auditServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_AUDIT_SERVICE_URL",
			proxyPath: "/audit",
			localDefault: "http://localhost:8103",
		}),
		tenantServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_TENANT_SERVICE_URL",
			proxyPath: "/tenant",
			localDefault: "http://localhost:8108",
		}),
		billingServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_BILLING_SERVICE_URL",
			proxyPath: "/billing",
			// Include the /billing root so local-dev (no edge gateway) appends the same
			// post-/billing paths the commands use (/addons, /v1/usage). Without it,
			// localhost:8106/addons missed the backend's /billing/addons route.
			localDefault: "http://localhost:8106/billing",
		}),
		accessControlServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_ACCESS_CONTROL_SERVICE_URL",
			proxyPath: "/access",
			localDefault: "http://localhost:8102",
		}),
		securityMonitoringServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_SECURITY_MONITORING_SERVICE_URL",
			proxyPath: "/security",
			localDefault: "http://localhost:8104",
		}),
		storageServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_STORAGE_SERVICE_URL",
			proxyPath: "/storage",
			localDefault: "http://localhost:8092",
		}),
		searchServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_SEARCH_SERVICE_URL",
			proxyPath: "/search",
			localDefault: "http://localhost:8101",
		}),
		observabilityServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_OBSERVABILITY_SERVICE_URL",
			proxyPath: "/observability",
			localDefault: "http://localhost:8105",
		}),
		outputFormat: (process.env["QNSI_OUTPUT_FORMAT"] as "json" | "table" | "yaml") ?? "table",
		verbose: process.env["QNSI_VERBOSE"] === "true",
	};

	return { ...defaults, ...overrides };
}

export const EXIT_CODES = {
	SUCCESS: 0,
	GENERAL_ERROR: 1,
	INVALID_ARGUMENTS: 2,
	AUTH_ERROR: 3,
	AUTHORIZATION_ERROR: 4,
	NOT_FOUND: 5,
	RATE_LIMITED: 6,
	NETWORK_ERROR: 7,
} as const;
