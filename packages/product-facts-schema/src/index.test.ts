import { generateKeyPairSync, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	canonicalPreimage,
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
