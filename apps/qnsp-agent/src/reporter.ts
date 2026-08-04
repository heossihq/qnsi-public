/**
 * QNSP Agent Reporter
 *
 * Signs and submits asset discovery reports to the QNSP platform.
 *
 * Auth protocol (must match apps/crypto-inventory-service/src/services/agent-auth.ts):
 *   hmacKey  = SHA-256(bootstrapSecret)
 *   bodyHash = SHA-256(rawBody)
 *   payload  = timestamp + "." + nonce + "." + bodyHash
 *   sig      = HMAC-SHA256(hmacKey, payload)
 *
 * Headers sent:
 *   X-Agent-Id:         <agentId>
 *   X-Agent-Timestamp:  <ISO 8601>
 *   X-Agent-Nonce:      <random 32-char hex>
 *   X-Agent-Body-Hash:  <hex SHA-256 of body>
 *   X-Agent-Signature:  <hex HMAC-SHA256>
 *   X-Qnsp-Tenant:      <tenantId>
 */

import * as crypto from "node:crypto";

import type { AgentConfig } from "./config.js";
import { logger } from "./logger.js";
import type { ScannedAsset } from "./scanner.js";

export interface ReportPayload {
	readonly agentId: string;
	readonly hostname: string;
	readonly reportedAt: string;
	readonly assets: ScannedAsset[];
}

export interface ReportResult {
	readonly accepted: boolean;
	readonly agentId: string;
	readonly assetCount: number;
	readonly bodyHash: string;
}

export function createReportPayload(
	config: AgentConfig,
	assets: readonly ScannedAsset[],
	reportedAt = new Date().toISOString(),
): ReportPayload {
	return {
		agentId: config.agentId,
		hostname: config.hostname,
		reportedAt,
		assets: [...assets],
	};
}

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1_000;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Derive the HMAC key from the bootstrap secret.
 * Both agent and server use SHA-256(secret_bytes) as the HMAC key - over the DECODED
 * bytes of the hex secret, not the hex string's UTF-8 bytes. Matches the server's
 * `hashSecret` / verifySignature in apps/crypto-inventory-service/src/services/agent-store.ts.
 * Exported so a contract test can pin this derivation to the canonical key (audit
 * qnsp-agent HMAC).
 */
export function deriveHmacKey(secret: string): Buffer {
	return crypto.createHash("sha256").update(Buffer.from(secret, "hex")).digest();
}

/**
 * Generate a random nonce (32 hex chars = 16 bytes).
 * Nonce length must be 8-128 chars per agent-auth.ts validation.
 */
function generateNonce(): string {
	return crypto.randomBytes(16).toString("hex");
}

/**
 * Sign a report payload and return the required auth headers.
 * Protocol matches apps/crypto-inventory-service/src/services/agent-auth.ts.
 */
function signReport(agentId: string, secret: string, rawBody: Buffer): Record<string, string> {
	const timestamp = new Date().toISOString();
	const nonce = generateNonce();
	const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
	const hmacKey = deriveHmacKey(secret);
	const sigPayload = `${timestamp}.${nonce}.${bodyHash}`;
	const signature = crypto.createHmac("sha256", hmacKey).update(sigPayload).digest("hex");

	return {
		"x-agent-id": agentId,
		"x-agent-timestamp": timestamp,
		"x-agent-nonce": nonce,
		"x-agent-body-hash": bodyHash,
		"x-agent-signature": signature,
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Submit a discovery report to the QNSP platform.
 * Retries up to MAX_RETRIES times with exponential backoff on transient (5xx/network) errors.
 * Does not retry on 4xx client errors.
 */
export async function submitReport(
	config: AgentConfig,
	assets: ScannedAsset[],
): Promise<ReportResult> {
	return submitReportPayload(config, createReportPayload(config, assets));
}

/**
 * Submit an already-created payload. Durable spool replay uses this entry point
 * so the exact report body and body hash survive process and network restarts.
 */
export async function submitReportPayload(
	config: AgentConfig,
	payload: ReportPayload,
): Promise<ReportResult> {
	if (payload.agentId !== config.agentId) {
		throw new Error("Queued report agentId does not match configured agent");
	}

	const rawBody = Buffer.from(JSON.stringify(payload), "utf8");
	const authHeaders = signReport(config.agentId, config.agentSecret, rawBody);
	const url = `${config.endpoint}/proxy/crypto/v1/agent-reports`;

	const headers: Record<string, string> = {
		"content-type": "application/json",
		"x-qnsp-tenant": config.tenantId,
		...authHeaders,
	};

	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		let res: Response;
		try {
			logger.debug("Submitting report", { url, assetCount: payload.assets.length, attempt });

			res = await fetch(url, {
				method: "POST",
				headers,
				body: rawBody,
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch (err) {
			lastError =
				err instanceof Error && err.name === "AbortError"
					? new Error("Request timed out")
					: err instanceof Error
						? err
						: new Error(String(err));

			logger.warn("Request failed, will retry", {
				error: lastError.message,
				attempt,
				maxRetries: MAX_RETRIES,
			});

			if (attempt < MAX_RETRIES) {
				await sleep(Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, 30_000));
			}
			continue;
		}

		if (res.status === 202) {
			const body = (await res.json()) as ReportResult;
			logger.info("Report accepted", {
				agentId: body.agentId,
				assetCount: body.assetCount,
				bodyHash: body.bodyHash,
			});
			return body;
		}

		if (res.status === 429) {
			logger.warn("Rate limited, backing off", { retryAfterMs: 60_000 });
			await sleep(60_000);
			continue;
		}

		if (res.status >= 400 && res.status < 500) {
			// Client error - do not retry
			const text = await res.text().catch(() => "");
			throw new Error(`Report rejected (${res.status}): ${text}`);
		}

		// 5xx - retry with backoff
		const text = await res.text().catch(() => "");
		lastError = new Error(`Server error (${res.status}): ${text}`);
		logger.warn("Server error, will retry", {
			status: res.status,
			attempt,
			maxRetries: MAX_RETRIES,
		});

		if (attempt < MAX_RETRIES) {
			await sleep(Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, 30_000));
		}
	}

	throw lastError ?? new Error("Failed to submit report after retries");
}
