import type { Command } from "commander";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { getAuthHeaders } from "../utils/auth.js";
import { getEffectiveConfig } from "../utils/command-config.js";
import { fetchWithBackendHandling } from "../utils/fetcher.js";
import { printError, printJson, printTable } from "../utils/output.js";

export function registerTenantCommands(program: Command, config: CliConfig): void {
	const tenant = program.command("tenant").description("Tenant service commands");

	tenant
		.command("get")
		.description("Get tenant details")
		.argument("<tenantId>", "Tenant identifier")
		.action(async (tenantId: string, _options, command) => {
			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				if (!effectiveConfig.tenantId) {
					printError("QNSI_TENANT_ID must be set");
					process.exit(EXIT_CODES.INVALID_ARGUMENTS);
					return;
				}
				if (tenantId !== effectiveConfig.tenantId) {
					printError(
						"Cross-tenant access is not allowed from qnsp CLI. " +
							"The requested tenantId must match QNSI_TENANT_ID.",
					);
					process.exit(EXIT_CODES.INVALID_ARGUMENTS);
					return;
				}
				const headers = await getAuthHeaders(effectiveConfig);
				const tenantUrl = effectiveConfig.tenantServiceUrl;

				const response = await fetchWithBackendHandling(
					effectiveConfig,
					`${tenantUrl}/tenant/v1/tenants/${tenantId}`,
					{ headers },
				);
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (response.status === 404) {
					printError(`Tenant not found: ${tenantId}`);
					process.exit(EXIT_CODES.NOT_FOUND);
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to get tenant: ${response.status} ${errorText}`);
					process.exit(EXIT_CODES.GENERAL_ERROR);
					return;
				}

				const data = await response.json();

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printTable(data as Record<string, unknown>);
				}
				process.exit(EXIT_CODES.SUCCESS);
				return;
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to get tenant");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});

	tenant
		.command("list")
		.description("List tenants")
		.option("--limit <number>", "Number of tenants to return", "100")
		.option("--cursor <cursor>", "Pagination cursor")
		.action(async () => {
			printError(
				"tenant list is unavailable in qnsp CLI to prevent cross-tenant enumeration. " +
					"Use the Cloud Portal for tenant administration.",
			);
			process.exit(EXIT_CODES.INVALID_ARGUMENTS);
			return;
		});

	tenant
		.command("create")
		.description("Create a new tenant")
		.requiredOption("--name <name>", "Tenant name")
		.option("--tier <tier>", "Pricing tier", "free")
		.action(async (_options) => {
			printError(
				"tenant create is not available in qnsp CLI. " +
					"Use the Cloud Portal signup flow (or the platform APIs) for tenant provisioning.",
			);
			process.exit(EXIT_CODES.INVALID_ARGUMENTS);
			return;
		});
}
