import { XWing } from "@noble/post-quantum/hybrid.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { describe, expect, it } from "vitest";
import {
	type MlKem768Kem,
	XWING_SIZES,
	xwingDecapsulate,
	xwingEncapsulate,
	xwingKeygen,
} from "./xwing.js";

/**
 * X-Wing (SP 800-227 composite KEM) correctness + spec-compliance proof.
 *
 * QNSI's from-spec implementation is CROSS-VERIFIED against a second independent
 * implementation (@noble/post-quantum's XWing). Bidirectional interop -
 * my-encaps→noble-decaps and noble-encaps→my-decaps producing identical shared
 * secrets - proves the combiner, byte layout, and label match the draft exactly.
 * (If my combiner were wrong, my own roundtrip would still pass but the
 * cross-checks would fail.) The ML-KEM primitive is injected; here it is noble's
 * ml_kem768.
 */
const mlkem: MlKem768Kem = {
	keygen: () => ml_kem768.keygen(),
	encapsulate: (pk) => ml_kem768.encapsulate(pk),
	decapsulate: (ct, sk) => ml_kem768.decapsulate(ct, sk),
};
const eq = (a: Uint8Array, b: Uint8Array) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

describe("X-Wing composite KEM (ML-KEM-768 + X25519, SP 800-227)", () => {
	it("has the spec sizes and round-trips", () => {
		const kp = xwingKeygen(mlkem);
		expect(kp.publicKey.length).toBe(XWING_SIZES.encapsulationKey); // 1216
		const enc = xwingEncapsulate(mlkem, kp.publicKey);
		expect(enc.cipherText.length).toBe(XWING_SIZES.ciphertext); // 1120
		expect(enc.sharedSecret.length).toBe(XWING_SIZES.sharedSecret); // 32
		const ss2 = xwingDecapsulate(mlkem, enc.cipherText, kp.secretKey);
		expect(eq(enc.sharedSecret, ss2)).toBe(true);
	});

	it("cross-verify: QNSI encaps → noble decaps yields the same shared secret", () => {
		// noble owns the keypair; QNSI encapsulates against noble's public key;
		// noble decapsulates QNSI's ciphertext. Match ⇒ QNSI's encaps + combiner
		// are spec-exact (an independent impl agrees).
		const kp = XWing.keygen();
		const enc = xwingEncapsulate(mlkem, kp.publicKey);
		const ssNoble = XWing.decapsulate(enc.cipherText, kp.secretKey);
		expect(eq(enc.sharedSecret, ssNoble)).toBe(true);
	});

	it("cross-verify: noble encaps → QNSI decaps yields the same shared secret", () => {
		// QNSI owns the keypair; noble encapsulates against QNSI's public key;
		// QNSI decapsulates noble's ciphertext. Match ⇒ QNSI's decaps + combiner
		// are spec-exact.
		const kp = xwingKeygen(mlkem);
		const enc = XWing.encapsulate(kp.publicKey);
		const ssQnsi = xwingDecapsulate(mlkem, enc.cipherText, kp.secretKey);
		expect(eq(enc.sharedSecret, ssQnsi)).toBe(true);
	});

	it("fail-closed: a tampered ciphertext yields a different shared secret", () => {
		const kp = xwingKeygen(mlkem);
		const enc = xwingEncapsulate(mlkem, kp.publicKey);
		const bad = Buffer.from(enc.cipherText);
		bad[0] = (bad[0] ?? 0) ^ 0xff;
		const ss2 = xwingDecapsulate(mlkem, bad, kp.secretKey);
		expect(eq(enc.sharedSecret, ss2)).toBe(false);
	});

	it("rejects malformed public keys and ciphertexts before cryptographic use", () => {
		expect(() => xwingEncapsulate(mlkem, new Uint8Array(1))).toThrow("XWING_BAD_PUBLIC_KEY_LEN: 1");
		expect(() => xwingDecapsulate(mlkem, new Uint8Array(1), new Uint8Array(1))).toThrow(
			"XWING_BAD_CIPHERTEXT_LEN: 1",
		);
	});
});
