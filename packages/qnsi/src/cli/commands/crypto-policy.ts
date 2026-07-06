import type { Command } from "commander";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { getAuthHeaders } from "../utils/auth.js";
import { getEffectiveConfig } from "../utils/command-config.js";
import { fetchWithBackendHandling } from "../utils/fetcher.js";
import { printError, printJson, printSuccess, printTable } from "../utils/output.js";

export function registerCryptoPolicyCommands(program: Command, config: CliConfig): void {
	const cryptoPolicy = program
		.command("crypto-policy")
		.description("Tenant crypto policy management commands");

	cryptoPolicy
		.command("get")
		.description("Get tenant crypto policy")
		.action(async (_options, command) => {
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
				const tenantUrl = effectiveConfig.tenantServiceUrl;

				const response = await fetchWithBackendHandling(
					effectiveConfig,
					`${tenantUrl}/tenant/v1/tenants/${effectiveConfig.tenantId}/crypto-policy`,
					{ headers },
				);

				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (response.status === 404) {
					printError("Crypto policy not found");
					process.exit(EXIT_CODES.NOT_FOUND);
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to get crypto policy: ${response.status} ${errorText}`);
					process.exit(EXIT_CODES.GENERAL_ERROR);
					return;
				}

				const data = (await response.json()) as Record<string, unknown>;

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printTable(data);
				}
				process.exit(EXIT_CODES.SUCCESS);
				return;
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to get crypto policy");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});

	cryptoPolicy
		.command("update")
		.description("Update tenant crypto policy")
		.option("--tier <tier>", "Policy tier (free, pro, enterprise)")
		.option("--kem-algorithms <algorithms>", "Comma-separated list of allowed KEM algorithms")
		.option(
			"--signature-algorithms <algorithms>",
			"Comma-separated list of allowed signature algorithms",
		)
		.option("--require-hsm-for-root-keys", "Require HSM for root keys")
		.option("--max-key-age-days <days>", "Maximum key age in days")
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

				if (!options.tier) {
					printError("--tier is required");
					process.exit(EXIT_CODES.INVALID_ARGUMENTS);
					return;
				}

				const headers = await getAuthHeaders(effectiveConfig);
				const tenantUrl = effectiveConfig.tenantServiceUrl;

				const body = {
					policyTier: options.tier,
					customAllowedKemAlgorithms: options.kemAlgorithms
						? options.kemAlgorithms.split(",").map((s: string) => s.trim())
						: undefined,
					customAllowedSignatureAlgorithms: options.signatureAlgorithms
						? options.signatureAlgorithms.split(",").map((s: string) => s.trim())
						: undefined,
					requireHsmForRootKeys: options.requireHsmForRootKeys ?? false,
					maxKeyAgeDays: options.maxKeyAgeDays ? parseInt(options.maxKeyAgeDays, 10) : undefined,
				};

				const response = await fetchWithBackendHandling(
					effectiveConfig,
					`${tenantUrl}/tenant/v1/tenants/${effectiveConfig.tenantId}/crypto-policy`,
					{
						method: "PUT",
						headers,
						body: JSON.stringify(body),
					},
				);

				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to update crypto policy: ${response.status} ${errorText}`);
					process.exit(EXIT_CODES.GENERAL_ERROR);
					return;
				}

				const data = (await response.json()) as Record<string, unknown>;

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printSuccess("Crypto policy updated successfully");
					printTable(data);
				}
				process.exit(EXIT_CODES.SUCCESS);
				return;
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to update crypto policy");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});
}
