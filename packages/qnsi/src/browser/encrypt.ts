/**
 * Client-side encryption (CSE) helpers for browser PQC operations.
 *
 * Provides encrypt-before-upload and decrypt-after-download using:
 * - ML-KEM (FIPS 203) for key encapsulation → derives AES-256-GCM key
 * - AES-256-GCM via WebCrypto API for bulk data encryption (hardware-accelerated)
 *
 * No node: imports. Works in browsers, Deno, Bun, and Node.js 20+.
 *
 * @module
 */

import type { PqcAlgorithm } from "./pqc-types.js";
import { getActiveProvider } from "./provider-setup.js";

/** KEM algorithms supported for CSE operations. */
const KEM_ALGORITHMS = new Set<string>(["kyber-512", "kyber-768", "kyber-1024"]);

/** AES-256-GCM IV size in bytes. */
const AES_GCM_IV_BYTES = 12;

/** AES-256-GCM key size in bytes. */
const AES_GCM_KEY_BYTES = 32;

/** AES-256-GCM tag size in bits. */
const AES_GCM_TAG_BITS = 128;

/**
 * CSE envelope: contains everything needed to decrypt the data.
 * The recipient needs their private key + this envelope to recover plaintext.
 */
export interface CseEnvelope {
	/** PQC algorithm used for key encapsulation. */
	readonly algorithm: PqcAlgorithm;
	/** KEM ciphertext (encapsulated shared secret). */
	readonly kemCiphertext: Uint8Array;
	/** AES-256-GCM initialization vector. */
	readonly iv: Uint8Array;
	/** AES-256-GCM encrypted data (includes authentication tag). */
	readonly ciphertext: Uint8Array;
}

/**
 * Encrypt data using PQC key encapsulation + AES-256-GCM.
 *
 * Flow:
 * 1. ML-KEM encapsulate with recipient's public key → shared secret + KEM ciphertext
 * 2. Derive AES-256-GCM key from shared secret (first 32 bytes)
 * 3. Generate random IV
 * 4. AES-256-GCM encrypt the plaintext
 * 5. Return CSE envelope (KEM ciphertext + IV + AES ciphertext)
 *
 * @param plaintext - Data to encrypt
 * @param publicKey - Recipient's PQC public key (from ML-KEM keygen)
 * @param algorithm - KEM algorithm to use (kyber-512, kyber-768, kyber-1024)
 * @returns CSE envelope containing all data needed for decryption
 */
export async function encryptBeforeUpload(
	plaintext: Uint8Array,
	publicKey: Uint8Array,
	algorithm: PqcAlgorithm,
): Promise<CseEnvelope> {
	if (!KEM_ALGORITHMS.has(algorithm)) {
		throw new Error(
			`Algorithm '${algorithm}' is not a supported KEM algorithm for CSE. ` +
				`Supported: ${[...KEM_ALGORITHMS].join(", ")}`,
		);
	}

	if (plaintext.length === 0) {
		throw new Error("Plaintext must not be empty");
	}

	if (publicKey.length === 0) {
		throw new Error("Public key must not be empty");
	}

	const provider = getActiveProvider();

	// Step 1: KEM encapsulate → shared secret + ciphertext
	const { ciphertext: kemCiphertext, sharedSecret } = await provider.encapsulate({
		algorithm,
		publicKey,
	});

	// Step 2: Derive AES-256-GCM key from shared secret
	const aesKeyBytes = new Uint8Array(
		sharedSecret.buffer.slice(sharedSecret.byteOffset, sharedSecret.byteOffset + AES_GCM_KEY_BYTES),
	) as Uint8Array<ArrayBuffer>;
	const aesKey = await crypto.subtle.importKey("raw", aesKeyBytes, { name: "AES-GCM" }, false, [
		"encrypt",
	]);

	// Step 3: Generate random IV
	const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));

	// Step 4: AES-256-GCM encrypt
	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv, tagLength: AES_GCM_TAG_BITS },
		aesKey,
		new Uint8Array(plaintext) as Uint8Array<ArrayBuffer>,
	);

	return {
		algorithm,
		kemCiphertext: new Uint8Array(kemCiphertext),
		iv: new Uint8Array(iv),
		ciphertext: new Uint8Array(encrypted),
	};
}

/**
 * Decrypt a CSE envelope using PQC key decapsulation + AES-256-GCM.
 *
 * Flow:
 * 1. ML-KEM decapsulate with recipient's private key → shared secret
 * 2. Derive AES-256-GCM key from shared secret (first 32 bytes)
 * 3. AES-256-GCM decrypt using IV from envelope
 * 4. Return plaintext
 *
 * @param envelope - CSE envelope from encryptBeforeUpload()
 * @param privateKey - Recipient's PQC private key (from ML-KEM keygen)
 * @returns Decrypted plaintext
 */
export async function decryptAfterDownload(
	envelope: CseEnvelope,
	privateKey: Uint8Array,
): Promise<Uint8Array> {
	if (!KEM_ALGORITHMS.has(envelope.algorithm)) {
		throw new Error(
			`Algorithm '${envelope.algorithm}' is not a supported KEM algorithm for CSE. ` +
				`Supported: ${[...KEM_ALGORITHMS].join(", ")}`,
		);
	}

	if (privateKey.length === 0) {
		throw new Error("Private key must not be empty");
	}

	const provider = getActiveProvider();

	// Step 1: KEM decapsulate → shared secret
	const sharedSecret = await provider.decapsulate({
		algorithm: envelope.algorithm,
		ciphertext: envelope.kemCiphertext,
		privateKey,
	});

	// Step 2: Derive AES-256-GCM key from shared secret
	const aesKeyBytes = new Uint8Array(
		sharedSecret.buffer.slice(sharedSecret.byteOffset, sharedSecret.byteOffset + AES_GCM_KEY_BYTES),
	) as Uint8Array<ArrayBuffer>;
	const aesKey = await crypto.subtle.importKey("raw", aesKeyBytes, { name: "AES-GCM" }, false, [
		"decrypt",
	]);

	// Step 3: AES-256-GCM decrypt
	const ciphertextBuf = new Uint8Array(envelope.ciphertext) as Uint8Array<ArrayBuffer>;
	const ivBuf = new Uint8Array(envelope.iv) as Uint8Array<ArrayBuffer>;
	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: ivBuf, tagLength: AES_GCM_TAG_BITS },
		aesKey,
		ciphertextBuf,
	);

	return new Uint8Array(decrypted);
}

/**
 * Serialize a CSE envelope to a single Uint8Array for storage/transmission.
 *
 * Format: [algorithmLen(2)] [algorithm] [kemCtLen(4)] [kemCt] [ivLen(1)] [iv] [ciphertext]
 * All lengths are big-endian unsigned integers.
 */
export function serializeCseEnvelope(envelope: CseEnvelope): Uint8Array {
	const algorithmBytes = new TextEncoder().encode(envelope.algorithm);
	const totalLen =
		2 +
		algorithmBytes.length +
		4 +
		envelope.kemCiphertext.length +
		1 +
		envelope.iv.length +
		envelope.ciphertext.length;

	const result = new Uint8Array(totalLen);
	const view = new DataView(result.buffer);
	let offset = 0;

	// Algorithm name length (2 bytes) + algorithm name
	view.setUint16(offset, algorithmBytes.length);
	offset += 2;
	result.set(algorithmBytes, offset);
	offset += algorithmBytes.length;

	// KEM ciphertext length (4 bytes) + KEM ciphertext
	view.setUint32(offset, envelope.kemCiphertext.length);
	offset += 4;
	result.set(envelope.kemCiphertext, offset);
	offset += envelope.kemCiphertext.length;

	// IV length (1 byte) + IV
	result[offset] = envelope.iv.length;
	offset += 1;
	result.set(envelope.iv, offset);
	offset += envelope.iv.length;

	// Remaining bytes = AES ciphertext
	result.set(envelope.ciphertext, offset);

	return result;
}

/**
 * Deserialize a CSE envelope from a Uint8Array.
 */
export function deserializeCseEnvelope(data: Uint8Array): CseEnvelope {
	if (data.length < 9) {
		throw new Error("Invalid CSE envelope: too short");
	}

	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	let offset = 0;

	// Algorithm name
	const algorithmLen = view.getUint16(offset);
	offset += 2;
	if (offset + algorithmLen > data.length) {
		throw new Error("Invalid CSE envelope: algorithm length exceeds data");
	}
	const algorithm = new TextDecoder().decode(
		data.slice(offset, offset + algorithmLen),
	) as PqcAlgorithm;
	offset += algorithmLen;

	// KEM ciphertext
	if (offset + 4 > data.length) {
		throw new Error("Invalid CSE envelope: missing KEM ciphertext length");
	}
	const kemCtLen = view.getUint32(offset);
	offset += 4;
	if (offset + kemCtLen > data.length) {
		throw new Error("Invalid CSE envelope: KEM ciphertext length exceeds data");
	}
	const kemCiphertext = data.slice(offset, offset + kemCtLen);
	offset += kemCtLen;

	// IV
	if (offset + 1 > data.length) {
		throw new Error("Invalid CSE envelope: missing IV length");
	}
	const ivLen = data[offset] ?? 0;
	offset += 1;
	if (offset + ivLen > data.length) {
		throw new Error("Invalid CSE envelope: IV length exceeds data");
	}
	const iv = data.slice(offset, offset + ivLen);
	offset += ivLen;

	// AES ciphertext (remaining bytes)
	const ciphertext = data.slice(offset);
	if (ciphertext.length === 0) {
		throw new Error("Invalid CSE envelope: empty ciphertext");
	}

	return { algorithm, kemCiphertext, iv, ciphertext };
}
