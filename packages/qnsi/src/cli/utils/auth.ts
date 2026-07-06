import type { CliConfig } from "../config.js";
import { EXIT_CODES } from "../config.js";
import { validateHttpsUrl } from "./https-validator.js";
import { printError, printVerbose } from "./output.js";
import { promptForSecret } from "./prompt.js";
import { RateLimitError, RateLimiter } from "./rate-limiter.js";
import { getCachedToken, setCachedToken } from "./token-cache.js";

const authRateLimiter = new RateLimiter(50, 60000);

interface ServiceTokenResponse {
	readonly accessToken: string;
}

export async function requestServiceToken(config: CliConfig): Promise<string | null> {
	if (!config.serviceId) {
		printError("QNSI_SERVICE_ID must be set");
		process.exit(EXIT_CODES.AUTH_ERROR);
	}

	const cached = getCachedToken(config.serviceId);
	if (cached) {
		printVerbose("Using cached service token", config.verbose);
		return cached;
	}

	let serviceSecret = config.serviceSecret;
	if (!serviceSecret) {
		if (process.stdin.isTTY) {
			printVerbose("Service secret not found, prompting for input", config.verbose);
			serviceSecret = await promptForSecret("Enter service secret: ");
		} else {
			printError("QNSI_SERVICE_SECRET must be set (non-interactive mode)");
			process.exit(EXIT_CODES.AUTH_ERROR);
		}
	}

	validateHttpsUrl(config.authServiceUrl, "Auth service URL", process.env["NODE_ENV"]);

	try {
		await authRateLimiter.checkLimit();
	} catch (error) {
		if (error instanceof RateLimitError) {
			printError(error.message);
			process.exit(EXIT_CODES.RATE_LIMITED);
		}
		throw error;
	}

	printVerbose(`Requesting service token from ${config.authServiceUrl}`, config.verbose);

	try {
		const response = await fetch(`${config.authServiceUrl}/auth/service-token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${serviceSecret}`,
			},
			body: JSON.stringify({
				serviceId: config.serviceId,
				audience: "internal-service",
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			let errorBody: unknown;
			try {
				errorBody = JSON.parse(errorText);
			} catch {
				errorBody = { error: "unknown", message: errorText };
			}

			if (
				response.status === 429 ||
				response.status === 402 ||
				response.status === 403 ||
				response.status === 507
			) {
				const { handleBackendError } = await import("./backend-validator.js");
				handleBackendError(response, errorBody);
			}

			printError(`Failed to get service token: ${response.status} ${errorText}`);
			process.exit(EXIT_CODES.AUTH_ERROR);
		}

		const data = (await response.json()) as ServiceTokenResponse;
		printVerbose("Service token obtained successfully", config.verbose);

		const { parseRateLimitHeaders, warnIfLowQuota } = await import("./backend-validator.js");
		const rateLimits = parseRateLimitHeaders(response.headers);
		warnIfLowQuota(rateLimits.remaining, rateLimits.limit);

		setCachedToken(config.serviceId, data.accessToken);

		return data.accessToken;
	} catch (error) {
		printError(`Network error: ${error instanceof Error ? error.message : "Unknown error"}`);
		process.exit(EXIT_CODES.NETWORK_ERROR);
	}
}

export async function getAuthHeaders(config: CliConfig): Promise<Record<string, string>> {
	const token = await requestServiceToken(config);
	if (!token) {
		process.exit(EXIT_CODES.AUTH_ERROR);
	}

	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};

	if (config.tenantId) {
		headers["x-qnsp-tenant"] = config.tenantId;
		headers["x-tenant-id"] = config.tenantId;
	}

	return headers;
}
