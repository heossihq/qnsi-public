import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PqcAlgorithm } from "../provider.js";
import {
	initializeExternalPqcProvider,
	registerExternalPqcProvider,
	unregisterExternalPqcProvider,
} from "./external.js";
import { createLiboqsProviderFactory, registerLiboqsProvider } from "./liboqs.js";

type CapturedOperation = {
	readonly ciphertext: Uint8Array;
	readonly secretKey: Uint8Array;
};

describe("liboqs provider factory", () => {
	const decapsulationCalls: CapturedOperation[] = [];
	const signatureAlgorithms: string[] = [];
	let freedKemInstances = 0;
	let freedSignatureInstances = 0;

	class StubKem {
		readonly algorithm: string;

		constructor(algorithm: string) {
			this.algorithm = algorithm;
		}

		generateKeypair() {
			return {
				publicKey: new Uint8Array([1, 2, 3]),
				secretKey: new Uint8Array([4, 5, 6]),
			};
		}

		encapsulate(publicKey: Uint8Array) {
			expect(Array.from(publicKey)).toStrictEqual([1, 2, 3]);
			return {
				ciphertext: new Uint8Array([7, 8, 9]),
				sharedSecret: new Uint8Array([10, 11, 12]),
			};
		}

		decapsulate(ciphertext: Uint8Array, secretKey: Uint8Array) {
			decapsulationCalls.push({ ciphertext, secretKey });
			return new Uint8Array([13, 14, 15]);
		}

		free() {
			freedKemInstances += 1;
		}
	}

	class StubSignature {
		readonly algorithm: string;

		constructor(algorithm: string) {
			this.algorithm = algorithm;
			signatureAlgorithms.push(algorithm);
		}

		generateKeypair() {
			return {
				publicKey: new Uint8Array([20, 21]),
				secretKey: new Uint8Array([30, 31]),
			};
		}

		sign(message: Uint8Array, secretKey: Uint8Array) {
			expect(Array.from(message)).toStrictEqual([100]);
			expect(Array.from(secretKey)).toStrictEqual([30, 31]);
			return new Uint8Array([200]);
		}

		verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array) {
			expect(Array.from(message)).toStrictEqual([100]);
			expect(Array.from(signature)).toStrictEqual([200]);
			expect(Array.from(publicKey)).toStrictEqual([20, 21]);
			return true;
		}

		free() {
			freedSignatureInstances += 1;
		}
	}

	const stubModule = {
		KEM: StubKem,
		Sig: StubSignature,
		version: () => "1.0.0",
		getSupportedKems: () => ["Kyber512", "Kyber768", "Kyber1024"],
		getSupportedSignatures: () => [
			"Dilithium2",
			"Dilithium3",
			"Dilithium5",
			"Falcon-512",
			"Falcon-1024",
			"SPHINCS+-SHAKE-128f-simple",
			"SLH_DSA_PURE_SHAKE_256F",
		],
	};

	const loadModule = vi.fn(async () => stubModule);

	beforeEach(() => {
		decapsulationCalls.length = 0;
		signatureAlgorithms.length = 0;
		freedKemInstances = 0;
		freedSignatureInstances = 0;
	});

	afterEach(() => {
		unregisterExternalPqcProvider("liboqs");
		registerLiboqsProvider();
	});

	it("exposes metadata for all supported algorithms", () => {
		const factory = createLiboqsProviderFactory({ loadModule });
		expect(factory.metadata.supportedAlgorithms).toEqual(
			expect.arrayContaining([
				"kyber-512",
				"kyber-768",
				"kyber-1024",
				"dilithium-2",
				"dilithium-3",
				"dilithium-5",
				"falcon-512",
				"falcon-1024",
				"sphincs-shake-128f-simple",
				"sphincs-shake-256f-simple",
			]),
		);
	});

	it("creates a provider capable of key encapsulation and signatures", async () => {
		const factory = createLiboqsProviderFactory({ loadModule });
		unregisterExternalPqcProvider("liboqs");
		registerExternalPqcProvider(factory);

		const provider = await initializeExternalPqcProvider("liboqs", {
			internal: true,
			algorithms: ["kyber-512", "dilithium-2"],
		});

		expect(provider.name).toBe("liboqs");

		const { keyPair: kemKeyPair } = await provider.generateKeyPair({ algorithm: "kyber-512" });
		expect(kemKeyPair.algorithm).toBe("kyber-512");
		expect(Array.from(kemKeyPair.publicKey)).toStrictEqual([1, 2, 3]);
		expect(Array.from(kemKeyPair.privateKey)).toStrictEqual([4, 5, 6]);

		const encapsulated = await provider.encapsulate({
			algorithm: "kyber-512",
			publicKey: kemKeyPair.publicKey,
		});
		expect(Array.from(encapsulated.ciphertext)).toStrictEqual([7, 8, 9]);
		expect(Array.from(encapsulated.sharedSecret)).toStrictEqual([10, 11, 12]);

		const decapsulated = await provider.decapsulate({
			algorithm: "kyber-512",
			ciphertext: encapsulated.ciphertext,
			privateKey: kemKeyPair.privateKey,
		});
		expect(Array.from(decapsulated)).toStrictEqual([13, 14, 15]);
		expect(decapsulationCalls).toHaveLength(1);

		const { keyPair: signatureKeyPair } = await provider.generateKeyPair({
			algorithm: "dilithium-2",
		});
		expect(Array.from(signatureKeyPair.publicKey)).toStrictEqual([20, 21]);

		const signature = await provider.sign({
			algorithm: "dilithium-2",
			data: new Uint8Array([100]),
			privateKey: signatureKeyPair.privateKey,
		});
		expect(Array.from(signature.signature)).toStrictEqual([200]);

		const verified = await provider.verify({
			algorithm: "dilithium-2",
			data: new Uint8Array([100]),
			signature: signature.signature,
			publicKey: signatureKeyPair.publicKey,
		});
		expect(verified).toBe(true);

		const hash = await provider.hash(new Uint8Array([1, 2, 3]));
		expect(hash.algorithm).toBe("sha3-256");
		expect(hash.digest).toBeInstanceOf(Uint8Array);

		expect(freedKemInstances).toBeGreaterThanOrEqual(3);
		expect(freedSignatureInstances).toBeGreaterThanOrEqual(3);
	});

	it("uses the liboqs 0.16 identifier for SLH-DSA signatures", async () => {
		const factory = createLiboqsProviderFactory({ loadModule });
		const provider = await factory.create({
			algorithms: ["sphincs-shake-256f-simple"],
		});

		await provider.generateKeyPair({ algorithm: "sphincs-shake-256f-simple" });

		expect(signatureAlgorithms).toContain("SLH_DSA_PURE_SHAKE_256F");
	});

	it("rejects unsupported algorithms", async () => {
		const factory = createLiboqsProviderFactory({
			loadModule,
		});
		await expect(
			factory.create({
				algorithms: ["kyber-512", "kyber-1024", "dilithium-3", "sphincs" as PqcAlgorithm],
			}),
		).rejects.toThrow(/not supported/);
	});
});
