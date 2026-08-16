/**
 * @heossihq/qnsi-kms-client
 *
 * TypeScript client for the QNSP kms-service API.
 * Provides key wrapping and unwrapping operations with tenant-specific PQC algorithms.
 * Algorithm selection is based on tenant crypto policy managed through tenant-service.
 */

import { performance } from "node:perf_hooks";

import { activateSdk, type SdkActivationConfig } from "@heossihq/qnsi-sdk-activation";

import type { KmsClientTelemetry, KmsClientTelemetryConfig } from "./observability.js";
import { createKmsClientTelemetry, isKmsClientTelemetry } from "./observability.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";
import { validateUUID } from "./validation.js";

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

/**
 * PQC metadata returned from key operations.
 */
export interface KmsPqcMetadata {
	readonly algorithm: string;
	readonly algorithmNist: string;
	readonly provider: string;
	readonly keyId: string;
}

export interface KmsServiceClient {
	wrapKey(input: {
		tenantId: string;
		dataKey: string; // Base64-encoded
		keyId: string;
		associatedData?: string; // Base64-encoded
	}): Promise<{
		keyId: string;
		wrappedKey: string; // Base64-encoded
		algorithm: string;
		algorithmNist: string;
		provider: string;
	}>;
	unwrapKey(input: {
		tenantId: string;
		wrappedKey: string; // Base64-encoded
		keyId: string;
		associatedData?: string; // Base64-encoded
		providerHint?: string; // HSM provider that performed the wrap
	}): Promise<{
		dataKey: string; // Base64-encoded
	}>;
}

/** Default QNSP cloud API base URL. Get a free API key at https://cloud.qnsi.heossi.com/signup */
export const QNSP_CLOUD_URL = "https://api.qnsi.heossi.com";

export interface HttpKmsServiceClientAuthConfig {
	readonly getAuthHeader: () => Promise<string | undefined>;
}

export interface KmsClientOptions {
	readonly telemetry?: KmsClientTelemetry | KmsClientTelemetryConfig;
	readonly maxRetries?: number;
	readonly retryDelayMs?: number;
}

export class HttpKmsServiceClient implements KmsServiceClient {
	private readonly baseUrl: string;
	private readonly apiToken: string | undefined;
	private readonly getAuthHeaderFn: (() => Promise<string | undefined>) | undefined;
	private readonly maxRetries: number;
	private readonly retryDelayMs: number;
	private readonly telemetry: KmsClientTelemetry | null;
	private readonly targetService: string;
	private activationPromise: Promise<void> | null = null;
	private readonly activationConfig: SdkActivationConfig | null;
	private resolvedTenantId: string | null = null;

	private async ensureActivated(): Promise<void> {
		if (!this.activationConfig) return;
		if (!this.activationPromise) {
			this.activationPromise = activateSdk(this.activationConfig).then((response) => {
				this.resolvedTenantId = response.tenantId;
			});
		}
		return this.activationPromise;
	}

	private static isPrivateIpv4(hostname: string): boolean {
		const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
		if (!m) return false;
		// The pattern guarantees four numeric groups, so the captures always exist. No bounds
		// check is needed either: an out-of-range octet cannot equal 10, 172 or 192, and Node's
		// URL parser rejects such hosts before they ever reach here.
		const a = Number(m[1]);
		const b = Number(m[2]);
		if (a === 10) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		return false;
	}

	private static isInternalServiceHostname(hostname: string): boolean {
		const normalized = hostname.toLowerCase();
		if (normalized === "localhost" || normalized === "127.0.0.1") return true;
		if (normalized.endsWith(".internal")) return true;
		if (HttpKmsServiceClient.isPrivateIpv4(normalized)) return true;
		return false;
	}

	constructor(baseUrl: string, apiToken: string, options?: KmsClientOptions);
	constructor(
		baseUrl: string,
		authConfig: HttpKmsServiceClientAuthConfig,
		options?: KmsClientOptions,
	);
	constructor(
		baseUrl: string,
		second: string | HttpKmsServiceClientAuthConfig,
		options?: KmsClientOptions,
	) {
		this.baseUrl = baseUrl.trim().replace(/\/$/, "");

		// Enforce HTTPS in production (allow HTTP only for localhost in development)
		if (!this.baseUrl.startsWith("https://")) {
			const isLocalhost =
				this.baseUrl.startsWith("http://localhost") || this.baseUrl.startsWith("http://127.0.0.1");
			let isInternalService = false;
			try {
				const parsed = new URL(this.baseUrl);
				isInternalService =
					parsed.protocol === "http:" &&
					HttpKmsServiceClient.isInternalServiceHostname(parsed.hostname);
			} catch {
				// ignore; invalid URL will be handled later by fetch/URL parsing.
			}
			const isDevelopment =
				process.env["NODE_ENV"] === "development" || process.env["NODE_ENV"] === "test";
			if ((!isLocalhost || !isDevelopment) && !isInternalService) {
				throw new Error(
					"baseUrl must use HTTPS in production. HTTP is only allowed for localhost in development.",
				);
			}
		}

		if (second == null) {
			throw new Error(
				"QNSP KMS Client: apiToken is required. " +
					"Get your free API key at https://cloud.qnsi.heossi.com/signup - " +
					"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
					"Docs: https://docs.qnsi.heossi.com/sdk/kms-client",
			);
		}
		if (typeof second === "string") {
			if (!second || second.trim().length === 0) {
				throw new Error(
					"QNSP KMS Client: apiToken is required. " +
						"Get your free API key at https://cloud.qnsi.heossi.com/signup - " +
						"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
						"Docs: https://docs.qnsi.heossi.com/sdk/kms-client",
				);
			}
			this.apiToken = second;
			this.getAuthHeaderFn = undefined;
		} else {
			this.apiToken = undefined;
			this.getAuthHeaderFn = second.getAuthHeader;
		}

		this.maxRetries = options?.maxRetries ?? 3;
		this.retryDelayMs = options?.retryDelayMs ?? 1_000;

		this.telemetry = options?.telemetry
			? isKmsClientTelemetry(options.telemetry)
				? options.telemetry
				: createKmsClientTelemetry(options.telemetry)
			: null;

		try {
			this.targetService = new URL(this.baseUrl).host;
		} catch {
			this.targetService = "kms-service";
		}

		// Only activate for external consumers (apiToken). Internal service-to-service
		// calls use getAuthHeaderFn and skip activation.
		this.activationConfig = this.apiToken
			? {
					apiKey: this.apiToken,
					sdkId: "kms-client",
					sdkVersion: SDK_PACKAGE_VERSION,
					platformUrl: this.baseUrl,
				}
			: null;
	}

	private async buildAuthHeader(): Promise<string | undefined> {
		if (this.getAuthHeaderFn) {
			const header = await this.getAuthHeaderFn();
			if (header) {
				return header;
			}
		}
		if (this.apiToken) {
			return `Bearer ${this.apiToken}`;
		}
		return undefined;
	}

	private async fetchWithRetry(url: string, init: RequestInit, attempt: number): Promise<Response> {
		const response = await fetch(url, init);

		if (response.status === 429) {
			if (attempt < this.maxRetries) {
				const retryAfterHeader = response.headers.get("Retry-After");
				let delayMs = this.retryDelayMs;

				if (retryAfterHeader) {
					const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
					if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
						delayMs = retryAfterSeconds * 1_000;
					}
				} else {
					// Exponential backoff: 2^attempt * baseDelay, capped at 30 seconds
					delayMs = Math.min(2 ** attempt * this.retryDelayMs, 30_000);
				}

				await new Promise((resolve) => setTimeout(resolve, delayMs));
				return this.fetchWithRetry(url, init, attempt + 1);
			}

			throw new Error(`KMS API error: Rate limit exceeded after ${this.maxRetries} retries`);
		}

		return response;
	}

	async wrapKey(input: {
		tenantId: string;
		dataKey: string;
		keyId: string;
		associatedData?: string;
	}): Promise<{
		keyId: string;
		wrappedKey: string;
		algorithm: string;
		algorithmNist: string;
		provider: string;
	}> {
		validateUUID(input.tenantId, "tenantId");
		await this.ensureActivated();

		const url = new URL(`/kms/v1/keys/${input.keyId}/wrap`, this.baseUrl);
		const headers: Record<string, string> = {
			"content-type": "application/json",
		};
		const authHeader = await this.buildAuthHeader();
		if (authHeader) {
			headers["authorization"] = authHeader;
		}

		// Auto-inject tenant ID from activation response
		if (this.resolvedTenantId) {
			headers["x-qnsp-tenant-id"] = this.resolvedTenantId;
		}

		const route = "/kms/v1/keys/:keyId/wrap";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const response = await this.fetchWithRetry(
				url.toString(),
				{
					method: "POST",
					headers,
					body: JSON.stringify({
						tenantId: input.tenantId,
						dataKey: input.dataKey,
						...(input.associatedData ? { associatedData: input.associatedData } : {}),
					}),
				},
				0,
			);

			httpStatus = response.status;

			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`KMS API error: ${response.status} ${response.statusText}`);
			}

			const result = (await response.json()) as {
				keyId: string;
				wrappedKey: string;
				algorithm: string;
				provider: string;
			};

			return {
				...result,
				algorithmNist: toNistAlgorithmName(result.algorithm),
			};
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			if (this.telemetry) {
				this.telemetry.record({
					operation: "wrapKey",
					method: "POST",
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}

	async unwrapKey(input: {
		tenantId: string;
		wrappedKey: string;
		keyId: string;
		associatedData?: string;
		providerHint?: string;
	}): Promise<{
		dataKey: string;
	}> {
		validateUUID(input.tenantId, "tenantId");
		await this.ensureActivated();

		const url = new URL(`/kms/v1/keys/${input.keyId}/unwrap`, this.baseUrl);
		const headers: Record<string, string> = {
			"content-type": "application/json",
		};
		const authHeader = await this.buildAuthHeader();
		if (authHeader) {
			headers["authorization"] = authHeader;
		}

		// Auto-inject tenant ID from activation response
		if (this.resolvedTenantId) {
			headers["x-qnsp-tenant-id"] = this.resolvedTenantId;
		}

		const route = "/kms/v1/keys/:keyId/unwrap";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		try {
			const response = await this.fetchWithRetry(
				url.toString(),
				{
					method: "POST",
					headers,
					body: JSON.stringify({
						tenantId: input.tenantId,
						wrappedKey: input.wrappedKey,
						...(input.associatedData ? { associatedData: input.associatedData } : {}),
						...(input.providerHint ? { providerHint: input.providerHint } : {}),
					}),
				},
				0,
			);

			httpStatus = response.status;

			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`KMS API error: ${response.status} ${response.statusText}`);
			}

			return (await response.json()) as { dataKey: string };
		} catch (error) {
			status = "error";
			if (!errorMessage && error instanceof Error) {
				errorMessage = error.message;
			}
			throw error;
		} finally {
			if (this.telemetry) {
				this.telemetry.record({
					operation: "unwrapKey",
					method: "POST",
					route,
					target: this.targetService,
					status,
					durationMs: performance.now() - start,
					...(typeof httpStatus === "number" ? { httpStatus } : {}),
					...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				});
			}
		}
	}
}

/**
 * Factory: create a KMS client pointed at the QNSP cloud.
 * Equivalent to `new HttpKmsServiceClient(QNSP_CLOUD_URL, apiToken, options)`.
 */
export function createKmsClient(
	apiToken: string,
	options?: KmsClientOptions,
): HttpKmsServiceClient {
	return new HttpKmsServiceClient(QNSP_CLOUD_URL, apiToken, options);
}

export * from "./observability.js";
export * from "./validation.js";
