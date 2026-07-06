import type { Command } from "commander";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { getAuthHeaders } from "../utils/auth.js";
import { getEffectiveConfig } from "../utils/command-config.js";
import { fetchWithBackendHandling } from "../utils/fetcher.js";
import { printError, printJson, printSuccess, printTable } from "../utils/output.js";

export function registerBillingCommands(program: Command, config: CliConfig): void {
	const billing = program.command("billing").description("Billing service commands");

	const addons = billing.command("addons").description("Add-on management");

	addons
		.command("list")
		.description("List enabled add-ons for tenant")
		.action(async (_options, command) => {
			if (!config.tenantId) {
				printError("QNSI_TENANT_ID must be set");
				process.exit(EXIT_CODES.INVALID_ARGUMENTS);
				return;
			}

			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				const headers = await getAuthHeaders(effectiveConfig);
				const billingUrl = effectiveConfig.billingServiceUrl;

				const response = await fetchWithBackendHandling(
					effectiveConfig,
					`${billingUrl}/addons/${effectiveConfig.tenantId}`,
					{ headers },
				);
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to list add-ons: ${response.status} ${errorText}`);
					process.exit(EXIT_CODES.GENERAL_ERROR);
					return;
				}

				const data = (await response.json()) as {
					success?: boolean;
					addOns?: unknown[];
					error?: string;
				};

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printTable((data.addOns ?? []) as Record<string, unknown>[]);
				}
				process.exit(EXIT_CODES.SUCCESS);
				return;
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to list add-ons");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});

	addons
		.command("catalog")
		.description("List all available add-ons")
		.action(async (_options, command) => {
			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				const headers = await getAuthHeaders(effectiveConfig);
				const billingUrl = effectiveConfig.billingServiceUrl;

				const response = await fetchWithBackendHandling(
					effectiveConfig,
					`${billingUrl}/addons/catalog`,
					{
						headers,
					},
				);
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to get catalog: ${response.status} ${errorText}`);
					process.exit(EXIT_CODES.GENERAL_ERROR);
					return;
				}

				const data = (await response.json()) as {
					success?: boolean;
					catalog?: unknown[];
					error?: string;
				};

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printTable((data.catalog ?? []) as Record<string, unknown>[]);
				}
				process.exit(EXIT_CODES.SUCCESS);
				return;
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to get catalog");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});

	addons
		.command("enable")
		.description("Enable an add-on")
		.requiredOption("--addon-id <id>", "Add-on identifier")
		.action(async (options, command) => {
			if (!config.tenantId) {
				printError("QNSI_TENANT_ID must be set");
				process.exit(EXIT_CODES.INVALID_ARGUMENTS);
				return;
			}

			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				const headers = await getAuthHeaders(effectiveConfig);
				const billingUrl = effectiveConfig.billingServiceUrl;

				const response = await fetchWithBackendHandling(
					effectiveConfig,
					`${billingUrl}/addons/enable`,
					{
						method: "POST",
						headers,
						body: JSON.stringify({
							tenantId: effectiveConfig.tenantId,
							addonId: options.addonId,
						}),
					},
				);
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to enable add-on: ${response.status} ${errorText}`);
					process.exit(EXIT_CODES.GENERAL_ERROR);
					return;
				}

				printSuccess(`Add-on enabled: ${options.addonId}`);
				process.exit(EXIT_CODES.SUCCESS);
				return;
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to enable add-on");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});

	billing
		.command("usage")
		.description("Get usage metrics for tenant")
		.option("--start <date>", "Start date (ISO 8601)")
		.option("--end <date>", "End date (ISO 8601)")
		.action(async (options, command) => {
			if (!config.tenantId) {
				printError("QNSI_TENANT_ID must be set");
				process.exit(EXIT_CODES.INVALID_ARGUMENTS);
			}

			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				const headers = await getAuthHeaders(effectiveConfig);
				const billingUrl = effectiveConfig.billingServiceUrl;
				// billingServiceUrl already resolves to the /billing root (edge: /proxy/billing
				// rewritten to /billing; local: localhost:8106/billing). Append only the
				// post-/billing path — the addons commands above do the same. A leading
				// "/billing" here produced /billing/billing/v1/usage -> 404 in prod.
				const url = new URL(`${billingUrl}/v1/usage/${effectiveConfig.tenantId}`);
				if (options.start) {
					url.searchParams.set("start", options.start);
				}
				if (options.end) {
					url.searchParams.set("end", options.end);
				}

				const response = await fetchWithBackendHandling(effectiveConfig, url.toString(), {
					headers,
				});
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to get usage: ${response.status} ${errorText}`);
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
				printError(error instanceof Error ? error.message : "Failed to get usage");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});
}
