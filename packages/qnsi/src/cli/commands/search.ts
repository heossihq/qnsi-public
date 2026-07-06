import type { Command } from "commander";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { getAuthHeaders } from "../utils/auth.js";
import { getEffectiveConfig } from "../utils/command-config.js";
import { fetchWithBackendHandling } from "../utils/fetcher.js";
import { printError, printJson, printTable } from "../utils/output.js";

export function registerSearchCommands(program: Command, config: CliConfig): void {
	const search = program.command("search").description("Search service commands");

	search
		.command("query")
		.description("Execute search query")
		.requiredOption("--query <query>", "Search query")
		.option("--limit <number>", "Number of results to return", "20")
		.action(async (options, command) => {
			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				if (!effectiveConfig.tenantId) {
					printError("QNSI_TENANT_ID must be set");
					process.exit(EXIT_CODES.INVALID_ARGUMENTS);
					return;
				}
				const headers = await getAuthHeaders(effectiveConfig);
				const searchUrl = effectiveConfig.searchServiceUrl;
				const url = new URL(`${searchUrl}/search/v1/documents`);
				url.searchParams.set("tenantId", effectiveConfig.tenantId);
				url.searchParams.set("q", options.query);
				url.searchParams.set("limit", String(Number.parseInt(options.limit, 10)));
				const response = await fetchWithBackendHandling(effectiveConfig, url.toString(), {
					headers,
				});
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Search failed: ${response.status} ${errorText}`);
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
				printError(error instanceof Error ? error.message : "Search failed");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});

	const indexes = search.command("indexes").description("Index operations");

	indexes
		.command("list")
		.description("List search indexes")
		.action(async () => {
			printError(
				"search indexes list is unavailable: search-service does not expose a list-indexes endpoint. " +
					"Use search query, or the optimization endpoints in search-service.",
			);
			process.exit(EXIT_CODES.INVALID_ARGUMENTS);
			return;
		});
}
