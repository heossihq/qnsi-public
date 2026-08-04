#!/usr/bin/env node

import { Command } from "commander";
import cliPackage from "../../package.json" with { type: "json" };
import { registerAccessControlCommands } from "./commands/access-control.js";
import { registerAuditCommands } from "./commands/audit.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerBillingCommands } from "./commands/billing.js";
import { registerCryptoPolicyCommands } from "./commands/crypto-policy.js";
import { registerCryptoScanCommands } from "./commands/crypto-scan.js";
import { registerKmsCommands } from "./commands/kms.js";
import { registerObservabilityCommands } from "./commands/observability.js";
import { registerSearchCommands } from "./commands/search.js";
import { registerSecurityCommands } from "./commands/security.js";
import { registerStorageCommands } from "./commands/storage.js";
import { registerTenantCommands } from "./commands/tenant.js";
import { registerVaultCommands } from "./commands/vault.js";
import { loadConfig } from "./config.js";
import { resolveApiKeyTenant } from "./utils/auth.js";

const program = new Command();

program
	.name("qnsi")
	.description("QNSP CLI - Command-line interface for the QNSP platform")
	.version(cliPackage.version)
	.option("--edge-gateway-url <url>", "Edge Gateway URL (production entrypoint)")
	.option("--cloud-portal-url <url>", "Cloud Portal URL (for upgrade/add-on links)")
	.option("--auth-service-url <url>", "Auth service URL")
	.option("--service-id <id>", "Service account ID")
	.option("--service-secret <secret>", "Service account secret")
	.option("--tenant-id <id>", "Tenant identifier")
	.option("--kms-service-url <url>", "KMS service URL")
	.option("--vault-service-url <url>", "Vault service URL")
	.option("--audit-service-url <url>", "Audit service URL")
	.option("--tenant-service-url <url>", "Tenant service URL")
	.option("--billing-service-url <url>", "Billing service URL")
	.option("--access-control-service-url <url>", "Access control service URL")
	.option("--security-monitoring-service-url <url>", "Security monitoring service URL")
	.option("--storage-service-url <url>", "Storage service URL")
	.option("--search-service-url <url>", "Search service URL")
	.option("--observability-service-url <url>", "Observability service URL")
	.option("--output <format>", "Output format: json, table, yaml", "table")
	.option("--verbose", "Enable verbose output");

const baseConfig = loadConfig();

/**
 * With an API key, the tenant resolves from the activation handshake - a customer should
 * never have to look up and export their own tenant UUID.
 *
 * Every command guards on `config.tenantId` and exits with "QNSI_TENANT_ID must be set".
 * That is fine for the service-account path (an ops operator knows the tenant), but a
 * customer holding only an API key had no way through: the CLI demanded QNSI_SERVICE_ID,
 * QNSI_SERVICE_SECRET *and* QNSI_TENANT_ID - none of which they have.
 *
 * Resolving once here, before the commands are registered, means every existing command
 * works with an API key and nothing downstream changes.
 */
const config: typeof baseConfig =
	baseConfig.apiKey && !baseConfig.tenantId
		? { ...baseConfig, tenantId: await resolveApiKeyTenant(baseConfig) }
		: baseConfig;

registerAuthCommands(program, config);
registerKmsCommands(program, config);
registerVaultCommands(program, config);
registerAuditCommands(program, config);
registerStorageCommands(program, config);
registerSearchCommands(program, config);
registerTenantCommands(program, config);
registerCryptoPolicyCommands(program, config);
registerCryptoScanCommands(program, config);
registerBillingCommands(program, config);
registerAccessControlCommands(program, config);
registerObservabilityCommands(program, config);
registerSecurityCommands(program, config);

program.parse(process.argv);
