/**
 * QNSP Vault - PQC-encrypted secret storage with versioning, rotation,
 * and deletion. Wraps `apps/vault-service` (`/vault/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";

const PATH_PREFIX = "/proxy/vault/v1";

export interface CreateSecretRequest {
	readonly name: string;
	readonly payloadB64: string;
	readonly algorithm?: string;
	readonly metadata?: Record<string, unknown>;
}

export class VaultClient {
	constructor(private readonly internal: Internal) {}

	createSecret(req: CreateSecretRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		// Wire contract: vault createSecretSchema = { tenantId, name(min3), payload,
		// metadata, rotationPolicy(default) }. tenantId is auto-injected by Internal.
		// Map the SDK's payloadB64 -> payload and fold algorithm into metadata.
		const metadata = {
			...(req.metadata ?? {}),
			...(req.algorithm ? { algorithm: req.algorithm } : {}),
		};
		const body = { name: req.name, payload: req.payloadB64, metadata };
		return this.internal.request("POST", `${PATH_PREFIX}/secrets`, body, opts);
	}

	/** Secret metadata + the ML-KEM-wrapped envelope (NOT the plaintext). */
	getSecret(secretId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/secrets/${secretId}`);
	}

	/**
	 * The DECRYPTED plaintext of a secret: `{ value }`. Server-side unwrap of the
	 * ML-KEM-wrapped envelope, tenant-isolated by the API key.
	 */
	getSecretValue(secretId: string): Promise<{ value: string }> {
		return this.internal.request("GET", `${PATH_PREFIX}/secrets/${secretId}/value`) as Promise<{
			value: string;
		}>;
	}

	/**
	 * List the tenant's secrets (metadata: id, name, versions - never the payload).
	 * The tenant is derived from the API key. Use to resolve a secret by name.
	 */
	listSecrets(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/secrets`, undefined, { query });
	}

	/**
	 * Resolve a secret by NAME to its decrypted plaintext string, or null if no
	 * secret with that name exists. The vault addresses secrets by id, so this
	 * lists (to map name→id) then fetches the decrypted value.
	 */
	async getSecretValueByName(name: string): Promise<string | null> {
		const listed = (await this.listSecrets()) as { secrets?: Array<Record<string, unknown>> };
		const match = (listed?.secrets ?? []).find((s) => s["name"] === name);
		const id = match?.["id"];
		if (typeof id !== "string") return null;
		const { value } = await this.getSecretValue(id);
		return value ?? null;
	}

	getSecretVersion(secretId: string, version: number) {
		return this.internal.request("GET", `${PATH_PREFIX}/secrets/${secretId}/versions/${version}`);
	}

	rotateSecret(
		secretId: string,
		payloadB64: string,
		algorithm?: string,
		opts?: Pick<RequestOptions, "idempotencyKey">,
	) {
		// Wire contract: rotateSecretSchema = { tenantId, newPayload?, metadata?,
		// rotationPolicy? }. Map payloadB64 -> newPayload; algorithm into metadata.
		const body: Record<string, unknown> = { newPayload: payloadB64 };
		if (algorithm !== undefined) body["metadata"] = { algorithm };
		return this.internal.request("POST", `${PATH_PREFIX}/secrets/${secretId}/rotate`, body, opts);
	}

	deleteSecret(secretId: string): Promise<Record<string, unknown>> {
		return this.internal.request("DELETE", `${PATH_PREFIX}/secrets/${secretId}`);
	}

	listSecretVersions(secretId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/secrets/${secretId}/versions`);
	}
}
