import type { Command } from "commander";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { getAuthHeaders } from "../utils/auth.js";
import { getEffectiveConfig } from "../utils/command-config.js";
import { fetchWithBackendHandling } from "../utils/fetcher.js";
import { printError, printJson, printTable } from "../utils/output.js";

export function registerObservabilityCommands(program: Command, config: CliConfig): void {
	const observability = program
		.command("observability")
		.description("Observability service commands");

	const slos = observability.command("slos").description("SLO operations");

	slos
		.command("list")
		.description("List SLOs")
		.option("--limit <number>", "Number of SLOs to return", "50")
		.option("--cursor <cursor>", "Pagination cursor")
		.action(async (options, command) => {
			if (!config.tenantId) {
				printError("QNSI_TENANT_ID must be set");
				process.exit(EXIT_CODES.INVALID_ARGUMENTS);
				return;
			}

			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				const headers = await getAuthHeaders(effectiveConfig);
				const obsUrl = effectiveConfig.observabilityServiceUrl;
				const url = new URL(`${obsUrl}/observability/v1/slos`);
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
					printError(`Failed to list SLOs: ${response.status} ${errorText}`);
					process.exit(EXIT_CODES.GENERAL_ERROR);
					return;
				}

				const data = (await response.json()) as { slos?: unknown[]; count?: number };

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printTable((data.slos ?? []) as Record<string, unknown>[]);
				}
				process.exit(EXIT_CODES.SUCCESS);
				return;
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to list SLOs");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});

	const otlp = observability.command("otlp").description("OTLP ingestion endpoints");

	otlp
		.command("status")
		.description("Get OTLP ingestion status")
		.action(async (_options, command) => {
			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				const headers = await getAuthHeaders(effectiveConfig);
				const obsUrl = effectiveConfig.observabilityServiceUrl;

				const response = await fetchWithBackendHandling(effectiveConfig, `${obsUrl}/health`, {
					headers,
				});
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to get status: ${response.status} ${errorText}`);
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
				printError(error instanceof Error ? error.message : "Failed to get OTLP status");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});
}
