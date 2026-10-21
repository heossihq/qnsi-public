/**
 * All PQC algorithms supported by QNSP via liboqs.
 * Includes NIST FIPS standards (ML-KEM, ML-DSA, SLH-DSA) and additional candidates.
 * Tier-based algorithm enforcement is handled by TenantCryptoPolicyClient.
 */
export type PqcAlgorithm =
	// FIPS 203 - ML-KEM (formerly Kyber)
	| "kyber-512"
	| "kyber-768"
	| "kyber-1024"
	// FIPS 204 - ML-DSA (formerly Dilithium)
	| "dilithium-2"
	| "dilithium-3"
	| "dilithium-5"
	// FIPS 205 - SLH-DSA (formerly SPHINCS+)
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
	| "sphincs-shake-256s-simple"
	// Falcon (NIST selected, awaiting FIPS)
	| "falcon-512"
	| "falcon-1024"
	// NIST Round 4 KEMs
	| "bike-l1"
	| "bike-l3"
	| "bike-l5"
	| "hqc-128"
	| "hqc-192"
	| "hqc-256"
	// Classic McEliece (ISO standard)
	| "mceliece-348864"
	| "mceliece-460896"
	| "mceliece-6688128"
	| "mceliece-6960119"
	| "mceliece-8192128"
	// FrodoKEM (ISO standard)
	| "frodokem-640-aes"
	| "frodokem-640-shake"
	| "frodokem-976-aes"
	| "frodokem-976-shake"
	| "frodokem-1344-aes"
	| "frodokem-1344-shake"
	// NTRU (lattice-based KEM, re-added in liboqs 0.15)
	| "ntru-hps-2048-509"
	| "ntru-hps-2048-677"
	| "ntru-hps-4096-821"
	| "ntru-hps-4096-1229"
	| "ntru-hrss-701"
	| "ntru-hrss-1373"
	// NTRU-Prime (lattice-based KEM)
	| "sntrup761"
	// NIST Additional Signature Round 2
	| "mayo-1"
	| "mayo-2"
	| "mayo-3"
	| "mayo-5"
	| "cross-rsdp-128-balanced"
	| "cross-rsdp-128-fast"
	| "cross-rsdp-128-small"
	| "cross-rsdp-192-balanced"
	| "cross-rsdp-192-fast"
	| "cross-rsdp-192-small"
	| "cross-rsdp-256-balanced"
	| "cross-rsdp-256-fast"
	| "cross-rsdp-256-small"
	| "cross-rsdpg-128-balanced"
	| "cross-rsdpg-128-fast"
	| "cross-rsdpg-128-small"
	| "cross-rsdpg-192-balanced"
	| "cross-rsdpg-192-fast"
	| "cross-rsdpg-192-small"
	| "cross-rsdpg-256-balanced"
	| "cross-rsdpg-256-fast"
	| "cross-rsdpg-256-small"
	// UOV (Unbalanced Oil and Vinegar, NIST Additional Signatures Round 2)
	| "ov-Is"
	| "ov-Ip"
	| "ov-III"
	| "ov-V"
	| "ov-Is-pkc"
	| "ov-Ip-pkc"
	| "ov-III-pkc"
	| "ov-V-pkc"
	| "ov-Is-pkc-skc"
	| "ov-Ip-pkc-skc"
	| "ov-III-pkc-skc"
	| "ov-V-pkc-skc"
	// SNOVA (NIST Additional Signatures Round 2, added in liboqs 0.14)
	| "snova-24-5-4"
	| "snova-24-5-4-shake"
	| "snova-24-5-4-esk"
	| "snova-24-5-4-shake-esk"
	| "snova-25-8-3"
	| "snova-37-17-2"
	| "snova-37-8-4"
	| "snova-24-5-5"
	| "snova-56-25-2"
	| "snova-49-11-3"
	| "snova-60-10-4"
	| "snova-29-6-5";

/**
 * Raised when a PQC algorithm is known to the registry but cannot be used by
 * the loaded provider image (not enabled for the provider, or none of its
 * native aliases is supported by the linked library). Callers map this to a
 * capability failure without matching on message text.
 */
export class PqcAlgorithmUnavailableError extends Error {
	readonly algorithm: string;

	constructor(algorithm: string, message: string) {
		super(message);
		this.name = "PqcAlgorithmUnavailableError";
		this.algorithm = algorithm;
	}
}

export interface GenerateKeyPairOptions {
	readonly algorithm: PqcAlgorithm;
	readonly seed?: Uint8Array;
}

export interface EncapsulateOptions {
	readonly algorithm: PqcAlgorithm;
	readonly publicKey: Uint8Array;
}

export interface DecapsulateOptions {
	readonly algorithm: PqcAlgorithm;
	readonly privateKey: Uint8Array;
	readonly ciphertext: Uint8Array;
}

export interface SignOptions {
	readonly algorithm: PqcAlgorithm;
	readonly data: Uint8Array;
	readonly privateKey: Uint8Array;
}

export interface VerifyOptions {
	readonly algorithm: PqcAlgorithm;
	readonly data: Uint8Array;
	readonly signature: Uint8Array;
	readonly publicKey: Uint8Array;
}

export interface PqcKeyPair {
	readonly publicKey: Uint8Array;
	readonly privateKey: Uint8Array;
	readonly algorithm: PqcAlgorithm;
}

export interface EncapsulationResult {
	readonly ciphertext: Uint8Array;
	readonly sharedSecret: Uint8Array;
}

export interface SignatureResult {
	readonly signature: Uint8Array;
	readonly algorithm: PqcAlgorithm;
}

export interface HashResult {
	readonly digest: Uint8Array;
	readonly algorithm: string;
}

export interface PqcProvider {
	readonly name: string;
	generateKeyPair(options: GenerateKeyPairOptions): Promise<{ keyPair: PqcKeyPair }>;
	encapsulate(options: EncapsulateOptions): Promise<EncapsulationResult>;
	decapsulate(options: DecapsulateOptions): Promise<Uint8Array>;
	sign(options: SignOptions): Promise<SignatureResult>;
	verify(options: VerifyOptions): Promise<boolean>;
	hash(data: Uint8Array, algorithm?: string): Promise<HashResult>;
}

export interface PqcProviderMetadata {
	readonly version?: string;
	readonly supportedAlgorithms?: readonly PqcAlgorithm[];
	readonly implementation?: string;
}

interface RegisteredPqcProvider {
	readonly provider: PqcProvider;
	readonly metadata?: PqcProviderMetadata;
	readonly registeredAt: Date;
}

const providers = new Map<string, RegisteredPqcProvider>();

export function registerPqcProvider(
	name: string,
	provider: PqcProvider,
	metadata?: PqcProviderMetadata,
): void {
	const entry: RegisteredPqcProvider = {
		provider,
		registeredAt: new Date(),
		...(metadata ? { metadata } : {}),
	};

	providers.set(name, entry);
}

export function unregisterPqcProvider(name: string): void {
	providers.delete(name);
}

export function getPqcProvider(name: string): PqcProvider {
	const entry = providers.get(name);

	if (!entry) {
		throw new Error(`PQC provider '${name}' is not registered`);
	}

	return entry.provider;
}

export function listPqcProviders(): ReadonlyArray<string> {
	return Array.from(providers.keys());
}

export interface ResolvedPqcProvider {
	readonly name: string;
	readonly provider: PqcProvider;
	readonly registeredAt: Date;
	readonly metadata?: PqcProviderMetadata;
}

export function resolvePqcProvider(preferred: readonly string[]): ResolvedPqcProvider {
	const preference = preferred.length > 0 ? preferred : listPqcProviders();

	if (preference.length === 0) {
		throw new Error("No PQC providers are registered");
	}

	const missing: string[] = [];

	for (const name of preference) {
		const trimmed = name.trim();
		if (!trimmed) {
			continue;
		}

		const entry = providers.get(trimmed);
		if (entry) {
			const resolved: ResolvedPqcProvider = {
				name: trimmed,
				provider: entry.provider,
				registeredAt: entry.registeredAt,
				...(entry.metadata ? { metadata: entry.metadata } : {}),
			};

			return resolved;
		}

		missing.push(trimmed);
	}

	const available = listPqcProviders();
	throw new Error(
		`Preferred PQC providers [${missing.join(
			", ",
		)}] are not registered. Available providers: ${available.join(", ")}`,
	);
}

export function getPqcProviderMetadata(name: string): PqcProviderMetadata | undefined {
	return providers.get(name)?.metadata;
}
