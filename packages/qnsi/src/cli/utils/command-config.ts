import type { Command } from "commander";

import type { CliConfig } from "../config.js";
import { loadConfig } from "../config.js";

export function getEffectiveConfig(baseConfig: CliConfig, command: Command): CliConfig {
	const globals = command.optsWithGlobals() as Record<string, unknown>;

	return loadConfig({
		...baseConfig,
		edgeGatewayUrl: (globals["edgeGatewayUrl"] as string | undefined) ?? baseConfig.edgeGatewayUrl,
		cloudPortalUrl: (globals["cloudPortalUrl"] as string | undefined) ?? baseConfig.cloudPortalUrl,
		authServiceUrl: (globals["authServiceUrl"] as string | undefined) ?? baseConfig.authServiceUrl,
		serviceId: (globals["serviceId"] as string | undefined) ?? baseConfig.serviceId,
		serviceSecret: (globals["serviceSecret"] as string | undefined) ?? baseConfig.serviceSecret,
		tenantId: (globals["tenantId"] as string | undefined) ?? baseConfig.tenantId,
		kmsServiceUrl: (globals["kmsServiceUrl"] as string | undefined) ?? baseConfig.kmsServiceUrl,
		vaultServiceUrl:
			(globals["vaultServiceUrl"] as string | undefined) ?? baseConfig.vaultServiceUrl,
		auditServiceUrl:
			(globals["auditServiceUrl"] as string | undefined) ?? baseConfig.auditServiceUrl,
		tenantServiceUrl:
			(globals["tenantServiceUrl"] as string | undefined) ?? baseConfig.tenantServiceUrl,
		billingServiceUrl:
			(globals["billingServiceUrl"] as string | undefined) ?? baseConfig.billingServiceUrl,
		accessControlServiceUrl:
			(globals["accessControlServiceUrl"] as string | undefined) ??
			baseConfig.accessControlServiceUrl,
		securityMonitoringServiceUrl:
			(globals["securityMonitoringServiceUrl"] as string | undefined) ??
			baseConfig.securityMonitoringServiceUrl,
		storageServiceUrl:
			(globals["storageServiceUrl"] as string | undefined) ?? baseConfig.storageServiceUrl,
		searchServiceUrl:
			(globals["searchServiceUrl"] as string | undefined) ?? baseConfig.searchServiceUrl,
		observabilityServiceUrl:
			(globals["observabilityServiceUrl"] as string | undefined) ??
			baseConfig.observabilityServiceUrl,
		outputFormat:
			(globals["output"] as CliConfig["outputFormat"] | undefined) ?? baseConfig.outputFormat,
		verbose: (globals["verbose"] as boolean | undefined) ?? baseConfig.verbose,
	});
}
