import { generateKeyPairSync, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	canonicalPreimage,
	canonicalPreimageBytes,
	publicKeyFingerprint,
	publicKeysFromDocument,
	signFactsDocument,
	stableStringify,
	verifyFactsSignature,
} from "./index.js";

const pem = (key: KeyObject): string =>
	key.export({
		type: key.type === "private" ? "pkcs8" : "spki",
		format: "pem",
	}) as string;

describe("product facts signature protocol", () => {
	it("canonicalizes recursively and omits the top-level signature", () => {
		expect(stableStringify({ z: [2, { b: true, a: null }], a: "first" })).toBe(
			'{"a":"first","z":[2,{"a":null,"b":true}]}',
		);
		expect(canonicalPreimage({ z: 2, signature: { ignored: true }, a: 1 })).toBe('{"a":1,"z":2}');
	});

	it("rejects unsupported canonical values and non-finite numbers", () => {
		for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(() => stableStringify(value)).toThrow(/finite numbers/);
		}
		for (const value of [undefined, 1n, Symbol("x"), () => undefined]) {
			expect(() => stableStringify(value)).toThrow(/does not support/);
		}
		expect(canonicalPreimageBytes({ value: true })).toEqual(Buffer.from('{"value":true}', "utf8"));
	});

	it("validates the published key document shape and fingerprints both key forms", () => {
		const ed25519 = generateKeyPairSync("ed25519");
		expect(publicKeyFingerprint(ed25519.publicKey)).toBe(
			publicKeyFingerprint(pem(ed25519.publicKey)),
		);
		for (const invalid of [
			null,
			{},
			{ algorithms: null },
			{ algorithms: { "ML-DSA-65": {}, Ed25519: null } },
			{ algorithms: { "ML-DSA-65": { publicKeyPem: 1 }, Ed25519: { publicKeyPem: "x" } } },
			{ algorithms: { "ML-DSA-65": { publicKeyPem: "x" }, Ed25519: { publicKeyPem: 1 } } },
		]) {
			expect(() => publicKeysFromDocument(invalid)).toThrow();
		}
	});

	it("fails closed for every malformed signature field and key mismatch", () => {
		const mldsa = generateKeyPairSync("ml-dsa-65");
		const ed25519 = generateKeyPairSync("ed25519");
		const keysUrl = "https://example.test/keys";
		const unsigned = { product: "QNSI", count: 1 };
		const signature = signFactsDocument(unsigned, {
			mldsaPrivateKeyPem: pem(mldsa.privateKey),
			ed25519PrivateKeyPem: pem(ed25519.privateKey),
			keysUrl,
			signedAt: "2026-08-14T00:00:00.000Z",
		});
		const document = { ...unsigned, signature };
		const keys = {
			mldsaPublicKeyPem: pem(mldsa.publicKey),
			ed25519PublicKeyPem: pem(ed25519.publicKey),
		};
		const malformed: object[] = [
			unsigned,
			{ ...document, signature: { ...signature, canonicalization: "other" } },
			{ ...document, signature: { ...signature, keysUrl: 1 } },
			{ ...document, signature: { ...signature, algorithms: null } },
			{
				...document,
				signature: { ...signature, algorithms: { ...signature.algorithms, Ed25519: null } },
			},
			{
				...document,
				signature: {
					...signature,
					algorithms: {
						...signature.algorithms,
						"ML-DSA-65": { ...signature.algorithms["ML-DSA-65"], signature: 1 },
					},
				},
			},
			{
				...document,
				signature: {
					...signature,
					algorithms: {
						...signature.algorithms,
						Ed25519: { ...signature.algorithms.Ed25519, signature: 1 },
					},
				},
			},
			{
				...document,
				signature: {
					...signature,
					algorithms: {
						...signature.algorithms,
						"ML-DSA-65": { ...signature.algorithms["ML-DSA-65"], publicKeyFingerprint: 1 },
					},
				},
			},
			{
				...document,
				signature: {
					...signature,
					algorithms: {
						...signature.algorithms,
						Ed25519: { ...signature.algorithms.Ed25519, publicKeyFingerprint: 1 },
					},
				},
			},
		];
		for (const candidate of malformed) {
			expect(verifyFactsSignature(candidate, keys, keysUrl).ok).toBe(false);
		}

		const wrongMldsa = generateKeyPairSync("ml-dsa-65");
		const wrongEd25519 = generateKeyPairSync("ed25519");
		expect(
			verifyFactsSignature(
				document,
				{ ...keys, mldsaPublicKeyPem: pem(wrongMldsa.publicKey) },
				keysUrl,
			).ok,
		).toBe(false);
		expect(
			verifyFactsSignature(
				document,
				{ ...keys, ed25519PublicKeyPem: pem(wrongEd25519.publicKey) },
				keysUrl,
			).ok,
		).toBe(false);
		expect(
			verifyFactsSignature(document, { ...keys, mldsaPublicKeyPem: "invalid" }, keysUrl).reason,
		).toMatch(/verification error/);
	});

	it("reports each individual proof failure", () => {
		const mldsa = generateKeyPairSync("ml-dsa-65");
		const ed25519 = generateKeyPairSync("ed25519");
		const unsigned = { product: "QNSI" };
		const signature = signFactsDocument(unsigned, {
			mldsaPrivateKeyPem: pem(mldsa.privateKey),
			ed25519PrivateKeyPem: pem(ed25519.privateKey),
			keysUrl: "https://example.test/keys",
			signedAt: "2026-08-14T00:00:00.000Z",
		});
		const keys = {
			mldsaPublicKeyPem: pem(mldsa.publicKey),
			ed25519PublicKeyPem: pem(ed25519.publicKey),
		};
		const corrupt = (value: string) =>
			Buffer.concat([Buffer.from(value, "base64"), Buffer.from([0])]).toString("base64");
		const badMldsa = {
			...unsigned,
			signature: {
				...signature,
				algorithms: {
					...signature.algorithms,
					"ML-DSA-65": {
						...signature.algorithms["ML-DSA-65"],
						signature: corrupt(signature.algorithms["ML-DSA-65"].signature),
					},
				},
			},
		};
		const badEd25519 = {
			...unsigned,
			signature: {
				...signature,
				algorithms: {
					...signature.algorithms,
					Ed25519: {
						...signature.algorithms.Ed25519,
						signature: corrupt(signature.algorithms.Ed25519.signature),
					},
				},
			},
		};
		expect(verifyFactsSignature(badMldsa, keys)).toMatchObject({
			mldsa: false,
			ed25519: true,
			ok: false,
		});
		expect(verifyFactsSignature(badEd25519, keys)).toMatchObject({
			mldsa: true,
			ed25519: false,
			ok: false,
		});
	});

	it("executes and verifies both ML-DSA-65 and Ed25519 signatures", () => {
		const mldsa = generateKeyPairSync("ml-dsa-65");
		const ed25519 = generateKeyPairSync("ed25519");
		const keysUrl = "https://example.test/.well-known/facts-signing-key";
		const unsigned = { schemaVersion: "1.0", product: "QNSI", count: 7 };
		const signature = signFactsDocument(unsigned, {
			mldsaPrivateKeyPem: pem(mldsa.privateKey),
			ed25519PrivateKeyPem: pem(ed25519.privateKey),
			keysUrl,
			signedAt: "2026-07-27T00:00:00.000Z",
		});
		const document = { ...unsigned, signature };
		const keys = publicKeysFromDocument({
			algorithms: {
				"ML-DSA-65": { publicKeyPem: pem(mldsa.publicKey) },
				Ed25519: { publicKeyPem: pem(ed25519.publicKey) },
			},
		});

		expect(verifyFactsSignature(document, keys, keysUrl)).toMatchObject({
			mldsa: true,
			ed25519: true,
			ok: true,
		});
		expect(verifyFactsSignature({ ...document, count: 8 }, keys, keysUrl)).toMatchObject({
			ok: false,
		});
		expect(verifyFactsSignature(document, keys, "https://attacker.test/keys")).toMatchObject({
			ok: false,
		});
	});
});
