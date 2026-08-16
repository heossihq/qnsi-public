import { afterEach, describe, expect, it } from "vitest";

import type { PqcAlgorithm } from "../provider.js";
import {
	initializeExternalPqcProvider,
	registerExternalPqcProvider,
	unregisterExternalPqcProvider,
} from "./external.js";
import {
	createNobleProviderFactory,
	NOBLE_SUPPORTED_ALGORITHMS,
	registerNobleProvider,
} from "./noble.js";

describe("noble provider factory", () => {
	afterEach(() => {
		unregisterExternalPqcProvider("noble");
	});

	it("exposes metadata for all 18 supported algorithms", () => {
		const factory = createNobleProviderFactory();
		expect(factory.metadata.name).toBe("noble");
		expect(factory.metadata.author).toBe("Paul Miller (@paulmillr)");
		expect(factory.metadata.supportedAlgorithms).toHaveLength(18);
		expect(factory.metadata.supportedAlgorithms).toEqual(
			expect.arrayContaining([
				"kyber-512",
				"kyber-768",
				"kyber-1024",
				"dilithium-2",
				"dilithium-3",
				"dilithium-5",
				"sphincs-sha2-128f-simple",
				"sphincs-shake-256s-simple",
			]),
		);
	});

	it("probe always returns true (pure JS, no native deps)", async () => {
		const factory = createNobleProviderFactory();
		expect(factory.probe).toBeDefined();
		const result = await factory.probe?.();
		expect(result).toBe(true);
	});

	it("rejects unsupported algorithms", async () => {
		const factory = createNobleProviderFactory();
		await expect(
			factory.create({
				algorithms: ["falcon-512" as PqcAlgorithm],
			}),
		).rejects.toThrow(/not supported/);
	});

	it("rejects empty algorithm set after filtering", async () => {
		const factory = createNobleProviderFactory();
		await expect(
			factory.create({
				algorithms: ["bike-l1" as PqcAlgorithm],
			}),
		).rejects.toThrow(/not supported/);
	});

	describe("ML-KEM (FIPS 203) key encapsulation", () => {
		const kemAlgorithms: PqcAlgorithm[] = ["kyber-512", "kyber-768", "kyber-1024"];

		for (const algorithm of kemAlgorithms) {
			it(`${algorithm}: keygen → encapsulate → decapsulate round-trip`, async () => {
				const factory = createNobleProviderFactory();
				unregisterExternalPqcProvider("noble");
				registerExternalPqcProvider(factory);

				const provider = await initializeExternalPqcProvider("noble", {
					internal: true,
					algorithms: [algorithm],
				});

				expect(provider.name).toBe("noble");

				const { keyPair } = await provider.generateKeyPair({ algorithm });
				expect(keyPair.algorithm).toBe(algorithm);
				expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
				expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
				expect(keyPair.publicKey.length).toBeGreaterThan(0);
				expect(keyPair.privateKey.length).toBeGreaterThan(0);

				const { ciphertext, sharedSecret } = await provider.encapsulate({
					algorithm,
					publicKey: keyPair.publicKey,
				});
				expect(ciphertext).toBeInstanceOf(Uint8Array);
				expect(sharedSecret).toBeInstanceOf(Uint8Array);
				expect(ciphertext.length).toBeGreaterThan(0);
				expect(sharedSecret.length).toBeGreaterThan(0);

				const decapsulated = await provider.decapsulate({
					algorithm,
					ciphertext,
					privateKey: keyPair.privateKey,
				});
				expect(decapsulated).toBeInstanceOf(Uint8Array);
				expect(Array.from(decapsulated)).toStrictEqual(Array.from(sharedSecret));
			});
		}

		it("rejects signature algorithm for encapsulate", async () => {
			const factory = createNobleProviderFactory();
			unregisterExternalPqcProvider("noble");
			registerExternalPqcProvider(factory);

			const provider = await initializeExternalPqcProvider("noble", { internal: true });

			await expect(
				provider.encapsulate({
					algorithm: "dilithium-2",
					publicKey: new Uint8Array(32),
				}),
			).rejects.toThrow(/not a KEM algorithm/);
		});

		it("honors an explicit deterministic ML-KEM seed", async () => {
			const factory = createNobleProviderFactory();
			const provider = await factory.create({ algorithms: ["kyber-512"] });
			const seed = new Uint8Array(64).fill(7);
			const first = await provider.generateKeyPair({ algorithm: "kyber-512", seed });
			const second = await provider.generateKeyPair({ algorithm: "kyber-512", seed });
			expect(first.keyPair).toEqual(second.keyPair);
		});

		it("rejects signature algorithm for decapsulate", async () => {
			const factory = createNobleProviderFactory();
			unregisterExternalPqcProvider("noble");
			registerExternalPqcProvider(factory);

			const provider = await initializeExternalPqcProvider("noble", { internal: true });

			await expect(
				provider.decapsulate({
					algorithm: "dilithium-2",
					ciphertext: new Uint8Array(32),
					privateKey: new Uint8Array(32),
				}),
			).rejects.toThrow(/not a KEM algorithm/);
		});
	});

	describe("ML-DSA (FIPS 204) digital signatures", () => {
		const sigAlgorithms: PqcAlgorithm[] = ["dilithium-2", "dilithium-3", "dilithium-5"];

		for (const algorithm of sigAlgorithms) {
			it(`${algorithm}: keygen → sign → verify round-trip`, async () => {
				const factory = createNobleProviderFactory();
				unregisterExternalPqcProvider("noble");
				registerExternalPqcProvider(factory);

				const provider = await initializeExternalPqcProvider("noble", {
					internal: true,
					algorithms: [algorithm],
				});

				const { keyPair } = await provider.generateKeyPair({ algorithm });
				expect(keyPair.algorithm).toBe(algorithm);
				expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
				expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);

				const message = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
				const { signature, algorithm: sigAlg } = await provider.sign({
					algorithm,
					data: message,
					privateKey: keyPair.privateKey,
				});
				expect(signature).toBeInstanceOf(Uint8Array);
				expect(signature.length).toBeGreaterThan(0);
				expect(sigAlg).toBe(algorithm);

				const verified = await provider.verify({
					algorithm,
					data: message,
					signature,
					publicKey: keyPair.publicKey,
				});
				expect(verified).toBe(true);
			});

			it(`${algorithm}: verify rejects tampered message`, async () => {
				const factory = createNobleProviderFactory();
				unregisterExternalPqcProvider("noble");
				registerExternalPqcProvider(factory);

				const provider = await initializeExternalPqcProvider("noble", {
					internal: true,
					algorithms: [algorithm],
				});

				const { keyPair } = await provider.generateKeyPair({ algorithm });
				const message = new Uint8Array([1, 2, 3, 4, 5]);
				const { signature } = await provider.sign({
					algorithm,
					data: message,
					privateKey: keyPair.privateKey,
				});

				const tampered = new Uint8Array([1, 2, 3, 4, 6]);
				const verified = await provider.verify({
					algorithm,
					data: tampered,
					signature,
					publicKey: keyPair.publicKey,
				});
				expect(verified).toBe(false);
			});
		}

		it("rejects KEM algorithm for sign", async () => {
			const factory = createNobleProviderFactory();
			unregisterExternalPqcProvider("noble");
			registerExternalPqcProvider(factory);

			const provider = await initializeExternalPqcProvider("noble", { internal: true });

			await expect(
				provider.sign({
					algorithm: "kyber-512",
					data: new Uint8Array([1]),
					privateKey: new Uint8Array(32),
				}),
			).rejects.toThrow(/not a signature algorithm/);
		});

		it("honors an explicit deterministic ML-DSA seed", async () => {
			const factory = createNobleProviderFactory();
			const provider = await factory.create({ algorithms: ["dilithium-2"] });
			const seed = new Uint8Array(32).fill(11);
			const first = await provider.generateKeyPair({ algorithm: "dilithium-2", seed });
			const second = await provider.generateKeyPair({ algorithm: "dilithium-2", seed });
			expect(first.keyPair).toEqual(second.keyPair);
		});

		it("rejects KEM algorithm for verify", async () => {
			const factory = createNobleProviderFactory();
			unregisterExternalPqcProvider("noble");
			registerExternalPqcProvider(factory);

			const provider = await initializeExternalPqcProvider("noble", { internal: true });

			await expect(
				provider.verify({
					algorithm: "kyber-512",
					data: new Uint8Array([1]),
					signature: new Uint8Array(32),
					publicKey: new Uint8Array(32),
				}),
			).rejects.toThrow(/not a signature algorithm/);
		});
	});

	describe("SLH-DSA (FIPS 205) hash-based signatures", () => {
		// Test one SHA2 and one SHAKE variant to keep test runtime reasonable
		// (SLH-DSA keygen is slow - full 12-variant test would take minutes)
		const slhAlgorithms: PqcAlgorithm[] = ["sphincs-sha2-128f-simple", "sphincs-shake-128f-simple"];

		for (const algorithm of slhAlgorithms) {
			it(`${algorithm}: keygen → sign → verify round-trip`, async () => {
				const factory = createNobleProviderFactory();
				unregisterExternalPqcProvider("noble");
				registerExternalPqcProvider(factory);

				const provider = await initializeExternalPqcProvider("noble", {
					internal: true,
					algorithms: [algorithm],
				});

				const { keyPair } = await provider.generateKeyPair({ algorithm });
				expect(keyPair.algorithm).toBe(algorithm);
				expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
				expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);

				const message = new Uint8Array([80, 81, 67]); // "PQC"
				const { signature, algorithm: sigAlg } = await provider.sign({
					algorithm,
					data: message,
					privateKey: keyPair.privateKey,
				});
				expect(signature).toBeInstanceOf(Uint8Array);
				expect(signature.length).toBeGreaterThan(0);
				expect(sigAlg).toBe(algorithm);

				const verified = await provider.verify({
					algorithm,
					data: message,
					signature,
					publicKey: keyPair.publicKey,
				});
				expect(verified).toBe(true);

				// Tampered message must fail verification
				const tampered = new Uint8Array([80, 81, 68]);
				const tamperedResult = await provider.verify({
					algorithm,
					data: tampered,
					signature,
					publicKey: keyPair.publicKey,
				});
				expect(tamperedResult).toBe(false);
			}, 300_000); // SLH-DSA can be slow in pure JS
		}
	});

	describe("hash functions", () => {
		const testData = new Uint8Array([1, 2, 3, 4, 5]);

		it("defaults to sha3-256", async () => {
			const factory = createNobleProviderFactory();
			unregisterExternalPqcProvider("noble");
			registerExternalPqcProvider(factory);

			const provider = await initializeExternalPqcProvider("noble", { internal: true });
			const result = await provider.hash(testData);
			expect(result.algorithm).toBe("sha3-256");
			expect(result.digest).toBeInstanceOf(Uint8Array);
			expect(result.digest.length).toBe(32); // SHA3-256 = 32 bytes
		});

		it("supports sha-256", async () => {
			const factory = createNobleProviderFactory();
			unregisterExternalPqcProvider("noble");
			registerExternalPqcProvider(factory);

			const provider = await initializeExternalPqcProvider("noble", { internal: true });
			const result = await provider.hash(testData, "sha-256");
			expect(result.algorithm).toBe("sha-256");
			expect(result.digest).toBeInstanceOf(Uint8Array);
			expect(result.digest.length).toBe(32); // SHA-256 = 32 bytes
		});

		it("supports sha256 without a separator", async () => {
			const provider = await createNobleProviderFactory().create();
			const result = await provider.hash(testData, "sha256");
			expect(result.digest).toHaveLength(32);
		});

		it("supports sha-512", async () => {
			const factory = createNobleProviderFactory();
			unregisterExternalPqcProvider("noble");
			registerExternalPqcProvider(factory);

			const provider = await initializeExternalPqcProvider("noble", { internal: true });
			const result = await provider.hash(testData, "sha-512");
			expect(result.algorithm).toBe("sha-512");
			expect(result.digest).toBeInstanceOf(Uint8Array);
			expect(result.digest.length).toBe(64); // SHA-512 = 64 bytes
		});

		it("supports sha512 without a separator", async () => {
			const provider = await createNobleProviderFactory().create();
			const result = await provider.hash(testData, "sha512");
			expect(result.digest).toHaveLength(64);
		});

		it("supports sha3-512", async () => {
			const factory = createNobleProviderFactory();
			unregisterExternalPqcProvider("noble");
			registerExternalPqcProvider(factory);

			const provider = await initializeExternalPqcProvider("noble", { internal: true });
			const result = await provider.hash(testData, "sha3-512");
			expect(result.algorithm).toBe("sha3-512");
			expect(result.digest).toBeInstanceOf(Uint8Array);
			expect(result.digest.length).toBe(64); // SHA3-512 = 64 bytes
		});

		it("produces deterministic output", async () => {
			const factory = createNobleProviderFactory();
			unregisterExternalPqcProvider("noble");
			registerExternalPqcProvider(factory);

			const provider = await initializeExternalPqcProvider("noble", { internal: true });
			const result1 = await provider.hash(testData, "sha3-256");
			const result2 = await provider.hash(testData, "sha3-256");
			expect(Array.from(result1.digest)).toStrictEqual(Array.from(result2.digest));
		});

		it("rejects unsupported hash algorithm", async () => {
			const factory = createNobleProviderFactory();
			unregisterExternalPqcProvider("noble");
			registerExternalPqcProvider(factory);

			const provider = await initializeExternalPqcProvider("noble", { internal: true });
			await expect(provider.hash(testData, "md5")).rejects.toThrow(/not supported/);
		});
	});

	describe("algorithm restriction enforcement", () => {
		it("rejects algorithm not in allowed set", async () => {
			const factory = createNobleProviderFactory();
			unregisterExternalPqcProvider("noble");
			registerExternalPqcProvider(factory);

			const provider = await initializeExternalPqcProvider("noble", {
				internal: true,
				algorithms: ["kyber-512"],
			});

			await expect(provider.generateKeyPair({ algorithm: "kyber-768" })).rejects.toThrow(
				/not enabled/,
			);
		});

		it("allows all algorithms when none specified", async () => {
			const factory = createNobleProviderFactory();
			unregisterExternalPqcProvider("noble");
			registerExternalPqcProvider(factory);

			const provider = await initializeExternalPqcProvider("noble", { internal: true });

			// Should not throw for any supported algorithm
			const { keyPair } = await provider.generateKeyPair({ algorithm: "kyber-1024" });
			expect(keyPair.algorithm).toBe("kyber-1024");
		});
	});

	describe("registration", () => {
		it("registerNobleProvider makes noble available via initializeExternalPqcProvider", async () => {
			unregisterExternalPqcProvider("noble");
			registerNobleProvider();

			const provider = await initializeExternalPqcProvider("noble", {
				internal: true,
				algorithms: ["kyber-512"],
			});
			expect(provider.name).toBe("noble");

			const { keyPair } = await provider.generateKeyPair({ algorithm: "kyber-512" });
			expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
		});
	});

	describe("NOBLE_SUPPORTED_ALGORITHMS export", () => {
		it("contains exactly 18 algorithms (3 KEM + 3 ML-DSA + 12 SLH-DSA)", () => {
			expect(NOBLE_SUPPORTED_ALGORITHMS).toHaveLength(18);

			const kemAlgorithms = NOBLE_SUPPORTED_ALGORITHMS.filter((a) => a.startsWith("kyber-"));
			expect(kemAlgorithms).toHaveLength(3);

			const dsaAlgorithms = NOBLE_SUPPORTED_ALGORITHMS.filter((a) => a.startsWith("dilithium-"));
			expect(dsaAlgorithms).toHaveLength(3);

			const slhAlgorithms = NOBLE_SUPPORTED_ALGORITHMS.filter((a) => a.startsWith("sphincs-"));
			expect(slhAlgorithms).toHaveLength(12);
		});
	});
});
