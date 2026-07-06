import { EXIT_CODES } from "../config.js";
import { printError } from "./output.js";

export function validateHttpsUrl(url: string, context: string, nodeEnv = "production"): void {
	if (nodeEnv === "production" && !url.startsWith("https://")) {
		printError(
			`${context} requires an https:// URL when NODE_ENV=production. Got: ${url}\n` +
				"Use --auth-service-url with https:// or set NODE_ENV=development for testing.",
		);
		process.exit(EXIT_CODES.INVALID_ARGUMENTS);
		return;
	}

	if (url.startsWith("http://") && !isLocalhostUrl(url) && nodeEnv !== "development") {
		printError(
			`Warning: ${context} is using unencrypted HTTP. This is insecure.\n` +
				`URL: ${url}\n` +
				"Consider using HTTPS or set NODE_ENV=development to suppress this warning.",
		);
	}
}

export function isLocalhostUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return (
			parsed.hostname === "localhost" ||
			parsed.hostname === "127.0.0.1" ||
			parsed.hostname === "::1" ||
			parsed.hostname.endsWith(".local")
		);
	} catch {
		return false;
	}
}

export function validateAllServiceUrls(config: {
	authServiceUrl: string;
	kmsServiceUrl: string;
	vaultServiceUrl: string;
	auditServiceUrl: string;
}): void {
	const nodeEnv = process.env["NODE_ENV"] ?? "production";

	validateHttpsUrl(config.authServiceUrl, "Auth service URL", nodeEnv);
	validateHttpsUrl(config.kmsServiceUrl, "KMS service URL", nodeEnv);
	validateHttpsUrl(config.vaultServiceUrl, "Vault service URL", nodeEnv);
	validateHttpsUrl(config.auditServiceUrl, "Audit service URL", nodeEnv);
}
