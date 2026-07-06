export type PqcAlgorithm =
	| "kyber-512"
	| "kyber-768"
	| "kyber-1024"
	| "dilithium-2"
	| "dilithium-3"
	| "dilithium-5"
	| "sphincs-sha2-128f-simple"
	| "sphincs-sha2-128s-simple"
	| "sphincs-sha2-192f-simple"
	| "sphincs-sha2-192s-simple"
	| "sphincs-sha2-256f-simple"
	| "sphincs-sha2-256s-simple"
	| "sphincs-shake-128f-simple"
	| "sphincs-shake-128s-simple"
	| "sphincs-shake-192f-simple"
	| "sphincs-shake-192s-simple"
	| "sphincs-shake-256f-simple"
	| "sphincs-shake-256s-simple";

export interface PqcKeyPair {
	readonly algorithm: PqcAlgorithm;
	readonly publicKey: Uint8Array;
	readonly privateKey: Uint8Array;
}

export interface PqcProvider {
	readonly name: string;
	generateKeyPair(input: {
		readonly algorithm: PqcAlgorithm;
	}): Promise<{ readonly keyPair: PqcKeyPair }>;
	encapsulate(input: {
		readonly algorithm: PqcAlgorithm;
		readonly publicKey: Uint8Array;
	}): Promise<{ readonly ciphertext: Uint8Array; readonly sharedSecret: Uint8Array }>;
	decapsulate(input: {
		readonly algorithm: PqcAlgorithm;
		readonly ciphertext: Uint8Array;
		readonly privateKey: Uint8Array;
	}): Promise<Uint8Array>;
	sign(input: {
		readonly algorithm: PqcAlgorithm;
		readonly data: Uint8Array;
		readonly privateKey: Uint8Array;
	}): Promise<{ readonly signature: Uint8Array }>;
	verify(input: {
		readonly algorithm: PqcAlgorithm;
		readonly data: Uint8Array;
		readonly signature: Uint8Array;
		readonly publicKey: Uint8Array;
	}): Promise<boolean>;
}
