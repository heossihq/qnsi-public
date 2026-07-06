import type { Command } from "commander";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { getAuthHeaders } from "../utils/auth.js";
import { getEffectiveConfig } from "../utils/command-config.js";
import { fetchWithBackendHandling } from "../utils/fetcher.js";
import { printError, printJson, printTable } from "../utils/output.js";

export function registerStorageCommands(program: Command, config: CliConfig): void {
	const storage = program.command("storage").description("Storage service commands");

	const objects = storage.command("objects").description("Object operations");

	objects
		.command("list")
		.description("List storage objects")
		.option("--limit <number>", "Number of objects to return", "100")
		.option("--cursor <cursor>", "Pagination cursor")
		.option("--prefix <prefix>", "Filter by prefix")
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
				const storageUrl = effectiveConfig.storageServiceUrl;
				const url = new URL(`${storageUrl}/storage/v1/documents`);
				url.searchParams.set("limit", options.limit);
				if (options.cursor) {
					url.searchParams.set("cursor", options.cursor);
				}
				if (options.prefix) {
					url.searchParams.set("prefix", options.prefix);
				}

				const response = await fetchWithBackendHandling(effectiveConfig, url.toString(), {
					headers,
				});
				if (!response.ok && [429, 402, 403, 507].includes(response.status)) {
					return;
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to list objects: ${response.status} ${errorText}`);
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
				printError(error instanceof Error ? error.message : "Failed to list objects");
				process.exit(EXIT_CODES.NETWORK_ERROR);
				return;
			}
		});

	objects
		.command("get")
		.description("Get storage object metadata")
		.argument("<objectId>", "Object identifier")
		.action(async (_objectId: string) => {
			printError(
				"storage objects get is not available: storage-service does not expose GET /storage/v1/documents/:id. " +
					"Use storage objects list or the document policy endpoints via the platform APIs.",
			);
			process.exit(EXIT_CODES.INVALID_ARGUMENTS);
		});

	objects
		.command("delete")
		.description("Delete storage object")
		.argument("<objectId>", "Object identifier")
		.action(async (_objectId: string) => {
			printError(
				"storage objects delete is not available: storage-service does not expose a delete endpoint for documents. " +
					"Use retention/lifecycle policies or administrative workflows.",
			);
			process.exit(EXIT_CODES.INVALID_ARGUMENTS);
		});
}
