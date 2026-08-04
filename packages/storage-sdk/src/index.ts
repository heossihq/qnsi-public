import { activateSdk, type SdkActivationConfig } from "@heossihq/qnsi-sdk-activation";

import type {
	StorageClientTelemetry,
	StorageClientTelemetryConfig,
	StorageClientTelemetryEvent,
} from "./observability.js";
import { createStorageClientTelemetry, isStorageClientTelemetry } from "./observability.js";
import { SDK_PACKAGE_VERSION } from "./sdk-package-version.js";
import type {
	ClassificationLevel,
	ClassificationPolicySummary,
	ClassificationStats,
	ClassifyObjectRequest,
	CreateClassificationPolicyRequest,
	CreateReplicationConfigRequest,
	CreateRetentionPolicyRequest,
	CreateTieringPolicyRequest,
	DeletionType,
	DetectPiiResult,
	EvaluateRetentionResult,
	EvaluateTieringResult,
	LegalHoldType,
	ObjectClassification,
	ObjectReplicationStatus,
	PlaceHoldRequest,
	ReplicationConfigSummary,
	ReplicationHealth,
	ReplicationMetrics,
	ReplicationMode,
	RetentionPolicySummary,
	RetentionType,
	ScheduleDeleteRequest,
	StartClassificationScanRequest,
	TieringPolicy,
	TieringRecommendation,
	TieringStats,
} from "./types.js";
import { validateUUID } from "./validation.js";

/**
 * @heossihq/qnsi-storage-sdk
 *
 * TypeScript SDK client for the QNSP storage-service API.
 * Provides a high-level interface for document upload, download, and management operations.
 * All cryptographic operations use tenant-specific PQC algorithms based on crypto policy.
 */

/**
 * PQC metadata for cryptographic operations.
 */
export interface PqcMetadata {
	readonly provider: string;
	readonly algorithm: string;
	readonly algorithmNist?: string;
	readonly keyId: string;
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

export interface StorageClientConfig {
	readonly baseUrl?: string;
	readonly apiKey: string;
	readonly tenantId: string;
	readonly timeoutMs?: number;
	readonly maxRetries?: number;
	readonly retryDelayMs?: number;
	readonly telemetry?: StorageClientTelemetry | StorageClientTelemetryConfig;
}

type InternalStorageClientConfig = {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly tenantId: string;
	readonly timeoutMs: number;
	readonly maxRetries: number;
	readonly retryDelayMs: number;
};

export interface InitiateUploadOptions {
	readonly name: string;
	readonly mimeType: string;
	readonly sizeBytes: number;
	readonly classification?: string;
	readonly metadata?: Record<string, unknown>;
	readonly tags?: readonly string[];
	readonly retentionPolicy?: {
		readonly mode?: "compliance" | "governance" | null;
		readonly retainUntil?: string | null;
		readonly legalHolds?: readonly string[];
	};
}

export interface UploadPartResult {
	readonly uploadId: string;
	readonly partId: number;
	readonly status: string;
	readonly sizeBytes: number;
	readonly checksumSha3: string;
	readonly retries: number;
	readonly totalParts: number;
	readonly completedParts: number;
	readonly bytesReceived: number;
	readonly lastPartNumber: number;
	readonly resumeToken: string | null;
	readonly scan?: {
		readonly status: string;
		readonly signature: string | null;
		readonly engine: string | null;
	};
}

export interface CompleteUploadResult {
	readonly documentId: string;
	readonly tenantId: string;
	readonly version: number;
	readonly sizeBytes: number;
	readonly checksumSha3: string;
	readonly parts: readonly {
		readonly partId: number;
		readonly checksumSha3: string;
		readonly sizeBytes: number;
	}[];
	readonly downloadManifest: unknown;
	readonly cdnDownload?: {
		readonly url: string;
		readonly expiresAt: string;
		readonly token: string;
	} | null;
}

export interface DownloadDescriptor {
	readonly documentId: string;
	readonly tenantId: string;
	readonly version: number;
	readonly sizeBytes: number;
	readonly checksumSha3: string;
	readonly manifest: unknown;
}

export interface UploadStatus {
	readonly uploadId: string;
	readonly documentId: string;
	readonly tenantId: string;
	readonly status: "pending" | "committed" | "aborted" | "quarantined";
	readonly totalParts: number;
	readonly completedParts: number;
	readonly bytesReceived: number;
	readonly lastPartNumber: number;
	readonly chunkSizeBytes: number;
	readonly totalSizeBytes: number;
	readonly expiresAt: string;
	readonly resumeToken: string | null;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface DocumentPolicies {
	readonly documentId: string;
	readonly tenantId: string;
	readonly compliance: {
		readonly retentionMode: "compliance" | "governance" | null;
		readonly retainUntil: string | null;
		readonly legalHolds: readonly string[];
		readonly wormLockExpiresAt: string | null;
	};
	readonly lifecycle?: {
		readonly currentTier?: "hot" | "warm" | "cold" | "frozen";
		readonly targetTier?: "hot" | "warm" | "cold" | "frozen" | null;
		readonly transitionAfter?: string | null;
	};
}

export interface UpdatePoliciesRequest {
	readonly retentionMode?: "compliance" | "governance";
	readonly retainUntil?: string;
	readonly legalHolds?: readonly string[];
	readonly wormLockExpiresAt?: string;
}

export interface ApplyLegalHoldRequest {
	readonly holdId: string;
}

export interface ScheduleTransitionRequest {
	readonly targetTier: "hot" | "warm" | "cold" | "frozen";
	readonly transitionAfter: string;
}

interface RequestOptions {
	readonly body?: unknown;
	readonly headers?: Record<string, string>;
	readonly signal?: AbortSignal;
	readonly operation?: string;
	readonly telemetryRoute?: string;
	readonly telemetryTarget?: string;
}

export class StorageClient {
	private readonly config: InternalStorageClientConfig;
	private readonly telemetry: StorageClientTelemetry | null;
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

	constructor(config: StorageClientConfig) {
		if (!config.apiKey || config.apiKey.trim().length === 0) {
			throw new Error(
				"QNSP Storage SDK: apiKey is required. " +
					"Get your free API key at https://cloud.qnsi.heossi.com/signup - " +
					"no credit card required (FREE tier: 10 GB storage, 50,000 API calls/month). " +
					"Docs: https://docs.qnsi.heossi.com/sdk/storage-sdk",
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
			tenantId: config.tenantId,
			timeoutMs: config.timeoutMs ?? 30_000,
			maxRetries: config.maxRetries ?? 3,
			retryDelayMs: config.retryDelayMs ?? 1_000,
		};

		this.telemetry = config.telemetry
			? isStorageClientTelemetry(config.telemetry)
				? config.telemetry
				: createStorageClientTelemetry(config.telemetry)
			: null;

		try {
			this.targetService = new URL(this.config.baseUrl).host;
		} catch {
			this.targetService = "storage-service";
		}

		this.activationConfig = {
			apiKey: config.apiKey,
			sdkId: "storage-sdk",
			sdkVersion: SDK_PACKAGE_VERSION,
			platformUrl: baseUrl,
		};
	}

	private async request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
		return this.requestWithRetry<T>(method, path, options, 0);
	}

	private async requestWithRetry<T>(
		method: string,
		path: string,
		options: RequestOptions | undefined,
		attempt: number,
	): Promise<T> {
		const url = `${this.config.baseUrl}${path}`;
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...options?.headers,
		};

		headers["Authorization"] = `Bearer ${this.config.apiKey}`;

		// Auto-inject tenant ID from activation response
		if (this.resolvedTenantId) {
			headers["x-qnsp-tenant-id"] = this.resolvedTenantId;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
		const signal = options?.signal ?? controller.signal;
		const route = options?.telemetryRoute ?? new URL(path, this.config.baseUrl).pathname;
		const target = options?.telemetryTarget ?? this.targetService;
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

			if (options?.body !== undefined) {
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
					`Storage API error: Rate limit exceeded after ${this.config.maxRetries} retries`,
				);
			}

			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Storage API error: ${response.status} ${response.statusText}`);
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
			const event: StorageClientTelemetryEvent = {
				operation: options?.operation ?? `${method} ${route}`,
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

	async initiateUpload(options: InitiateUploadOptions): Promise<{
		readonly uploadId: string;
		readonly documentId: string;
		readonly tenantId: string;
		readonly chunkSizeBytes: number;
		readonly totalSizeBytes: number;
		readonly totalParts: number;
		readonly expiresAt: string;
		readonly resumeToken: string | null;
		readonly pqc: PqcMetadata;
	}> {
		await this.ensureActivated();
		const result = await this.request<{
			uploadId: string;
			documentId: string;
			tenantId: string;
			chunkSizeBytes: number;
			totalSizeBytes: number;
			totalParts: number;
			expiresAt: string;
			resumeToken: string | null;
			pqc: {
				provider: string;
				algorithm: string;
				keyId: string;
			};
		}>("POST", "/storage/v1/documents", {
			body: {
				name: options.name,
				mimeType: options.mimeType,
				sizeBytes: options.sizeBytes,
				classification: options.classification ?? "confidential",
				metadata: options.metadata ?? {},
				tags: options.tags ?? [],
				retentionPolicy: options.retentionPolicy,
			},
			operation: "initiateUpload",
		});

		// Enrich PQC metadata with NIST algorithm name
		return {
			...result,
			pqc: {
				...result.pqc,
				algorithmNist: toNistAlgorithmName(result.pqc.algorithm),
			},
		};
	}

	async uploadPart(
		uploadId: string,
		partId: number,
		data: ReadableStream<Uint8Array> | Buffer | Uint8Array,
	): Promise<UploadPartResult> {
		await this.ensureActivated();
		const url = `${this.config.baseUrl}/storage/v1/uploads/${uploadId}/parts/${partId}`;
		const headers: Record<string, string> = {
			"Content-Type": "application/octet-stream",
		};

		headers["Authorization"] = `Bearer ${this.config.apiKey}`;

		// Auto-inject tenant ID from activation response
		if (this.resolvedTenantId) {
			headers["x-qnsp-tenant-id"] = this.resolvedTenantId;
		}

		const bytesSent =
			data instanceof Buffer || data instanceof Uint8Array ? data.byteLength : undefined;
		const route = "/storage/v1/uploads/:uploadId/parts/:partId";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;

		const body =
			data instanceof ReadableStream
				? data
				: data instanceof Buffer
					? new ReadableStream({
							start(controller) {
								controller.enqueue(new Uint8Array(data));
								controller.close();
							},
						})
					: new ReadableStream({
							start(controller) {
								controller.enqueue(data);
								controller.close();
							},
						});

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

		try {
			const response = await fetch(url, {
				method: "PUT",
				headers,
				body,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);
			httpStatus = response.status;

			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Upload part error: ${response.status} ${response.statusText}`);
			}

			return (await response.json()) as UploadPartResult;
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
			const event: StorageClientTelemetryEvent = {
				operation: "uploadPart",
				method: "PUT",
				route,
				target: this.targetService,
				status,
				durationMs,
				...(typeof httpStatus === "number" ? { httpStatus } : {}),
				...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				...(typeof bytesSent === "number" ? { bytesSent } : {}),
			};
			this.recordTelemetryEvent(event);
		}
	}

	async getUploadStatus(uploadId: string): Promise<UploadStatus> {
		validateUUID(uploadId, "uploadId");
		await this.ensureActivated();
		// Use GET since we need the full status object
		return this.request<UploadStatus>("GET", `/storage/v1/uploads/${uploadId}`, {
			operation: "getUploadStatus",
			telemetryRoute: "/storage/v1/uploads/:uploadId",
		});
	}

	async completeUpload(uploadId: string): Promise<CompleteUploadResult> {
		validateUUID(uploadId, "uploadId");
		await this.ensureActivated();
		return this.request("POST", `/storage/v1/uploads/${uploadId}/complete`, {
			operation: "completeUpload",
			telemetryRoute: "/storage/v1/uploads/:uploadId/complete",
		});
	}

	async getDownloadDescriptor(
		documentId: string,
		version: number,
		options?: {
			readonly token?: string | null;
			readonly expiresAt?: number | null;
			readonly signature?: string | null;
		},
	): Promise<DownloadDescriptor> {
		await this.ensureActivated();
		const params = new URLSearchParams({
			tenantId: this.config.tenantId,
		});

		if (options?.token) {
			params.set("token", options.token);
		}
		if (options?.expiresAt) {
			params.set("expiresAt", String(options.expiresAt));
		}
		if (options?.signature) {
			params.set("signature", options.signature);
		}

		return this.request(
			"GET",
			`/storage/v1/documents/${documentId}/versions/${version}/download?${params}`,
			{
				operation: "getDownloadDescriptor",
				telemetryRoute: "/storage/v1/documents/:documentId/versions/:version/download",
			},
		);
	}

	async downloadStream(
		documentId: string,
		version: number,
		options?: {
			readonly token?: string | null;
			readonly expiresAt?: number | null;
			readonly signature?: string | null;
			readonly range?: string | null;
		},
	): Promise<{
		readonly stream: ReadableStream<Uint8Array>;
		readonly statusCode: 200 | 206;
		readonly totalSize: number;
		readonly contentLength: number;
		readonly range?: { readonly start: number; readonly end: number };
		readonly checksumSha3: string;
	}> {
		await this.ensureActivated();
		const params = new URLSearchParams({
			tenantId: this.config.tenantId,
		});

		if (options?.token) {
			params.set("token", options.token);
		}
		if (options?.expiresAt) {
			params.set("expiresAt", String(options.expiresAt));
		}
		if (options?.signature) {
			params.set("signature", options.signature);
		}
		if (options?.range) {
			params.set("range", options.range);
		}

		const url = `${this.config.baseUrl}/storage/v1/documents/${documentId}/versions/${version}/content?${params}`;
		const headers: Record<string, string> = {};

		if (options?.range) {
			headers["Range"] = options.range;
		}

		headers["Authorization"] = `Bearer ${this.config.apiKey}`;

		// Auto-inject tenant ID from activation response
		if (this.resolvedTenantId) {
			headers["x-qnsp-tenant-id"] = this.resolvedTenantId;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
		const route = "/storage/v1/documents/:documentId/versions/:version/content";
		const start = performance.now();
		let status: "ok" | "error" = "ok";
		let httpStatus: number | undefined;
		let errorMessage: string | undefined;
		let bytesReceived: number | undefined;

		try {
			const response = await fetch(url, {
				method: "GET",
				headers,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);
			httpStatus = response.status;

			if (!response.ok) {
				status = "error";
				errorMessage = `HTTP ${response.status}`;
				throw new Error(`Download error: ${response.status} ${response.statusText}`);
			}

			const contentRange = response.headers.get("Content-Range");
			const rangeMatch = contentRange?.startsWith("bytes ")
				? contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/)
				: null;

			const parsedRange =
				rangeMatch?.[1] && rangeMatch[2]
					? {
							start: Number.parseInt(rangeMatch[1], 10),
							end: Number.parseInt(rangeMatch[2], 10),
						}
					: undefined;

			const totalSize = rangeMatch?.[3]
				? Number.parseInt(rangeMatch[3], 10)
				: Number.parseInt(response.headers.get("X-Total-Size") ?? "0", 10);
			const contentLength = Number.parseInt(response.headers.get("Content-Length") ?? "0", 10);
			const checksumSha3 = response.headers.get("X-Checksum-Sha3") ?? "";

			const stream =
				response.body ??
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.close();
					},
				});

			bytesReceived = contentLength > 0 ? contentLength : totalSize > 0 ? totalSize : undefined;

			const statusCode = (response.status === 206 ? 206 : 200) as 200 | 206;

			return {
				stream,
				statusCode,
				totalSize: totalSize > 0 ? totalSize : contentLength,
				contentLength: contentLength > 0 ? contentLength : totalSize,
				checksumSha3,
				...(parsedRange ? { range: parsedRange } : {}),
			};
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
			const event: StorageClientTelemetryEvent = {
				operation: "downloadStream",
				method: "GET",
				route,
				target: this.targetService,
				status,
				durationMs,
				...(typeof httpStatus === "number" ? { httpStatus } : {}),
				...(status === "error" && errorMessage ? { error: errorMessage } : {}),
				...(typeof bytesReceived === "number" ? { bytesReceived } : {}),
			};
			this.recordTelemetryEvent(event);
		}
	}

	/**
	 * Retrieve document policies (compliance + lifecycle summary).
	 * Requires x-tenant-id header.
	 */
	async getDocumentPolicies(documentId: string): Promise<DocumentPolicies> {
		validateUUID(documentId, "documentId");
		await this.ensureActivated();
		return this.request("GET", `/storage/v1/documents/${documentId}/policies`, {
			operation: "getDocumentPolicies",
			telemetryRoute: "/storage/v1/documents/:documentId/policies",
			headers: {
				"x-tenant-id": this.config.tenantId,
			},
		});
	}

	/**
	 * Update document retention/WORM/legal hold list atomically.
	 * Requires x-tenant-id header.
	 */
	async updateDocumentPolicies(
		documentId: string,
		input: UpdatePoliciesRequest,
	): Promise<DocumentPolicies> {
		validateUUID(documentId, "documentId");
		await this.ensureActivated();
		return this.request("PATCH", `/storage/v1/documents/${documentId}/policies`, {
			body: input,
			operation: "updateDocumentPolicies",
			telemetryRoute: "/storage/v1/documents/:documentId/policies",
			headers: {
				"x-tenant-id": this.config.tenantId,
			},
		});
	}

	/**
	 * Apply a legal hold by id. Hold ids are caller-defined.
	 * Requires x-tenant-id header.
	 */
	async applyLegalHold(
		documentId: string,
		request: ApplyLegalHoldRequest,
	): Promise<{
		readonly documentId: string;
		readonly tenantId: string;
		readonly legalHolds: readonly string[];
	}> {
		validateUUID(documentId, "documentId");
		await this.ensureActivated();
		return this.request("POST", `/storage/v1/documents/${documentId}/legal-holds`, {
			body: request,
			operation: "applyLegalHold",
			telemetryRoute: "/storage/v1/documents/:documentId/legal-holds",
			headers: {
				"x-tenant-id": this.config.tenantId,
			},
		});
	}

	/**
	 * Release a legal hold by id.
	 * Requires x-tenant-id header.
	 */
	async releaseLegalHold(documentId: string, holdId: string): Promise<void> {
		validateUUID(documentId, "documentId");
		await this.ensureActivated();
		return this.request("DELETE", `/storage/v1/documents/${documentId}/legal-holds/${holdId}`, {
			operation: "releaseLegalHold",
			telemetryRoute: "/storage/v1/documents/:documentId/legal-holds/:holdId",
			headers: {
				"x-tenant-id": this.config.tenantId,
			},
		});
	}

	/**
	 * Schedule a lifecycle tier transition for a document.
	 * Requires x-tenant-id header.
	 */
	async scheduleLifecycleTransition(
		documentId: string,
		request: ScheduleTransitionRequest,
	): Promise<{
		readonly documentId: string;
		readonly tenantId: string;
		readonly lifecycle: {
			readonly currentTier?: "hot" | "warm" | "cold" | "frozen";
			readonly targetTier?: "hot" | "warm" | "cold" | "frozen" | null;
			readonly transitionAfter?: string | null;
		};
	}> {
		validateUUID(documentId, "documentId");
		await this.ensureActivated();
		return this.request("POST", `/storage/v1/documents/${documentId}/lifecycle/transitions`, {
			body: request,
			operation: "scheduleLifecycleTransition",
			telemetryRoute: "/storage/v1/documents/:documentId/lifecycle/transitions",
			headers: {
				"x-tenant-id": this.config.tenantId,
			},
		});
	}

	async createClassificationPolicy(policy: CreateClassificationPolicyRequest): Promise<{
		readonly id: string;
		readonly name: string;
		readonly classificationLevel: ClassificationLevel;
		readonly piiDetectionEnabled: boolean;
		readonly createdAt: string;
	}> {
		await this.ensureActivated();
		return this.request("POST", "/storage/v1/classification/policies", {
			body: policy,
			operation: "createClassificationPolicy",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async listClassificationPolicies(options?: {
		readonly enabled?: boolean;
	}): Promise<{ readonly policies: readonly ClassificationPolicySummary[] }> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (options?.enabled !== undefined) params.set("enabled", String(options.enabled));
		const query = params.toString();
		return this.request("GET", `/storage/v1/classification/policies${query ? `?${query}` : ""}`, {
			operation: "listClassificationPolicies",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async classifyObject(
		objectId: string,
		classification: Omit<ClassifyObjectRequest, "objectId">,
	): Promise<{
		readonly id: string;
		readonly objectId: string;
		readonly classificationLevel: ClassificationLevel;
		readonly piiDetected: boolean;
		readonly piiTypesCount: number;
		readonly classifiedAt: string;
	}> {
		validateUUID(objectId, "objectId");
		await this.ensureActivated();
		return this.request("POST", "/storage/v1/classification/objects", {
			body: { objectId, ...classification },
			operation: "classifyObject",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async getObjectClassification(objectId: string): Promise<ObjectClassification> {
		validateUUID(objectId, "objectId");
		await this.ensureActivated();
		return this.request("GET", `/storage/v1/classification/objects/${objectId}`, {
			operation: "getObjectClassification",
			telemetryRoute: "/storage/v1/classification/objects/:objectId",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async startClassificationScan(scope: StartClassificationScanRequest): Promise<{
		readonly id: string;
		readonly scanType: "full" | "incremental" | "pii_only" | "reclassify";
		readonly status: "in_progress";
		readonly startedAt: string;
	}> {
		await this.ensureActivated();
		return this.request("POST", "/storage/v1/classification/scans", {
			body: scope,
			operation: "startClassificationScan",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async detectPII(content: string, contentType?: string): Promise<DetectPiiResult> {
		await this.ensureActivated();
		return this.request("POST", "/storage/v1/classification/detect-pii", {
			body: { content, contentType },
			operation: "detectPII",
		});
	}

	async getClassificationStats(): Promise<ClassificationStats> {
		await this.ensureActivated();
		return this.request("GET", "/storage/v1/classification/stats", {
			operation: "getClassificationStats",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async createRetentionPolicy(policy: CreateRetentionPolicyRequest): Promise<{
		readonly id: string;
		readonly name: string;
		readonly retentionType: RetentionType;
		readonly retentionDays: number | null;
		readonly deletionType: DeletionType;
		readonly createdAt: string;
	}> {
		await this.ensureActivated();
		return this.request("POST", "/storage/v1/retention/policies", {
			body: policy,
			operation: "createRetentionPolicy",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async listRetentionPolicies(options?: {
		readonly enabled?: boolean;
	}): Promise<{ readonly policies: readonly RetentionPolicySummary[] }> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (options?.enabled !== undefined) params.set("enabled", String(options.enabled));
		const query = params.toString();
		return this.request("GET", `/storage/v1/retention/policies${query ? `?${query}` : ""}`, {
			operation: "listRetentionPolicies",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async placeHold(
		objectId: string,
		hold: Omit<PlaceHoldRequest, "objectId">,
	): Promise<{
		readonly id: string;
		readonly objectId: string;
		readonly holdType: LegalHoldType;
		readonly legalCaseId: string | null;
		readonly createdBy: string;
		readonly createdAt: string;
	}> {
		validateUUID(objectId, "objectId");
		await this.ensureActivated();
		return this.request("POST", "/storage/v1/retention/holds", {
			body: { objectId, ...hold },
			operation: "placeHold",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async releaseHold(
		holdId: string,
		releaseReason: string,
	): Promise<{
		readonly id: string;
		readonly status: "released";
		readonly releasedAt: string;
		readonly releasedBy: string;
		readonly releaseReason: string;
	}> {
		validateUUID(holdId, "holdId");
		await this.ensureActivated();
		return this.request("POST", `/storage/v1/retention/holds/${holdId}/release`, {
			body: { releaseReason },
			operation: "releaseHold",
			telemetryRoute: "/storage/v1/retention/holds/:holdId/release",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async scheduleDelete(
		objectId: string,
		schedule: Omit<ScheduleDeleteRequest, "objectId">,
	): Promise<{
		readonly id: string;
		readonly objectId: string;
		readonly status: "pending" | "pending_approval";
		readonly scheduledAt: string;
		readonly deletionType: DeletionType;
		readonly approvalRequired: boolean;
	}> {
		validateUUID(objectId, "objectId");
		await this.ensureActivated();
		return this.request("POST", "/storage/v1/retention/deletions", {
			body: { objectId, ...schedule },
			operation: "scheduleDelete",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async evaluateRetention(
		objectId: string,
		options?: { readonly objectPath?: string; readonly metadata?: Record<string, unknown> },
	): Promise<EvaluateRetentionResult> {
		validateUUID(objectId, "objectId");
		await this.ensureActivated();
		return this.request("POST", "/storage/v1/retention/evaluate", {
			body: { objectId, ...options },
			operation: "evaluateRetention",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async createReplicationConfig(config: CreateReplicationConfigRequest): Promise<{
		readonly id: string;
		readonly name: string;
		readonly sourceRegion: string;
		readonly targetRegions: readonly string[];
		readonly replicationMode: ReplicationMode;
		readonly createdAt: string;
	}> {
		await this.ensureActivated();
		return this.request("POST", "/storage/v1/replication/configurations", {
			body: config,
			operation: "createReplicationConfig",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async listReplicationConfigs(options?: {
		readonly enabled?: boolean;
		readonly sourceRegion?: string;
	}): Promise<{ readonly configurations: readonly ReplicationConfigSummary[] }> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (options?.enabled !== undefined) params.set("enabled", String(options.enabled));
		if (options?.sourceRegion) params.set("sourceRegion", options.sourceRegion);
		const query = params.toString();
		return this.request(
			"GET",
			`/storage/v1/replication/configurations${query ? `?${query}` : ""}`,
			{
				operation: "listReplicationConfigs",
				headers: { "x-qnsp-tenant-id": this.config.tenantId },
			},
		);
	}

	async replicateObject(
		objectId: string,
		regions: readonly string[],
		options?: {
			readonly sizeBytes?: number;
			readonly sourceChecksum?: string;
			readonly configurationId?: string;
			readonly priority?: "low" | "normal" | "high" | "critical";
		},
	): Promise<{
		readonly objectId: string;
		readonly replications: readonly {
			readonly id: string;
			readonly targetRegion: string;
			readonly status: "pending";
		}[];
		readonly initiatedAt: string;
	}> {
		validateUUID(objectId, "objectId");
		await this.ensureActivated();
		return this.request("POST", "/storage/v1/replication/objects", {
			body: {
				objectId,
				targetRegions: regions,
				sizeBytes: options?.sizeBytes ?? 0,
				sourceChecksum: options?.sourceChecksum,
				configurationId: options?.configurationId,
				priority: options?.priority ?? "normal",
			},
			operation: "replicateObject",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async getReplicationStatus(objectId: string): Promise<{
		readonly objectId: string;
		readonly replications: readonly ObjectReplicationStatus[];
	}> {
		validateUUID(objectId, "objectId");
		await this.ensureActivated();
		return this.request("GET", `/storage/v1/replication/objects/${objectId}/status`, {
			operation: "getReplicationStatus",
			telemetryRoute: "/storage/v1/replication/objects/:objectId/status",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async getReplicationMetrics(options?: {
		readonly sourceRegion?: string;
		readonly targetRegion?: string;
		readonly periodDays?: number;
	}): Promise<ReplicationMetrics> {
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (options?.sourceRegion) params.set("sourceRegion", options.sourceRegion);
		if (options?.targetRegion) params.set("targetRegion", options.targetRegion);
		if (options?.periodDays !== undefined) params.set("periodDays", String(options.periodDays));
		const query = params.toString();
		return this.request("GET", `/storage/v1/replication/metrics${query ? `?${query}` : ""}`, {
			operation: "getReplicationMetrics",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async getRegionHealth(): Promise<ReplicationHealth> {
		await this.ensureActivated();
		return this.request("GET", "/storage/v1/replication/health", {
			operation: "getRegionHealth",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async createTieringPolicy(policy: CreateTieringPolicyRequest): Promise<{
		readonly id: string;
		readonly tenantId: string;
		readonly name: string;
		readonly enabled: boolean;
		readonly rulesCount: number;
		readonly createdAt: string;
	}> {
		await this.ensureActivated();
		return this.request("POST", "/storage/v1/tiering/policies", {
			body: policy,
			operation: "createTieringPolicy",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async listTieringPolicies(): Promise<{ readonly policies: readonly TieringPolicy[] }> {
		await this.ensureActivated();
		return this.request("GET", "/storage/v1/tiering/policies", {
			operation: "listTieringPolicies",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async evaluateTiering(
		policyId: string,
		options?: { readonly dryRun?: boolean },
	): Promise<EvaluateTieringResult> {
		validateUUID(policyId, "policyId");
		await this.ensureActivated();
		const params = new URLSearchParams();
		if (options?.dryRun !== undefined) params.set("dryRun", String(options.dryRun));
		const query = params.toString();
		return this.request(
			"POST",
			`/storage/v1/tiering/policies/${policyId}/evaluate${query ? `?${query}` : ""}`,
			{
				operation: "evaluateTiering",
				telemetryRoute: "/storage/v1/tiering/policies/:policyId/evaluate",
				headers: { "x-qnsp-tenant-id": this.config.tenantId },
			},
		);
	}

	async getTieringStats(): Promise<TieringStats> {
		await this.ensureActivated();
		return this.request("GET", "/storage/v1/tiering/stats", {
			operation: "getTieringStats",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	async getTieringRecommendations(): Promise<{
		readonly recommendations: readonly TieringRecommendation[];
	}> {
		await this.ensureActivated();
		return this.request("GET", "/storage/v1/tiering/recommendations", {
			operation: "getTieringRecommendations",
			headers: { "x-qnsp-tenant-id": this.config.tenantId },
		});
	}

	private recordTelemetryEvent(event: StorageClientTelemetryEvent): void {
		if (!this.telemetry) {
			return;
		}
		this.telemetry.record(event);
	}
}

export * from "./events.js";
export * from "./observability.js";
export * from "./types.js";
export * from "./validation.js";
