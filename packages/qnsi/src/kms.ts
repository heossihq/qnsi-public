/**
 * QNSP KMS — server-side PQC keys with sign, verify, wrap, and unwrap.
 * Wraps `apps/kms-service` (`/kms/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";
import { QnsiApiError } from "./errors.js";

const PATH_PREFIX = "/proxy/kms/v1";

export interface CreateKeyRequest {
	/** Caller key identifier (1-255 chars). Auto-generated (uuid) if omitted. */
	readonly keyId?: string;
	/** Key type per backend schema. Defaults to "data". */
	readonly keyType?: "root" | "master" | "data" | "byok";
	/** Symmetric/PQC algorithm. Backend default: AES-256-GCM. */
	readonly algorithm?: string;
	/** Optional hint (e.g. "signing"/"encryption"/"kem"); folded into metadata. */
	readonly purpose?: string;
	readonly metadata?: Record<string, unknown>;
}

interface SignResponse {
	readonly signature?: string; // base64 (backend SignDataResponse.signature)
}

interface VerifyResponse {
	readonly valid?: boolean;
}

interface WrapResponse {
	readonly wrappedKey?: string;
	readonly ciphertextB64?: string;
}

interface UnwrapResponse {
	readonly dataKey?: string;
	readonly plaintextB64?: string;
}

export class KmsClient {
	constructor(private readonly internal: Internal) {}

	createKey(req: CreateKeyRequest = {}, opts?: Pick<RequestOptions, "idempotencyKey">) {
		// Wire contract: createKeySchema = { tenantId, keyId(req,1-255),
		// keyType(req: root|master|data|byok), algorithm(default AES-256-GCM),
		// metadata }. tenantId auto-injected. Default keyType "data", generate keyId
		// if absent, fold the SDK "purpose" hint into metadata (not a backend field).
		const metadata = {
			...(req.metadata ?? {}),
			...(req.purpose ? { purpose: req.purpose } : {}),
		};
		const body: Record<string, unknown> = {
			keyId: req.keyId ?? globalThis.crypto.randomUUID(),
			keyType: req.keyType ?? "data",
			metadata,
		};
		if (req.algorithm) body["algorithm"] = req.algorithm;
		return this.internal.request("POST", `${PATH_PREFIX}/keys`, body, opts);
	}

	listKeys(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/keys`, undefined, { query });
	}

	getKey(keyId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/keys/${keyId}`);
	}

	rotateKey(keyId: string, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/keys/${keyId}/rotate`, undefined, opts);
	}

	deleteKey(keyId: string): Promise<Record<string, unknown>> {
		return this.internal.request("DELETE", `${PATH_PREFIX}/keys/${keyId}`);
	}

	async sign(
		keyId: string,
		data: Uint8Array,
		opts?: Pick<RequestOptions, "idempotencyKey">,
	): Promise<Uint8Array> {
		// Wire contract: signDataSchema = { tenantId, data(base64), algorithm? };
		// response SignDataResponse = { keyId, signature(base64), algorithm, provider }.
		const body = { data: encodeB64(data) };
		const resp = await this.internal.request<SignResponse>(
			"POST",
			`${PATH_PREFIX}/keys/${keyId}/sign`,
			body,
			opts,
		);
		if (!resp.signature) {
			throw new QnsiApiError("kms.sign: response missing signature", 200);
		}
		return decodeB64(resp.signature);
	}

	async verify(keyId: string, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
		// Wire contract: verifySignatureSchema = { tenantId, data(base64),
		// signature(base64), algorithm? }; response { keyId, valid, algorithm }.
		const body = { data: encodeB64(data), signature: encodeB64(signature) };
		const resp = await this.internal.request<VerifyResponse>(
			"POST",
			`${PATH_PREFIX}/keys/${keyId}/verify`,
			body,
		);
		return resp.valid === true;
	}

	async wrap(
		keyId: string,
		plaintext: Uint8Array,
		opts?: Pick<RequestOptions, "idempotencyKey">,
	): Promise<Uint8Array> {
		// Wire request contract: wrapKeySchema = { tenantId, dataKey(base64),
		// associatedData? }. tenantId auto-injected; the value to wrap is the dataKey.
		// NOTE: the response field is NOT yet e2e-verified against a wrap-capable key
		// (provable-evidence-mandate) — accept either wrappedKey or ciphertextB64.
		const body = { dataKey: encodeB64(plaintext) };
		const resp = await this.internal.request<WrapResponse>(
			"POST",
			`${PATH_PREFIX}/keys/${keyId}/wrap`,
			body,
			opts,
		);
		const wrapped = resp.wrappedKey ?? resp.ciphertextB64;
		if (!wrapped) {
			throw new QnsiApiError("kms.wrap: response missing wrappedKey/ciphertextB64", 200);
		}
		return decodeB64(wrapped);
	}

	async unwrap(
		keyId: string,
		ciphertext: Uint8Array,
		opts?: Pick<RequestOptions, "idempotencyKey">,
	): Promise<Uint8Array> {
		// Wire request contract: unwrapKeySchema = { tenantId, wrappedKey(base64),
		// associatedData?, providerHint? }. tenantId auto-injected.
		// NOTE: response field NOT yet e2e-verified (provable-evidence-mandate) —
		// accept either dataKey or plaintextB64.
		const body = { wrappedKey: encodeB64(ciphertext) };
		const resp = await this.internal.request<UnwrapResponse>(
			"POST",
			`${PATH_PREFIX}/keys/${keyId}/unwrap`,
			body,
			opts,
		);
		const unwrapped = resp.dataKey ?? resp.plaintextB64;
		if (!unwrapped) {
			throw new QnsiApiError("kms.unwrap: response missing dataKey/plaintextB64", 200);
		}
		return decodeB64(unwrapped);
	}
}

function encodeB64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("base64");
}

function decodeB64(b64: string): Uint8Array {
	return new Uint8Array(Buffer.from(b64, "base64"));
}
