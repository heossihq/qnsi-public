/**
 * @heossi/qnsi-browser test suite.
 *
 * Tests the full browser-sdk API: provider initialization, CSE encrypt/decrypt,
 * digital signatures, serialization, runtime detection, and error handling.
 *
 * Runs in Node.js (vitest) — the noble provider works identically in Node.js and browsers.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// Replace SDK activation with a vi.fn double to avoid real HTTP in tests.
// provider-setup.ts imports the folded-in copy at ../_activation/index.js.
vi.mock("../_activation/index.js", () => ({
	activateSdk: vi.fn().mockResolvedValue({
		activated: true,
		tenantId: "00000000-0000-0000-0000-000000000000",
		tier: "free",
		limits: {
			storageGB: 5,
			apiCalls: 10_000,
			enclavesEnabled: false,
			aiTrainingEnabled: false,
			aiInferenceEnabled: false,
			sseEnabled: false,
			vaultEnabled: false,
		},
		activationToken: "test-activation-token",
		expiresInSeconds: 3600,
		activatedAt: new Date().toISOString(),
	}),
}));

import {
	decryptAfterDownload,
	deserializeCseEnvelope,
	detectRuntime,
	encryptBeforeUpload,
	generateEncryptionKeyPair,
	generateSigningKeyPair,
	getActiveProvider,
	getSupportedAlgorithms,
	initializePqcProvider,
	isProviderInitialized,
	NOBLE_SUPPORTED_ALGORITHMS,
	resetProvider,
	serializeCseEnvelope,
	signData,
	verifySignature,
} from "./index.js";

import type { PqcAlgorithm } from "./pqc-types.js";

describe("@heossi/qnsi-browser", () => {
	afterEach(() => {
		resetProvider();
	});

	describe("runtime detection", () => {
		it("detects Node.js runtime", () => {
			const runtime = detectRuntime();
			expect(runtime).toBe("node");
		});
	});

	describe("provider initialization", () => {
		it("initializes provider successfully", async () => {
			expect(isProviderInitialized()).toBe(false);
			const provider = await initializePqcProvider({ apiKey: "test-key" });
			expect(provider).toBeDefined();
			expect(provider.name).toBeDefined();
			expect(isProviderInitialized()).toBe(true);
		});

		it("returns same provider on repeated calls", async () => {
			const provider1 = await initializePqcProvider({ apiKey: "test-key" });
			const provider2 = await initializePqcProvider({ apiKey: "test-key" });
			expect(provider1).toBe(provider2);
		});

		it("getActiveProvider returns initialized provider", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			const provider = getActiveProvider();
			expect(provider).toBeDefined();
			expect(provider.name).toBeDefined();
		});

		it("getActiveProvider throws before initialization", () => {
			expect(() => getActiveProvider()).toThrow(/not initialized/);
		});

		it("resetProvider clears state", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			expect(isProviderInitialized()).toBe(true);
			resetProvider();
			expect(isProviderInitialized()).toBe(false);
			expect(() => getActiveProvider()).toThrow(/not initialized/);
		});

		it("initializes with specific algorithm subset", async () => {
			const provider = await initializePqcProvider({
				apiKey: "test-key",
				algorithms: ["kyber-768"],
			});
			expect(provider).toBeDefined();
		});
	});

	describe("supported algorithms", () => {
		it("returns 18 FIPS algorithms", () => {
			const algorithms = getSupportedAlgorithms();
			expect(algorithms).toHaveLength(18);
			expect(algorithms).toEqual(NOBLE_SUPPORTED_ALGORITHMS);
		});

		it("includes all ML-KEM variants", () => {
			const algorithms = getSupportedAlgorithms();
			expect(algorithms).toContain("kyber-512");
			expect(algorithms).toContain("kyber-768");
			expect(algorithms).toContain("kyber-1024");
		});

		it("includes all ML-DSA variants", () => {
			const algorithms = getSupportedAlgorithms();
			expect(algorithms).toContain("dilithium-2");
			expect(algorithms).toContain("dilithium-3");
			expect(algorithms).toContain("dilithium-5");
		});
	});

	describe("key pair generation", () => {
		it("generates ML-KEM encryption key pair", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			const keyPair = await generateEncryptionKeyPair("kyber-768");
			expect(keyPair.algorithm).toBe("kyber-768");
			expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
			expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
			expect(keyPair.publicKey.length).toBeGreaterThan(0);
			expect(keyPair.privateKey.length).toBeGreaterThan(0);
		});

		it("generates ML-DSA signing key pair", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			const keyPair = await generateSigningKeyPair("dilithium-3");
			expect(keyPair.algorithm).toBe("dilithium-3");
			expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
			expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
			expect(keyPair.publicKey.length).toBeGreaterThan(0);
			expect(keyPair.privateKey.length).toBeGreaterThan(0);
		});

		it("rejects non-KEM algorithm for encryption key pair", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			await expect(generateEncryptionKeyPair("dilithium-2" as PqcAlgorithm)).rejects.toThrow(
				/not a supported KEM algorithm/,
			);
		});

		it("rejects non-signature algorithm for signing key pair", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			await expect(generateSigningKeyPair("kyber-512" as PqcAlgorithm)).rejects.toThrow(
				/not a supported signature algorithm/,
			);
		});
	});

	describe("CSE encrypt/decrypt round-trip", () => {
		const kemAlgorithms: PqcAlgorithm[] = ["kyber-512", "kyber-768", "kyber-1024"];

		for (const algorithm of kemAlgorithms) {
			it(`${algorithm}: encrypt → decrypt recovers plaintext`, async () => {
				await initializePqcProvider({ apiKey: "test-key" });
				const keyPair = await generateEncryptionKeyPair(algorithm);

				const plaintext = new TextEncoder().encode("QNSP browser-side PQC encryption test");

				const envelope = await encryptBeforeUpload(plaintext, keyPair.publicKey, algorithm);
				expect(envelope.algorithm).toBe(algorithm);
				expect(envelope.kemCiphertext).toBeInstanceOf(Uint8Array);
				expect(envelope.kemCiphertext.length).toBeGreaterThan(0);
				expect(envelope.iv).toBeInstanceOf(Uint8Array);
				expect(envelope.iv.length).toBe(12); // AES-GCM IV = 12 bytes
				expect(envelope.ciphertext).toBeInstanceOf(Uint8Array);
				expect(envelope.ciphertext.length).toBeGreaterThan(0);

				const decrypted = await decryptAfterDownload(envelope, keyPair.privateKey);
				expect(Array.from(decrypted)).toStrictEqual(Array.from(plaintext));
			});
		}

		it("encrypts large data (1 MB)", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			const keyPair = await generateEncryptionKeyPair("kyber-768");

			const plaintext = new Uint8Array(1024 * 1024);
			// crypto.getRandomValues has a 65536-byte limit per call
			for (let offset = 0; offset < plaintext.length; offset += 65536) {
				const chunk = plaintext.subarray(offset, offset + 65536);
				crypto.getRandomValues(chunk);
			}

			const envelope = await encryptBeforeUpload(plaintext, keyPair.publicKey, "kyber-768");
			const decrypted = await decryptAfterDownload(envelope, keyPair.privateKey);
			expect(Array.from(decrypted)).toStrictEqual(Array.from(plaintext));
		}, 30_000);

		it("different encryptions produce different ciphertexts", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			const keyPair = await generateEncryptionKeyPair("kyber-768");
			const plaintext = new TextEncoder().encode("same data");

			const envelope1 = await encryptBeforeUpload(plaintext, keyPair.publicKey, "kyber-768");
			const envelope2 = await encryptBeforeUpload(plaintext, keyPair.publicKey, "kyber-768");

			// IVs must differ (random)
			expect(Array.from(envelope1.iv)).not.toStrictEqual(Array.from(envelope2.iv));
			// KEM ciphertexts must differ (random encapsulation)
			expect(Array.from(envelope1.kemCiphertext)).not.toStrictEqual(
				Array.from(envelope2.kemCiphertext),
			);
		});

		it("decryption with wrong key fails", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			const keyPair1 = await generateEncryptionKeyPair("kyber-768");
			const keyPair2 = await generateEncryptionKeyPair("kyber-768");

			const plaintext = new TextEncoder().encode("secret data");
			const envelope = await encryptBeforeUpload(plaintext, keyPair1.publicKey, "kyber-768");

			// Decrypting with a different private key should fail
			// (AES-GCM authentication will reject the wrong key)
			await expect(decryptAfterDownload(envelope, keyPair2.privateKey)).rejects.toThrow();
		});
	});

	describe("CSE error handling", () => {
		it("rejects non-KEM algorithm", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			await expect(
				encryptBeforeUpload(
					new Uint8Array([1]),
					new Uint8Array([1]),
					"dilithium-2" as PqcAlgorithm,
				),
			).rejects.toThrow(/not a supported KEM algorithm/);
		});

		it("rejects empty plaintext", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			await expect(
				encryptBeforeUpload(new Uint8Array(0), new Uint8Array([1]), "kyber-768"),
			).rejects.toThrow(/must not be empty/);
		});

		it("rejects empty public key", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			await expect(
				encryptBeforeUpload(new Uint8Array([1]), new Uint8Array(0), "kyber-768"),
			).rejects.toThrow(/must not be empty/);
		});

		it("rejects empty private key for decryption", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			const keyPair = await generateEncryptionKeyPair("kyber-768");
			const plaintext = new TextEncoder().encode("test");
			const envelope = await encryptBeforeUpload(plaintext, keyPair.publicKey, "kyber-768");

			await expect(decryptAfterDownload(envelope, new Uint8Array(0))).rejects.toThrow(
				/must not be empty/,
			);
		});
	});

	describe("digital signatures", () => {
		it("ML-DSA sign → verify round-trip", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			const keyPair = await generateSigningKeyPair("dilithium-3");
			const data = new TextEncoder().encode("QNSP document integrity verification");

			const envelope = await signData(data, keyPair.privateKey, "dilithium-3");
			expect(envelope.algorithm).toBe("dilithium-3");
			expect(envelope.signature).toBeInstanceOf(Uint8Array);
			expect(envelope.signature.length).toBeGreaterThan(0);
			expect(Array.from(envelope.data)).toStrictEqual(Array.from(data));

			const valid = await verifySignature(
				data,
				envelope.signature,
				keyPair.publicKey,
				"dilithium-3",
			);
			expect(valid).toBe(true);
		});

		it("verify rejects tampered data", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			const keyPair = await generateSigningKeyPair("dilithium-2");
			const data = new TextEncoder().encode("original data");

			const envelope = await signData(data, keyPair.privateKey, "dilithium-2");

			const tampered = new TextEncoder().encode("tampered data");
			const valid = await verifySignature(
				tampered,
				envelope.signature,
				keyPair.publicKey,
				"dilithium-2",
			);
			expect(valid).toBe(false);
		});

		it("verify rejects wrong public key", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			const keyPair1 = await generateSigningKeyPair("dilithium-5");
			const keyPair2 = await generateSigningKeyPair("dilithium-5");
			const data = new TextEncoder().encode("signed by key 1");

			const envelope = await signData(data, keyPair1.privateKey, "dilithium-5");

			const valid = await verifySignature(
				data,
				envelope.signature,
				keyPair2.publicKey,
				"dilithium-5",
			);
			expect(valid).toBe(false);
		});

		it("SLH-DSA sign → verify round-trip", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			const keyPair = await generateSigningKeyPair("sphincs-sha2-128f-simple");
			const data = new TextEncoder().encode("hash-based signature test");

			const envelope = await signData(data, keyPair.privateKey, "sphincs-sha2-128f-simple");
			expect(envelope.algorithm).toBe("sphincs-sha2-128f-simple");

			const valid = await verifySignature(
				data,
				envelope.signature,
				keyPair.publicKey,
				"sphincs-sha2-128f-simple",
			);
			expect(valid).toBe(true);
		}, 30_000); // SLH-DSA can be slow in pure JS
	});

	describe("signature error handling", () => {
		it("rejects non-signature algorithm for signData", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			await expect(
				signData(new Uint8Array([1]), new Uint8Array([1]), "kyber-768" as PqcAlgorithm),
			).rejects.toThrow(/not a supported signature algorithm/);
		});

		it("rejects empty data for signData", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			await expect(signData(new Uint8Array(0), new Uint8Array([1]), "dilithium-2")).rejects.toThrow(
				/must not be empty/,
			);
		});

		it("rejects empty private key for signData", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			await expect(signData(new Uint8Array([1]), new Uint8Array(0), "dilithium-2")).rejects.toThrow(
				/must not be empty/,
			);
		});

		it("rejects empty data for verifySignature", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			await expect(
				verifySignature(new Uint8Array(0), new Uint8Array([1]), new Uint8Array([1]), "dilithium-2"),
			).rejects.toThrow(/must not be empty/);
		});

		it("rejects empty signature for verifySignature", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			await expect(
				verifySignature(new Uint8Array([1]), new Uint8Array(0), new Uint8Array([1]), "dilithium-2"),
			).rejects.toThrow(/must not be empty/);
		});

		it("rejects empty public key for verifySignature", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			await expect(
				verifySignature(new Uint8Array([1]), new Uint8Array([1]), new Uint8Array(0), "dilithium-2"),
			).rejects.toThrow(/must not be empty/);
		});
	});

	describe("CSE envelope serialization", () => {
		it("serialize → deserialize round-trip", async () => {
			await initializePqcProvider({ apiKey: "test-key" });
			const keyPair = await generateEncryptionKeyPair("kyber-768");
			const plaintext = new TextEncoder().encode("serialization test");

			const envelope = await encryptBeforeUpload(plaintext, keyPair.publicKey, "kyber-768");
			const serialized = serializeCseEnvelope(envelope);
			expect(serialized).toBeInstanceOf(Uint8Array);
			expect(serialized.length).toBeGreaterThan(0);

			const deserialized = deserializeCseEnvelope(serialized);
			expect(deserialized.algorithm).toBe(envelope.algorithm);
			expect(Array.from(deserialized.kemCiphertext)).toStrictEqual(
				Array.from(envelope.kemCiphertext),
			);
			expect(Array.from(deserialized.iv)).toStrictEqual(Array.from(envelope.iv));
			expect(Array.from(deserialized.ciphertext)).toStrictEqual(Array.from(envelope.ciphertext));

			// Verify the deserialized envelope can still decrypt
			const decrypted = await decryptAfterDownload(deserialized, keyPair.privateKey);
			expect(Array.from(decrypted)).toStrictEqual(Array.from(plaintext));
		});

		it("rejects truncated data", () => {
			expect(() => deserializeCseEnvelope(new Uint8Array(5))).toThrow(/too short/);
		});

		it("rejects corrupted algorithm length", () => {
			const data = new Uint8Array(20);
			const view = new DataView(data.buffer);
			// Set algorithm length to exceed data size
			view.setUint16(0, 1000);
			expect(() => deserializeCseEnvelope(data)).toThrow(/exceeds data/);
		});

		it("rejects envelope with empty ciphertext", () => {
			// Construct a minimal valid-looking envelope that has zero ciphertext bytes
			const algorithm = new TextEncoder().encode("kyber-768");
			const kemCt = new Uint8Array(32);
			const iv = new Uint8Array(12);
			// Total: 2 + 9 + 4 + 32 + 1 + 12 + 0 = 60 bytes (no ciphertext)
			const totalLen = 2 + algorithm.length + 4 + kemCt.length + 1 + iv.length;
			const data = new Uint8Array(totalLen);
			const view = new DataView(data.buffer);
			let offset = 0;

			view.setUint16(offset, algorithm.length);
			offset += 2;
			data.set(algorithm, offset);
			offset += algorithm.length;

			view.setUint32(offset, kemCt.length);
			offset += 4;
			data.set(kemCt, offset);
			offset += kemCt.length;

			data[offset] = iv.length;
			offset += 1;
			data.set(iv, offset);

			expect(() => deserializeCseEnvelope(data)).toThrow(/empty ciphertext/);
		});
	});

	describe("end-to-end: encrypt + sign workflow", () => {
		it("encrypts data and signs the envelope", async () => {
			await initializePqcProvider({ apiKey: "test-key" });

			// Generate keys
			const encKeyPair = await generateEncryptionKeyPair("kyber-768");
			const sigKeyPair = await generateSigningKeyPair("dilithium-3");

			// Encrypt
			const plaintext = new TextEncoder().encode("classified document content");
			const envelope = await encryptBeforeUpload(plaintext, encKeyPair.publicKey, "kyber-768");

			// Sign the serialized envelope
			const serialized = serializeCseEnvelope(envelope);
			const signed = await signData(serialized, sigKeyPair.privateKey, "dilithium-3");

			// Verify signature
			const sigValid = await verifySignature(
				serialized,
				signed.signature,
				sigKeyPair.publicKey,
				"dilithium-3",
			);
			expect(sigValid).toBe(true);

			// Decrypt
			const deserialized = deserializeCseEnvelope(serialized);
			const decrypted = await decryptAfterDownload(deserialized, encKeyPair.privateKey);
			expect(new TextDecoder().decode(decrypted)).toBe("classified document content");
		});
	});
});
