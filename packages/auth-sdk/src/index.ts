import { performance } from "node:perf_hooks";

import { activateSdk, type SdkActivationConfig } from "@heossihq/qnsi-sdk-activation";

import type {
	AuthClientTelemetry,
	AuthClientTelemetryConfig,
	AuthClientTelemetryEvent,
} from "./observability.js";
import { createAuthClientTelemetry, isAuthClientTelemetry } from "./observability.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";
import { validateEmail, validateUUID } from "./validation.js";

/**
 * @heossihq/qnsi-auth-sdk
 *
 * TypeScript SDK client for the QNSP auth-service API.
 * Provides a high-level interface for authentication, token management, WebAuthn, MFA, and federation.
 * All tokens are signed with tenant-specific PQC algorithms based on crypto policy.
 */

/**
 * PQC metadata for cryptographic operations.
 */
export interface PqcSignatureMetadata {
	readonly provider: string;
	readonly algorithm: string;
	readonly algorithmNist?: string;
}

/**
 * Mapping from internal algorithm names to NIST/standards display names.
 * Covers all 87 runtime-supported PQC algorithms (24 KEMs + 63 signatures).
 * HQC's 3 variants are excluded (disabled in the liboqs build for CVE-2025-48946).
 * Canonical source: @heossihq/qnsi-cryptography pqc-standards.ts ALGORITHM_NIST_NAMES
 */
export const ALGORITHM_TO_NIST: Record<string, string> = {
	// FIPS 203 - ML-KEM
	"kyber-512": "ML-KEM-512",
	"kyber-768": "ML-KEM-768",
	"kyber-1024": "ML-KEM-1024",
	// FIPS 204 - ML-DSA
	"dilithium-2": "ML-DSA-44",
	"dilithium-3": "ML-DSA-65",
	"dilithium-5": "ML-DSA-87",
	// FIPS 205 - SLH-DSA (SHA-2 variants)
	"sphincs-sha2-128f-simple": "SLH-DSA-SHA2-128f",
	"sphincs-sha2-128s-simple": "SLH-DSA-SHA2-128s",
	"sphincs-sha2-192f-simple": "SLH-DSA-SHA2-192f",
	"sphincs-sha2-192s-simple": "SLH-DSA-SHA2-192s",
	"sphincs-sha2-256f-simple": "SLH-DSA-SHA2-256f",
	"sphincs-sha2-256s-simple": "SLH-DSA-SHA2-256s",
	// FIPS 205 - SLH-DSA (SHAKE variants)
	"sphincs-shake-128f-simple": "SLH-DSA-SHAKE-128f",
	"sphincs-shake-128s-simple": "SLH-DSA-SHAKE-128s",
	"sphincs-shake-192f-simple": "SLH-DSA-SHAKE-192f",
	"sphincs-shake-192s-simple": "SLH-DSA-SHAKE-192s",
	"sphincs-shake-256f-simple": "SLH-DSA-SHAKE-256f",
	"sphincs-shake-256s-simple": "SLH-DSA-SHAKE-256s",
	// FN-DSA (FIPS 206 draft)
	"falcon-512": "FN-DSA-512",
	"falcon-1024": "FN-DSA-1024",
	// HQC (NIST selected March 2025)
	// BIKE (NIST Round 4)
	"bike-l1": "BIKE-L1",
	"bike-l3": "BIKE-L3",
	"bike-l5": "BIKE-L5",
	// Classic McEliece (ISO standard)
	"mceliece-348864": "Classic-McEliece-348864",
	"mceliece-460896": "Classic-McEliece-460896",
	"mceliece-6688128": "Classic-McEliece-6688128",
	"mceliece-6960119": "Classic-McEliece-6960119",
	"mceliece-8192128": "Classic-McEliece-8192128",
	// FrodoKEM (ISO standard)
	"frodokem-640-aes": "FrodoKEM-640-AES",
	"frodokem-640-shake": "FrodoKEM-640-SHAKE",
	"frodokem-976-aes": "FrodoKEM-976-AES",
	"frodokem-976-shake": "FrodoKEM-976-SHAKE",
	"frodokem-1344-aes": "FrodoKEM-1344-AES",
	"frodokem-1344-shake": "FrodoKEM-1344-SHAKE",
	// NTRU (lattice-based, re-added in liboqs 0.15)
	"ntru-hps-2048-509": "NTRU-HPS-2048-509",
	"ntru-hps-2048-677": "NTRU-HPS-2048-677",
	"ntru-hps-4096-821": "NTRU-HPS-4096-821",
	"ntru-hps-4096-1229": "NTRU-HPS-4096-1229",
	"ntru-hrss-701": "NTRU-HRSS-701",
	"ntru-hrss-1373": "NTRU-HRSS-1373",
	// NTRU-Prime
	sntrup761: "sntrup761",
	// MAYO (NIST Additional Signatures Round 2)
	"mayo-1": "MAYO-1",
	"mayo-2": "MAYO-2",
	"mayo-3": "MAYO-3",
	"mayo-5": "MAYO-5",
	// CROSS (NIST Additional Signatures Round 2)
	"cross-rsdp-128-balanced": "CROSS-RSDP-128-balanced",
	"cross-rsdp-128-fast": "CROSS-RSDP-128-fast",
	"cross-rsdp-128-small": "CROSS-RSDP-128-small",
	"cross-rsdp-192-balanced": "CROSS-RSDP-192-balanced",
	"cross-rsdp-192-fast": "CROSS-RSDP-192-fast",
	"cross-rsdp-192-small": "CROSS-RSDP-192-small",
	"cross-rsdp-256-balanced": "CROSS-RSDP-256-balanced",
	"cross-rsdp-256-fast": "CROSS-RSDP-256-fast",
	"cross-rsdp-256-small": "CROSS-RSDP-256-small",
	"cross-rsdpg-128-balanced": "CROSS-RSDPG-128-balanced",
	"cross-rsdpg-128-fast": "CROSS-RSDPG-128-fast",
	"cross-rsdpg-128-small": "CROSS-RSDPG-128-small",
	"cross-rsdpg-192-balanced": "CROSS-RSDPG-192-balanced",
	"cross-rsdpg-192-fast": "CROSS-RSDPG-192-fast",
	"cross-rsdpg-192-small": "CROSS-RSDPG-192-small",
	"cross-rsdpg-256-balanced": "CROSS-RSDPG-256-balanced",
	"cross-rsdpg-256-fast": "CROSS-RSDPG-256-fast",
	"cross-rsdpg-256-small": "CROSS-RSDPG-256-small",
	// UOV (NIST Additional Signatures Round 2)
	"ov-Is": "UOV-Is",
	"ov-Ip": "UOV-Ip",
	"ov-III": "UOV-III",
	"ov-V": "UOV-V",
	"ov-Is-pkc": "UOV-Is-pkc",
	"ov-Ip-pkc": "UOV-Ip-pkc",
	"ov-III-pkc": "UOV-III-pkc",
	"ov-V-pkc": "UOV-V-pkc",
	"ov-Is-pkc-skc": "UOV-Is-pkc-skc",
	"ov-Ip-pkc-skc": "UOV-Ip-pkc-skc",
	"ov-III-pkc-skc": "UOV-III-pkc-skc",
	"ov-V-pkc-skc": "UOV-V-pkc-skc",
	// SNOVA (NIST Additional Signatures Round 2, liboqs 0.14+)
	"snova-24-5-4": "SNOVA-24-5-4",
	"snova-24-5-4-shake": "SNOVA-24-5-4-SHAKE",
	"snova-24-5-4-esk": "SNOVA-24-5-4-ESK",
	"snova-24-5-4-shake-esk": "SNOVA-24-5-4-SHAKE-ESK",
	"snova-25-8-3": "SNOVA-25-8-3",
	"snova-37-17-2": "SNOVA-37-17-2",
	"snova-37-8-4": "SNOVA-37-8-4",
	"snova-24-5-5": "SNOVA-24-5-5",
	"snova-56-25-2": "SNOVA-56-25-2",
	"snova-49-11-3": "SNOVA-49-11-3",
	"snova-60-10-4": "SNOVA-60-10-4",
	"snova-29-6-5": "SNOVA-29-6-5",
};

/**
 * Convert internal algorithm name to NIST standardized name.
 */
export function toNistAlgorithmName(algorithm: string): string {
	return ALGORITHM_TO_NIST[algorithm] ?? algorithm;
}

/** Default QNSP cloud API base URL. Get a free API key at https://cloud.qnsi.heossi.com/signup */
export const DEFAULT_BASE_URL = "https://api.qnsi.heossi.com";

export interface AuthClientConfig {
	readonly baseUrl?: string;
	readonly apiKey: string;
	readonly timeoutMs?: number;
	readonly telemetry?: AuthClientTelemetry | AuthClientTelemetryConfig;
	readonly maxRetries?: number;
	readonly retryDelayMs?: number;
}

type InternalAuthClientConfig = {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly timeoutMs: number;
	readonly maxRetries: number;
	readonly retryDelayMs: number;
};

export interface TokenPair {
	readonly accessToken: string;
	readonly refreshToken: {
		readonly token: string;
		readonly metadata: {
			readonly tokenId: string;
			readonly subjectId: string;
			readonly tenantId: string;
			readonly roles: readonly string[];
			readonly audience: string;
			readonly expiresAt: string;
			readonly createdAt: string;
		};
	} | null;
}

export interface LoginRequest {
	readonly email: string;
	readonly password: string;
	readonly tenantId: string;
	readonly totp?: string;
	readonly audience?: string;
}

export interface RefreshTokenRequest {
	readonly refreshToken: string;
	readonly audience?: string;
}

export interface WebAuthnRegistrationStartRequest {
	readonly userId: string;
	readonly tenantId: string;
}

export interface WebAuthnRegistrationStartResponse {
	readonly options: {
		readonly challenge: string;
		readonly rp: {
			readonly id: string;
			readonly name: string;
		};
		readonly user: {
			readonly id: string;
			readonly name: string;
			readonly displayName: string;
		};
		readonly pubKeyCredParams: readonly {
			readonly type: string;
			readonly alg: number;
		}[];
		readonly timeout?: number;
		readonly attestation?: string;
		readonly excludeCredentials?: readonly {
			readonly id: string;
			readonly type: string;
		}[];
	};
	readonly challengeId: string;
}

export interface WebAuthnRegistrationCompleteRequest {
	readonly userId: string;
	readonly tenantId: string;
	readonly challengeId: string;
	readonly response: unknown; // PublicKeyCredential from WebAuthn API
}

export interface WebAuthnRegistrationCompleteResponse {
	readonly credential: {
		readonly id: string;
		readonly credentialId: string;
		readonly deviceType: string;
		readonly deviceName: string;
		readonly createdAt: string;
	};
}

export interface WebAuthnAuthenticationStartRequest {
	readonly userId?: string;
	readonly email?: string;
	readonly tenantId: string;
}

export interface WebAuthnAuthenticationStartResponse {
	readonly options: {
		readonly challenge: string;
		readonly rpId: string;
		readonly timeout?: number;
		readonly allowCredentials?: readonly {
			readonly id: string;
			readonly type: string;
		}[];
		readonly userVerification?: string;
	};
	readonly challengeId: string;
	readonly userId: string;
}

export interface ServiceTokenClientConfig {
	readonly authServiceUrl: string;
	readonly serviceId: string;
	readonly serviceSecret: string;
	readonly audience?: string;
	readonly timeoutMs?: number;
}

export interface ServiceTokenResponse {
	readonly accessToken: string;
}

export interface WebAuthnAuthenticationCompleteRequest {
	readonly userId?: string;
	readonly email?: string;
	readonly tenantId: string;
	readonly challengeId: string;
	readonly response: unknown; // PublicKeyCredential from WebAuthn API
}

export interface WebAuthnAuthenticationCompleteResponse {
	readonly accessToken: string;
	readonly refreshToken: {
		readonly token: string;
		readonly metadata: {
			readonly tokenId: string;
			readonly subjectId: string;
			readonly tenantId: string;
			readonly roles: readonly string[];
			readonly audience: string;
			readonly expiresAt: string;
			readonly createdAt: string;
		};
	} | null;
	readonly verified: boolean;
	readonly userId: string;
}

export interface WebAuthnCredential {
	readonly id: string;
	readonly credentialId: string;
	readonly deviceType: string;
	readonly deviceName: string;
	readonly createdAt: string;
	readonly lastUsedAt: string | null;
}

export interface MFAChallengeRequest {
	readonly email: string;
	readonly tenantId: string;
}

export interface MFAChallengeResponse {
	readonly statusCode: number;
	readonly message: string;
	readonly mfaRequired: boolean;
}

export interface MFAVerifyRequest {
	readonly email: string;
	readonly tenantId: string;
	readonly totp: string;
}

export interface MFAVerifyResponse {
	readonly statusCode: number;
	readonly message: string;
	readonly verified: boolean;
}

export interface SAMLAssertionRequest {
	readonly providerId: string;
	readonly externalUserId: string;
	readonly email: string;
	readonly name?: string;
	readonly tenantId?: string;
	readonly roles?: readonly string[];
	readonly attributes?: Record<string, unknown>;
}

export interface SAMLAssertionResponse {
	readonly accessToken: string;
	readonly refreshToken: {
		readonly token: string;
		readonly metadata: {
			readonly tokenId: string;
			readonly subjectId: string;
			readonly tenantId: string;
			readonly roles: readonly string[];
			readonly audience: string;
			readonly expiresAt: string;
			readonly createdAt: string;
		};
	} | null;
	readonly userId: string;
}

export interface OIDCCallbackRequest {
	readonly providerId: string;
	readonly code: string;
	readonly state?: string;
}

export interface OIDCCallbackResponse {
	readonly accessToken: string;
	readonly refreshToken: {
		readonly token: string;
		readonly metadata: {
			readonly tokenId: string;
			readonly subjectId: string;
			readonly tenantId: string;
			readonly roles: readonly string[];
			readonly audience: string;
			readonly expiresAt: string;
			readonly createdAt: string;
		};
	} | null;
	readonly userId: string;
}

interface RequestOptions {
	readonly body?: unknown;
	readonly headers?: Record<string, string>;
	readonly signal?: AbortSignal;
	/** Required: every public method names its operation for telemetry. */
	readonly operation: string;
	readonly telemetryRoute?: string;
	readonly telemetryTarget?: string;
}

export class AuthClient {
	private readonly config: InternalAuthClientConfig;
	private readonly telemetry: AuthClientTelemetry | null;
	private readonly targetService: string;
	private activationPromise: Promise<void> | null = null;
	private readonly activationConfig: SdkActivationConfig;
	private resolvedTenantId: string | null = null;

	private async ensureActivated(): Promise<void> {
		if (!this.activationPromise) {
			this.activationPromise = activateSdk(this.activationConfig).then((response) => {
				this.resolvedTenantId = response.tenantId;
			});
		}
		return this.activationPromise;
	}

	constructor(config: AuthClientConfig) {
		if (!config.apiKey || config.apiKey.trim().length === 0) {
			throw new Error(
				"QNSP Auth SDK: apiKey is required. " +
					"Get your free API key at https://cloud.qnsi.heossi.com/signup - " +
					"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
					"Docs: https://docs.qnsi.heossi.com/sdk/auth-sdk",
			);
		}

		const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");

		// Enforce HTTPS in production (allow HTTP for localhost in development and
		// for internal service-mesh hostnames - e.g. *.internal - which are on a
		// private VPC network and do not require TLS termination at the transport layer).
		if (!baseUrl.startsWith("https://")) {
			const isLocalhost =
				baseUrl.startsWith("http://localhost") || baseUrl.startsWith("http://127.0.0.1");
			let isInternalService = false;
			try {
				const parsed = new URL(baseUrl);
				isInternalService =
					parsed.protocol === "http:" &&
					(parsed.hostname.endsWith(".internal") ||
						parsed.hostname === "localhost" ||
						parsed.hostname === "127.0.0.1");
			} catch {
				// ignore; invalid URL will be caught later by fetch
			}
			const isDevelopment =
				process.env["NODE_ENV"] === "development" || process.env["NODE_ENV"] === "test";
			if ((!isLocalhost || !isDevelopment) && !isInternalService) {
				throw new Error(
					"baseUrl must use HTTPS in production. HTTP is only allowed for localhost in development.",
				);
			}
		}

		this.config = {
			baseUrl,
			apiKey: config.apiKey,
			timeoutMs: config.timeoutMs ?? 30_000,
			maxRetries: config.maxRetries ?? 3,
			retryDelayMs: config.retryDelayMs ?? 1_000,
		};

		this.telemetry = config.telemetry
			? isAuthClientTelemetry(config.telemetry)
				? config.telemetry
				: createAuthClientTelemetry(config.telemetry)
			: null;

		try {
			this.targetService = new URL(this.config.baseUrl).host;
		} catch {
			this.targetService = "auth-service";
		}

		this.activationConfig = {
			apiKey: config.apiKey,
			sdkId: "auth-sdk",
			sdkVersion: SDK_PACKAGE_VERSION,
			platformUrl: baseUrl,
		};
	}

	private async request<T>(method: string, path: string, options: RequestOptions): Promise<T> {
		return this.requestWithRetry<T>(method, path, options, 0);
	}

	private async requestWithRetry<T>(
		method: string,
		path: string,
		options: RequestOptions,
		attempt: number,
	): Promise<T> {
		const url = `${this.config.baseUrl}${path}`;
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...options.headers,
		};

		headers["Authorization"] = `Bearer ${this.config.apiKey}`;

		// Auto-inject tenant ID from activation response. Every public method
		// awaits ensureActivated() before requesting, and activation always
		// carries a tenantId, so this is set unconditionally.
		headers["x-qnsp-tenant-id"] = this.resolvedTenantId as string;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
		const signal = options.signal ?? controller.signal;
		const route = options.telemetryRoute ?? new URL(path, this.config.baseUrl).pathname;
		const target = options.telemetryTarget ?? this.targetService;
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const init: RequestInit = {
				method,
				headers,
				signal,
			};

			if (options.body !== undefined) {
				init.body = JSON.stringify(options.body);
			}

			const response = await fetch(url, init);

			clearTimeout(timeoutId);
			httpStatus = response.status;

			// Handle rate limiting (429) with retry logic
			if (response.status === 429) {
				if (attempt < this.config.maxRetries) {
					const retryAfterHeader = response.headers.get("Retry-After");
					let delayMs = this.config.retryDelayMs;

					if (retryAfterHeader) {
						const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
						if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
							delayMs = retryAfterSeconds * 1_000;
						}
					} else {
						// Exponential backoff: 2^attempt * baseDelay, capped at 30 seconds
						delayMs = Math.min(2 ** attempt * this.config.retryDelayMs, 30_000);
					}

					await new Promise((resolve) => setTimeout(resolve, delayMs));
					return this.requestWithRetry<T>(method, path, options, attempt + 1);
				}

				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(
					`Auth API error: Rate limit exceeded after ${this.config.maxRetries} retries`,
				);
			}

			if (!response.ok) {
				status = "error";
				// Sanitize error message to prevent information disclosure
				// Don't include full response text in error to avoid leaking sensitive data
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Auth API error: ${response.status} ${response.statusText}`);
			}

			if (response.status === 204) {
				return undefined as T;
			}

			return (await response.json()) as T;
		} catch (error) {
			clearTimeout(timeoutId);
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			if (error instanceof Error && error.name === "AbortError") {
				errorMessage = `timeout after ${this.config.timeoutMs}ms`;
				throw new Error(`Request timeout after ${this.config.timeoutMs}ms`);
			}
			throw error;
		} finally {
			const durationMs = performance.now() - start;
			const event: AuthClientTelemetryEvent = {
				operation: options.operation,
				method,
				route,
				target,
				status,
				durationMs,
				...(typeof httpStatus === "number" ? { httpStatus } : {}),
				...(status === "error" && errorMessage ? { error: errorMessage } : {}),
			};
			this.recordTelemetryEvent(event);
		}
	}

	private recordTelemetryEvent(event: AuthClientTelemetryEvent): void {
		if (!this.telemetry) {
			return;
		}
		this.telemetry.record(event);
	}

	/**
	 * Login with email and password.
	 * Returns a token pair (access token and refresh token).
	 */
	async login(request: LoginRequest): Promise<TokenPair> {
		validateEmail(request.email, "email");
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<TokenPair>("POST", "/auth/login", {
			body: {
				email: request.email,
				password: request.password,
				tenantId: request.tenantId,
				...(request.totp !== undefined ? { totp: request.totp } : {}),
				...(request.audience !== undefined ? { audience: request.audience } : {}),
			},
			operation: "login",
		});
	}

	/**
	 * Refresh an access token using a refresh token.
	 * Returns a new token pair.
	 */
	async refreshToken(request: RefreshTokenRequest): Promise<TokenPair> {
		await this.ensureActivated();
		return this.request<TokenPair>("POST", "/auth/token/refresh", {
			body: {
				refreshToken: request.refreshToken,
				...(request.audience !== undefined ? { audience: request.audience } : {}),
			},
			operation: "refreshToken",
		});
	}

	/**
	 * Start WebAuthn passkey registration.
	 * Returns registration options and challenge ID.
	 */
	async registerPasskeyStart(
		request: WebAuthnRegistrationStartRequest,
	): Promise<WebAuthnRegistrationStartResponse> {
		validateUUID(request.userId, "userId");
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<WebAuthnRegistrationStartResponse>(
			"POST",
			"/auth/webauthn/register/start",
			{
				body: {
					userId: request.userId,
					tenantId: request.tenantId,
				},
				operation: "registerPasskeyStart",
			},
		);
	}

	/**
	 * Complete WebAuthn passkey registration.
	 * Requires the response from the WebAuthn API (navigator.credentials.create).
	 */
	async registerPasskeyComplete(
		request: WebAuthnRegistrationCompleteRequest,
	): Promise<WebAuthnRegistrationCompleteResponse> {
		validateUUID(request.userId, "userId");
		validateUUID(request.tenantId, "tenantId");
		validateUUID(request.challengeId, "challengeId");
		await this.ensureActivated();

		return this.request<WebAuthnRegistrationCompleteResponse>(
			"POST",
			"/auth/webauthn/register/complete",
			{
				body: {
					userId: request.userId,
					tenantId: request.tenantId,
					challengeId: request.challengeId,
					response: request.response,
				},
				operation: "registerPasskeyComplete",
			},
		);
	}

	/**
	 * Start WebAuthn passkey authentication.
	 * Can use either userId or email to identify the user.
	 * Returns authentication options and challenge ID.
	 */
	async authenticatePasskeyStart(
		request: WebAuthnAuthenticationStartRequest,
	): Promise<WebAuthnAuthenticationStartResponse> {
		validateUUID(request.tenantId, "tenantId");
		if (request.userId !== undefined) {
			validateUUID(request.userId, "userId");
		}
		if (request.email !== undefined) {
			validateEmail(request.email, "email");
		}
		await this.ensureActivated();

		return this.request<WebAuthnAuthenticationStartResponse>(
			"POST",
			"/auth/webauthn/authenticate/start",
			{
				body: {
					...(request.userId !== undefined ? { userId: request.userId } : {}),
					...(request.email !== undefined ? { email: request.email } : {}),
					tenantId: request.tenantId,
				},
				operation: "authenticatePasskeyStart",
			},
		);
	}

	/**
	 * Complete WebAuthn passkey authentication.
	 * Requires the response from the WebAuthn API (navigator.credentials.get).
	 * Returns a token pair upon successful authentication.
	 */
	async authenticatePasskeyComplete(
		request: WebAuthnAuthenticationCompleteRequest,
	): Promise<WebAuthnAuthenticationCompleteResponse> {
		validateUUID(request.tenantId, "tenantId");
		validateUUID(request.challengeId, "challengeId");
		if (request.userId !== undefined) {
			validateUUID(request.userId, "userId");
		}
		if (request.email !== undefined) {
			validateEmail(request.email, "email");
		}
		await this.ensureActivated();

		return this.request<WebAuthnAuthenticationCompleteResponse>(
			"POST",
			"/auth/webauthn/authenticate/complete",
			{
				body: {
					...(request.userId !== undefined ? { userId: request.userId } : {}),
					...(request.email !== undefined ? { email: request.email } : {}),
					tenantId: request.tenantId,
					challengeId: request.challengeId,
					response: request.response,
				},
				operation: "authenticatePasskeyComplete",
			},
		);
	}

	/**
	 * List all passkeys (WebAuthn credentials) for a user.
	 */
	async listPasskeys(userId: string, tenantId: string): Promise<readonly WebAuthnCredential[]> {
		validateUUID(userId, "userId");
		validateUUID(tenantId, "tenantId");
		await this.ensureActivated();

		const response = await this.request<{ credentials: readonly WebAuthnCredential[] }>(
			"GET",
			`/auth/webauthn/credentials/${userId}?tenantId=${encodeURIComponent(tenantId)}`,
			{
				operation: "listPasskeys",
			},
		);
		return response.credentials;
	}

	/**
	 * Delete a passkey (WebAuthn credential) for a user.
	 */
	async deletePasskey(credentialId: string, userId: string): Promise<void> {
		validateUUID(credentialId, "credentialId");
		validateUUID(userId, "userId");
		await this.ensureActivated();

		return this.request<void>(
			"DELETE",
			`/auth/webauthn/credentials/${credentialId}?userId=${encodeURIComponent(userId)}`,
			{
				operation: "deletePasskey",
			},
		);
	}

	/**
	 * Generate an MFA challenge (TOTP).
	 * Returns a response indicating MFA is required.
	 */
	async mfaChallenge(request: MFAChallengeRequest): Promise<MFAChallengeResponse> {
		validateEmail(request.email, "email");
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<MFAChallengeResponse>("POST", "/auth/mfa/challenge", {
			body: {
				email: request.email,
				tenantId: request.tenantId,
			},
			operation: "mfaChallenge",
		});
	}

	/**
	 * Verify an MFA code (TOTP).
	 * Returns a response indicating verification success.
	 */
	async mfaVerify(request: MFAVerifyRequest): Promise<MFAVerifyResponse> {
		validateEmail(request.email, "email");
		validateUUID(request.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<MFAVerifyResponse>("POST", "/auth/mfa/verify", {
			body: {
				email: request.email,
				tenantId: request.tenantId,
				totp: request.totp,
			},
			operation: "mfaVerify",
		});
	}

	/**
	 * Process a SAML assertion for federation.
	 * Returns a token pair upon successful authentication.
	 */
	async federateSAML(request: SAMLAssertionRequest): Promise<SAMLAssertionResponse> {
		validateEmail(request.email, "email");
		if (request.tenantId !== undefined) {
			validateUUID(request.tenantId, "tenantId");
		}
		await this.ensureActivated();

		return this.request<SAMLAssertionResponse>("POST", "/auth/federation/saml/assertion", {
			body: {
				providerId: request.providerId,
				externalUserId: request.externalUserId,
				email: request.email,
				...(request.name !== undefined ? { name: request.name } : {}),
				...(request.tenantId !== undefined ? { tenantId: request.tenantId } : {}),
				...(request.roles !== undefined ? { roles: request.roles } : {}),
				attributes: request.attributes ?? {},
			},
			operation: "federateSAML",
		});
	}

	/**
	 * Process an OIDC callback for federation.
	 * Exchanges the authorization code for tokens and returns a token pair.
	 */
	async federateOIDC(request: OIDCCallbackRequest): Promise<OIDCCallbackResponse> {
		await this.ensureActivated();
		return this.request<OIDCCallbackResponse>("POST", "/auth/federation/oidc/callback", {
			body: {
				providerId: request.providerId,
				code: request.code,
				...(request.state !== undefined ? { state: request.state } : {}),
			},
			operation: "federateOIDC",
		});
	}

	// ============================================================================
	// Risk-Based Authentication Methods
	// ============================================================================

	/**
	 * Evaluate authentication risk for a user action.
	 * Calculates a risk score based on IP reputation, device trust, geo-velocity,
	 * and behavioral analysis. Returns the required action (allow, MFA, or block).
	 */
	async evaluateRisk(input: EvaluateRiskInput): Promise<EvaluateRiskResult> {
		validateUUID(input.userId, "userId");
		validateUUID(input.tenantId, "tenantId");
		await this.ensureActivated();

		return this.request<EvaluateRiskResult>("POST", "/auth/risk/evaluate", {
			body: {
				userId: input.userId,
				tenantId: input.tenantId,
				context: input.context,
				action: input.action,
			},
			operation: "evaluateRisk",
		});
	}

	/**
	 * Create a risk policy for a tenant.
	 * Policies define rules that contribute to risk scores and actions for each risk level.
	 */
	async createRiskPolicy(
		policy: CreateRiskPolicyInput,
		tenantId?: string,
	): Promise<CreateRiskPolicyResult> {
		await this.ensureActivated();

		const queryString = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";

		return this.request<CreateRiskPolicyResult>("POST", `/auth/risk/policies${queryString}`, {
			body: {
				name: policy.name,
				enabled: policy.enabled ?? true,
				rules: policy.rules,
				thresholds: policy.thresholds ?? {},
				actions: policy.actions ?? {},
			},
			operation: "createRiskPolicy",
		});
	}

	/**
	 * List risk policies for a tenant.
	 * Returns all configured risk policies ordered by creation date.
	 */
	async listRiskPolicies(tenantId?: string): Promise<ListRiskPoliciesResult> {
		await this.ensureActivated();

		const queryString = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";

		return this.request<ListRiskPoliciesResult>("GET", `/auth/risk/policies${queryString}`, {
			operation: "listRiskPolicies",
		});
	}

	/**
	 * Report a threat signal for risk analysis.
	 * Threat signals are used to inform future risk evaluations.
	 */
	async reportThreatSignal(signal: ReportThreatSignalInput): Promise<ReportThreatSignalResult> {
		validateUUID(signal.tenantId, "tenantId");
		if (signal.userId !== undefined) {
			validateUUID(signal.userId, "userId");
		}
		await this.ensureActivated();

		return this.request<ReportThreatSignalResult>("POST", "/auth/risk/signals", {
			body: {
				...(signal.userId !== undefined ? { userId: signal.userId } : {}),
				tenantId: signal.tenantId,
				signalType: signal.signalType,
				severity: signal.severity,
				context: signal.context,
				source: signal.source,
			},
			operation: "reportThreatSignal",
		});
	}

	/**
	 * Get risk signals for a specific user.
	 * Returns recent threat signals associated with the user.
	 */
	async getUserRiskSignals(
		userId: string,
		options?: { tenantId?: string; limit?: number },
	): Promise<GetUserRiskSignalsResult> {
		validateUUID(userId, "userId");
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		if (options?.limit !== undefined) {
			params.set("limit", String(options.limit));
		}

		const queryString = params.toString() ? `?${params.toString()}` : "";

		return this.request<GetUserRiskSignalsResult>(
			"GET",
			`/auth/risk/users/${userId}/signals${queryString}`,
			{
				operation: "getUserRiskSignals",
			},
		);
	}

	/**
	 * Get risk statistics for a tenant.
	 * Returns aggregated risk metrics including risk distribution and blocked attempts.
	 */
	async getRiskStats(tenantId?: string): Promise<RiskStats> {
		await this.ensureActivated();

		const queryString = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";

		return this.request<RiskStats>("GET", `/auth/risk/stats${queryString}`, {
			operation: "getRiskStats",
		});
	}

	// ============================================================================
	// Federated Audit Methods
	// ============================================================================

	/**
	 * Query federated audit events.
	 * Search and filter federation-related audit logs with pagination.
	 */
	async queryFederatedAudit(
		query: QueryFederatedAuditInput,
		tenantId?: string,
	): Promise<QueryFederatedAuditResult> {
		await this.ensureActivated();

		const queryString = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";

		return this.request<QueryFederatedAuditResult>(
			"POST",
			`/auth/federation/audit/query${queryString}`,
			{
				body: {
					...(query.startDate !== undefined ? { startDate: query.startDate } : {}),
					...(query.endDate !== undefined ? { endDate: query.endDate } : {}),
					...(query.providerIds !== undefined ? { providerIds: query.providerIds } : {}),
					...(query.eventTypes !== undefined ? { eventTypes: query.eventTypes } : {}),
					...(query.userIds !== undefined ? { userIds: query.userIds } : {}),
					limit: query.limit ?? 100,
					offset: query.offset ?? 0,
				},
				operation: "queryFederatedAudit",
			},
		);
	}

	/**
	 * Create a federated audit compliance report.
	 * Generates a report summarizing federation activity for a time period.
	 */
	async createFederatedAuditReport(
		report: CreateFederatedAuditReportInput,
		tenantId?: string,
	): Promise<FederatedAuditReport> {
		await this.ensureActivated();

		const queryString = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";

		return this.request<FederatedAuditReport>(
			"POST",
			`/auth/federation/audit/reports${queryString}`,
			{
				body: {
					reportType: report.reportType,
					startDate: report.startDate,
					endDate: report.endDate,
					...(report.providerIds !== undefined ? { providerIds: report.providerIds } : {}),
					format: report.format ?? "json",
					includeDetails: report.includeDetails ?? true,
				},
				operation: "createFederatedAuditReport",
			},
		);
	}

	/**
	 * List generated federated audit reports.
	 * Returns metadata for all reports, ordered by creation date.
	 */
	async listFederatedAuditReports(options?: {
		tenantId?: string;
		limit?: number;
	}): Promise<ListFederatedAuditReportsResult> {
		await this.ensureActivated();

		const params = new URLSearchParams();
		if (options?.tenantId) {
			params.set("tenantId", options.tenantId);
		}
		if (options?.limit !== undefined) {
			params.set("limit", String(options.limit));
		}

		const queryString = params.toString() ? `?${params.toString()}` : "";

		return this.request<ListFederatedAuditReportsResult>(
			"GET",
			`/auth/federation/audit/reports${queryString}`,
			{
				operation: "listFederatedAuditReports",
			},
		);
	}

	/**
	 * Get a specific federated audit report by ID.
	 * Returns the full report including summary and optionally detailed events.
	 */
	async getFederatedAuditReport(
		reportId: string,
		tenantId?: string,
	): Promise<FederatedAuditReport> {
		validateUUID(reportId, "reportId");
		await this.ensureActivated();

		const queryString = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";

		return this.request<FederatedAuditReport>(
			"GET",
			`/auth/federation/audit/reports/${reportId}${queryString}`,
			{
				operation: "getFederatedAuditReport",
			},
		);
	}

	/**
	 * Get cross-tenant federation activity.
	 * Returns aggregated activity across all tenants (admin use).
	 */
	async getCrossTenantActivity(hours?: number): Promise<GetCrossTenantActivityResult> {
		await this.ensureActivated();

		const queryString = hours !== undefined ? `?hours=${hours}` : "";

		return this.request<GetCrossTenantActivityResult>(
			"GET",
			`/auth/federation/audit/cross-tenant${queryString}`,
			{
				operation: "getCrossTenantActivity",
			},
		);
	}
}

/**
 * Request a service account token from the auth-service /auth/service-token endpoint.
 *
 * This helper is intended for internal services (vault, storage, billing, etc.) to
 * obtain short-lived PQC-signed JWTs for outbound calls. It returns null on any
 * network or HTTP error so callers can decide whether to fall back to legacy
 * static tokens in non-production environments.
 */
export async function requestServiceToken(
	config: ServiceTokenClientConfig,
): Promise<ServiceTokenResponse | null> {
	const baseUrl = config.authServiceUrl.replace(/\/$/, "");

	if (!baseUrl.startsWith("https://")) {
		const isLocalhost =
			baseUrl.startsWith("http://localhost") || baseUrl.startsWith("http://127.0.0.1");
		const isInternalServiceMesh = baseUrl.includes(".internal");
		const isDevelopment =
			process.env["NODE_ENV"] === "development" || process.env["NODE_ENV"] === "test";
		if (!isLocalhost && !isInternalServiceMesh && !isDevelopment) {
			throw new Error(
				"authServiceUrl must use HTTPS in production. HTTP is only allowed for localhost, internal service mesh, or development.",
			);
		}
	}

	const controller = new AbortController();
	const timeoutMs = config.timeoutMs ?? 5_000;
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const url = new URL("/auth/service-token", baseUrl).toString();
		const body: { serviceId: string; audience?: string } = {
			serviceId: config.serviceId,
		};
		if (config.audience !== undefined) {
			body.audience = config.audience;
		}

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${config.serviceSecret}`,
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as { accessToken?: unknown };
		if (typeof data.accessToken !== "string" || data.accessToken.length === 0) {
			return null;
		}

		return { accessToken: data.accessToken };
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return null;
		}
		return null;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Convenience helper that returns a ready-to-use Authorization header for a
 * service account, or undefined if a token could not be obtained.
 */
export async function getServiceAuthHeader(
	config: ServiceTokenClientConfig,
): Promise<string | undefined> {
	const result = await requestServiceToken(config);
	if (!result) {
		return undefined;
	}
	return `Bearer ${result.accessToken}`;
}

// ============================================================================
// Personal Access Token (PAT) Types and Utilities
// ============================================================================

/**
 * PQC hash algorithms supported for PAT storage.
 * SHA-3 is NIST FIPS 202 approved and explicitly PQC-safe.
 */
export type PatPqcHashAlgorithm = "sha3-256" | "sha3-512" | "shake256";

/**
 * PQC signature algorithms supported for PAT signing.
 * Based on NIST FIPS 204 (ML-DSA, formerly Dilithium).
 */
export type PatPqcSignatureAlgorithm = "dilithium-2" | "dilithium-3" | "dilithium-5";

/**
 * PAT crypto tier aligned with tenant crypto policy.
 */
export type PatCryptoTier = "standard" | "hybrid" | "maximum";

/**
 * Scopes available for Personal Access Tokens.
 */
export const PAT_SCOPES = [
	"read:storage",
	"write:storage",
	"read:vault",
	"write:vault",
	"read:kms",
	"write:kms",
	"read:audit",
	"admin:tenant",
] as const;

export type PatScope = (typeof PAT_SCOPES)[number];

/**
 * PQC metadata returned with PAT operations.
 */
export interface PatPqcMetadata {
	/** Hash algorithm used for secure storage (SHA-3 family) */
	readonly hashAlgorithm: PatPqcHashAlgorithm;
	/** Signature algorithm if token is signed (ML-DSA/Dilithium) */
	readonly signatureAlgorithm: PatPqcSignatureAlgorithm | null;
	/** Whether the token has a PQC signature */
	readonly signed: boolean;
	/** Crypto tier that determined the algorithms */
	readonly cryptoTier: PatCryptoTier;
}

/**
 * Personal Access Token record.
 */
export interface PersonalAccessToken {
	readonly id: string;
	readonly name: string;
	readonly description: string | null;
	/** First 20 characters of token for identification */
	readonly tokenPrefix: string;
	readonly scopes: readonly PatScope[];
	readonly expiresAt: string | null;
	readonly lastUsedAt: string | null;
	readonly createdAt: string;
	/** PQC metadata (Quantum-Native Security) */
	readonly pqc?: PatPqcMetadata;
}

/**
 * Response from PAT creation - includes the one-time plaintext token.
 */
export interface CreatePatResponse extends PersonalAccessToken {
	/** The full token - only returned once on creation */
	readonly token: string;
	/** PQC metadata for the created token */
	readonly pqc: PatPqcMetadata;
}

/**
 * Request to create a Personal Access Token.
 */
export interface CreatePatRequest {
	readonly name: string;
	readonly description?: string;
	readonly scopes: readonly PatScope[];
	/** Token expiration in days (null for never) */
	readonly expiresInDays?: number | null;
}

/**
 * PAT validation result from the auth service.
 */
export interface ValidatePatResult {
	readonly valid: boolean;
	readonly userId: string;
	readonly tenantId: string;
	readonly scopes: readonly PatScope[];
	readonly tokenId: string;
	readonly expiresAt: string | null;
	readonly pqc?: {
		readonly hashAlgorithm: PatPqcHashAlgorithm;
		readonly signatureAlgorithm: PatPqcSignatureAlgorithm | null;
		readonly cryptoTier: PatCryptoTier;
		readonly isPqcNative: boolean;
	};
}

/**
 * Check if a token string is a QNSP Personal Access Token.
 * Supports both legacy (qnsp_pat_) and PQC-native (qnsp_pqc_pat_) formats.
 */
export function isPersonalAccessToken(token: string): boolean {
	return (
		token.startsWith("qnsi_pqc_pat_") ||
		token.startsWith("qnsp_pqc_pat_") ||
		token.startsWith("qnsp_pat_")
	);
}

/**
 * Check if a token string is a PQC-native Personal Access Token.
 */
export function isPqcNativeToken(token: string): boolean {
	return token.startsWith("qnsi_pqc_pat_") || token.startsWith("qnsp_pqc_pat_");
}

/**
 * Map NIST algorithm names for PAT PQC metadata.
 */
export const PAT_PQC_ALGORITHM_TO_NIST: Record<string, string> = {
	"sha3-256": "SHA3-256",
	"sha3-512": "SHA3-512",
	shake256: "SHAKE256",
	"dilithium-2": "ML-DSA-44",
	"dilithium-3": "ML-DSA-65",
	"dilithium-5": "ML-DSA-87",
};

/**
 * Get NIST standardized name for a PAT PQC algorithm.
 */
export function toPatNistAlgorithmName(algorithm: string): string {
	return PAT_PQC_ALGORITHM_TO_NIST[algorithm] ?? algorithm;
}

// ============================================================================
// Risk-Based Authentication Types
// ============================================================================

/**
 * Authentication actions that can be evaluated for risk.
 */
export type RiskAction =
	| "login"
	| "mfa_change"
	| "password_change"
	| "api_key_create"
	| "sensitive_action";

/**
 * Risk levels returned from risk evaluation.
 */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/**
 * Actions that can be required based on risk evaluation.
 */
export type RiskRequiredAction = "allow" | "mfa_required" | "block" | "review";

/**
 * Threat signal types that can be reported.
 */
export type ThreatSignalType =
	| "impossible_travel"
	| "credential_stuffing"
	| "brute_force"
	| "suspicious_ip"
	| "compromised_credential"
	| "anomalous_behavior";

/**
 * Severity levels for threat signals.
 */
export type ThreatSeverity = "low" | "medium" | "high" | "critical";

/**
 * Geolocation context for risk evaluation.
 */
export interface RiskGeoLocation {
	readonly country?: string;
	readonly region?: string;
	readonly city?: string;
	readonly latitude?: number;
	readonly longitude?: number;
}

/**
 * Context for risk evaluation.
 */
export interface RiskEvaluationContext {
	readonly ipAddress: string;
	readonly userAgent: string;
	readonly deviceFingerprint?: string;
	readonly geoLocation?: RiskGeoLocation;
	readonly timestamp?: string;
}

/**
 * Input for evaluating authentication risk.
 */
export interface EvaluateRiskInput {
	readonly userId: string;
	readonly tenantId: string;
	readonly context: RiskEvaluationContext;
	readonly action: RiskAction;
}

/**
 * Individual risk factor from evaluation.
 */
export interface RiskFactor {
	readonly factor: string;
	readonly score: number;
	readonly reason: string;
}

/**
 * Result from risk evaluation.
 */
export interface EvaluateRiskResult {
	readonly riskScore: number;
	readonly riskLevel: RiskLevel;
	readonly riskFactors: readonly RiskFactor[];
	readonly requiredAction: RiskRequiredAction;
	readonly sessionId: string;
}

/**
 * Risk policy rule condition field.
 */
export type RiskPolicyConditionField =
	| "ip_reputation"
	| "geo_velocity"
	| "device_trust"
	| "time_anomaly"
	| "behavior_score";

/**
 * Risk policy rule condition operator.
 */
export type RiskPolicyConditionOperator =
	| "eq"
	| "ne"
	| "gt"
	| "lt"
	| "gte"
	| "lte"
	| "in"
	| "not_in";

/**
 * Risk policy rule condition.
 */
export interface RiskPolicyCondition {
	readonly field: RiskPolicyConditionField;
	readonly operator: RiskPolicyConditionOperator;
	readonly value: string | number | readonly string[];
}

/**
 * Risk policy rule.
 */
export interface RiskPolicyRule {
	readonly condition: RiskPolicyCondition;
	readonly riskScore: number;
}

/**
 * Risk policy thresholds.
 */
export interface RiskPolicyThresholds {
	readonly low?: number;
	readonly medium?: number;
	readonly high?: number;
	readonly critical?: number;
}

/**
 * Risk policy actions for each risk level.
 */
export interface RiskPolicyActions {
	readonly low?: "allow" | "log";
	readonly medium?: "allow" | "mfa_required" | "log";
	readonly high?: "mfa_required" | "block" | "review";
	readonly critical?: "block" | "lockout";
}

/**
 * Input for creating a risk policy.
 */
export interface CreateRiskPolicyInput {
	readonly name: string;
	readonly enabled?: boolean;
	readonly rules: readonly RiskPolicyRule[];
	readonly thresholds?: RiskPolicyThresholds;
	readonly actions?: RiskPolicyActions;
}

/**
 * Risk policy returned from API.
 */
export interface RiskPolicy {
	readonly id: string;
	readonly name: string;
	readonly enabled: boolean;
	readonly rules: readonly RiskPolicyRule[];
	readonly thresholds: RiskPolicyThresholds;
	readonly actions: RiskPolicyActions;
	readonly createdAt: string;
}

/**
 * Result from creating a risk policy.
 */
export interface CreateRiskPolicyResult {
	readonly id: string;
	readonly name: string;
	readonly enabled: boolean;
}

/**
 * Result from listing risk policies.
 */
export interface ListRiskPoliciesResult {
	readonly policies: readonly RiskPolicy[];
}

/**
 * Input for reporting a threat signal.
 */
export interface ReportThreatSignalInput {
	readonly userId?: string;
	readonly tenantId: string;
	readonly signalType: ThreatSignalType;
	readonly severity: ThreatSeverity;
	readonly context: Record<string, unknown>;
	readonly source: string;
}

/**
 * Result from reporting a threat signal.
 */
export interface ReportThreatSignalResult {
	readonly id: string;
	readonly signalType: ThreatSignalType;
	readonly severity: ThreatSeverity;
}

/**
 * Risk signal for a user.
 */
export interface UserRiskSignal {
	readonly id: string;
	readonly signalType: ThreatSignalType;
	readonly severity: ThreatSeverity;
	readonly context: Record<string, unknown>;
	readonly source: string;
	readonly createdAt: string;
}

/**
 * Result from getting user risk signals.
 */
export interface GetUserRiskSignalsResult {
	readonly signals: readonly UserRiskSignal[];
}

/**
 * Signal count by type and severity.
 */
export interface RiskSignalCount {
	readonly signalType: ThreatSignalType;
	readonly severity: ThreatSeverity;
	readonly count: number;
}

/**
 * Risk statistics for a tenant.
 */
export interface RiskStats {
	readonly riskDistribution: Record<RiskLevel, number>;
	readonly signalsLast24Hours: readonly RiskSignalCount[];
	readonly blockedAttemptsLast24Hours: number;
}

// ============================================================================
// Federated Audit Types
// ============================================================================

/**
 * Federation event types.
 */
export type FederationEventType =
	| "federation_login"
	| "federation_logout"
	| "federation_link"
	| "federation_unlink"
	| "jit_provision"
	| "attribute_sync"
	| "session_created"
	| "session_terminated";

/**
 * Input for querying federated audit events.
 */
export interface QueryFederatedAuditInput {
	readonly startDate?: string;
	readonly endDate?: string;
	readonly providerIds?: readonly string[];
	readonly eventTypes?: readonly FederationEventType[];
	readonly userIds?: readonly string[];
	readonly limit?: number;
	readonly offset?: number;
}

/**
 * Federated audit event.
 */
export interface FederatedAuditEvent {
	readonly id: string;
	readonly eventType: FederationEventType;
	readonly providerId: string;
	readonly userId: string | null;
	readonly externalUserId: string | null;
	readonly sessionId: string | null;
	readonly ipAddress: string | null;
	readonly userAgent: string | null;
	readonly geoLocation: Record<string, unknown> | null;
	readonly attributes: Record<string, unknown>;
	readonly metadata: Record<string, unknown>;
	readonly createdAt: string;
}

/**
 * Result from querying federated audit events.
 */
export interface QueryFederatedAuditResult {
	readonly events: readonly FederatedAuditEvent[];
	readonly total: number;
	readonly limit: number;
	readonly offset: number;
}

/**
 * Report type for federated audit reports.
 */
export type FederatedAuditReportType = "compliance" | "access" | "activity" | "security";

/**
 * Input for creating a federated audit report.
 */
export interface CreateFederatedAuditReportInput {
	readonly reportType: FederatedAuditReportType;
	readonly startDate: string;
	readonly endDate: string;
	readonly providerIds?: readonly string[];
	readonly format?: "json" | "csv";
	readonly includeDetails?: boolean;
}

/**
 * Provider statistics in a report.
 */
export interface FederatedAuditReportProviderStats {
	readonly providerId: string;
	readonly eventCount: number;
	readonly uniqueUsers: number;
}

/**
 * Summary section of a federated audit report.
 */
export interface FederatedAuditReportSummary {
	readonly totalEvents: number;
	readonly uniqueUsers: number;
	readonly jitProvisioned: number;
	readonly eventsByType: Record<string, number>;
	readonly byProvider: readonly FederatedAuditReportProviderStats[];
}

/**
 * Federated audit report.
 */
export interface FederatedAuditReport {
	readonly id: string;
	readonly reportType: FederatedAuditReportType;
	readonly generatedAt: string;
	readonly period: {
		readonly start: string;
		readonly end: string;
	};
	readonly summary: FederatedAuditReportSummary;
	readonly events?: readonly unknown[];
}

/**
 * Report metadata for listing.
 */
export interface FederatedAuditReportMeta {
	readonly id: string;
	readonly reportType: FederatedAuditReportType;
	readonly startDate: string;
	readonly endDate: string;
	readonly createdAt: string;
}

/**
 * Result from listing federated audit reports.
 */
export interface ListFederatedAuditReportsResult {
	readonly reports: readonly FederatedAuditReportMeta[];
}

/**
 * Cross-tenant activity entry.
 */
export interface CrossTenantActivityEntry {
	readonly tenantId: string;
	readonly providerId: string;
	readonly eventType: FederationEventType;
	readonly count: number;
	readonly uniqueUsers: number;
}

/**
 * Result from getting cross-tenant activity.
 */
export interface GetCrossTenantActivityResult {
	readonly timeRange: { readonly hours: number };
	readonly tenantsActive: number;
	readonly activity: readonly CrossTenantActivityEntry[];
}

export * from "./observability.js";
export * from "./validation.js";
