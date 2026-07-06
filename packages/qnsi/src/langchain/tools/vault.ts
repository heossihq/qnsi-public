/**
 * QNSP Vault Tools for LangChain
 *
 * Provides governed agents with PQC-encrypted secret storage.
 * Every read and write is automatically audited via the QNSP audit trail.
 */

import { StructuredTool, type ToolParams } from "@langchain/core/tools";
import { z } from "zod";
import type { VaultClient } from "../vault-client.js";

// ─── Read Secret ─────────────────────────────────────────────────────────────

const readSecretSchema = z.object({
	secretId: z.string().min(1).describe("The UUID of the secret to read"),
});

/**
 * LangChain tool that reads a PQC-encrypted secret from QNSP Vault.
 */
export class QnsiReadSecretTool extends StructuredTool {
	override readonly name = "qnsp_read_secret";
	override readonly description =
		"Read a PQC-encrypted secret from QNSP Vault. Returns the secret name and encrypted envelope. Use this when an agent needs to retrieve a stored credential, API key, or sensitive value.";
	override readonly schema = readSecretSchema;

	readonly #vault: VaultClient;

	constructor(vault: VaultClient, fields?: ToolParams) {
		super(fields);
		this.#vault = vault;
	}

	protected async _call(input: z.infer<typeof readSecretSchema>): Promise<string> {
		const secret = await this.#vault.getSecret(input.secretId);
		return JSON.stringify({
			id: secret.id,
			name: secret.name,
			tenantId: secret.tenantId,
			version: secret.version,
			algorithm: secret.pqc?.algorithm ?? secret.envelope.algorithm,
			createdAt: secret.createdAt,
		});
	}
}

// ─── Write Secret ─────────────────────────────────────────────────────────────

const writeSecretSchema = z.object({
	tenantId: z.string().min(1).describe("The tenant ID that will own the secret"),
	name: z.string().min(1).max(255).describe("A human-readable name for the secret"),
	payload: z
		.string()
		.min(1)
		.describe("The secret value to store, base64-encoded (e.g. btoa('my-api-key'))"),
	description: z.string().max(1000).optional().describe("Optional description stored in metadata"),
});

/**
 * LangChain tool that stores a PQC-encrypted secret in QNSP Vault.
 */
export class QnsiWriteSecretTool extends StructuredTool {
	override readonly name = "qnsp_write_secret";
	override readonly description =
		"Store a PQC-encrypted secret in QNSP Vault. The payload must be base64-encoded. Returns the created secret ID. Use this when an agent needs to persist a credential, token, or sensitive value securely.";
	override readonly schema = writeSecretSchema;

	readonly #vault: VaultClient;

	constructor(vault: VaultClient, fields?: ToolParams) {
		super(fields);
		this.#vault = vault;
	}

	protected async _call(input: z.infer<typeof writeSecretSchema>): Promise<string> {
		const secret = await this.#vault.createSecret({
			tenantId: input.tenantId,
			name: input.name,
			payload: input.payload,
			...(input.description !== undefined ? { metadata: { description: input.description } } : {}),
		});
		return JSON.stringify({
			id: secret.id,
			name: secret.name,
			tenantId: secret.tenantId,
			algorithm: secret.pqc?.algorithm ?? secret.envelope.algorithm,
			createdAt: secret.createdAt,
		});
	}
}

// ─── Rotate Secret ────────────────────────────────────────────────────────────

const rotateSecretSchema = z.object({
	secretId: z.string().min(1).describe("The UUID of the secret to rotate"),
	tenantId: z.string().min(1).describe("The tenant ID that owns the secret"),
	newPayload: z.string().min(1).describe("The new secret value, base64-encoded"),
});

/**
 * LangChain tool that rotates a secret in QNSP Vault with a new value.
 */
export class QnsiRotateSecretTool extends StructuredTool {
	override readonly name = "qnsp_rotate_secret";
	override readonly description =
		"Rotate a secret in QNSP Vault with a new PQC-encrypted value. The previous version is retained for rollback. Use this when an agent needs to update a credential after rotation.";
	override readonly schema = rotateSecretSchema;

	readonly #vault: VaultClient;

	constructor(vault: VaultClient, fields?: ToolParams) {
		super(fields);
		this.#vault = vault;
	}

	protected async _call(input: z.infer<typeof rotateSecretSchema>): Promise<string> {
		const secret = await this.#vault.rotateSecret(input.secretId, {
			tenantId: input.tenantId,
			newPayload: input.newPayload,
		});
		return JSON.stringify({
			id: secret.id,
			name: secret.name,
			version: secret.version,
			algorithm: secret.pqc?.algorithm ?? secret.envelope.algorithm,
			rotatedAt: secret.updatedAt,
		});
	}
}
