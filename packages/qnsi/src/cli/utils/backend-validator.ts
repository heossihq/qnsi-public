import { bridgeQnsiEnv } from "../../internal/env-aliases.js";
import { EXIT_CODES } from "../config.js";
import { printError } from "./output.js";

// Accept both QNSI_* (canonical) and legacy QNSP_* user env vars.
bridgeQnsiEnv();

const CLOUD_PORTAL_URL = process.env["QNSI_CLOUD_PORTAL_URL"] ?? "https://cloud.qnsi.heossi.com";

export interface BackendErrorResponse {
	readonly error: string;
	readonly message: string;
	readonly statusCode: number;
	readonly tier?: string;
	readonly requiredTier?: string;
	readonly requiredAddOn?: string;
	readonly limit?: number;
	readonly remaining?: number;
	readonly retryAfter?: number;
}

export function handleBackendError(response: Response, body: unknown): void {
	const error = body as BackendErrorResponse;

	switch (response.status) {
		case 429: // Rate Limited
			printError(
				`🚫 Rate limit exceeded for your tier (${error.tier || "unknown"}).\n` +
					`Limit: ${error.limit || "N/A"} requests per minute\n` +
					`Remaining: ${error.remaining || 0}\n` +
					`Retry after: ${error.retryAfter || 60}s\n\n` +
					`💡 Upgrade your tier for higher limits: ${CLOUD_PORTAL_URL}/billing/upgrade`,
			);
			process.exit(EXIT_CODES.RATE_LIMITED);
			return;

		case 402: // Payment Required
			printError(
				`💳 Payment required: ${error.message}\n\n` +
					`This feature requires a paid tier or add-on.\n` +
					`Current tier: ${error.tier || "unknown"}\n` +
					`Required: ${error.requiredTier || error.requiredAddOn || "unknown"}\n\n` +
					`💡 Upgrade at: ${CLOUD_PORTAL_URL}/billing`,
			);
			process.exit(EXIT_CODES.AUTHORIZATION_ERROR);
			return;

		case 403: // Forbidden - Feature not enabled
			if (error.requiredAddOn) {
				printError(
					`🔒 Feature not enabled: ${error.message}\n\n` +
						`This requires the "${error.requiredAddOn}" add-on.\n` +
						`Current tier: ${error.tier || "unknown"}\n\n` +
						`💡 Enable add-ons at: ${CLOUD_PORTAL_URL}/billing/addons\n` +
						`⚠️  Note: Some add-ons require sales approval for security/compliance.`,
				);
			} else {
				printError(
					`🔒 Access denied: ${error.message}\n\n` +
						`You don't have permission for this operation.\n` +
						`Current tier: ${error.tier || "unknown"}\n` +
						`Required tier: ${error.requiredTier || "higher"}\n\n` +
						`💡 Upgrade at: ${CLOUD_PORTAL_URL}/billing/upgrade`,
				);
			}
			process.exit(EXIT_CODES.AUTHORIZATION_ERROR);
			return;

		case 507: // Insufficient Storage / Quota Exceeded
			printError(
				`📊 Quota exceeded: ${error.message}\n\n` +
					`You've reached your tier limit.\n` +
					`Current tier: ${error.tier || "unknown"}\n\n` +
					`💡 Options:\n` +
					`  1. Upgrade your tier: ${CLOUD_PORTAL_URL}/billing/upgrade\n` +
					`  2. Delete unused resources\n` +
					`  3. Purchase additional capacity: ${CLOUD_PORTAL_URL}/billing/addons`,
			);
			process.exit(EXIT_CODES.GENERAL_ERROR);
			return;

		default:
			printError(`❌ Backend error (${response.status}): ${error.message || "Unknown error"}`);
			process.exit(EXIT_CODES.GENERAL_ERROR);
			return;
	}
}

export function parseRateLimitHeaders(headers: Headers): {
	limit: number | null;
	remaining: number | null;
	reset: number | null;
} {
	const limitRaw = headers.get("x-ratelimit-limit");
	const remainingRaw = headers.get("x-ratelimit-remaining");
	const resetRaw = headers.get("x-ratelimit-reset");

	return {
		limit: limitRaw ? Number.parseInt(limitRaw, 10) : null,
		remaining: remainingRaw ? Number.parseInt(remainingRaw, 10) : null,
		reset: resetRaw ? Number.parseInt(resetRaw, 10) : null,
	};
}

export function warnIfLowQuota(remaining: number | null, limit: number | null): void {
	if (remaining !== null && limit !== null && remaining < limit * 0.1) {
		console.warn(
			`⚠️  Warning: Low quota remaining (${remaining}/${limit}).\n` +
				`Consider upgrading your tier or purchasing add-ons to avoid service interruption.`,
		);
	}
}
