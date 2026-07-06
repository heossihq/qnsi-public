import type { CliConfig } from "../config.js";

import { handleBackendError, parseRateLimitHeaders, warnIfLowQuota } from "./backend-validator.js";

const ENFORCEMENT_STATUSES = new Set([429, 402, 403, 507]);

export async function fetchWithBackendHandling(
	_config: CliConfig,
	input: Parameters<typeof fetch>[0],
	init?: Parameters<typeof fetch>[1],
): Promise<Response> {
	const response = await fetch(input, init);

	if (!response.ok && ENFORCEMENT_STATUSES.has(response.status)) {
		const errorText =
			typeof (response as Response).clone === "function"
				? await (response as Response).clone().text()
				: await (response as Response).text();
		let errorBody: unknown;
		try {
			errorBody = JSON.parse(errorText);
		} catch {
			errorBody = { error: "unknown", message: errorText };
		}
		handleBackendError(response, errorBody);
	}

	try {
		const headers = (response as { headers?: Headers }).headers;
		if (headers && typeof headers.get === "function") {
			const rateLimits = parseRateLimitHeaders(headers);
			warnIfLowQuota(rateLimits.remaining, rateLimits.limit);
		}
	} catch {
		// ignore non-standard/mocked responses
	}

	return response;
}
