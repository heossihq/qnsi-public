import type { Command } from "commander";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { getAuthHeaders } from "../utils/auth.js";
import { getEffectiveConfig } from "../utils/command-config.js";
import { fetchWithBackendHandling } from "../utils/fetcher.js";
import { printError, printJson, printSuccess, printTable } from "../utils/output.js";

export function registerAccessControlCommands(program: Command, config: CliConfig): void {
	const access = program.command("access").description("Access control service commands");

	const policies = access.command("policies").description("Policy management");

	policies
		.command("list")
		.description("List access policies")
		.option("--limit <number>", "Number of policies to return", "100")
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
				const accessUrl = effectiveConfig.accessControlServiceUrl;
				const url = new URL(`${accessUrl}/access/v1/tenants/${effectiveConfig.tenantId}/policies`);
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
					printError(`Failed to list policies: ${response.status} ${errorText}`);
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
				printError(error instanceof Error ? error.message : "Failed to list policies");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});

	policies
		.command("get")
		.description("Get policy details")
		.argument("<policyId>", "Policy identifier")
		.action(async (policyId: string, _options, command) => {
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
				const accessUrl = effectiveConfig.accessControlServiceUrl;
				const url = new URL(`${accessUrl}/access/v1/policies/${policyId}`);

				const response = await fetchWithBackendHandling(effectiveConfig, url.toString(), {
					headers,
				});
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (response.status === 404) {
					printError(`Policy not found: ${policyId}`);
					process.exit(EXIT_CODES.NOT_FOUND);
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to get policy: ${response.status} ${errorText}`);
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
				printError(error instanceof Error ? error.message : "Failed to get policy");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});

	policies
		.command("create")
		.description("Create access policy")
		.requiredOption("--name <name>", "Policy name")
		.requiredOption("--effect <effect>", "Policy effect (allow/deny)")
		.requiredOption("--actions <actions>", "Comma-separated actions")
		.requiredOption("--resources <resources>", "Comma-separated resources")
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
				const accessUrl = effectiveConfig.accessControlServiceUrl;

				const response = await fetchWithBackendHandling(
					effectiveConfig,
					`${accessUrl}/access/v1/policies`,
					{
						method: "POST",
						headers,
						body: JSON.stringify({
							tenantId: effectiveConfig.tenantId,
							name: options.name,
							statement: {
								effect: options.effect,
								actions: options.actions
									.split(",")
									.map((v: string) => v.trim())
									.filter(Boolean),
								resources: options.resources
									.split(",")
									.map((v: string) => v.trim())
									.filter(Boolean),
							},
						}),
					},
				);
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to create policy: ${response.status} ${errorText}`);
					process.exit(EXIT_CODES.GENERAL_ERROR);
					return;
				}

				const data = await response.json();

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printSuccess(`Policy created: ${(data as { id?: string }).id}`);
					printTable(data as Record<string, unknown>);
				}
				process.exit(EXIT_CODES.SUCCESS);
				return;
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to create policy");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});
}
