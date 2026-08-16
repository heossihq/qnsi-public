import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	CrossVerificationService,
	getCrossVerifiableAlgorithms,
	isCrossVerifiable,
	isCrossVerifiableKem,
	isCrossVerifiableSignature,
} from "./cross-verification.js";
import type { PqcAlgorithm } from "./provider.js";
import { registerPqcProvider, unregisterPqcProvider } from "./provider.js";
import { createDeterministicTestPqcProvider } from "./testing/providers.js";

describe("isCrossVerifiable", () => {
	it("returns true for kyber-768", () => {
		expect(isCrossVerifiable("kyber-768")).toBe(true);
	});

	it("returns true for dilithium-3", () => {
		expect(isCrossVerifiable("dilithium-3")).toBe(true);
	});

	it("returns true for sphincs-sha2-256f-simple", () => {
		expect(isCrossVerifiable("sphincs-sha2-256f-simple")).toBe(true);
	});

	it("returns false for falcon-512", () => {
		expect(isCrossVerifiable("falcon-512")).toBe(false);
	});

	it("returns false for hqc-256", () => {
		expect(isCrossVerifiable("hqc-256")).toBe(false);
	});

	it("returns false for mayo-1", () => {
		expect(isCrossVerifiable("mayo-1")).toBe(false);
	});

	it("returns false for bike-l1", () => {
		expect(isCrossVerifiable("bike-l1")).toBe(false);
	});
});

describe("isCrossVerifiableKem", () => {
	it("returns true for kyber-512", () => {
		expect(isCrossVerifiableKem("kyber-512")).toBe(true);
	});

	it("returns true for kyber-768", () => {
		expect(isCrossVerifiableKem("kyber-768")).toBe(true);
	});

	it("returns true for kyber-1024", () => {
		expect(isCrossVerifiableKem("kyber-1024")).toBe(true);
	});

	it("returns false for dilithium-3", () => {
		expect(isCrossVerifiableKem("dilithium-3")).toBe(false);
	});

	it("returns false for hqc-256", () => {
		expect(isCrossVerifiableKem("hqc-256")).toBe(false);
	});
});

describe("isCrossVerifiableSignature", () => {
	it("returns true for dilithium-2", () => {
		expect(isCrossVerifiableSignature("dilithium-2")).toBe(true);
	});

	it("returns true for dilithium-3", () => {
		expect(isCrossVerifiableSignature("dilithium-3")).toBe(true);
	});

	it("returns true for dilithium-5", () => {
		expect(isCrossVerifiableSignature("dilithium-5")).toBe(true);
	});

	it.each([
		"sphincs-sha2-128f-simple",
		"sphincs-sha2-128s-simple",
		"sphincs-sha2-192f-simple",
		"sphincs-sha2-192s-simple",
		"sphincs-sha2-256f-simple",
		"sphincs-sha2-256s-simple",
		"sphincs-shake-128f-simple",
		"sphincs-shake-128s-simple",
		"sphincs-shake-192f-simple",
		"sphincs-shake-192s-simple",
		"sphincs-shake-256f-simple",
		"sphincs-shake-256s-simple",
	])("returns true for %s", (algorithm) => {
		expect(isCrossVerifiableSignature(algorithm)).toBe(true);
	});

	it("returns false for kyber-768", () => {
		expect(isCrossVerifiableSignature("kyber-768")).toBe(false);
	});

	it("returns false for falcon-512", () => {
		expect(isCrossVerifiableSignature("falcon-512")).toBe(false);
	});
});

describe("getCrossVerifiableAlgorithms", () => {
	it("returns exactly 18 algorithms", () => {
		const algorithms = getCrossVerifiableAlgorithms();
		expect(algorithms).toHaveLength(18);
	});

	it("includes all 3 KEM algorithms", () => {
		const algorithms = getCrossVerifiableAlgorithms();
		expect(algorithms).toContain("kyber-512");
		expect(algorithms).toContain("kyber-768");
		expect(algorithms).toContain("kyber-1024");
	});

	it("includes all 15 signature algorithms", () => {
		const algorithms = getCrossVerifiableAlgorithms();
		expect(algorithms).toContain("dilithium-2");
		expect(algorithms).toContain("dilithium-3");
		expect(algorithms).toContain("dilithium-5");
		expect(algorithms).toContain("sphincs-sha2-128f-simple");
		expect(algorithms).toContain("sphincs-sha2-128s-simple");
		expect(algorithms).toContain("sphincs-sha2-192f-simple");
		expect(algorithms).toContain("sphincs-sha2-192s-simple");
		expect(algorithms).toContain("sphincs-sha2-256f-simple");
		expect(algorithms).toContain("sphincs-sha2-256s-simple");
		expect(algorithms).toContain("sphincs-shake-128f-simple");
		expect(algorithms).toContain("sphincs-shake-128s-simple");
		expect(algorithms).toContain("sphincs-shake-192f-simple");
		expect(algorithms).toContain("sphincs-shake-192s-simple");
		expect(algorithms).toContain("sphincs-shake-256f-simple");
		expect(algorithms).toContain("sphincs-shake-256s-simple");
	});
});

describe("CrossVerificationService", () => {
	const primaryName = "test-primary-provider";
	const secondaryName = "test-secondary-provider";
	const seed = "cross-verification-test-seed";

	let primaryProvider: ReturnType<typeof createDeterministicTestPqcProvider>;
	let secondaryProvider: ReturnType<typeof createDeterministicTestPqcProvider>;
	let service: CrossVerificationService;

	beforeEach(() => {
		primaryProvider = createDeterministicTestPqcProvider({
			seed,
			name: primaryName,
		});
		secondaryProvider = createDeterministicTestPqcProvider({
			seed,
			name: secondaryName,
		});

		registerPqcProvider(primaryName, primaryProvider);
		registerPqcProvider(secondaryName, secondaryProvider);

		service = new CrossVerificationService({
			primaryProvider,
			primaryProviderName: primaryName,
			secondaryProvider,
			secondaryProviderName: secondaryName,
		});
	});

	afterEach(() => {
		unregisterPqcProvider(primaryName);
		unregisterPqcProvider(secondaryName);
	});

	describe("crossVerifySignature", () => {
		it("returns verified=true with matching cross-verification for dilithium-3", async () => {
			const algorithm = "dilithium-3" satisfies PqcAlgorithm;
			const { keyPair } = await primaryProvider.generateKeyPair({ algorithm });
			const data = new TextEncoder().encode("cross-verify-test-data");

			const result = await service.crossVerifySignature({
				algorithm,
				data,
				privateKey: keyPair.privateKey,
				publicKey: keyPair.publicKey,
			});

			expect(result.verified).toBe(true);
			expect(result.primaryProvider).toBe(primaryName);
			expect(result.secondaryProvider).toBe(secondaryName);
			expect(result.algorithm).toBe(algorithm);
			expect(result.operation).toBe("sign");
			expect(result.attestation.crossVerified).toBe(true);
			expect(result.attestation.crossVerificationResult).toBe("match");
			expect(result.error).toBeUndefined();
		});

		it("returns verified=false with error for non-cross-verifiable algorithm", async () => {
			const algorithm = "falcon-512" satisfies PqcAlgorithm;
			const data = new TextEncoder().encode("test-data");

			const result = await service.crossVerifySignature({
				algorithm,
				data,
				privateKey: new Uint8Array(32),
				publicKey: new Uint8Array(32),
			});

			expect(result.verified).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain("not supported");
		});

		it("returns verified=false when secondary provider throws", async () => {
			const errorMessage = "Forced verification failure";
			const throwingProvider = createDeterministicTestPqcProvider({
				seed,
				name: "throwing-provider",
			});

			(throwingProvider as { verify: typeof throwingProvider.verify }).verify = async () => {
				throw new Error(errorMessage);
			};

			registerPqcProvider("throwing-provider", throwingProvider);

			const errorService = new CrossVerificationService({
				primaryProvider,
				primaryProviderName: primaryName,
				secondaryProvider: throwingProvider,
				secondaryProviderName: "throwing-provider",
			});

			const algorithm = "dilithium-3" satisfies PqcAlgorithm;
			const { keyPair } = await primaryProvider.generateKeyPair({ algorithm });
			const data = new TextEncoder().encode("error-test-data");

			const result = await errorService.crossVerifySignature({
				algorithm,
				data,
				privateKey: keyPair.privateKey,
				publicKey: keyPair.publicKey,
			});

			expect(result.verified).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain(errorMessage);

			unregisterPqcProvider("throwing-provider");
		});

		it("records a mismatch when the secondary provider rejects the signature", async () => {
			const rejectingProvider = createDeterministicTestPqcProvider({
				seed,
				name: "rejecting-provider",
			});
			(rejectingProvider as { verify: typeof rejectingProvider.verify }).verify = async () => false;
			const mismatchService = new CrossVerificationService({
				primaryProvider,
				primaryProviderName: primaryName,
				secondaryProvider: rejectingProvider,
				secondaryProviderName: "rejecting-provider",
			});
			const algorithm = "dilithium-3" satisfies PqcAlgorithm;
			const { keyPair } = await primaryProvider.generateKeyPair({ algorithm });

			const result = await mismatchService.crossVerifySignature({
				algorithm,
				data: new Uint8Array([1]),
				privateKey: keyPair.privateKey,
				publicKey: keyPair.publicKey,
			});

			expect(result.verified).toBe(false);
			expect(result.attestation.crossVerificationResult).toBe("mismatch");
			expect(result.error).toContain("rejected signature");
		});

		it("normalizes non-Error signature verification failures", async () => {
			const throwingProvider = createDeterministicTestPqcProvider({ seed, name: "throw-string" });
			(throwingProvider as { verify: typeof throwingProvider.verify }).verify = async () => {
				throw "signature backend offline";
			};
			const errorService = new CrossVerificationService({
				primaryProvider,
				primaryProviderName: primaryName,
				secondaryProvider: throwingProvider,
				secondaryProviderName: "throw-string",
			});
			const algorithm = "dilithium-3" satisfies PqcAlgorithm;
			const { keyPair } = await primaryProvider.generateKeyPair({ algorithm });

			const result = await errorService.crossVerifySignature({
				algorithm,
				data: new Uint8Array([2]),
				privateKey: keyPair.privateKey,
				publicKey: keyPair.publicKey,
			});

			expect(result.error).toContain("signature backend offline");
		});
	});

	describe("crossVerifyVerification", () => {
		it("returns verified=true when both providers agree on valid signature", async () => {
			const algorithm = "dilithium-3" satisfies PqcAlgorithm;
			const { keyPair } = await primaryProvider.generateKeyPair({ algorithm });
			const data = new TextEncoder().encode("verification-test-data");

			const { signature } = await primaryProvider.sign({
				algorithm,
				data,
				privateKey: keyPair.privateKey,
			});

			const result = await service.crossVerifyVerification({
				algorithm,
				data,
				signature,
				publicKey: keyPair.publicKey,
			});

			expect(result.verified).toBe(true);
			expect(result.primaryProvider).toBe(primaryName);
			expect(result.secondaryProvider).toBe(secondaryName);
			expect(result.algorithm).toBe(algorithm);
			expect(result.operation).toBe("verify");
			expect(result.attestation.crossVerified).toBe(true);
			expect(result.attestation.crossVerificationResult).toBe("match");
			expect(result.error).toBeUndefined();
		});

		it("returns verified=false with error for non-cross-verifiable algorithm", async () => {
			const algorithm = "falcon-512" satisfies PqcAlgorithm;
			const data = new TextEncoder().encode("verify-unsupported-data");

			const result = await service.crossVerifyVerification({
				algorithm,
				data,
				signature: new Uint8Array(64),
				publicKey: new Uint8Array(32),
			});

			expect(result.verified).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain("not supported");
		});

		it("returns verified=true when both providers reject tampered data", async () => {
			const algorithm = "dilithium-3" satisfies PqcAlgorithm;
			const { keyPair } = await primaryProvider.generateKeyPair({ algorithm });
			const originalData = new TextEncoder().encode("original-data");

			const { signature } = await primaryProvider.sign({
				algorithm,
				data: originalData,
				privateKey: keyPair.privateKey,
			});

			const tamperedData = new TextEncoder().encode("tampered-data");

			const result = await service.crossVerifyVerification({
				algorithm,
				data: tamperedData,
				signature,
				publicKey: keyPair.publicKey,
			});

			// Both providers reject the tampered data - they agree, so verified=true
			expect(result.verified).toBe(true);
			expect(result.attestation.crossVerificationResult).toBe("match");
		});

		it("returns verified=false when secondary provider throws during verification", async () => {
			const errorMessage = "Verification engine failure";
			const throwingProvider = createDeterministicTestPqcProvider({
				seed,
				name: "throwing-verify-provider",
			});
			(throwingProvider as { verify: typeof throwingProvider.verify }).verify = async () => {
				throw new Error(errorMessage);
			};

			registerPqcProvider("throwing-verify-provider", throwingProvider);

			const errorService = new CrossVerificationService({
				primaryProvider,
				primaryProviderName: primaryName,
				secondaryProvider: throwingProvider,
				secondaryProviderName: "throwing-verify-provider",
			});

			const algorithm = "dilithium-3" satisfies PqcAlgorithm;
			const { keyPair } = await primaryProvider.generateKeyPair({ algorithm });
			const data = new TextEncoder().encode("error-verify-data");
			const { signature } = await primaryProvider.sign({
				algorithm,
				data,
				privateKey: keyPair.privateKey,
			});

			const result = await errorService.crossVerifyVerification({
				algorithm,
				data,
				signature,
				publicKey: keyPair.publicKey,
			});

			expect(result.verified).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain(errorMessage);

			unregisterPqcProvider("throwing-verify-provider");
		});

		it("records a mismatch when providers disagree on a verification verdict", async () => {
			const rejectingProvider = createDeterministicTestPqcProvider({ seed, name: "rejecting" });
			(rejectingProvider as { verify: typeof rejectingProvider.verify }).verify = async () => false;
			const mismatchService = new CrossVerificationService({
				primaryProvider,
				primaryProviderName: primaryName,
				secondaryProvider: rejectingProvider,
				secondaryProviderName: "rejecting",
			});
			const algorithm = "dilithium-3" satisfies PqcAlgorithm;
			const { keyPair } = await primaryProvider.generateKeyPair({ algorithm });
			const data = new Uint8Array([3]);
			const { signature } = await primaryProvider.sign({
				algorithm,
				data,
				privateKey: keyPair.privateKey,
			});

			const result = await mismatchService.crossVerifyVerification({
				algorithm,
				data,
				signature,
				publicKey: keyPair.publicKey,
			});

			expect(result.verified).toBe(false);
			expect(result.attestation.crossVerificationResult).toBe("mismatch");
			expect(result.error).toContain(`${primaryName}=true`);
		});

		it("normalizes non-Error dual-verification failures", async () => {
			const throwingProvider = createDeterministicTestPqcProvider({ seed, name: "throw-string" });
			(throwingProvider as { verify: typeof throwingProvider.verify }).verify = async () => {
				throw "dual verification offline";
			};
			const errorService = new CrossVerificationService({
				primaryProvider,
				primaryProviderName: primaryName,
				secondaryProvider: throwingProvider,
				secondaryProviderName: "throw-string",
			});

			const result = await errorService.crossVerifyVerification({
				algorithm: "dilithium-3",
				data: new Uint8Array([4]),
				signature: new Uint8Array(32),
				publicKey: new Uint8Array(32),
			});

			expect(result.error).toContain("dual verification offline");
		});
	});
});
