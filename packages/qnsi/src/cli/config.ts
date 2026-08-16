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
	/**
	 * A customer's API key (QNSI_API_KEY) - the ONLY credential a customer actually has.
	 *
	 * The CLI ships as the `qnsi` bin inside @heossihq/qnsi, the package every customer
	 * installs, yet it had NO api-key path at all: it required QNSI_SERVICE_ID +
	 * QNSI_SERVICE_SECRET + QNSI_TENANT_ID - internal service-account credentials. Proven
	 * 2026-07-14: `qnsi kms keys list` with a real API key exited with
	 * "Error: QNSI_SERVICE_ID must be set". The word `apiKey` appeared exactly once in the
	 * whole CLI, in a log-sanitiser regex.
	 *
	 * When this is set, the CLI activates it (resolving the tenant automatically, like the
	 * SDK does) and uses it as the bearer. The service-account path is unchanged for
	 * internal/ops use.
	 */
	readonly apiKey: string | null;
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

/**
 * Build a service base URL.
 *
 * THE PREFIX MUST NOT BE APPLIED TWICE. The edge gateway strips only `/proxy` and forwards
 * the rest, so a call to `/proxy/kms/v1/keys` reaches kms-service as `/kms/v1/keys` - which
 * is exactly its route. And EVERY CLI command already appends the service-prefixed path
 * (`${kmsServiceUrl}/kms/v1/keys`, `${vaultServiceUrl}/vault/v1/secrets`, …).
 *
 * So `proxyPath` must be EMPTY for those services. It was `/kms`, `/vault`, `/audit`, …, so
 * the CLI built `/proxy/kms` + `/kms/v1/keys` = `/proxy/kms/kms/v1/keys`, and the service
 * answered:
 *
 *     404  Route GET:/kms/kms/v1/keys not found
 *
 * Eight of eleven command groups did this. The CLI had NEVER worked against production - it
 * only ever worked with explicit per-service QNSI_*_SERVICE_URL pointing at localhost, where
 * the command's own prefix is the whole path. Proven 2026-07-14 with a real API key.
 *
 * Two services genuinely DO need a prefix, and they keep it:
 *   - storage: production really is `/proxy/storage/storage/v1/...` (the double is real; the
 *     storage command appends `/storage/v1/...`).
 *   - billing: the billing commands append `/addons`, `/v1/usage` - no service prefix of
 *     their own - so the base must carry `/billing`.
 */
function deriveViaEdgeGateway(options: {
	edgeGatewayUrl: string | null;
	envVar: string;
	/** Extra path segment AFTER /proxy. Empty unless the command omits the service prefix. */
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

/** The live edge gateway - the same default the SDK ships with. */
const DEFAULT_EDGE_GATEWAY_URL = "https://api.qnsi.heossi.com";

export function loadConfig(overrides?: Partial<CliConfig>): CliConfig {
	// DEFAULT TO PRODUCTION, exactly as the SDK does (QnsiClientOptions.baseUrl defaults to
	// https://api.qnsi.heossi.com).
	//
	// This was `?? null`, and every service URL derives from it - so with no
	// QNSI_EDGE_GATEWAY_URL the CLI silently pointed at http://localhost:8095 and a
	// customer's very first command died with "fetch failed". A published CLI that defaults
	// to localhost is a CLI that has never been run by anyone outside this repo.
	//
	// Local development still works: set QNSI_EDGE_GATEWAY_URL, or any per-service
	// QNSI_*_SERVICE_URL, and it wins.
	const edgeGatewayUrl = process.env["QNSI_EDGE_GATEWAY_URL"] ?? DEFAULT_EDGE_GATEWAY_URL;
	const cloudPortalUrl = process.env["QNSI_CLOUD_PORTAL_URL"] ?? "https://cloud.qnsi.heossi.com";

	const defaults: CliConfig = {
		edgeGatewayUrl,
		cloudPortalUrl,
		// edgeGatewayUrl is always a string (env value or the production default),
		// so no further localhost fallback is reachable here.
		authServiceUrl: process.env["QNSI_AUTH_SERVICE_URL"] ?? edgeGatewayUrl,
		apiKey: process.env["QNSI_API_KEY"] ?? process.env["QNSP_API_KEY"] ?? null,
		serviceId: process.env["QNSI_SERVICE_ID"] ?? null,
		serviceSecret: process.env["QNSI_SERVICE_SECRET"] ?? null,
		tenantId: process.env["QNSI_TENANT_ID"] ?? null,
		kmsServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_KMS_SERVICE_URL",
			proxyPath: "",
			localDefault: "http://localhost:8095",
		}),
		vaultServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_VAULT_SERVICE_URL",
			proxyPath: "",
			localDefault: "http://localhost:8090",
		}),
		auditServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_AUDIT_SERVICE_URL",
			proxyPath: "",
			localDefault: "http://localhost:8103",
		}),
		tenantServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_TENANT_SERVICE_URL",
			proxyPath: "",
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
			proxyPath: "",
			localDefault: "http://localhost:8102",
		}),
		securityMonitoringServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_SECURITY_MONITORING_SERVICE_URL",
			proxyPath: "",
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
			proxyPath: "",
			localDefault: "http://localhost:8101",
		}),
		observabilityServiceUrl: deriveViaEdgeGateway({
			edgeGatewayUrl,
			envVar: "QNSI_OBSERVABILITY_SERVICE_URL",
			proxyPath: "",
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
