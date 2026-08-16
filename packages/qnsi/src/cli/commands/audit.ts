import type { Command } from "commander";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { getAuthHeaders } from "../utils/auth.js";
import { getEffectiveConfig } from "../utils/command-config.js";
import { fetchWithBackendHandling } from "../utils/fetcher.js";
import { printError, printJson, printTable } from "../utils/output.js";

export function registerAuditCommands(program: Command, config: CliConfig): void {
	const audit = program.command("audit").description("Audit event commands");

	const events = audit.command("events").description("Event operations");

	events
		.command("list")
		.description("List audit events")
		.option("--limit <number>", "Number of events to return (1-200)", "50")
		.option("--cursor <cursor>", "Pagination cursor")
		.option("--source-service <service>", "Filter by source service")
		.option("--topic <topic>", "Filter by topic")
		.option("--since <timestamp>", "Filter events since timestamp")
		.action(async (options, command) => {
			if (!config.tenantId) {
				printError("QNSI_TENANT_ID must be set");
				process.exit(EXIT_CODES.INVALID_ARGUMENTS);
				return;
			}

			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				// Fail closed like the sibling commands: a blank global --tenant-id
				// override previously fell through to an empty tenantId query param.
				const tenantId = effectiveConfig.tenantId;
				if (!tenantId) {
					printError("QNSI_TENANT_ID must be set");
					process.exit(EXIT_CODES.INVALID_ARGUMENTS);
					return;
				}
				const headers = await getAuthHeaders(effectiveConfig);
				const url = new URL(`${effectiveConfig.auditServiceUrl}/audit/v1/events`);
				url.searchParams.set("tenantId", tenantId);
				url.searchParams.set("limit", options.limit);
				if (options.cursor) {
					url.searchParams.set("cursor", options.cursor);
				}
				if (options.sourceService) {
					url.searchParams.set("sourceService", options.sourceService);
				}
				if (options.topic) {
					url.searchParams.set("topic", options.topic);
				}
				if (options.since) {
					url.searchParams.set("since", options.since);
				}

				const response = await fetchWithBackendHandling(effectiveConfig, url.toString(), {
					headers,
				});
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to list events: ${response.status} ${errorText}`);
					process.exit(EXIT_CODES.GENERAL_ERROR);
					return;
				}

				const data = (await response.json()) as { items?: unknown[] };

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printTable((data.items ?? []) as Record<string, unknown>[]);
				}
				process.exit(EXIT_CODES.SUCCESS);
				return;
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to list events");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});
}
