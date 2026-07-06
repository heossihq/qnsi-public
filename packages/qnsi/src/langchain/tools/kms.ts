/**
 * QNSP KMS Tools for LangChain
 *
 * Provides governed agents with quantum-safe signing and key operations.
 * Uses ML-DSA (FIPS 204), SLH-DSA (FIPS 205), and FN-DSA for signatures.
 */

import { StructuredTool, type ToolParams } from "@langchain/core/tools";
import { z } from "zod";

export interface QnsiKmsToolConfig {
	/** Base URL for the QNSP API (e.g. https://api.qnsi.heossi.com) */
	readonly baseUrl: string;
	/** API key or Bearer token for authentication */
	readonly apiKey: string;
	/** Tenant ID for all KMS operations */
	readonly tenantId: string;
	/** Request timeout in milliseconds (default: 15000) */
	readonly timeoutMs?: number;
}

// ─── Sign Data ────────────────────────────────────────────────────────────────

const signDataSchema = z.object({
	keyId: z.string().min(1).describe("The UUID of the PQC signing key to use"),
	data: z
		.string()
		.min(1)
		.describe("The data to sign, base64-encoded (e.g. btoa(JSON.stringify(payload)))"),
	context: z
		.string()
		.optional()
		.describe("Optional context string for domain separation (base64-encoded)"),
});

/**
 * LangChain tool that signs data with a PQC key (ML-DSA / SLH-DSA / FN-DSA).
 */
export class QnsiSignDataTool extends StructuredTool {
	override readonly name = "qnsp_sign_data";
	override readonly description =
		"Sign data with a quantum-safe PQC key (ML-DSA, SLH-DSA, or FN-DSA). Returns a base64-encoded signature. Use this when an agent needs to cryptographically attest to data it produced or decisions it made.";
	override readonly schema = signDataSchema;

	readonly #config: Required<QnsiKmsToolConfig>;

	constructor(config: QnsiKmsToolConfig, fields?: ToolParams) {
		super(fields);
		this.#config = { timeoutMs: 15_000, ...config };
	}

	protected async _call(input: z.infer<typeof signDataSchema>): Promise<string> {
		const url = `${this.#config.baseUrl}/proxy/kms/v1/keys/${encodeURIComponent(input.keyId)}/sign`;
		const body: Record<string, string> = {
			tenantId: this.#config.tenantId,
			data: input.data,
		};
		if (input.context !== undefined) {
			body["context"] = input.context;
		}

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.#config.apiKey}`,
				"x-qnsp-tenant-id": this.#config.tenantId,
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(this.#config.timeoutMs),
		});

		if (!response.ok) {
			const err = (await response.json().catch(() => ({}))) as Record<string, unknown>;
			throw new Error(
				`KMS sign failed (${response.status}): ${String(err["message"] ?? "unknown error")}`,
			);
		}

		const result = (await response.json()) as Record<string, unknown>;
		return JSON.stringify({
			keyId: input.keyId,
			signature: result["signature"],
			algorithm: result["algorithm"],
			signedAt: new Date().toISOString(),
		});
	}
}

// ─── Verify Signature ─────────────────────────────────────────────────────────

const verifySignatureSchema = z.object({
	keyId: z.string().min(1).describe("The UUID of the PQC key used to create the signature"),
	data: z.string().min(1).describe("The original data that was signed, base64-encoded"),
	signature: z.string().min(1).describe("The signature to verify, base64-encoded"),
	context: z
		.string()
		.optional()
		.describe("Optional context string used during signing (base64-encoded)"),
});

/**
 * LangChain tool that verifies a PQC signature against data and a key.
 */
export class QnsiVerifySignatureTool extends StructuredTool {
	override readonly name = "qnsp_verify_signature";
	override readonly description =
		"Verify a quantum-safe PQC signature. Returns true/false and the algorithm used. Use this when an agent needs to verify the authenticity of data or attestations from other agents or services.";
	override readonly schema = verifySignatureSchema;

	readonly #config: Required<QnsiKmsToolConfig>;

	constructor(config: QnsiKmsToolConfig, fields?: ToolParams) {
		super(fields);
		this.#config = { timeoutMs: 15_000, ...config };
	}

	protected async _call(input: z.infer<typeof verifySignatureSchema>): Promise<string> {
		const url = `${this.#config.baseUrl}/proxy/kms/v1/keys/${encodeURIComponent(input.keyId)}/verify`;
		const body: Record<string, string> = {
			tenantId: this.#config.tenantId,
			data: input.data,
			signature: input.signature,
		};
		if (input.context !== undefined) {
			body["context"] = input.context;
		}

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.#config.apiKey}`,
				"x-qnsp-tenant-id": this.#config.tenantId,
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(this.#config.timeoutMs),
		});

		if (!response.ok) {
			const err = (await response.json().catch(() => ({}))) as Record<string, unknown>;
			throw new Error(
				`KMS verify failed (${response.status}): ${String(err["message"] ?? "unknown error")}`,
			);
		}

		const result = (await response.json()) as Record<string, unknown>;
		return JSON.stringify({
			keyId: input.keyId,
			valid: result["valid"],
			algorithm: result["algorithm"],
			verifiedAt: new Date().toISOString(),
		});
	}
}
