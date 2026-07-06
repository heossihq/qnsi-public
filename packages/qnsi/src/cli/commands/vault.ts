import type { Command } from "commander";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { getAuthHeaders } from "../utils/auth.js";
import { getEffectiveConfig } from "../utils/command-config.js";
import { fetchWithBackendHandling } from "../utils/fetcher.js";
import { printError, printJson, printTable } from "../utils/output.js";

export function registerVaultCommands(program: Command, config: CliConfig): void {
	const vault = program.command("vault").description("Vault secret management commands");

	const secrets = vault.command("secrets").description("Secret operations");

	secrets
		.command("list")
		.description("List vault secrets")
		.option("--limit <number>", "Number of secrets to return", "100")
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
				const url = new URL(`${effectiveConfig.vaultServiceUrl}/vault/v1/secrets`);
				url.searchParams.set("tenantId", effectiveConfig.tenantId);
				url.searchParams.set("limit", options.limit);

				const response = await fetchWithBackendHandling(effectiveConfig, url.toString(), {
					headers,
				});
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to list secrets: ${response.status} ${errorText}`);
					process.exit(EXIT_CODES.GENERAL_ERROR);
					return;
				}

				const data = (await response.json()) as { secrets?: unknown[] };

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printTable((data.secrets ?? []) as Record<string, unknown>[]);
				}
				process.exit(EXIT_CODES.SUCCESS);
				return;
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to list secrets");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});

	secrets
		.command("get")
		.description("Get secret value")
		.argument("<secretId>", "Secret identifier (UUID)")
		.action(async (secretId: string, _options, command) => {
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
				const url = new URL(
					`${effectiveConfig.vaultServiceUrl}/vault/v1/secrets/${encodeURIComponent(secretId)}/value`,
				);

				const response = await fetchWithBackendHandling(effectiveConfig, url.toString(), {
					headers,
				});
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (response.status === 404) {
					printError(`Secret not found: ${secretId}`);
					process.exit(EXIT_CODES.NOT_FOUND);
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to get secret: ${response.status} ${errorText}`);
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
				printError(error instanceof Error ? error.message : "Failed to get secret");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});
}
