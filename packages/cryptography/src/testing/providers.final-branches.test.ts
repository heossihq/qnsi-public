import { describe, expect, it } from "vitest";

import { createDeterministicTestPqcProvider, createTestPqcProvider } from "./providers.js";

describe("Test PQC Providers - Final Branch Coverage", () => {
	describe("createTestPqcProvider - remaining branches", () => {
		it("should handle large message signing", async () => {
			const provider = createTestPqcProvider();
			const { keyPair } = await provider.generateKeyPair({
				algorithm: "sphincs-shake-256f-simple",
			});
			const largeMessage = new Uint8Array(10000).fill(42);

			const { signature } = await provider.sign({
				algorithm: "sphincs-shake-256f-simple",
				data: largeMessage,
				privateKey: keyPair.privateKey,
			});

			expect(signature).toBeInstanceOf(Uint8Array);

			const isValid = await provider.verify({
				algorithm: "sphincs-shake-256f-simple",
				data: largeMessage,
				signature,
				publicKey: keyPair.publicKey,
			});

			expect(isValid).toBe(true);
		});

		it("should handle verification with mismatched algorithm", async () => {
			const provider = createTestPqcProvider();
			const message = new TextEncoder().encode("test");

			const { keyPair: kp1 } = await provider.generateKeyPair({ algorithm: "dilithium-2" });
			const { signature } = await provider.sign({
				algorithm: "dilithium-2",
				data: message,
				privateKey: kp1.privateKey,
			});

			// Verify with different algorithm (should fail)
			const isValid = await provider.verify({
				algorithm: "dilithium-5",
				data: message,
				signature,
				publicKey: kp1.publicKey,
			});

			expect(isValid).toBe(false);
		});

		it("should handle multiple sequential operations", async () => {
			const provider = createTestPqcProvider();

			for (let i = 0; i < 5; i++) {
				const { keyPair } = await provider.generateKeyPair({ algorithm: "kyber-768" });
				const { ciphertext } = await provider.encapsulate({
					algorithm: "kyber-768",
					publicKey: keyPair.publicKey,
				});
				const decapsulated = await provider.decapsulate({
					algorithm: "kyber-768",
					privateKey: keyPair.privateKey,
					ciphertext,
				});

				expect(decapsulated.length).toBeGreaterThan(0);
			}
		});

		it("rejects ciphertexts that were not produced by the provider", async () => {
			const provider = createTestPqcProvider();
			await expect(
				provider.decapsulate({
					algorithm: "kyber-768",
					privateKey: new Uint8Array(32),
					ciphertext: new Uint8Array([1, 2, 3]),
				}),
			).rejects.toThrow("Unknown ciphertext for algorithm 'kyber-768'");
		});

		it("should handle hash with various algorithms", async () => {
			const provider = createTestPqcProvider();
			const data = new TextEncoder().encode("test data");

			const algorithms = ["sha256", "sha512", "sha3-256", "sha3-512"];

			for (const algo of algorithms) {
				const { digest, algorithm } = await provider.hash(data, algo);
				expect(digest).toBeInstanceOf(Uint8Array);
				expect(algorithm).toBe(algo);
			}
		});
	});

	describe("createDeterministicTestPqcProvider - remaining branches", () => {
		it("should handle seed as Uint8Array", () => {
			const seedBytes = new Uint8Array([1, 2, 3, 4, 5]);
			const provider = createDeterministicTestPqcProvider({ seed: seedBytes });

			expect(provider.name).toContain("deterministic");
		});

		it("should handle seed as string", () => {
			const provider = createDeterministicTestPqcProvider({ seed: "string-seed" });

			expect(provider.name).toContain("deterministic");
		});

		it("should handle custom name option", () => {
			const provider = createDeterministicTestPqcProvider({
				seed: "test",
				name: "custom-deterministic-provider",
			});

			expect(provider.name).toBe("custom-deterministic-provider");
		});

		it("should generate consistent hashes across instances", async () => {
			const seed = "hash-consistency-test";
			const provider1 = createDeterministicTestPqcProvider({ seed });
			const provider2 = createDeterministicTestPqcProvider({ seed });

			const data = new TextEncoder().encode("consistent data");

			const { digest: d1 } = await provider1.hash(data, "sha512");
			const { digest: d2 } = await provider2.hash(data, "sha512");

			expect(d1).toEqual(d2);
		});

		it("should handle multiple encapsulations with same provider", async () => {
			const provider = createDeterministicTestPqcProvider({ seed: "multi-encap" });
			const { keyPair } = await provider.generateKeyPair({ algorithm: "kyber-1024" });

			const results = [];
			for (let i = 0; i < 3; i++) {
				const { ciphertext, sharedSecret } = await provider.encapsulate({
					algorithm: "kyber-1024",
					publicKey: keyPair.publicKey,
				});
				results.push({ ciphertext, sharedSecret });
			}

			// Each encapsulation should produce different ciphertext/secret
			expect(results[0]?.ciphertext).not.toEqual(results[1]?.ciphertext);
			expect(results[1]?.ciphertext).not.toEqual(results[2]?.ciphertext);
		});

		it("should handle decapsulation of multiple ciphertexts", async () => {
			const provider = createDeterministicTestPqcProvider({ seed: "multi-decap" });
			const { keyPair } = await provider.generateKeyPair({ algorithm: "kyber-512" });

			const encap1 = await provider.encapsulate({
				algorithm: "kyber-512",
				publicKey: keyPair.publicKey,
			});
			const encap2 = await provider.encapsulate({
				algorithm: "kyber-512",
				publicKey: keyPair.publicKey,
			});

			const secret1 = await provider.decapsulate({
				algorithm: "kyber-512",
				privateKey: keyPair.privateKey,
				ciphertext: encap1.ciphertext,
			});
			const secret2 = await provider.decapsulate({
				algorithm: "kyber-512",
				privateKey: keyPair.privateKey,
				ciphertext: encap2.ciphertext,
			});

			expect(secret1).toEqual(encap1.sharedSecret);
			expect(secret2).toEqual(encap2.sharedSecret);
		});

		it("rejects unknown deterministic ciphertexts", async () => {
			const provider = createDeterministicTestPqcProvider({ seed: "unknown-ciphertext" });
			await expect(
				provider.decapsulate({
					algorithm: "kyber-1024",
					privateKey: new Uint8Array(32),
					ciphertext: new Uint8Array([4, 5, 6]),
				}),
			).rejects.toThrow("Unknown ciphertext for algorithm 'kyber-1024'");
		});

		it("should handle signing with all dilithium variants", async () => {
			const algorithms = ["dilithium-2", "dilithium-3", "dilithium-5"] as const;
			const message = new TextEncoder().encode("test message");

			for (const algorithm of algorithms) {
				const provider = createDeterministicTestPqcProvider({ seed: `dilithium-${algorithm}` });
				const { keyPair } = await provider.generateKeyPair({ algorithm });

				const { signature } = await provider.sign({
					algorithm,
					data: message,
					privateKey: keyPair.privateKey,
				});

				const isValid = await provider.verify({
					algorithm,
					data: message,
					signature,
					publicKey: keyPair.publicKey,
				});

				expect(isValid).toBe(true);
			}
		});

		it("should handle signing with all falcon variants", async () => {
			const algorithms = ["falcon-512", "falcon-1024"] as const;
			const message = new TextEncoder().encode("falcon test");

			for (const algorithm of algorithms) {
				const provider = createDeterministicTestPqcProvider({ seed: `falcon-${algorithm}` });
				const { keyPair } = await provider.generateKeyPair({ algorithm });

				const { signature } = await provider.sign({
					algorithm,
					data: message,
					privateKey: keyPair.privateKey,
				});

				const isValid = await provider.verify({
					algorithm,
					data: message,
					signature,
					publicKey: keyPair.publicKey,
				});

				expect(isValid).toBe(true);
			}
		});

		it("should handle all kyber variants for encapsulation", async () => {
			const algorithms = ["kyber-512", "kyber-768", "kyber-1024"] as const;

			for (const algorithm of algorithms) {
				const provider = createDeterministicTestPqcProvider({ seed: `kyber-${algorithm}` });
				const { keyPair } = await provider.generateKeyPair({ algorithm });

				const { ciphertext, sharedSecret } = await provider.encapsulate({
					algorithm,
					publicKey: keyPair.publicKey,
				});

				const decapsulated = await provider.decapsulate({
					algorithm,
					privateKey: keyPair.privateKey,
					ciphertext,
				});

				expect(decapsulated).toEqual(sharedSecret);
			}
		});
	});
});
