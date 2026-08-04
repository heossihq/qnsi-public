import { randomUUID } from "node:crypto";
import type { Command } from "commander";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { getAuthHeaders } from "../utils/auth.js";
import { getEffectiveConfig } from "../utils/command-config.js";
import { fetchWithBackendHandling } from "../utils/fetcher.js";
import { printError, printJson, printSuccess, printTable } from "../utils/output.js";

export function registerKmsCommands(program: Command, config: CliConfig): void {
	const kms = program.command("kms").description("KMS key management commands");

	const keys = kms.command("keys").description("Key operations");

	keys
		.command("list")
		.description("List KMS keys")
		.option("--limit <number>", "Number of keys to return", "100")
		.option("--cursor <cursor>", "Pagination cursor")
		.action(async (options, command) => {
			if (!config.tenantId) {
				printError("QNSI_TENANT_ID must be set");
				return process.exit(EXIT_CODES.INVALID_ARGUMENTS);
			}

			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				const headers = await getAuthHeaders(effectiveConfig);
				const url = new URL(`${effectiveConfig.kmsServiceUrl}/kms/v1/keys`);
				url.searchParams.set("tenantId", effectiveConfig.tenantId ?? "");
				url.searchParams.set("limit", options.limit);
				if (options.cursor) {
					url.searchParams.set("cursor", options.cursor);
				}

				const response = await fetchWithBackendHandling(effectiveConfig, url.toString(), {
					headers,
				});

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to list keys: ${response.status} ${errorText}`);
					return process.exit(EXIT_CODES.GENERAL_ERROR);
				}

				const data = (await response.json()) as { items?: Record<string, unknown>[] };

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printTable(data.items ?? []);
				}
				return process.exit(EXIT_CODES.SUCCESS);
			} catch (error) {
				if (error instanceof Error && error.message.startsWith("__EXIT__")) {
					return;
				}
				printError(error instanceof Error ? error.message : "Failed to list keys");
				return process.exit(EXIT_CODES.NETWORK_ERROR);
			}
		});

	keys
		.command("get")
		.description("Get KMS key details")
		.argument("<keyId>", "Key identifier")
		.action(async (keyId: string, _options, command) => {
			if (!config.tenantId) {
				printError("QNSI_TENANT_ID must be set");
				return process.exit(EXIT_CODES.INVALID_ARGUMENTS);
			}

			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				if (!effectiveConfig.tenantId) {
					printError("QNSI_TENANT_ID must be set");
					return process.exit(EXIT_CODES.INVALID_ARGUMENTS);
				}
				const headers = await getAuthHeaders(effectiveConfig);
				const url = new URL(`${effectiveConfig.kmsServiceUrl}/kms/v1/keys/${keyId}`);
				url.searchParams.set("tenantId", effectiveConfig.tenantId);

				const response = await fetchWithBackendHandling(effectiveConfig, url.toString(), {
					headers,
				});

				if (response.status === 404) {
					printError(`Key not found: ${keyId}`);
					return process.exit(EXIT_CODES.NOT_FOUND);
				}

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to get key: ${response.status} ${errorText}`);
					return process.exit(EXIT_CODES.GENERAL_ERROR);
				}

				const data = (await response.json()) as Record<string, unknown>;

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printTable(data);
				}
				return process.exit(EXIT_CODES.SUCCESS);
			} catch (error) {
				if (error instanceof Error && error.message.startsWith("__EXIT__")) {
					return;
				}
				printError(error instanceof Error ? error.message : "Failed to get key");
				return process.exit(EXIT_CODES.NETWORK_ERROR);
			}
		});

	keys
		.command("create")
		.description("Create a new KMS key")
		.option("--name <name>", "Key name")
		.option("--algorithm <algorithm>", "Key algorithm", "aes-256-gcm")
		.option("--purpose <purpose>", "Key purpose", "encryption")
		.action(async (options, command) => {
			if (!config.tenantId) {
				printError("QNSI_TENANT_ID must be set");
				return process.exit(EXIT_CODES.INVALID_ARGUMENTS);
			}

			try {
				const effectiveConfig = getEffectiveConfig(config, command);
				if (!effectiveConfig.tenantId) {
					printError("QNSI_TENANT_ID must be set");
					return process.exit(EXIT_CODES.INVALID_ARGUMENTS);
				}
				const headers = await getAuthHeaders(effectiveConfig);

				// WIRE CONTRACT (kms-service createKeySchema):
				//     { tenantId, keyId (REQUIRED, 1-255), keyType (root|master|data|byok),
				//       algorithm, metadata }
				//
				// This sent `{ tenantId, name, algorithm, purpose }` - no keyId, no keyType, and
				// two fields (`name`, `purpose`) the backend does not know. It returned 400
				// EVERY TIME: the command had never created a key. Proven 2026-07-14 against
				// production with a real API key:
				//
				//     fieldErrors: { keyId: ["expected string, received undefined"],
				//                    keyType: ["expected one of root|master|data|byok"] }
				//
				// Identical to the MCP server's qnsp_kms_generate_key. Backend Zod objects are
				// NON-STRICT, so `name`/`purpose` were silently STRIPPED and the two required
				// fields simply never arrived - which is why the failure never named itself.
				// They belong in metadata, exactly as the (proven) SDK does.
				const metadata: Record<string, string> = {};
				if (options.name) metadata["name"] = String(options.name);
				if (options.purpose) metadata["purpose"] = String(options.purpose);

				const body = {
					tenantId: effectiveConfig.tenantId,
					keyId: randomUUID(),
					keyType: "data",
					algorithm: options.algorithm,
					metadata,
				};

				const response = await fetchWithBackendHandling(
					effectiveConfig,
					`${effectiveConfig.kmsServiceUrl}/kms/v1/keys`,
					{
						method: "POST",
						headers,
						body: JSON.stringify(body),
					},
				);

				if (!response.ok) {
					const errorText = await response.text();
					printError(`Failed to create key: ${response.status} ${errorText}`);
					return process.exit(EXIT_CODES.GENERAL_ERROR);
				}

				const data = (await response.json()) as Record<string, unknown> & { keyId?: string };

				if (effectiveConfig.outputFormat === "json") {
					printJson(data);
				} else {
					printSuccess(`Key created: ${data.keyId}`);
					printTable(data);
				}
				return process.exit(EXIT_CODES.SUCCESS);
			} catch (error) {
				if (error instanceof Error && error.message.startsWith("__EXIT__")) {
					return;
				}
				printError(error instanceof Error ? error.message : "Failed to create key");
				return process.exit(EXIT_CODES.NETWORK_ERROR);
			}
		});
}
