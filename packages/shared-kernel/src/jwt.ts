import type { PqcAlgorithm, PqcProvider } from "@heossihq/qnsi-cryptography";
import { listPqcProviders, resolvePqcProvider } from "@heossihq/qnsi-cryptography";
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("@heossihq/qnsi-shared-kernel");
const jwtVerificationsCounter = meter.createCounter("pqc_jwt_verifications_total", {
	description: "Total PQC JWT verification attempts by algorithm and outcome",
});

export interface JwtHeader {
	readonly alg: string;
	readonly typ: "JWT";
	readonly kid?: string;
}

export interface JwtPayload {
	readonly [key: string]: unknown;
	readonly iss?: string;
	readonly sub?: string;
	readonly aud?: string | string[];
	readonly exp?: number;
	readonly nbf?: number;
	readonly iat?: number;
	readonly jti?: string;
}

export interface JwtSignOptions {
	readonly payload: JwtPayload;
	readonly algorithm: PqcAlgorithm;
	readonly privateKey: Uint8Array;
	readonly keyId?: string;
	readonly provider?: PqcProvider;
}

export interface JwtVerifyOptions {
	readonly token: string;
	readonly publicKey: Uint8Array;
	readonly algorithm?: PqcAlgorithm;
	readonly provider?: PqcProvider;
}

export interface JwtVerificationResult {
	readonly valid: boolean;
	readonly payload?: JwtPayload;
	readonly header?: JwtHeader;
	readonly error?: string;
}

/**
 * Base64URL encodes a buffer or string
 */
function base64UrlEncode(data: Uint8Array | string): string {
	const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
	return Buffer.from(buffer)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}

/**
 * Base64URL decodes a string
 */
function base64UrlDecode(input: string): Uint8Array {
	const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
	const padding = (4 - (base64.length % 4)) % 4;
	const padded = base64 + "=".repeat(padding);
	return new Uint8Array(Buffer.from(padded, "base64"));
}

/**
 * Parses a JWT token into its components
 */
function parseJwt(token: string): {
	header: JwtHeader;
	payload: JwtPayload;
	signature: Uint8Array;
	signingInput: string;
} {
	const parts = token.split(".");
	if (parts.length !== 3) {
		throw new Error("Invalid JWT format: expected 3 parts separated by dots");
	}

	const headerB64 = parts[0];
	const payloadB64 = parts[1];
	const signatureB64 = parts[2];

	if (!headerB64 || !payloadB64 || !signatureB64) {
		throw new Error("Invalid JWT format: missing header, payload, or signature");
	}

	let header: JwtHeader;
	let payload: JwtPayload;

	try {
		const headerJson = new TextDecoder().decode(base64UrlDecode(headerB64));
		header = JSON.parse(headerJson) as JwtHeader;
	} catch (error) {
		throw new Error(
			`Failed to parse JWT header: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	try {
		const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
		payload = JSON.parse(payloadJson) as JwtPayload;
	} catch (error) {
		throw new Error(
			`Failed to parse JWT payload: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const signature = base64UrlDecode(signatureB64);

	return { header, payload, signature, signingInput: `${headerB64}.${payloadB64}` };
}

/**
 * Maps PQC algorithm to JWT algorithm identifier
 */
function algorithmToJwtAlg(algorithm: PqcAlgorithm): string {
	const mapping: Partial<Record<PqcAlgorithm, string>> = {
		// FIPS 204 - ML-DSA (primary JWT signing algorithms)
		"dilithium-2": "Dilithium2",
		"dilithium-3": "Dilithium3",
		"dilithium-5": "Dilithium5",
		// Falcon
		"falcon-512": "Falcon512",
		"falcon-1024": "Falcon1024",
		// FIPS 205 - SLH-DSA
		"sphincs-shake-128f-simple": "SPHINCS+-SHAKE-128f-simple",
		"sphincs-shake-256f-simple": "SPHINCS+-SHAKE-256f-simple",
		// KEMs (not signature algorithms, but included for completeness)
		"kyber-512": "Kyber512",
		"kyber-768": "Kyber768",
		"kyber-1024": "Kyber1024",
	};

	return mapping[algorithm] ?? algorithm;
}

/**
 * Maps JWT algorithm identifier to PQC algorithm
 */
function jwtAlgToAlgorithm(jwtAlg: string): PqcAlgorithm | null {
	const mapping: Record<string, PqcAlgorithm> = {
		Dilithium2: "dilithium-2",
		Dilithium3: "dilithium-3",
		Dilithium5: "dilithium-5",
		Falcon512: "falcon-512",
		Falcon1024: "falcon-1024",
		"SPHINCS+-SHAKE-128f-simple": "sphincs-shake-128f-simple",
		"SPHINCS+-SHAKE-256f-simple": "sphincs-shake-256f-simple",
	};

	return mapping[jwtAlg] ?? null;
}

/**
 * Signs a JWT token using PQC signature algorithm (e.g., Dilithium)
 */
export async function signJwt(options: JwtSignOptions): Promise<string> {
	const { payload, algorithm, privateKey, keyId, provider } = options;

	// Create header
	const header: JwtHeader = {
		alg: algorithmToJwtAlg(algorithm),
		typ: "JWT",
		...(keyId !== undefined && keyId !== null ? { kid: keyId } : {}),
	};

	// Encode header and payload
	const headerB64 = base64UrlEncode(JSON.stringify(header));
	const payloadB64 = base64UrlEncode(JSON.stringify(payload));

	// Create the signing input: header.payload
	const signingInput = `${headerB64}.${payloadB64}`;
	const signingInputBytes = new TextEncoder().encode(signingInput);

	// Sign using PQC provider
	let pqcProvider: PqcProvider | undefined = provider;
	if (!pqcProvider) {
		const registered = listPqcProviders();
		if (registered.length === 0) {
			throw new Error("No PQC provider available for JWT signing");
		}
		const resolved = resolvePqcProvider(registered);
		pqcProvider = resolved.provider;
	}

	const signatureResult = await pqcProvider.sign({
		algorithm,
		data: signingInputBytes,
		privateKey,
	});

	// Encode signature
	const signatureB64 = base64UrlEncode(signatureResult.signature);

	// Return complete JWT: header.payload.signature
	return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Verifies a JWT token signed with PQC signature algorithm
 */
export async function verifyJwt(options: JwtVerifyOptions): Promise<JwtVerificationResult> {
	const { token, publicKey, algorithm, provider } = options;

	try {
		const { header, payload, signature, signingInput } = parseJwt(token);

		// Check token type
		if (header.typ !== "JWT") {
			return {
				valid: false,
				error: `Invalid token type: expected 'JWT', got '${header.typ}'`,
			};
		}

		// Determine algorithm from header or options
		const jwtAlg = header.alg;
		const pqcAlgorithm = algorithm ?? jwtAlgToAlgorithm(jwtAlg);

		if (!pqcAlgorithm) {
			return {
				valid: false,
				error: `Unsupported JWT algorithm: ${jwtAlg}`,
			};
		}

		const signingInputBytes = new TextEncoder().encode(signingInput);

		// Verify signature using PQC provider
		let pqcProvider: PqcProvider | undefined = provider;
		if (!pqcProvider) {
			const registered = listPqcProviders();
			if (registered.length === 0) {
				return {
					valid: false,
					error: "No PQC provider available for JWT verification",
				};
			}
			const resolved = resolvePqcProvider(registered);
			pqcProvider = resolved.provider;
		}

		const verified = await pqcProvider.verify({
			algorithm: pqcAlgorithm,
			data: signingInputBytes,
			signature,
			publicKey,
		});

		if (!verified) {
			jwtVerificationsCounter.add(1, {
				algorithm: pqcAlgorithm,
				provider: pqcProvider.name,
				outcome: "signature_invalid",
			});
			return {
				valid: false,
				error: "JWT signature verification failed",
			};
		}

		// Check expiration if present
		if (payload.exp !== undefined) {
			const now = Math.floor(Date.now() / 1000);
			if (payload.exp < now) {
				jwtVerificationsCounter.add(1, {
					algorithm: pqcAlgorithm,
					provider: pqcProvider.name,
					outcome: "expired",
				});
				return {
					valid: false,
					error: "JWT token has expired",
					payload,
					header,
				};
			}
		}

		// Check not-before if present
		if (payload.nbf !== undefined) {
			const now = Math.floor(Date.now() / 1000);
			if (payload.nbf > now) {
				jwtVerificationsCounter.add(1, {
					algorithm: pqcAlgorithm,
					provider: pqcProvider.name,
					outcome: "not_yet_valid",
				});
				return {
					valid: false,
					error: "JWT token is not yet valid",
					payload,
					header,
				};
			}
		}

		jwtVerificationsCounter.add(1, {
			algorithm: pqcAlgorithm,
			provider: pqcProvider.name,
			outcome: "success",
		});

		return {
			valid: true,
			payload,
			header,
		};
	} catch (error) {
		jwtVerificationsCounter.add(1, {
			algorithm: algorithm ?? "unknown",
			provider: provider?.name ?? "unknown",
			outcome: "error",
		});
		return {
			valid: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Verifier adapter interface for services that need to verify JWTs
 */
export interface JwtVerifier {
	verify(
		token: string,
		publicKey: Uint8Array,
		algorithm?: PqcAlgorithm,
	): Promise<JwtVerificationResult>;
}

/**
 * Creates a JWT verifier adapter
 */
export function createJwtVerifier(provider?: PqcProvider): JwtVerifier {
	return {
		async verify(token: string, publicKey: Uint8Array, algorithm?: PqcAlgorithm) {
			return verifyJwt({
				token,
				publicKey,
				...(algorithm !== undefined ? { algorithm } : {}),
				...(provider !== undefined ? { provider } : {}),
			});
		},
	};
}
