/**
 * QNSP Vault — PQC-encrypted secret storage with versioning, rotation,
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

	getSecret(secretId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/secrets/${secretId}`);
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
