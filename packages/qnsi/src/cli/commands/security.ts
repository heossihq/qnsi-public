import type { Command } from "commander";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { getAuthHeaders } from "../utils/auth.js";
import { getEffectiveConfig } from "../utils/command-config.js";
import { fetchWithBackendHandling } from "../utils/fetcher.js";
import { printError, printJson, printTable } from "../utils/output.js";

export function registerSecurityCommands(program: Command, config: CliConfig): void {
	const security = program.command("security").description("Security monitoring service commands");

	const alerts = security.command("alerts").description("Security alert operations");

	alerts
		.command("list")
		.description("List security alerts")
		.option("--severity <severity>", "Filter by severity")
		.option("--status <status>", "Filter by status")
		.option("--limit <number>", "Number of alerts to return", "50")
		.option("--cursor <cursor>", "Pagination cursor")
		.action(async (options, command) => {
			if (!config.tenantId) {
				printError("QNSI_TENANT_ID must be set");
				process.exit(EXIT_CODES.INVALID_ARGUMENTS);
				return;
			}

			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				if (!effectiveConfig.tenantId) {
					printError("QNSI_TENANT_ID must be set");
					process.exit(EXIT_CODES.INVALID_ARGUMENTS);
					return;
				}
				const headers = await getAuthHeaders(effectiveConfig);
				const secUrl = effectiveConfig.securityMonitoringServiceUrl;
				const url = new URL(`${secUrl}/security/v1/alerts`);
				url.searchParams.set("tenantId", effectiveConfig.tenantId);
				url.searchParams.set("limit", options.limit);
				if (options.severity) {
					url.searchParams.set("severity", options.severity);
				}
				if (options.status) {
					url.searchParams.set("status", options.status);
				}
				if (options.cursor) {
					url.searchParams.set("cursor", options.cursor);
				}

				const response = await fetchWithBackendHandling(effectiveConfig, url.toString(), {
					headers,
				});
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to list alerts: ${response.status} ${errorText}`);
					process.exit(EXIT_CODES.GENERAL_ERROR);
					return;
				}

				const data = (await response.json()) as { items?: unknown[]; nextCursor?: string | null };

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printTable((data.items ?? []) as Record<string, unknown>[]);
				}
				process.exit(EXIT_CODES.SUCCESS);
				return;
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to list alerts");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});

	alerts
		.command("get")
		.description("Get alert details")
		.argument("<alertId>", "Alert identifier")
		.action(async () => {
			printError(
				"security alerts get is not available: security-monitoring-service does not expose /security/v1/alerts/:id. " +
					"Use security alerts list with filters instead.",
			);
			process.exit(EXIT_CODES.INVALID_ARGUMENTS);
		});

	const breaches = security.command("breaches").description("Data breach detection");

	breaches
		.command("list")
		.description("List detected breaches")
		.option("--limit <number>", "Number of breaches to return", "50")
		.option("--cursor <cursor>", "Pagination cursor")
		.action(async (options, command) => {
			if (!config.tenantId) {
				printError("QNSI_TENANT_ID must be set");
				process.exit(EXIT_CODES.INVALID_ARGUMENTS);
				return;
			}

			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				if (!effectiveConfig.tenantId) {
					printError("QNSI_TENANT_ID must be set");
					process.exit(EXIT_CODES.INVALID_ARGUMENTS);
					return;
				}
				const headers = await getAuthHeaders(effectiveConfig);
				const secUrl = effectiveConfig.securityMonitoringServiceUrl;
				const url = new URL(`${secUrl}/security/v1/breaches`);
				url.searchParams.set("tenantId", effectiveConfig.tenantId);
				url.searchParams.set("limit", options.limit);
				if (options.cursor) {
					url.searchParams.set("cursor", options.cursor);
				}

				const response = await fetchWithBackendHandling(effectiveConfig, url.toString(), {
					headers,
				});
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to list breaches: ${response.status} ${errorText}`);
					process.exit(EXIT_CODES.GENERAL_ERROR);
					return;
				}

				const data = (await response.json()) as {
					breaches?: unknown[];
					nextCursor?: string | null;
				};

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printTable((data.breaches ?? []) as Record<string, unknown>[]);
				}
				process.exit(EXIT_CODES.SUCCESS);
				return;
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to list breaches");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});
}
