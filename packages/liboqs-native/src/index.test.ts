/// <reference types="vitest/globals" />

let liboqs: typeof import("./index.js");

beforeAll(async () => {
	const module = await import("./index.js");
	liboqs = module.default;
});

const ML_KEM_ALGORITHM = "ML-KEM-768";
const ML_DSA_ALGORITHM = "ML-DSA-65";
const HQC_ALGORITHM = "HQC-1";

describe("liboqs native binding", () => {
	it("reports real supported algorithms and native library state", () => {
		const supportedKems = liboqs.getSupportedKems();
		const supportedSignatures = liboqs.getSupportedSignatures();

		expect(supportedKems).toContain(ML_KEM_ALGORITHM);
		expect(supportedKems).toContain(HQC_ALGORITHM);
		expect(supportedSignatures).toContain(ML_DSA_ALGORITHM);
		expect(liboqs.isKemAlgorithmSupported(ML_KEM_ALGORITHM)).toBe(true);
		expect(liboqs.isKemAlgorithmSupported(HQC_ALGORITHM)).toBe(true);
		expect(liboqs.isSignatureAlgorithmSupported(ML_DSA_ALGORITHM)).toBe(true);
		expect(liboqs.isKemAlgorithmSupported("QNSI-UNSUPPORTED-KEM")).toBe(false);
		expect(liboqs.isSignatureAlgorithmSupported("QNSI-UNSUPPORTED-SIGNATURE")).toBe(false);
		expect(liboqs.version()).toMatch(/^0\.16\.0\b/);

		liboqs.clearOpenSslErrorQueue();
		expect(liboqs.hasOpenSslErrorQueueEntries()).toBe(false);
	});

	it("performs real ML-KEM key generation, encapsulation, and decapsulation", () => {
		const kem = new liboqs.KEM(ML_KEM_ALGORITHM);

		try {
			const details = kem.details();
			expect(details.algorithm).toBe(ML_KEM_ALGORITHM);
			expect(details.claimedNistLevel).toBe(3);
			expect(details.indCca).toBe(true);
			expect(details.algVersion.length).toBeGreaterThan(0);

			const keyPair = kem.generateKeypair();
			expect(keyPair.publicKey).toHaveLength(details.lengthPublicKey);
			expect(keyPair.secretKey).toHaveLength(details.lengthSecretKey);

			const encapsulation = kem.encapsulate(keyPair.publicKey);
			expect(encapsulation.ciphertext).toHaveLength(details.lengthCiphertext);
			expect(encapsulation.sharedSecret).toHaveLength(details.lengthSharedSecret);
			expect(kem.decapsulate(encapsulation.ciphertext, keyPair.secretKey)).toEqual(
				encapsulation.sharedSecret,
			);

			const tamperedCiphertext = Buffer.from(encapsulation.ciphertext);
			const firstCiphertextByte = tamperedCiphertext[0];
			if (firstCiphertextByte === undefined) {
				throw new Error("ML-KEM ciphertext must contain at least one byte");
			}
			tamperedCiphertext[0] = firstCiphertextByte ^ 1;
			expect(kem.decapsulate(tamperedCiphertext, keyPair.secretKey)).not.toEqual(
				encapsulation.sharedSecret,
			);

			expect(details.lengthKeypairSeed).toBeGreaterThan(0);
			expect(details.lengthEncapsSeed).toBeGreaterThan(0);
			const keypairSeed = Buffer.alloc(details.lengthKeypairSeed, 0x5a);
			const deterministicKeyPair = kem.generateKeypairDerand(keypairSeed);
			expect(kem.generateKeypairDerand(keypairSeed)).toEqual(deterministicKeyPair);

			const encapsulationSeed = Buffer.alloc(details.lengthEncapsSeed, 0xa5);
			const deterministicEncapsulation = kem.encapsulateDerand(
				deterministicKeyPair.publicKey,
				encapsulationSeed,
			);
			expect(kem.encapsulateDerand(deterministicKeyPair.publicKey, encapsulationSeed)).toEqual(
				deterministicEncapsulation,
			);
			expect(
				kem.decapsulate(deterministicEncapsulation.ciphertext, deterministicKeyPair.secretKey),
			).toEqual(deterministicEncapsulation.sharedSecret);
		} finally {
			kem.free();
		}
	});

	it("performs real ML-DSA signing and rejects altered signatures and messages", () => {
		const signature = new liboqs.Sig(ML_DSA_ALGORITHM);

		try {
			const details = signature.details();
			expect(details.algorithm).toBe(ML_DSA_ALGORITHM);
			expect(details.claimedNistLevel).toBe(3);
			expect(details.eufCma).toBe(true);
			expect(details.algVersion.length).toBeGreaterThan(0);

			const keyPair = signature.generateKeypair();
			expect(keyPair.publicKey).toHaveLength(details.lengthPublicKey);
			expect(keyPair.secretKey).toHaveLength(details.lengthSecretKey);

			const message = Buffer.from("QNSI real ML-DSA native verification");
			const signedMessage = signature.sign(message, keyPair.secretKey);
			expect(signedMessage.length).toBeGreaterThan(0);
			expect(signedMessage.length).toBeLessThanOrEqual(details.lengthSignature);
			expect(signature.verify(message, signedMessage, keyPair.publicKey)).toBe(true);

			const alteredMessage = Buffer.from(message);
			const firstMessageByte = alteredMessage[0];
			if (firstMessageByte === undefined) {
				throw new Error("ML-DSA test message must contain at least one byte");
			}
			alteredMessage[0] = firstMessageByte ^ 1;
			expect(signature.verify(alteredMessage, signedMessage, keyPair.publicKey)).toBe(false);

			const alteredSignature = Buffer.from(signedMessage);
			const lastSignatureIndex = alteredSignature.length - 1;
			const lastSignatureByte = alteredSignature[lastSignatureIndex];
			if (lastSignatureByte === undefined) {
				throw new Error("ML-DSA signature must contain at least one byte");
			}
			alteredSignature[lastSignatureIndex] = lastSignatureByte ^ 1;
			expect(signature.verify(message, alteredSignature, keyPair.publicKey)).toBe(false);
		} finally {
			signature.free();
		}
	});
});
