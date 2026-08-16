import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PqcProvider } from "../provider.js";
import {
	initializeExternalPqcProvider,
	registerExternalPqcProvider,
	unregisterExternalPqcProvider,
} from "./external.js";
import { createLiboqsProviderFactory } from "./liboqs.js";

async function canRunNativeIntegration(): Promise<boolean> {
	try {
		const factory = createLiboqsProviderFactory();
		return (await factory.probe?.()) ?? true;
	} catch {
		return false;
	}
}

const shouldRun = await canRunNativeIntegration();

if (!shouldRun) {
	throw new Error(
		"The required @heossihq/liboqs-native provider is unavailable; native PQC verification cannot be skipped",
	);
}

describe("liboqs provider - Real Native Library Integration", () => {
	let provider: PqcProvider;

	beforeAll(async () => {
		const factory = createLiboqsProviderFactory();
		registerExternalPqcProvider(factory);
		provider = await initializeExternalPqcProvider("liboqs", { internal: true });
	});

	afterAll(() => {
		unregisterExternalPqcProvider("liboqs");
	});

	describe("KEM operations with real liboqs", () => {
		it("should perform Kyber-512 key generation, encapsulation, and decapsulation", async () => {
			const { keyPair } = await provider.generateKeyPair({ algorithm: "kyber-512" });
			expect(keyPair.algorithm).toBe("kyber-512");
			expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
			expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
			expect(keyPair.publicKey.length).toBeGreaterThan(0);
			expect(keyPair.privateKey.length).toBeGreaterThan(0);

			const { ciphertext, sharedSecret } = await provider.encapsulate({
				algorithm: "kyber-512",
				publicKey: keyPair.publicKey,
			});
			expect(ciphertext).toBeInstanceOf(Uint8Array);
			expect(sharedSecret).toBeInstanceOf(Uint8Array);
			expect(ciphertext.length).toBeGreaterThan(0);
			expect(sharedSecret.length).toBeGreaterThan(0);

			const decapsulatedSecret = await provider.decapsulate({
				algorithm: "kyber-512",
				privateKey: keyPair.privateKey,
				ciphertext,
			});
			expect(decapsulatedSecret).toBeInstanceOf(Uint8Array);
			expect(decapsulatedSecret).toEqual(sharedSecret);
		});

		it("should perform Kyber-768 operations", async () => {
			const { keyPair } = await provider.generateKeyPair({ algorithm: "kyber-768" });
			const { ciphertext, sharedSecret } = await provider.encapsulate({
				algorithm: "kyber-768",
				publicKey: keyPair.publicKey,
			});
			const decapsulated = await provider.decapsulate({
				algorithm: "kyber-768",
				privateKey: keyPair.privateKey,
				ciphertext,
			});

			expect(decapsulated).toEqual(sharedSecret);
		});

		it("should perform Kyber-1024 operations", async () => {
			const { keyPair } = await provider.generateKeyPair({ algorithm: "kyber-1024" });
			const { ciphertext, sharedSecret } = await provider.encapsulate({
				algorithm: "kyber-1024",
				publicKey: keyPair.publicKey,
			});
			const decapsulated = await provider.decapsulate({
				algorithm: "kyber-1024",
				privateKey: keyPair.privateKey,
				ciphertext,
			});

			expect(decapsulated).toEqual(sharedSecret);
		});
	});

	describe("Signature operations with real liboqs", () => {
		it("should perform Dilithium-2 key generation, signing, and verification", async () => {
			const message = new TextEncoder().encode("Test message for Dilithium-2");

			const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
			expect(keyPair.algorithm).toBe("dilithium-2");
			expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
			expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);

			const { signature, algorithm } = await provider.sign({
				algorithm: "dilithium-2",
				data: message,
				privateKey: keyPair.privateKey,
			});
			expect(signature).toBeInstanceOf(Uint8Array);
			expect(algorithm).toBe("dilithium-2");
			expect(signature.length).toBeGreaterThan(0);

			const isValid = await provider.verify({
				algorithm: "dilithium-2",
				data: message,
				signature,
				publicKey: keyPair.publicKey,
			});
			expect(isValid).toBe(true);
		});

		it("should perform Dilithium-3 operations", async () => {
			const message = new TextEncoder().encode("Dilithium-3 test");

			const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-3" });
			const { signature } = await provider.sign({
				algorithm: "dilithium-3",
				data: message,
				privateKey: keyPair.privateKey,
			});
			const isValid = await provider.verify({
				algorithm: "dilithium-3",
				data: message,
				signature,
				publicKey: keyPair.publicKey,
			});

			expect(isValid).toBe(true);
		});

		it("should perform Dilithium-5 operations", async () => {
			const message = new TextEncoder().encode("Dilithium-5 test");

			const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-5" });
			const { signature } = await provider.sign({
				algorithm: "dilithium-5",
				data: message,
				privateKey: keyPair.privateKey,
			});
			const isValid = await provider.verify({
				algorithm: "dilithium-5",
				data: message,
				signature,
				publicKey: keyPair.publicKey,
			});

			expect(isValid).toBe(true);
		});

		it("should perform Falcon-512 operations", async () => {
			const message = new TextEncoder().encode("Falcon-512 test");

			const { keyPair } = await provider.generateKeyPair({ algorithm: "falcon-512" });
			const { signature } = await provider.sign({
				algorithm: "falcon-512",
				data: message,
				privateKey: keyPair.privateKey,
			});
			const isValid = await provider.verify({
				algorithm: "falcon-512",
				data: message,
				signature,
				publicKey: keyPair.publicKey,
			});

			expect(isValid).toBe(true);
		});

		it("should perform Falcon-1024 operations", async () => {
			const message = new TextEncoder().encode("Falcon-1024 test");

			const { keyPair } = await provider.generateKeyPair({ algorithm: "falcon-1024" });
			const { signature } = await provider.sign({
				algorithm: "falcon-1024",
				data: message,
				privateKey: keyPair.privateKey,
			});
			const isValid = await provider.verify({
				algorithm: "falcon-1024",
				data: message,
				signature,
				publicKey: keyPair.publicKey,
			});

			expect(isValid).toBe(true);
		});

		it("should perform SPHINCS+-SHAKE-128f-simple operations", async () => {
			const message = new TextEncoder().encode("SPHINCS test");

			const { keyPair } = await provider.generateKeyPair({
				algorithm: "sphincs-shake-128f-simple",
			});
			const { signature } = await provider.sign({
				algorithm: "sphincs-shake-128f-simple",
				data: message,
				privateKey: keyPair.privateKey,
			});
			const isValid = await provider.verify({
				algorithm: "sphincs-shake-128f-simple",
				data: message,
				signature,
				publicKey: keyPair.publicKey,
			});

			expect(isValid).toBe(true);
		});

		it("should perform SPHINCS+-SHAKE-256f-simple operations", async () => {
			const message = new TextEncoder().encode("SPHINCS-256 test");

			const { keyPair } = await provider.generateKeyPair({
				algorithm: "sphincs-shake-256f-simple",
			});
			const { signature } = await provider.sign({
				algorithm: "sphincs-shake-256f-simple",
				data: message,
				privateKey: keyPair.privateKey,
			});
			const isValid = await provider.verify({
				algorithm: "sphincs-shake-256f-simple",
				data: message,
				signature,
				publicKey: keyPair.publicKey,
			});

			expect(isValid).toBe(true);
		});

		it("should reject invalid signatures", async () => {
			const message = new TextEncoder().encode("Original message");
			const tamperedMessage = new TextEncoder().encode("Tampered message");

			const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-3" });
			const { signature } = await provider.sign({
				algorithm: "dilithium-3",
				data: message,
				privateKey: keyPair.privateKey,
			});

			const isValid = await provider.verify({
				algorithm: "dilithium-3",
				data: tamperedMessage,
				signature,
				publicKey: keyPair.publicKey,
			});

			expect(isValid).toBe(false);
		});

		it("should reject tampered signatures", async () => {
			const message = new TextEncoder().encode("Test message");

			const { keyPair } = await provider.generateKeyPair({ algorithm: "falcon-512" });
			const { signature } = await provider.sign({
				algorithm: "falcon-512",
				data: message,
				privateKey: keyPair.privateKey,
			});

			// Tamper with signature
			const tamperedSignature = new Uint8Array(signature);
			if (tamperedSignature[0] !== undefined) {
				tamperedSignature[0] ^= 0xff;
			}

			const isValid = await provider.verify({
				algorithm: "falcon-512",
				data: message,
				signature: tamperedSignature,
				publicKey: keyPair.publicKey,
			});

			expect(isValid).toBe(false);
		});
	});

	describe("Hash operations", () => {
		it("should perform SHA3-256 hashing", async () => {
			const data = new TextEncoder().encode("Hash this data");

			const { digest, algorithm } = await provider.hash(data);

			expect(digest).toBeInstanceOf(Uint8Array);
			expect(algorithm).toBe("sha3-256");
			expect(digest.length).toBe(32); // SHA3-256 produces 32 bytes
		});

		it("should perform custom algorithm hashing", async () => {
			const data = new TextEncoder().encode("Hash with SHA256");

			const { digest, algorithm } = await provider.hash(data, "sha256");

			expect(digest).toBeInstanceOf(Uint8Array);
			expect(algorithm).toBe("sha256");
			expect(digest.length).toBe(32);
		});

		it("should produce different hashes for different data", async () => {
			const data1 = new TextEncoder().encode("Data 1");
			const data2 = new TextEncoder().encode("Data 2");

			const { digest: digest1 } = await provider.hash(data1);
			const { digest: digest2 } = await provider.hash(data2);

			expect(digest1).not.toEqual(digest2);
		});

		it("should produce same hash for same data", async () => {
			const data = new TextEncoder().encode("Consistent data");

			const { digest: digest1 } = await provider.hash(data);
			const { digest: digest2 } = await provider.hash(data);

			expect(digest1).toEqual(digest2);
		});
	});

	describe("Error handling", () => {
		it("rejects seeded native key generation and cross-family operations", async () => {
			await expect(
				provider.generateKeyPair({ algorithm: "kyber-512", seed: new Uint8Array(64) }),
			).rejects.toThrow("Seeded KEM key generation is not supported");
			await expect(
				provider.generateKeyPair({ algorithm: "dilithium-2", seed: new Uint8Array(32) }),
			).rejects.toThrow("Seeded signature key generation is not supported");
			await expect(
				provider.encapsulate({ algorithm: "dilithium-2", publicKey: new Uint8Array(32) }),
			).rejects.toThrow("not a KEM algorithm");
			await expect(
				provider.sign({
					algorithm: "kyber-512",
					data: new Uint8Array(1),
					privateKey: new Uint8Array(32),
				}),
			).rejects.toThrow("not a signature algorithm");
		});

		it("enforces the factory algorithm allowlist", async () => {
			const restricted = await createLiboqsProviderFactory().create({
				algorithms: ["kyber-512"],
			});
			await expect(restricted.generateKeyPair({ algorithm: "kyber-768" })).rejects.toThrow(
				"not enabled",
			);
		});

		it("should handle empty message signing", async () => {
			const emptyMessage = new Uint8Array(0);

			const { keyPair } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
			const { signature } = await provider.sign({
				algorithm: "dilithium-2",
				data: emptyMessage,
				privateKey: keyPair.privateKey,
			});

			expect(signature).toBeInstanceOf(Uint8Array);
			expect(signature.length).toBeGreaterThan(0);

			const isValid = await provider.verify({
				algorithm: "dilithium-2",
				data: emptyMessage,
				signature,
				publicKey: keyPair.publicKey,
			});

			expect(isValid).toBe(true);
		});

		it("should handle empty data hashing", async () => {
			const emptyData = new Uint8Array(0);

			const { digest } = await provider.hash(emptyData);

			expect(digest).toBeInstanceOf(Uint8Array);
			expect(digest.length).toBeGreaterThan(0);
		});
	});

	describe("Cross-algorithm compatibility", () => {
		it("should not verify signature with wrong algorithm", async () => {
			const message = new TextEncoder().encode("Test");

			const { keyPair: keyPair1 } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
			const { keyPair: keyPair2 } = await provider.generateKeyPair({ algorithm: "dilithium-3" });

			const { signature } = await provider.sign({
				algorithm: "dilithium-2",
				data: message,
				privateKey: keyPair1.privateKey,
			});

			// Try to verify with different key from different algorithm
			const isValid = await provider.verify({
				algorithm: "dilithium-3",
				data: message,
				signature,
				publicKey: keyPair2.publicKey,
			});

			expect(isValid).toBe(false);
		});
	});
});
