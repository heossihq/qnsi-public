import { createHash } from "node:crypto";
import { createRequire } from "node:module";

import { z } from "zod";

import type {
	DecapsulateOptions,
	EncapsulateOptions,
	EncapsulationResult,
	GenerateKeyPairOptions,
	HashResult,
	PqcAlgorithm,
	PqcKeyPair,
	PqcProvider,
	SignatureResult,
	SignOptions,
	VerifyOptions,
} from "../provider.js";
import {
	type ExternalPqcProviderFactory,
	type ExternalPqcProviderInitOptions,
	registerExternalPqcProvider,
} from "./external.js";

const DEFAULT_MODULE_ID = "@heossihq/liboqs-native";
const DEFAULT_HASH_ALGORITHM = "sha3-256";

const require = createRequire(import.meta.url);
const runtimeImport = new Function("modulePath", "return import(modulePath);") as (
	modulePath: string,
) => Promise<{ default?: LiboqsModule } | LiboqsModule>;

interface LiboqsPackageMetadata {
	readonly version: string;
	readonly author: string;
}

export function loadLiboqsPackageMetadata(
	load: () => unknown = () => require("@heossihq/liboqs-native/package.json"),
): LiboqsPackageMetadata {
	try {
		const pkg = load() as {
			readonly version?: string;
			readonly liboqsVersion?: string;
			readonly author?: string;
		};
		return {
			version:
				typeof pkg.liboqsVersion === "string"
					? pkg.liboqsVersion
					: typeof pkg.version === "string"
						? pkg.version
						: "unavailable",
			author: typeof pkg.author === "string" ? pkg.author : "Open Quantum Safe",
		};
	} catch {
		return { version: "unavailable", author: "Open Quantum Safe" };
	}
}

const liboqsPackageMetadata = loadLiboqsPackageMetadata();

const liboqsConfigurationSchema = z

	.object({
		moduleId: z.string().min(1).optional(),
	})
	.strict();

/**
 * KEM algorithm mapping from QNSP internal names to liboqs algorithm names.
 * Each entry maps to an array of possible liboqs names (for compatibility across versions).
 * null means the algorithm is not a KEM.
 */
const KEM_ALGORITHM_MAP: Record<PqcAlgorithm, readonly string[] | null> = {
	// FIPS 203 - ML-KEM
	"kyber-512": ["ML-KEM-512", "Kyber512"],
	"kyber-768": ["ML-KEM-768", "Kyber768"],
	"kyber-1024": ["ML-KEM-1024", "Kyber1024"],
	// FIPS 204 - ML-DSA (signatures only)
	"dilithium-2": null,
	"dilithium-3": null,
	"dilithium-5": null,
	// FIPS 205 - SLH-DSA (signatures only)
	"sphincs-sha2-128f-simple": null,
	"sphincs-sha2-128s-simple": null,
	"sphincs-sha2-192f-simple": null,
	"sphincs-sha2-192s-simple": null,
	"sphincs-sha2-256f-simple": null,
	"sphincs-sha2-256s-simple": null,
	"sphincs-shake-128f-simple": null,
	"sphincs-shake-128s-simple": null,
	"sphincs-shake-192f-simple": null,
	"sphincs-shake-192s-simple": null,
	"sphincs-shake-256f-simple": null,
	"sphincs-shake-256s-simple": null,
	// Falcon (signatures only)
	"falcon-512": null,
	"falcon-1024": null,
	// NIST Round 4 KEMs
	"bike-l1": ["BIKE-L1"],
	"bike-l3": ["BIKE-L3"],
	"bike-l5": ["BIKE-L5"],
	// HQC mapped to null = UNAVAILABLE in this build (OQS_ENABLE_KEM_HQC=OFF), pending
	// the 2025-spec rewrite; unpatched CVE-2025-48946. null keeps the exhaustive
	// Record<PqcAlgorithm,...> valid while detectCapabilities() skips it, so HQC is
	// never reported as a supported algorithm. See crypto-policy.ts DISABLED_KEM_ALGORITHMS.
	"hqc-128": null,
	"hqc-192": null,
	"hqc-256": null,
	// Classic McEliece (ISO standard)
	"mceliece-348864": ["Classic-McEliece-348864"],
	"mceliece-460896": ["Classic-McEliece-460896"],
	"mceliece-6688128": ["Classic-McEliece-6688128"],
	"mceliece-6960119": ["Classic-McEliece-6960119"],
	"mceliece-8192128": ["Classic-McEliece-8192128"],
	// FrodoKEM (ISO standard)
	"frodokem-640-aes": ["FrodoKEM-640-AES"],
	"frodokem-640-shake": ["FrodoKEM-640-SHAKE"],
	"frodokem-976-aes": ["FrodoKEM-976-AES"],
	"frodokem-976-shake": ["FrodoKEM-976-SHAKE"],
	"frodokem-1344-aes": ["FrodoKEM-1344-AES"],
	"frodokem-1344-shake": ["FrodoKEM-1344-SHAKE"],
	// NIST Additional Signature Round 2 (signatures only)
	"mayo-1": null,
	"mayo-2": null,
	"mayo-3": null,
	"mayo-5": null,
	"cross-rsdp-128-balanced": null,
	"cross-rsdp-128-fast": null,
	"cross-rsdp-128-small": null,
	"cross-rsdp-192-balanced": null,
	"cross-rsdp-192-fast": null,
	"cross-rsdp-192-small": null,
	"cross-rsdp-256-balanced": null,
	"cross-rsdp-256-fast": null,
	"cross-rsdp-256-small": null,
	"cross-rsdpg-128-balanced": null,
	"cross-rsdpg-128-fast": null,
	"cross-rsdpg-128-small": null,
	"cross-rsdpg-192-balanced": null,
	"cross-rsdpg-192-fast": null,
	"cross-rsdpg-192-small": null,
	"cross-rsdpg-256-balanced": null,
	"cross-rsdpg-256-fast": null,
	"cross-rsdpg-256-small": null,
	// UOV (NIST Additional Signatures Round 2, KEMs only = null)
	"ov-Is": null,
	"ov-Ip": null,
	"ov-III": null,
	"ov-V": null,
	"ov-Is-pkc": null,
	"ov-Ip-pkc": null,
	"ov-III-pkc": null,
	"ov-V-pkc": null,
	"ov-Is-pkc-skc": null,
	"ov-Ip-pkc-skc": null,
	"ov-III-pkc-skc": null,
	"ov-V-pkc-skc": null,
	// SNOVA (NIST Additional Signatures Round 2, signatures only = null)
	"snova-24-5-4": null,
	"snova-24-5-4-shake": null,
	"snova-24-5-4-esk": null,
	"snova-24-5-4-shake-esk": null,
	"snova-25-8-3": null,
	"snova-37-17-2": null,
	"snova-37-8-4": null,
	"snova-24-5-5": null,
	"snova-56-25-2": null,
	"snova-49-11-3": null,
	"snova-60-10-4": null,
	"snova-29-6-5": null,
	// NTRU (lattice-based KEM, re-added in liboqs 0.15)
	"ntru-hps-2048-509": ["NTRU-HPS-2048-509"],
	"ntru-hps-2048-677": ["NTRU-HPS-2048-677"],
	"ntru-hps-4096-821": ["NTRU-HPS-4096-821"],
	"ntru-hps-4096-1229": ["NTRU-HPS-4096-1229"],
	"ntru-hrss-701": ["NTRU-HRSS-701"],
	"ntru-hrss-1373": ["NTRU-HRSS-1373"],
	// NTRU-Prime (lattice-based KEM)
	sntrup761: ["sntrup761"],
};

/**
 * Signature algorithm mapping from QNSP internal names to liboqs algorithm names.
 * Each entry maps to an array of possible liboqs names (for compatibility across versions).
 * null means the algorithm is not a signature scheme.
 */
const SIGNATURE_ALGORITHM_MAP: Record<PqcAlgorithm, readonly string[] | null> = {
	// FIPS 203 - ML-KEM (KEMs only)
	"kyber-512": null,
	"kyber-768": null,
	"kyber-1024": null,
	// FIPS 204 - ML-DSA
	"dilithium-2": ["ML-DSA-44", "Dilithium2"],
	"dilithium-3": ["ML-DSA-65", "Dilithium3"],
	"dilithium-5": ["ML-DSA-87", "Dilithium5"],
	// FIPS 205 - SLH-DSA
	"sphincs-sha2-128f-simple": ["SLH-DSA-SHA2-128f", "SPHINCS+-SHA2-128f-simple"],
	"sphincs-sha2-128s-simple": ["SLH-DSA-SHA2-128s", "SPHINCS+-SHA2-128s-simple"],
	"sphincs-sha2-192f-simple": ["SLH-DSA-SHA2-192f", "SPHINCS+-SHA2-192f-simple"],
	"sphincs-sha2-192s-simple": ["SLH-DSA-SHA2-192s", "SPHINCS+-SHA2-192s-simple"],
	"sphincs-sha2-256f-simple": ["SLH-DSA-SHA2-256f", "SPHINCS+-SHA2-256f-simple"],
	"sphincs-sha2-256s-simple": ["SLH-DSA-SHA2-256s", "SPHINCS+-SHA2-256s-simple"],
	"sphincs-shake-128f-simple": ["SLH-DSA-SHAKE-128f", "SPHINCS+-SHAKE-128f-simple"],
	"sphincs-shake-128s-simple": ["SLH-DSA-SHAKE-128s", "SPHINCS+-SHAKE-128s-simple"],
	"sphincs-shake-192f-simple": ["SLH-DSA-SHAKE-192f", "SPHINCS+-SHAKE-192f-simple"],
	"sphincs-shake-192s-simple": ["SLH-DSA-SHAKE-192s", "SPHINCS+-SHAKE-192s-simple"],
	"sphincs-shake-256f-simple": ["SLH-DSA-SHAKE-256f", "SPHINCS+-SHAKE-256f-simple"],
	"sphincs-shake-256s-simple": ["SLH-DSA-SHAKE-256s", "SPHINCS+-SHAKE-256s-simple"],
	// Falcon (NIST selected)
	"falcon-512": ["Falcon-512"],
	"falcon-1024": ["Falcon-1024"],
	// NIST Round 4 KEMs (KEMs only)
	"bike-l1": null,
	"bike-l3": null,
	"bike-l5": null,
	"hqc-128": null,
	"hqc-192": null,
	"hqc-256": null,
	// Classic McEliece (KEMs only)
	"mceliece-348864": null,
	"mceliece-460896": null,
	"mceliece-6688128": null,
	"mceliece-6960119": null,
	"mceliece-8192128": null,
	// FrodoKEM (KEMs only)
	"frodokem-640-aes": null,
	"frodokem-640-shake": null,
	"frodokem-976-aes": null,
	"frodokem-976-shake": null,
	"frodokem-1344-aes": null,
	"frodokem-1344-shake": null,
	// NIST Additional Signature Round 2
	"mayo-1": ["MAYO-1"],
	"mayo-2": ["MAYO-2"],
	"mayo-3": ["MAYO-3"],
	"mayo-5": ["MAYO-5"],
	"cross-rsdp-128-balanced": ["CROSS-RSDP-128-balanced"],
	"cross-rsdp-128-fast": ["CROSS-RSDP-128-fast"],
	"cross-rsdp-128-small": ["CROSS-RSDP-128-small"],
	"cross-rsdp-192-balanced": ["CROSS-RSDP-192-balanced"],
	"cross-rsdp-192-fast": ["CROSS-RSDP-192-fast"],
	"cross-rsdp-192-small": ["CROSS-RSDP-192-small"],
	"cross-rsdp-256-balanced": ["CROSS-RSDP-256-balanced"],
	"cross-rsdp-256-fast": ["CROSS-RSDP-256-fast"],
	"cross-rsdp-256-small": ["CROSS-RSDP-256-small"],
	"cross-rsdpg-128-balanced": ["CROSS-RSDPG-128-balanced"],
	"cross-rsdpg-128-fast": ["CROSS-RSDPG-128-fast"],
	"cross-rsdpg-128-small": ["CROSS-RSDPG-128-small"],
	"cross-rsdpg-192-balanced": ["CROSS-RSDPG-192-balanced"],
	"cross-rsdpg-192-fast": ["CROSS-RSDPG-192-fast"],
	"cross-rsdpg-192-small": ["CROSS-RSDPG-192-small"],
	"cross-rsdpg-256-balanced": ["CROSS-RSDPG-256-balanced"],
	"cross-rsdpg-256-fast": ["CROSS-RSDPG-256-fast"],
	"cross-rsdpg-256-small": ["CROSS-RSDPG-256-small"],
	// UOV (NIST Additional Signatures Round 2)
	"ov-Is": ["OV-Is"],
	"ov-Ip": ["OV-Ip"],
	"ov-III": ["OV-III"],
	"ov-V": ["OV-V"],
	"ov-Is-pkc": ["OV-Is-pkc"],
	"ov-Ip-pkc": ["OV-Ip-pkc"],
	"ov-III-pkc": ["OV-III-pkc"],
	"ov-V-pkc": ["OV-V-pkc"],
	"ov-Is-pkc-skc": ["OV-Is-pkc-skc"],
	"ov-Ip-pkc-skc": ["OV-Ip-pkc-skc"],
	"ov-III-pkc-skc": ["OV-III-pkc-skc"],
	"ov-V-pkc-skc": ["OV-V-pkc-skc"],
	// SNOVA (NIST Additional Signatures Round 2)
	"snova-24-5-4": ["SNOVA_24_5_4"],
	"snova-24-5-4-shake": ["SNOVA_24_5_4_SHAKE"],
	"snova-24-5-4-esk": ["SNOVA_24_5_4_esk"],
	"snova-24-5-4-shake-esk": ["SNOVA_24_5_4_SHAKE_esk"],
	"snova-25-8-3": ["SNOVA_25_8_3"],
	"snova-37-17-2": ["SNOVA_37_17_2"],
	"snova-37-8-4": ["SNOVA_37_8_4"],
	"snova-24-5-5": ["SNOVA_24_5_5"],
	"snova-56-25-2": ["SNOVA_56_25_2"],
	"snova-49-11-3": ["SNOVA_49_11_3"],
	"snova-60-10-4": ["SNOVA_60_10_4"],
	"snova-29-6-5": ["SNOVA_29_6_5"],
	// NTRU (KEMs only)
	"ntru-hps-2048-509": null,
	"ntru-hps-2048-677": null,
	"ntru-hps-4096-821": null,
	"ntru-hps-4096-1229": null,
	"ntru-hrss-701": null,
	"ntru-hrss-1373": null,
	// NTRU-Prime (KEMs only)
	sntrup761: null,
};

type KemAlgorithm = keyof typeof KEM_ALGORITHM_MAP;
type SignatureAlgorithm = keyof typeof SIGNATURE_ALGORITHM_MAP;

interface LiboqsKem {
	generateKeypair(): { publicKey: Uint8Array; secretKey: Uint8Array };
	encapsulate(publicKey: Uint8Array): { ciphertext: Uint8Array; sharedSecret: Uint8Array };
	decapsulate(ciphertext: Uint8Array, secretKey: Uint8Array): Uint8Array;
	free?: () => void;
}

interface LiboqsSignature {
	generateKeypair(): { publicKey: Uint8Array; secretKey: Uint8Array };
	sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array;
	verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;
	free?: () => void;
}

interface LiboqsModule {
	readonly version?: () => string | undefined;
	readonly KEM: new (algorithm: string) => LiboqsKem;
	readonly Sig: new (algorithm: string) => LiboqsSignature;
	readonly getSupportedKems?: () => readonly string[];
	readonly getSupportedSignatures?: () => readonly string[];
	readonly isKemAlgorithmSupported?: (algorithm: string) => boolean;
	readonly isSignatureAlgorithmSupported?: (algorithm: string) => boolean;
}

interface LiboqsFactoryDependencies {
	readonly loadModule?: (moduleId: string) => Promise<LiboqsModule>;
}

interface LiboqsCapabilities {
	readonly kem: Set<KemAlgorithm>;
	readonly signatures: Set<SignatureAlgorithm>;
}

interface DefaultModuleNamespace {
	readonly default?: LiboqsModule;
}

/**
 * Algorithms that exist in the PqcAlgorithm union + retain code paths, but are NOT
 * offered because the liboqs build cannot perform them safely. HQC: disabled upstream
 * (OQS_ENABLE_KEM_HQC=OFF) pending the 2025-spec rewrite; unpatched CVE-2025-48946.
 * Kept local (not imported from @heossihq/qnsi-security) to avoid a cryptography→security
 * dependency cycle; the canonical list is crypto-policy.ts DISABLED_KEM_ALGORITHMS.
 */
const DISABLED_ALGORITHMS: ReadonlySet<PqcAlgorithm> = new Set(["hqc-128", "hqc-192", "hqc-256"]);

/**
 * All PQC algorithms supported by QNSP via liboqs.
 * Derived from the keys of KEM_ALGORITHM_MAP, minus DISABLED_ALGORITHMS.
 */
const SUPPORTED_ALGORITHMS: readonly PqcAlgorithm[] = (
	Object.keys(KEM_ALGORITHM_MAP) as PqcAlgorithm[]
).filter((algorithm) => !DISABLED_ALGORITHMS.has(algorithm));

export function normalizeUint8Array(value: Uint8Array): Uint8Array {
	return value instanceof Uint8Array ? value : Uint8Array.from(value);
}

export function resolveImportedModule(
	imported: LiboqsModule | DefaultModuleNamespace,
): LiboqsModule {
	if ("default" in imported && imported.default) {
		return imported.default;
	}
	return imported as LiboqsModule;
}

const LIBOQS_MISSING_MESSAGE =
	"@heossihq/liboqs-native is not installed. " +
	"It is an optional dependency of @heossihq/qnsi-cryptography that is only distributed via GitHub Packages. " +
	"To enable the native liboqs provider, configure an .npmrc scope mapping " +
	"(echo '@heossi:registry=https://npm.pkg.github.com' >> .npmrc) and run " +
	"`npm install @heossihq/liboqs-native`. " +
	"Alternatively, use the pure-JS noble provider via " +
	"`initializeExternalPqcProvider('noble')`, which is always available.";

export function isModuleNotFoundError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}
	const code = (error as NodeJS.ErrnoException).code;
	return (
		code === "ERR_MODULE_NOT_FOUND" ||
		code === "MODULE_NOT_FOUND" ||
		code === "ERR_PACKAGE_PATH_NOT_EXPORTED"
	);
}

export async function defaultLoadModule(
	moduleId: string,
	importModule: typeof runtimeImport = runtimeImport,
	importDefault: () => Promise<LiboqsModule | DefaultModuleNamespace> = async () =>
		(await import("@heossihq/liboqs-native")) as LiboqsModule | DefaultModuleNamespace,
): Promise<LiboqsModule> {
	try {
		const imported: LiboqsModule | DefaultModuleNamespace =
			moduleId === DEFAULT_MODULE_ID ? await importDefault() : await importModule(moduleId);
		return resolveImportedModule(imported);
	} catch (error) {
		if (moduleId === DEFAULT_MODULE_ID && isModuleNotFoundError(error)) {
			throw new Error(LIBOQS_MISSING_MESSAGE, { cause: error });
		}
		throw error;
	}
}

function ensureKemAlgorithm(algorithm: PqcAlgorithm): asserts algorithm is KemAlgorithm {
	if (KEM_ALGORITHM_MAP[algorithm] === null) {
		throw new Error(`Algorithm '${algorithm}' is not a KEM algorithm in liboqs`);
	}
}

function ensureSignatureAlgorithm(
	algorithm: PqcAlgorithm,
): asserts algorithm is SignatureAlgorithm {
	if (SIGNATURE_ALGORITHM_MAP[algorithm] === null) {
		throw new Error(`Algorithm '${algorithm}' is not a signature algorithm in liboqs`);
	}
}

function withKemInstance<T>(
	liboqs: LiboqsModule,
	algorithm: KemAlgorithm,
	fn: (kem: LiboqsKem) => T,
): T {
	const kem = new liboqs.KEM(resolveKemAlias(liboqs, algorithm));
	try {
		return fn(kem);
	} finally {
		kem.free?.();
	}
}

function withSignatureInstance<T>(
	liboqs: LiboqsModule,
	algorithm: SignatureAlgorithm,
	fn: (sig: LiboqsSignature) => T,
): T {
	const signature = new liboqs.Sig(resolveSignatureAlias(liboqs, algorithm));
	try {
		return fn(signature);
	} finally {
		signature.free?.();
	}
}

function detectCapabilities(liboqs: LiboqsModule): LiboqsCapabilities {
	const kem = new Set<KemAlgorithm>();
	const signatures = new Set<SignatureAlgorithm>();

	for (const algorithm of SUPPORTED_ALGORITHMS) {
		const kemAliases = KEM_ALGORITHM_MAP[algorithm];
		if (kemAliases) {
			const supported = kemAliases.some((alias) => isKemSupported(liboqs, alias));
			if (supported) {
				kem.add(algorithm as KemAlgorithm);
			}
			continue;
		}

		const signatureAliases = SIGNATURE_ALGORITHM_MAP[algorithm];
		if (signatureAliases?.some((alias) => isSignatureSupported(liboqs, alias))) {
			signatures.add(algorithm as SignatureAlgorithm);
		}
	}

	return { kem, signatures };
}

export function isKemSupported(liboqs: LiboqsModule, algorithm: string): boolean {
	if (typeof liboqs.isKemAlgorithmSupported === "function") {
		return liboqs.isKemAlgorithmSupported(algorithm);
	}

	const supportedList = liboqs.getSupportedKems?.();
	if (Array.isArray(supportedList)) {
		return supportedList.includes(algorithm);
	}

	try {
		withKemInstance(liboqs, toInternalKemAlgorithm(algorithm), () => undefined);
		return true;
	} catch {
		return false;
	}
}

export function isSignatureSupported(liboqs: LiboqsModule, algorithm: string): boolean {
	if (typeof liboqs.isSignatureAlgorithmSupported === "function") {
		return liboqs.isSignatureAlgorithmSupported(algorithm);
	}

	const supportedList = liboqs.getSupportedSignatures?.();
	if (Array.isArray(supportedList)) {
		return supportedList.includes(algorithm);
	}

	try {
		withSignatureInstance(liboqs, toInternalSignatureAlgorithm(algorithm), () => undefined);
		return true;
	} catch {
		return false;
	}
}

export function toInternalKemAlgorithm(algorithm: string): KemAlgorithm {
	const entry = Object.entries(KEM_ALGORITHM_MAP).find(
		([, value]) => Array.isArray(value) && value.includes(algorithm),
	);
	if (!entry) {
		throw new Error(`Unsupported liboqs KEM algorithm identifier '${algorithm}'`);
	}
	return entry[0] as KemAlgorithm;
}

export function toInternalSignatureAlgorithm(algorithm: string): SignatureAlgorithm {
	const entry = Object.entries(SIGNATURE_ALGORITHM_MAP).find(
		([, value]) => Array.isArray(value) && value.includes(algorithm),
	);
	if (!entry) {
		throw new Error(`Unsupported liboqs signature algorithm identifier '${algorithm}'`);
	}
	return entry[0] as SignatureAlgorithm;
}

export function resolveKemAlias(liboqs: LiboqsModule, algorithm: KemAlgorithm): string {
	const aliases = KEM_ALGORITHM_MAP[algorithm];
	if (!aliases || aliases.length === 0) {
		throw new Error(`No liboqs aliases defined for KEM algorithm '${algorithm}'`);
	}

	for (const alias of aliases) {
		try {
			// Quick instantiation check without leaking instances.
			const instance = new liboqs.KEM(alias);
			instance.free?.();
			return alias;
		} catch {
			// try next alias
		}
	}

	throw new Error(
		`None of the aliases (${aliases.join(", ")}) are supported for KEM '${algorithm}'`,
	);
}

export function resolveSignatureAlias(liboqs: LiboqsModule, algorithm: SignatureAlgorithm): string {
	const aliases = SIGNATURE_ALGORITHM_MAP[algorithm];
	if (!aliases || aliases.length === 0) {
		throw new Error(`No liboqs aliases defined for signature algorithm '${algorithm}'`);
	}

	for (const alias of aliases) {
		try {
			const instance = new liboqs.Sig(alias);
			instance.free?.();
			return alias;
		} catch {
			// try next alias
		}
	}

	throw new Error(
		`None of the aliases (${aliases.join(", ")}) are supported for signature algorithm '${algorithm}'`,
	);
}

function createProvider(liboqs: LiboqsModule, allowed: ReadonlySet<PqcAlgorithm>): PqcProvider {
	const allowedAlgorithms = new Set(allowed);

	const ensureAllowed = (algorithm: PqcAlgorithm): void => {
		if (!allowedAlgorithms.has(algorithm)) {
			throw new Error(`Algorithm '${algorithm}' is not enabled for this liboqs provider`);
		}
	};

	return {
		name: "liboqs",

		async generateKeyPair({
			algorithm,
			seed,
		}: GenerateKeyPairOptions): Promise<{ keyPair: PqcKeyPair }> {
			ensureAllowed(algorithm);

			if (KEM_ALGORITHM_MAP[algorithm]) {
				ensureKemAlgorithm(algorithm);
				return withKemInstance(liboqs, algorithm, (kem) => {
					if (seed) {
						throw new Error("Seeded KEM key generation is not supported by liboqs");
					}
					const { publicKey, secretKey } = kem.generateKeypair();
					return {
						keyPair: {
							algorithm,
							publicKey: normalizeUint8Array(publicKey),
							privateKey: normalizeUint8Array(secretKey),
						},
					};
				});
			}

			ensureSignatureAlgorithm(algorithm);
			return withSignatureInstance(liboqs, algorithm, (sig) => {
				if (seed) {
					throw new Error("Seeded signature key generation is not supported by liboqs");
				}
				const { publicKey, secretKey } = sig.generateKeypair();
				return {
					keyPair: {
						algorithm,
						publicKey: normalizeUint8Array(publicKey),
						privateKey: normalizeUint8Array(secretKey),
					},
				};
			});
		},

		async encapsulate({ algorithm, publicKey }: EncapsulateOptions): Promise<EncapsulationResult> {
			ensureAllowed(algorithm);
			ensureKemAlgorithm(algorithm);

			return withKemInstance(liboqs, algorithm, (kem) => {
				const { ciphertext, sharedSecret } = kem.encapsulate(normalizeUint8Array(publicKey));
				return {
					ciphertext: normalizeUint8Array(ciphertext),
					sharedSecret: normalizeUint8Array(sharedSecret),
				};
			});
		},

		async decapsulate({
			algorithm,
			privateKey,
			ciphertext,
		}: DecapsulateOptions): Promise<Uint8Array> {
			ensureAllowed(algorithm);
			ensureKemAlgorithm(algorithm);

			return withKemInstance(liboqs, algorithm, (kem) =>
				normalizeUint8Array(
					kem.decapsulate(normalizeUint8Array(ciphertext), normalizeUint8Array(privateKey)),
				),
			);
		},

		async sign({ algorithm, data, privateKey }: SignOptions): Promise<SignatureResult> {
			ensureAllowed(algorithm);
			ensureSignatureAlgorithm(algorithm);

			return withSignatureInstance(liboqs, algorithm, (sig) => {
				const signature = sig.sign(normalizeUint8Array(data), normalizeUint8Array(privateKey));
				return {
					signature: normalizeUint8Array(signature),
					algorithm,
				};
			});
		},

		async verify({ algorithm, data, signature, publicKey }: VerifyOptions): Promise<boolean> {
			ensureAllowed(algorithm);
			ensureSignatureAlgorithm(algorithm);

			return withSignatureInstance(liboqs, algorithm, (sig) =>
				sig.verify(
					normalizeUint8Array(data),
					normalizeUint8Array(signature),
					normalizeUint8Array(publicKey),
				),
			);
		},

		async hash(data: Uint8Array, algorithm = DEFAULT_HASH_ALGORITHM): Promise<HashResult> {
			const digest = createHash(algorithm).update(data).digest();
			return {
				digest: normalizeUint8Array(digest),
				algorithm,
			};
		},
	};
}

function validateRequestedAlgorithms(
	requested: readonly PqcAlgorithm[] | undefined,
	capabilities: LiboqsCapabilities,
): Set<PqcAlgorithm> {
	if (!requested || requested.length === 0) {
		return new Set<PqcAlgorithm>([...capabilities.kem, ...capabilities.signatures]);
	}

	const result = new Set<PqcAlgorithm>();

	for (const algorithm of requested) {
		if (
			capabilities.kem.has(algorithm as KemAlgorithm) ||
			capabilities.signatures.has(algorithm as SignatureAlgorithm)
		) {
			result.add(algorithm);
			continue;
		}

		throw new Error(
			`Algorithm '${algorithm}' is not supported by the liboqs module in this environment`,
		);
	}

	return result;
}

function resolveModuleId(options?: ExternalPqcProviderInitOptions): string {
	const configuration = liboqsConfigurationSchema.parse(options?.configuration ?? {});
	return configuration.moduleId ?? DEFAULT_MODULE_ID;
}

export function createLiboqsProviderFactory(
	dependencies: LiboqsFactoryDependencies = {},
): ExternalPqcProviderFactory {
	const loadModule = dependencies.loadModule ?? defaultLoadModule;

	return {
		metadata: {
			name: "liboqs",
			author: liboqsPackageMetadata.author,
			supportedAlgorithms: SUPPORTED_ALGORITHMS,
			version: liboqsPackageMetadata.version,
		},
		probe: async () => {
			const moduleId = resolveModuleId();
			await loadModule(moduleId);
			return true;
		},
		create: async (options) => {
			const moduleId = resolveModuleId(options);
			const liboqs = await loadModule(moduleId);
			const capabilities = detectCapabilities(liboqs);
			const allowed = validateRequestedAlgorithms(options?.algorithms, capabilities);

			if (allowed.size === 0) {
				throw new Error("No liboqs algorithms are available with the current module configuration");
			}

			return createProvider(liboqs, allowed);
		},
	};
}

export const liboqsProviderFactory = createLiboqsProviderFactory();

export function registerLiboqsProvider(): void {
	registerExternalPqcProvider(liboqsProviderFactory);
}

registerLiboqsProvider();
