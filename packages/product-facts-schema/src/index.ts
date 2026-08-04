import {
	createHash,
	createPrivateKey,
	createPublicKey,
	type KeyObject,
	sign,
	verify,
} from "node:crypto";

/** Versioned so canonicalization can evolve without silently changing signed bytes. */
export const FACTS_CANONICALIZATION = "json-sorted-keys-no-signature/v1" as const;
export const FACTS_ALGORITHMS = ["ML-DSA-65", "Ed25519"] as const;

export interface FactsSignatureAlgorithm {
	/** Base64 signature over the canonical preimage. */
	signature: string;
	/** SHA-256 hex digest of the signer's DER SPKI public key. */
	publicKeyFingerprint: string;
}

export interface FactsSignature {
	canonicalization: typeof FACTS_CANONICALIZATION;
	signedAt: string;
	/** Public-key location. Consumers must pin the expected value independently. */
	keysUrl: string;
	algorithms: {
		"ML-DSA-65": FactsSignatureAlgorithm;
		Ed25519: FactsSignatureAlgorithm;
	};
}

export interface FactsPublicKeys {
	mldsaPublicKeyPem: string;
	ed25519PublicKeyPem: string;
}

export interface FactsKeyDocument {
	algorithms: {
		"ML-DSA-65": { publicKeyPem: string };
		Ed25519: { publicKeyPem: string };
	};
}

export interface DualSigningPems {
	mldsaPrivateKeyPem: string;
	ed25519PrivateKeyPem: string;
	keysUrl: string;
	signedAt: string;
}

export interface FactsVerificationResult {
	mldsa: boolean;
	ed25519: boolean;
	ok: boolean;
	reason: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Deterministic JSON with recursively sorted object keys and no incidental whitespace. */
export function stableStringify(value: unknown): string {
	if (value === null || typeof value === "string" || typeof value === "boolean") {
		return JSON.stringify(value);
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			throw new TypeError("facts canonicalization requires finite numbers");
		}
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(",")}]`;
	}
	if (!isRecord(value)) {
		throw new TypeError(`facts canonicalization does not support ${typeof value}`);
	}
	const body = Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
		.join(",");
	return `{${body}}`;
}

/** Exact signed text: the top-level document with its `signature` field omitted. */
export function canonicalPreimage(document: object): string {
	const { signature: _signature, ...unsigned } = document as Record<string, unknown>;
	return stableStringify(unsigned);
}

/** Exact signed bytes, provided for Node crypto and independent verifier integrations. */
export function canonicalPreimageBytes(document: object): Buffer {
	return Buffer.from(canonicalPreimage(document), "utf8");
}

export function publicKeyFingerprint(publicKey: KeyObject | string): string {
	const key = typeof publicKey === "string" ? createPublicKey(publicKey) : publicKey;
	const der = key.export({ type: "spki", format: "der" });
	return createHash("sha256").update(der).digest("hex");
}

/** Parse the only public-key fields the protocol trusts; extra product metadata is ignored. */
export function publicKeysFromDocument(document: unknown): FactsPublicKeys {
	if (!isRecord(document) || !isRecord(document["algorithms"])) {
		throw new TypeError("published key algorithms object missing");
	}
	const algorithms = document["algorithms"];
	const mldsa = algorithms["ML-DSA-65"];
	const ed25519 = algorithms["Ed25519"];
	if (!isRecord(mldsa) || !isRecord(ed25519)) {
		throw new TypeError("published dual keys missing");
	}
	if (typeof mldsa["publicKeyPem"] !== "string" || typeof ed25519["publicKeyPem"] !== "string") {
		throw new TypeError("published key PEM missing");
	}
	return {
		mldsaPublicKeyPem: mldsa["publicKeyPem"],
		ed25519PublicKeyPem: ed25519["publicKeyPem"],
	};
}

/** Sign the same canonical bytes with both the PQC and classical algorithms. */
export function signFactsDocument(document: object, options: DualSigningPems): FactsSignature {
	const preimage = canonicalPreimageBytes(document);
	const mldsaKey = createPrivateKey(options.mldsaPrivateKeyPem);
	const ed25519Key = createPrivateKey(options.ed25519PrivateKeyPem);
	return {
		canonicalization: FACTS_CANONICALIZATION,
		signedAt: options.signedAt,
		keysUrl: options.keysUrl,
		algorithms: {
			"ML-DSA-65": {
				signature: sign(null, preimage, mldsaKey).toString("base64"),
				publicKeyFingerprint: publicKeyFingerprint(createPublicKey(mldsaKey)),
			},
			Ed25519: {
				signature: sign(null, preimage, ed25519Key).toString("base64"),
				publicKeyFingerprint: publicKeyFingerprint(createPublicKey(ed25519Key)),
			},
		},
	};
}

function failure(reason: string, mldsa = false, ed25519 = false): FactsVerificationResult {
	return { mldsa, ed25519, ok: false, reason };
}

/**
 * Verify both proofs and their public-key fingerprints. Pass `pinnedKeysUrl` at trust
 * boundaries so a payload cannot redirect verification to attacker-controlled keys.
 */
export function verifyFactsSignature(
	document: object,
	keys: FactsPublicKeys,
	pinnedKeysUrl?: string,
): FactsVerificationResult {
	try {
		const signature = (document as Record<string, unknown>)["signature"];
		if (!isRecord(signature)) return failure("no signature published");
		if (signature["canonicalization"] !== FACTS_CANONICALIZATION) {
			return failure(`unsupported canonicalization: ${String(signature["canonicalization"])}`);
		}
		if (typeof signature["keysUrl"] !== "string") return failure("signature keysUrl missing");
		if (pinnedKeysUrl !== undefined && signature["keysUrl"] !== pinnedKeysUrl) {
			return failure(`keysUrl mismatch: expected ${pinnedKeysUrl}`);
		}
		if (!isRecord(signature["algorithms"])) {
			return failure("signature algorithms object missing");
		}
		const algorithms = signature["algorithms"];
		const mldsa = algorithms["ML-DSA-65"];
		const ed25519 = algorithms["Ed25519"];
		if (!isRecord(mldsa) || !isRecord(ed25519)) {
			return failure("both ML-DSA-65 and Ed25519 are required");
		}
		if (
			typeof mldsa["signature"] !== "string" ||
			typeof ed25519["signature"] !== "string" ||
			typeof mldsa["publicKeyFingerprint"] !== "string" ||
			typeof ed25519["publicKeyFingerprint"] !== "string"
		) {
			return failure("signature bytes or public-key fingerprints missing");
		}
		if (
			publicKeyFingerprint(keys.mldsaPublicKeyPem) !== mldsa["publicKeyFingerprint"] ||
			publicKeyFingerprint(keys.ed25519PublicKeyPem) !== ed25519["publicKeyFingerprint"]
		) {
			return failure("published public-key fingerprint mismatch");
		}
		const preimage = canonicalPreimageBytes(document);
		const mldsaValid = verify(
			null,
			preimage,
			createPublicKey(keys.mldsaPublicKeyPem),
			Buffer.from(mldsa["signature"], "base64"),
		);
		const ed25519Valid = verify(
			null,
			preimage,
			createPublicKey(keys.ed25519PublicKeyPem),
			Buffer.from(ed25519["signature"], "base64"),
		);
		if (!mldsaValid || !ed25519Valid) {
			return failure(
				`dual verification failed (ML-DSA-65=${mldsaValid}, Ed25519=${ed25519Valid})`,
				mldsaValid,
				ed25519Valid,
			);
		}
		return {
			mldsa: true,
			ed25519: true,
			ok: true,
			reason: "both signatures verified against the pinned published keys",
		};
	} catch (error) {
		return failure(`signature verification error: ${(error as Error).message}`);
	}
}
