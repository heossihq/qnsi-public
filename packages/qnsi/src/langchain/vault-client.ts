/**
 * Minimal QNSP Vault client - `@heossihq/qnsi/langchain` subpath.
 *
 * Faithful inline of the `getSecret` / `createSecret` / `rotateSecret` slice of
 * the former `@heossihq/qnsi-vault-sdk` `VaultClient` (2026-05-16
 * consolidation): Bearer auth, `x-qnsp-tenant-id` header, 429 retry with
 * exponential backoff + `Retry-After`, per-request timeout, `Vault API
 * error: <status> <statusText>` on failure. Endpoints and request/response
 * shapes are byte-for-byte preserved. Activation is owned by `QnsiToolkit`
 * (single `langchain-qnsp` handshake); the resolved tenant id is injected via
 * {@link VaultClient.setTenantId} - so this subpath has no `@heossihq/qnsi-*`
 * workspace dependency (same pattern as `../_activation`).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUUID(value: string, field: string): void {
	if (!UUID_RE.test(value)) {
		throw new Error(`QNSP Vault: ${field} must be a valid UUID, received "${value}"`);
	}
}

export interface VaultClientConfig {
	readonly baseUrl?: string;
	readonly apiKey: string;
	readonly timeoutMs?: number;
	readonly maxRetries?: number;
	readonly retryDelayMs?: number;
}

export interface RotationPolicy {
	/** When false the secret is never auto-rotated (static / not opted in). */
	readonly enabled: boolean;
	readonly intervalSeconds: number;
	readonly expiresAt: number | null;
}

export interface RotationPolicyInput {
	readonly enabled?: boolean;
	readonly intervalSeconds?: number;
	readonly expiresAt?: number;
}

export interface SecretEnvelope {
	readonly encrypted: string;
	readonly algorithm: string;
	readonly keyId?: string;
}

export interface VaultSecretPqcMetadata {
	readonly provider: string;
	readonly algorithm: string;
	readonly algorithmNist?: string;
	readonly keyId: string;
}

export interface Secret {
	readonly id: string;
	readonly name: string;
	readonly tenantId: string;
	readonly version: number;
	readonly metadata: Record<string, unknown>;
	readonly rotationPolicy: RotationPolicy;
	readonly checksum: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly versionCreatedAt: string;
	readonly envelope: SecretEnvelope;
	readonly pqc?: VaultSecretPqcMetadata;
}

export interface CreateSecretRequest {
	readonly tenantId?: string;
	readonly name: string;
	readonly payload: string; // Base64-encoded payload
	readonly metadata?: Record<string, unknown>;
	readonly rotationPolicy?: RotationPolicyInput;
}

export interface RotateSecretRequest {
	readonly tenantId: string;
	readonly newPayload?: string; // Base64-encoded payload
	readonly metadata?: Record<string, unknown>;
	readonly rotationPolicy?: RotationPolicyInput;
}

const DEFAULT_BASE_URL = "https://api.qnsi.heossi.com";

interface RequestOptions {
	readonly body?: unknown;
	readonly headers?: Record<string, string>;
}

export class VaultClient {
	readonly #baseUrl: string;
	readonly #apiKey: string;
	readonly #timeoutMs: number;
	readonly #maxRetries: number;
	readonly #retryDelayMs: number;
	#tenantId: string | null = null;

	constructor(config: VaultClientConfig) {
		if (!config.apiKey || config.apiKey.trim().length === 0) {
			throw new Error(
				"QNSP Vault: apiKey is required. Get a free key at https://cloud.qnsi.heossi.com/auth",
			);
		}
		this.#baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
		this.#apiKey = config.apiKey;
		this.#timeoutMs = config.timeoutMs ?? 15_000;
		this.#maxRetries = config.maxRetries ?? 3;
		this.#retryDelayMs = config.retryDelayMs ?? 1_000;
	}

	/** Inject the activation-resolved tenant id (sent as `x-qnsp-tenant-id`). */
	setTenantId(tenantId: string): void {
		this.#tenantId = tenantId;
	}

	async #request<T>(
		method: string,
		path: string,
		options: RequestOptions | undefined,
		attempt = 0,
	): Promise<T> {
		const url = `${this.#baseUrl}${path}`;
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...options?.headers,
			Authorization: `Bearer ${this.#apiKey}`,
		};
		if (this.#tenantId) {
			headers["x-qnsp-tenant-id"] = this.#tenantId;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.#timeoutMs);
		try {
			const init: RequestInit = { method, headers, signal: controller.signal };
			if (options?.body !== undefined) {
				init.body = JSON.stringify(options.body);
			}
			const response = await fetch(url, init);
			clearTimeout(timeoutId);

			if (response.status === 429) {
				if (attempt < this.#maxRetries) {
					const retryAfterHeader = response.headers.get("Retry-After");
					let delayMs = this.#retryDelayMs;
					if (retryAfterHeader) {
						const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
						if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
							delayMs = retryAfterSeconds * 1_000;
						}
					} else {
						delayMs = Math.min(2 ** attempt * this.#retryDelayMs, 30_000);
					}
					await new Promise((resolve) => setTimeout(resolve, delayMs));
					return this.#request<T>(method, path, options, attempt + 1);
				}
				throw new Error(`Vault API error: Rate limit exceeded after ${this.#maxRetries} retries`);
			}

			if (!response.ok) {
				throw new Error(`Vault API error: ${response.status} ${response.statusText}`);
			}
			if (response.status === 204) {
				return undefined as T;
			}
			return (await response.json()) as T;
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof Error && error.name === "AbortError") {
				throw new Error(`Request timeout after ${this.#timeoutMs}ms`);
			}
			throw error;
		}
	}

	/** Create a new secret. Payload must be base64-encoded. */
	async createSecret(request: CreateSecretRequest): Promise<Secret> {
		if (request.tenantId !== undefined) {
			validateUUID(request.tenantId, "tenantId");
		}
		const effectiveTenantId = request.tenantId ?? this.#tenantId;
		if (!effectiveTenantId) {
			throw new Error("QNSP Vault: tenantId could not be resolved. Ensure your API key is valid.");
		}
		return this.#request<Secret>("POST", "/vault/v1/secrets", {
			body: {
				tenantId: effectiveTenantId,
				name: request.name,
				payload: request.payload,
				...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
				...(request.rotationPolicy !== undefined ? { rotationPolicy: request.rotationPolicy } : {}),
			},
		});
	}

	/** Get the latest version of a secret. */
	async getSecret(id: string): Promise<Secret> {
		validateUUID(id, "id");
		return this.#request<Secret>("GET", `/vault/v1/secrets/${id}`, undefined);
	}

	/** Rotate a secret to create a new version. */
	async rotateSecret(id: string, request: RotateSecretRequest): Promise<Secret> {
		validateUUID(id, "id");
		validateUUID(request.tenantId, "tenantId");
		return this.#request<Secret>("POST", `/vault/v1/secrets/${id}/rotate`, {
			body: {
				tenantId: request.tenantId,
				...(request.newPayload !== undefined ? { newPayload: request.newPayload } : {}),
				...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
				...(request.rotationPolicy !== undefined ? { rotationPolicy: request.rotationPolicy } : {}),
			},
		});
	}
}
