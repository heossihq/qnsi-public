/**
 * X-Wing - the NIST SP 800-227 worked-example hybrid (composite) KEM:
 * ML-KEM-768 + X25519 with a SHA3-256 combiner (draft-connolly-cfrg-xwing-kem).
 *
 * This is QNSI's OWN from-spec implementation (injected ML-KEM + Node X25519 +
 * SHA3-256), independent of any single library. It is cross-verified against a
 * second independent implementation (@noble/post-quantum) in xwing.test.ts -
 * two independent implementations agreeing IS the spec-compliance proof, and
 * cross-verification is QNSI's crypto strategy (crypto-provider-strategy.md).
 *
 * Why hybrid (2026-2030): SP 800-227 permits a hybrid ONLY as an approved
 * composite; X-Wing is the finalization's worked example. It gives
 * defense-in-depth during the PQC transition - an attacker must break BOTH
 * ML-KEM-768 AND X25519. The classical X25519 half is only ever inside this
 * approved composite, never the sole KEM (nist-approved-pqc-only.md §3).
 *
 * Key/ciphertext sizes (verified against the draft):
 *   encapsulation key : 1216 B  (1184 ML-KEM-768 pk + 32 X25519 pk)
 *   ciphertext        : 1120 B  (1088 ML-KEM-768 ct + 32 X25519 ephemeral pk)
 *   shared secret     :   32 B
 * The private key here is the EXPANDED form (ML-KEM sk ‖ X25519 sk ‖ X25519 pk);
 * the draft's 32-byte seed is a compact serialization - functionally equivalent.
 */
import {
	createHash,
	createPrivateKey,
	createPublicKey,
	diffieHellman,
	generateKeyPairSync,
	type KeyObject,
} from "node:crypto";

/** The X25519 recipient/ephemeral public key + ML-KEM KEM primitive (injected). */
export interface MlKem768Kem {
	keygen(): { publicKey: Uint8Array; secretKey: Uint8Array };
	encapsulate(publicKey: Uint8Array): { cipherText: Uint8Array; sharedSecret: Uint8Array };
	decapsulate(cipherText: Uint8Array, secretKey: Uint8Array): Uint8Array;
}

// draft-connolly-cfrg-xwing-kem: XWingLabel = concat("\./","/^\") = 6 bytes.
const XWING_LABEL = Buffer.from("5c2e2f2f5e5c", "hex");
const MLKEM768_PK = 1184;
const MLKEM768_CT = 1088;
const X25519_RAW = 32;
export const XWING_SIZES = { encapsulationKey: 1216, ciphertext: 1120, sharedSecret: 32 } as const;

// Raw X25519 <-> Node KeyObject via the fixed SPKI/PKCS8 DER prefixes.
const X25519_SPKI = Buffer.from("302a300506032b656e032100", "hex");
const X25519_PKCS8 = Buffer.from("302e020100300506032b656e04220420", "hex");
function x25519PubFromRaw(raw: Uint8Array): KeyObject {
	return createPublicKey({
		key: Buffer.concat([X25519_SPKI, Buffer.from(raw)]),
		format: "der",
		type: "spki",
	});
}
function x25519PrivFromRaw(raw: Uint8Array): KeyObject {
	return createPrivateKey({
		key: Buffer.concat([X25519_PKCS8, Buffer.from(raw)]),
		format: "der",
		type: "pkcs8",
	});
}
function x25519RawPub(key: KeyObject): Buffer {
	return key.export({ type: "spki", format: "der" }).subarray(-X25519_RAW);
}
function x25519RawPriv(key: KeyObject): Buffer {
	return key.export({ type: "pkcs8", format: "der" }).subarray(-X25519_RAW);
}

/** SS = SHA3-256(ss_ML-KEM ‖ ss_X25519 ‖ ct_X25519 ‖ pk_X25519 ‖ XWingLabel). */
function combiner(ssM: Uint8Array, ssX: Uint8Array, ctX: Uint8Array, pkX: Uint8Array): Buffer {
	return createHash("sha3-256")
		.update(
			Buffer.concat([
				Buffer.from(ssM),
				Buffer.from(ssX),
				Buffer.from(ctX),
				Buffer.from(pkX),
				XWING_LABEL,
			]),
		)
		.digest();
}

export function xwingKeygen(mlkem: MlKem768Kem): { publicKey: Uint8Array; secretKey: Uint8Array } {
	const m = mlkem.keygen();
	const { publicKey: xPub, privateKey: xPriv } = generateKeyPairSync("x25519");
	const xPubRaw = x25519RawPub(xPub);
	const xPrivRaw = x25519RawPriv(xPriv);
	return {
		publicKey: Buffer.concat([Buffer.from(m.publicKey), xPubRaw]), // 1216
		secretKey: Buffer.concat([Buffer.from(m.secretKey), xPrivRaw, xPubRaw]), // ml sk ‖ x sk ‖ x pk
	};
}

export function xwingEncapsulate(
	mlkem: MlKem768Kem,
	publicKey: Uint8Array,
): { cipherText: Uint8Array; sharedSecret: Uint8Array } {
	if (publicKey.length !== XWING_SIZES.encapsulationKey) {
		throw new Error(`XWING_BAD_PUBLIC_KEY_LEN: ${publicKey.length}`);
	}
	const pk = Buffer.from(publicKey);
	const mlkemPk = pk.subarray(0, MLKEM768_PK);
	const xPk = pk.subarray(MLKEM768_PK); // 32
	const enc = mlkem.encapsulate(mlkemPk);
	// Ephemeral X25519, DH against the recipient's X25519 public key.
	const { publicKey: ePub, privateKey: ePriv } = generateKeyPairSync("x25519");
	const ctX = x25519RawPub(ePub);
	const ssX = diffieHellman({ publicKey: x25519PubFromRaw(xPk), privateKey: ePriv });
	const sharedSecret = combiner(enc.sharedSecret, ssX, ctX, xPk);
	return { cipherText: Buffer.concat([Buffer.from(enc.cipherText), ctX]), sharedSecret }; // 1120
}

export function xwingDecapsulate(
	mlkem: MlKem768Kem,
	cipherText: Uint8Array,
	secretKey: Uint8Array,
): Uint8Array {
	if (cipherText.length !== XWING_SIZES.ciphertext) {
		throw new Error(`XWING_BAD_CIPHERTEXT_LEN: ${cipherText.length}`);
	}
	const ct = Buffer.from(cipherText);
	const mlkemCt = ct.subarray(0, MLKEM768_CT);
	const ctX = ct.subarray(MLKEM768_CT); // 32
	const sk = Buffer.from(secretKey);
	const mlkemSk = sk.subarray(0, sk.length - 2 * X25519_RAW);
	const xPrivRaw = sk.subarray(sk.length - 2 * X25519_RAW, sk.length - X25519_RAW);
	const xPk = sk.subarray(sk.length - X25519_RAW);
	const ssM = mlkem.decapsulate(mlkemCt, mlkemSk);
	const ssX = diffieHellman({
		publicKey: x25519PubFromRaw(ctX),
		privateKey: x25519PrivFromRaw(xPrivRaw),
	});
	return combiner(ssM, ssX, ctX, xPk);
}
