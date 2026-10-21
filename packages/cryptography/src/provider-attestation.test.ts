import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PqcAlgorithm, PqcProviderMetadata } from "./provider.js";
import { getPqcProviderMetadata, registerPqcProvider, unregisterPqcProvider } from "./provider.js";
import {
	type CryptoOperationType,
	createProviderAttestation,
	getProviderImplementationType,
	type ProviderImplementationType,
} from "./provider-attestation.js";
import { createTestPqcProvider } from "./testing/providers.js";

describe("getProviderImplementationType", () => {
	it("classifies liboqs as native", () => {
		expect(getProviderImplementationType("liboqs")).toBe(
			"native" satisfies ProviderImplementationType,
		);
	});

	it("classifies noble as pure-js", () => {
		expect(getProviderImplementationType("noble")).toBe(
			"pure-js" satisfies ProviderImplementationType,
		);
	});

	it("classifies oqsprovider as openssl", () => {
		expect(getProviderImplementationType("oqsprovider")).toBe(
			"openssl" satisfies ProviderImplementationType,
		);
	});

	it("classifies deterministic-pqc as pure-js", () => {
		expect(getProviderImplementationType("deterministic-pqc")).toBe(
			"pure-js" satisfies ProviderImplementationType,
		);
	});

	it("falls back to native for unknown providers", () => {
		expect(getProviderImplementationType("some-unknown-provider")).toBe(
			"native" satisfies ProviderImplementationType,
		);
	});

	it("falls back to native for empty string", () => {
		expect(getProviderImplementationType("")).toBe("native" satisfies ProviderImplementationType);
	});
});

describe("createProviderAttestation", () => {
	describe("basic attestation", () => {
		it("creates a complete attestation for liboqs keygen", () => {
			const attestation = createProviderAttestation({
				providerName: "liboqs",
				algorithm: "kyber-768",
				operation: "keygen",
			});

			expect(attestation).toEqual(
				expect.objectContaining({
					providerName: "liboqs",
					providerVersion: null,
					implementationType: "native",
					algorithm: "kyber-768",
					operation: "keygen",
					crossVerified: false,
					crossVerificationProvider: null,
					crossVerificationImplementationType: null,
					crossVerificationResult: null,
				}),
			);
			expect(attestation.timestamp).toEqual(expect.any(String));
		});

		it("creates attestation for noble sign", () => {
			const attestation = createProviderAttestation({
				providerName: "noble",
				algorithm: "dilithium-3",
				operation: "sign",
			});

			expect(attestation.providerName).toBe("noble");
			expect(attestation.implementationType).toBe("pure-js");
			expect(attestation.algorithm).toBe("dilithium-3");
			expect(attestation.operation).toBe("sign");
			expect(attestation.crossVerified).toBe(false);
		});

		it("propagates version from provider metadata", () => {
			const metadata: PqcProviderMetadata = { version: "0.15.0" };
			const attestation = createProviderAttestation({
				providerName: "liboqs",
				providerMetadata: metadata,
				algorithm: "kyber-1024",
				operation: "encapsulate",
			});

			expect(attestation.providerVersion).toBe("0.15.0");
		});

		it("sets version to null when metadata is undefined", () => {
			const attestation = createProviderAttestation({
				providerName: "liboqs",
				providerMetadata: undefined,
				algorithm: "kyber-768",
				operation: "keygen",
			});

			expect(attestation.providerVersion).toBeNull();
		});

		it("sets version to null when metadata has no version field", () => {
			const metadata: PqcProviderMetadata = {
				supportedAlgorithms: ["kyber-768"],
			};
			const attestation = createProviderAttestation({
				providerName: "liboqs",
				providerMetadata: metadata,
				algorithm: "kyber-768",
				operation: "keygen",
			});

			expect(attestation.providerVersion).toBeNull();
		});

		it("produces a valid ISO 8601 timestamp", () => {
			const before = new Date().toISOString();
			const attestation = createProviderAttestation({
				providerName: "liboqs",
				algorithm: "kyber-768",
				operation: "keygen",
			});
			const after = new Date().toISOString();

			const parsed = new Date(attestation.timestamp);
			expect(parsed.toISOString()).toBe(attestation.timestamp);
			expect(attestation.timestamp >= before).toBe(true);
			expect(attestation.timestamp <= after).toBe(true);
		});

		it.each<CryptoOperationType>([
			"keygen",
			"encapsulate",
			"decapsulate",
			"sign",
			"verify",
			"hash",
		])("supports operation type: %s", (operation) => {
			const attestation = createProviderAttestation({
				providerName: "liboqs",
				algorithm: "kyber-768",
				operation,
			});

			expect(attestation.operation).toBe(operation);
		});

		it.each<PqcAlgorithm>(["kyber-512", "kyber-768", "kyber-1024"])(
			"supports FIPS KEM algorithm: %s",
			(algorithm) => {
				const attestation = createProviderAttestation({
					providerName: "liboqs",
					algorithm,
					operation: "keygen",
				});

				expect(attestation.algorithm).toBe(algorithm);
			},
		);

		it.each<PqcAlgorithm>([
			"dilithium-2",
			"dilithium-3",
			"dilithium-5",
			"sphincs-sha2-128f-simple",
			"sphincs-sha2-256f-simple",
			"sphincs-shake-256s-simple",
		])("supports FIPS signature algorithm: %s", (algorithm) => {
			const attestation = createProviderAttestation({
				providerName: "liboqs",
				algorithm,
				operation: "sign",
			});

			expect(attestation.algorithm).toBe(algorithm);
		});
	});

	describe("cross-verification", () => {
		it("records cross-verification match", () => {
			const attestation = createProviderAttestation({
				providerName: "liboqs",
				algorithm: "dilithium-3",
				operation: "sign",
				crossVerification: {
					providerName: "noble",
					result: "match",
				},
			});

			expect(attestation.crossVerified).toBe(true);
			expect(attestation.crossVerificationProvider).toBe("noble");
			expect(attestation.crossVerificationImplementationType).toBe("pure-js");
			expect(attestation.crossVerificationResult).toBe("match");
		});

		it("records cross-verification mismatch", () => {
			const attestation = createProviderAttestation({
				providerName: "liboqs",
				algorithm: "dilithium-5",
				operation: "verify",
				crossVerification: {
					providerName: "noble",
					result: "mismatch",
				},
			});

			expect(attestation.crossVerified).toBe(true);
			expect(attestation.crossVerificationResult).toBe("mismatch");
		});

		it("classifies oqsprovider cross-verification type as openssl", () => {
			const attestation = createProviderAttestation({
				providerName: "liboqs",
				algorithm: "dilithium-3",
				operation: "sign",
				crossVerification: {
					providerName: "oqsprovider",
					result: "match",
				},
			});

			expect(attestation.crossVerificationImplementationType).toBe("openssl");
		});

		it("sets cross-verification fields to null when crossVerification is undefined", () => {
			const attestation = createProviderAttestation({
				providerName: "liboqs",
				algorithm: "kyber-768",
				operation: "keygen",
				crossVerification: undefined,
			});

			expect(attestation.crossVerified).toBe(false);
			expect(attestation.crossVerificationProvider).toBeNull();
			expect(attestation.crossVerificationImplementationType).toBeNull();
			expect(attestation.crossVerificationResult).toBeNull();
		});
	});

	describe("integration with provider registry", () => {
		const providerName = "test-attestation-provider";

		beforeEach(() => {
			const provider = createTestPqcProvider();
			const metadata: PqcProviderMetadata = { version: "1.2.3" };
			registerPqcProvider(providerName, provider, metadata);
		});

		afterEach(() => {
			unregisterPqcProvider(providerName);
		});

		it("flows registered provider metadata version into attestation", () => {
			const metadata = getPqcProviderMetadata(providerName);
			const attestation = createProviderAttestation({
				providerName,
				providerMetadata: metadata,
				algorithm: "dilithium-3",
				operation: "sign",
			});

			expect(attestation.providerVersion).toBe("1.2.3");
			expect(attestation.providerName).toBe(providerName);
		});
	});
});
