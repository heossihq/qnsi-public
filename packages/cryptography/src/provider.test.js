import { describe, expect, it } from "vitest";
import {
	getPqcProvider,
	listPqcProviders,
	registerPqcProvider,
	resolvePqcProvider,
	unregisterPqcProvider,
} from "./provider.js";
import { createDeterministicTestPqcProvider, createTestPqcProvider } from "./testing/providers.js";

describe("@heossi/qnsi-cryptography", () => {
	it("registers and retrieves providers", async () => {
		const provider = createTestPqcProvider();
		registerPqcProvider("test-provider", provider);
		const retrieved = getPqcProvider("test-provider");
		expect(retrieved.name).toContain("test-pqc");
		unregisterPqcProvider("test-provider");
		expect(listPqcProviders()).not.toContain("test-provider");
	});
	it("supports encapsulation, signatures, and hashing", async () => {
		const providerName = "in-memory-provider";
		const provider = createTestPqcProvider();
		registerPqcProvider(providerName, provider);
		const { keyPair } = await provider.generateKeyPair({ algorithm: "kyber-768" });
		const message = new TextEncoder().encode("qnspplatform");
		const capsule = await provider.encapsulate({
			algorithm: "kyber-768",
			publicKey: keyPair.publicKey,
		});
		const sharedSecret = await provider.decapsulate({
			algorithm: "kyber-768",
			privateKey: keyPair.privateKey,
			ciphertext: capsule.ciphertext,
		});
		expect(sharedSecret.byteLength).toBeGreaterThan(0);
		const signature = await provider.sign({
			algorithm: "dilithium-3",
			data: message,
			privateKey: keyPair.privateKey,
		});
		expect(
			await provider.verify({
				algorithm: "dilithium-3",
				data: message,
				signature: signature.signature,
				publicKey: keyPair.publicKey,
			}),
		).toBe(true);
		const digest = await provider.hash(message);
		expect(digest.digest.byteLength).toBeGreaterThan(0);
		unregisterPqcProvider(providerName);
	});
	it("captures metadata when registering providers", () => {
		const providerName = "metadata-provider";
		const provider = createTestPqcProvider();
		const metadata = {
			version: "0.1.0",
			supportedAlgorithms: ["kyber-768", "dilithium-3"],
			implementation: "in-memory-test",
		};
		registerPqcProvider(providerName, provider, metadata);
		const resolved = resolvePqcProvider([providerName]);
		expect(resolved.metadata).toMatchObject(metadata);
		expect(resolved.registeredAt).toBeInstanceOf(Date);
		unregisterPqcProvider(providerName);
	});
	it("creates deterministic providers for reproducible tests", async () => {
		const seed = "qnsp-deterministic-seed";
		const providerA = createDeterministicTestPqcProvider({ seed });
		const providerB = createDeterministicTestPqcProvider({ seed });
		const { keyPair: keyPairA } = await providerA.generateKeyPair({ algorithm: "kyber-768" });
		const { keyPair: keyPairB } = await providerB.generateKeyPair({ algorithm: "kyber-768" });
		expect(keyPairA.publicKey).toEqual(keyPairB.publicKey);
		expect(keyPairA.privateKey).toEqual(keyPairB.privateKey);
		const message = new TextEncoder().encode("deterministic-message");
		const signatureA = await providerA.sign({
			algorithm: "dilithium-3",
			data: message,
			privateKey: keyPairA.privateKey,
		});
		const signatureB = await providerB.sign({
			algorithm: "dilithium-3",
			data: message,
			privateKey: keyPairB.privateKey,
		});
		expect(signatureA.signature).toEqual(signatureB.signature);
		expect(
			await providerB.verify({
				algorithm: "dilithium-3",
				data: message,
				signature: signatureA.signature,
				publicKey: keyPairB.publicKey,
			}),
		).toBe(true);
	});
});
//# sourceMappingURL=provider.test.js.map
