import type { Command } from "commander";
import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { requestServiceToken } from "../utils/auth.js";
import { printError, printJson, printSuccess } from "../utils/output.js";

export function registerAuthCommands(program: Command, config: CliConfig): void {
	const auth = program.command("auth").description("Authentication commands");

	auth
		.command("token")
		.description("Request a service token from auth-service")
		.option("--service-id <id>", "Service account ID")
		.option("--service-secret <secret>", "Service account secret")
		.option("--audience <audience>", "Token audience", "internal-service")
		.action(async (options) => {
			const serviceId = options.serviceId ?? config.serviceId;
			const serviceSecret = options.serviceSecret ?? config.serviceSecret;

			if (!serviceId || !serviceSecret) {
				printError("Service ID and secret are required");
				process.exit(EXIT_CODES.AUTH_ERROR);
				return;
			}

			const tokenConfig = {
				...config,
				serviceId,
				serviceSecret,
			};

			try {
				const token = await requestServiceToken(tokenConfig);
				if (token) {
					if (config.outputFormat === "json") {
						printJson({ accessToken: token });
					} else {
						printSuccess("Service token obtained");
						console.log(token);
					}
					process.exit(EXIT_CODES.SUCCESS);
					return;
				}
			} catch (error) {
				printError(error instanceof Error ? error.message : "Failed to get token");
				process.exit(EXIT_CODES.AUTH_ERROR);
				return;
			}
		});
}
