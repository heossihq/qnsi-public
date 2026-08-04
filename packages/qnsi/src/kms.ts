/**
 * QNSP KMS - server-side PQC keys with sign, verify, wrap, and unwrap.
 * Wraps `apps/kms-service` (`/kms/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";
import { QnsiApiError } from "./errors.js";

const PATH_PREFIX = "/proxy/kms/v1";

/** First-class cryptographic intents - the tenant's crypto policy selects the
 * algorithm; application code states only WHAT the key is for. */
export type KeyCreationIntent = "signing" | "key-encapsulation" | "data-encryption";

export interface CreateKeyRequest {
	/** Caller key identifier (1-255 chars). Auto-generated (uuid) if omitted. */
	readonly keyId?: string;
	/** Key type per backend schema. Defaults to "data". */
	readonly keyType?: "root" | "master" | "data" | "byok";
	/**
	 * PREFERRED: declare intent and let tenant crypto policy select the
	 * algorithm (recorded in metadata.intentResolution). Mutually exclusive
	 * with `algorithm` - the backend rejects requests carrying both.
	 */
	readonly intent?: KeyCreationIntent;
	/** COMPATIBILITY path: explicit algorithm. Backend default: AES-256-GCM. */
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

/** An ML-DSA private key sealed under an HSM RSA-OAEP custody key (HSPK). The caller
 * stores this opaque object and passes it back to `hspkSign`. */
export interface SealedPqcKey {
	readonly scheme: string;
	readonly algorithm: string;
	readonly hsmKeyId: string;
	readonly wrappedCek: string;
	readonly iv: string;
	readonly ciphertext: string;
	readonly authTag: string;
	readonly publicKey: string;
	readonly sealedAt: string;
}

export interface HspkSealRequest {
	/** An active BYOHSM connection the tenant has provisioned. */
	readonly connectionId: string;
	/** keyId of an HSM RSA key with encrypt+decrypt usage (the custody root). */
	readonly keyId: string;
	/** ML-DSA signature algorithm to generate + seal. Default: "ml-dsa-65". */
	readonly algorithm?: "ml-dsa-44" | "ml-dsa-65" | "ml-dsa-87";
	/** RSA-OAEP hash; default "sha256". Use "sha1" only for HSMs that require it. */
	readonly oaepHash?: "sha1" | "sha256";
}

export interface HspkSealResponse {
	readonly algorithm: string;
	/** ML-DSA public key, base64. */
	readonly publicKey: string;
	readonly sealedKey: SealedPqcKey;
	readonly hsmKeyHandle: string;
}

export interface HspkSignRequest {
	readonly connectionId: string;
	/** The same HSM RSA custody key used to seal. */
	readonly keyId: string;
	/** The object returned by `hspkSeal`. */
	readonly sealedKey: SealedPqcKey;
	/** Must match the oaepHash used at seal time. Default: "sha256". */
	readonly oaepHash?: "sha1" | "sha256";
}

export class KmsClient {
	constructor(private readonly internal: Internal) {}

	createKey(req: CreateKeyRequest = {}, opts?: Pick<RequestOptions, "idempotencyKey">) {
		// Wire contract: createKeySchema = { tenantId, keyId(req,1-255),
		// keyType(req: root|master|data|byok), intent? (signing|key-encapsulation|
		// data-encryption - policy resolves the algorithm) XOR algorithm?
		// (compatibility path; backend default AES-256-GCM), metadata }.
		// tenantId auto-injected. Default keyType "data", generate keyId if
		// absent, fold the SDK "purpose" hint into metadata (not a backend field).
		const metadata = {
			...(req.metadata ?? {}),
			...(req.purpose ? { purpose: req.purpose } : {}),
		};
		const body: Record<string, unknown> = {
			keyId: req.keyId ?? globalThis.crypto.randomUUID(),
			keyType: req.keyType ?? "data",
			metadata,
		};
		if (req.intent) body["intent"] = req.intent;
		if (req.algorithm) body["algorithm"] = req.algorithm;
		return this.internal.request("POST", `${PATH_PREFIX}/keys`, body, opts);
	}

	/**
	 * Transform a classical key to the tenant's PQC default - a COMPLETE
	 * cryptographic transformation: the backend generates and self-tests the
	 * new keypair before commit, and returns dual-signed (ML-DSA-65 + Ed25519)
	 * transformation evidence. Already-PQC/symmetric keys are rotated instead
	 * (`upgraded: false`).
	 */
	upgradeKey(keyId: string, reason?: string, opts?: Pick<RequestOptions, "idempotencyKey">) {
		// Wire contract: upgradeKeySchema = { tenantId (uuid, REQUIRED), reason? }.
		// Same lesson as rotateKey below: ALWAYS send an object body so
		// withTenantId has something to inject into - an undefined body with
		// content-type application/json is rejected by Fastify with a 400.
		const body: Record<string, unknown> = {};
		if (reason !== undefined) body["reason"] = reason;
		return this.internal.request("POST", `${PATH_PREFIX}/keys/${keyId}/upgrade`, body, opts);
	}

	listKeys(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/keys`, undefined, { query });
	}

	getKey(keyId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/keys/${keyId}`);
	}

	rotateKey(keyId: string, reason?: string, opts?: Pick<RequestOptions, "idempotencyKey">) {
		// Wire contract: rotateKeySchema = { tenantId (uuid, REQUIRED), reason? }.
		//
		// This passed `undefined` as the body. `withTenantId` only injects into an OBJECT, so
		// nothing was injected, NO body was sent - while the request still carried
		// `content-type: application/json`. Fastify rejects that outright:
		//
		//     400  "Body cannot be empty when content-type is set to 'application/json'"
		//
		// kms.rotateKey had therefore NEVER rotated a key. Proven against production
		// 2026-07-14 with the published SDK: 0 passed, 6 failed, every one a 400.
		//
		// An empty object gives withTenantId something to inject the activated tenant into.
		const body: Record<string, unknown> = {};
		if (reason !== undefined) body["reason"] = reason;
		return this.internal.request("POST", `${PATH_PREFIX}/keys/${keyId}/rotate`, body, opts);
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
		// (provable-evidence-mandate) - accept either wrappedKey or ciphertextB64.
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
		// NOTE: response field NOT yet e2e-verified (provable-evidence-mandate) -
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

	/**
	 * HSM-Sealed Post-Quantum Keys (HSPK): generate an ML-DSA-44/65/87 keypair and seal
	 * its private key under a non-extractable HSM RSA-OAEP custody key. The HSM protects
	 * custody at rest; QNSI performs ML-DSA outside the module. Stateless:
	 * store the returned `sealedKey` and pass it to `hspkSign`. Requires a customer-
	 * provisioned BYOHSM connection with an RSA encrypt/decrypt key.
	 *
	 * Wire contract: sealPqcSchema = { tenantId, connectionId, keyId, algorithm?,
	 * oaepHash? }; response { algorithm, publicKey, sealedKey, hsmKeyHandle }.
	 */
	hspkSeal(
		req: HspkSealRequest,
		opts?: Pick<RequestOptions, "idempotencyKey">,
	): Promise<HspkSealResponse> {
		const body: Record<string, unknown> = { connectionId: req.connectionId, keyId: req.keyId };
		if (req.algorithm) body["algorithm"] = req.algorithm;
		if (req.oaepHash) body["oaepHash"] = req.oaepHash;
		return this.internal.request("POST", `${PATH_PREFIX}/byohsm/pqc/seal`, body, opts);
	}

	/**
	 * HSPK: unseal a previously sealed ML-DSA private key via the HSM (which RSA-OAEP-
	 * unwraps the content key) and sign `data` in QNSI software. The private key exists in plaintext
	 * only transiently in memory during the signature.
	 *
	 * Wire contract: signPqcSchema = { tenantId, connectionId, keyId, sealedKey,
	 * data(base64), oaepHash? }; response { algorithm, signature(base64) }.
	 */
	async hspkSign(
		req: HspkSignRequest,
		data: Uint8Array,
		opts?: Pick<RequestOptions, "idempotencyKey">,
	): Promise<Uint8Array> {
		const body: Record<string, unknown> = {
			connectionId: req.connectionId,
			keyId: req.keyId,
			sealedKey: req.sealedKey,
			data: encodeB64(data),
		};
		if (req.oaepHash) body["oaepHash"] = req.oaepHash;
		const resp = await this.internal.request<SignResponse>(
			"POST",
			`${PATH_PREFIX}/byohsm/pqc/sign`,
			body,
			opts,
		);
		if (!resp.signature) {
			throw new QnsiApiError("kms.hspkSign: response missing signature", 200);
		}
		return decodeB64(resp.signature);
	}
}

function encodeB64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("base64");
}

function decodeB64(b64: string): Uint8Array {
	return new Uint8Array(Buffer.from(b64, "base64"));
}
