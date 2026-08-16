/**
 * QNSP AutoGen Executor - `@heossihq/qnsi/autogen` subpath.
 *
 * Submits code-execution workloads to QNSP AI orchestrator enclaves and waits
 * for completion, returning structured output with the enclave attestation
 * proof. Provides a function-executor interface compatible with AutoGen's code
 * execution pattern - without importing from `autogen` directly.
 *
 * Folded in from the former standalone `@heossihq/qnsi-autogen-qnsp` package
 * (2026-05-16). The workload submit/get HTTP is inlined here (faithful to the
 * former `@heossihq/qnsi-ai-sdk` `AiOrchestratorClient`: Bearer auth,
 * `idempotency-key` header, `env` defaulted, bounded retry) so this subpath
 * has no `@heossihq/qnsi-*` workspace dependency - same pattern as
 * `../_activation`. Tier/enclave access is enforced authoritatively by the
 * edge-gateway + ai-orchestrator server side (a 402/403 surfaces as an Error);
 * the former client-side tier pre-check was advisory only and is intentionally
 * dropped (single source of truth = server).
 */

import { z } from "zod";
import { activateSdk } from "../_activation/index.js";
import { bridgeQnsiEnv } from "../internal/env-aliases.js";

// Accept both QNSI_* (canonical) and legacy QNSP_* user env vars.
bridgeQnsiEnv();

const SDK_VERSION = "0.3.0";
const SDK_ID = "autogen-qnsi";

// Activation handshake - keeps telemetry and tier limits consistent. Returns
// the tenantId so callers can attach it to workload submissions.
async function resolveActivationTenantId(apiKey: string, baseUrl: string): Promise<string> {
	const activation = await activateSdk({
		apiKey,
		sdkId: SDK_ID,
		sdkVersion: SDK_VERSION,
		platformUrl: baseUrl,
	});
	return activation.tenantId;
}

// ─── Faithful workload types (ported from @heossihq/qnsi-ai-sdk types.ts) ──────

export type WorkloadStatus =
	| "pending"
	| "scheduled"
	| "running"
	| "canceling"
	| "succeeded"
	| "failed"
	| "canceled";

export type WorkloadPriority = "low" | "normal" | "high";
export type SchedulingPolicy = "spot" | "on-demand" | "mixed";

export interface WorkloadResources {
	readonly cpu: number;
	readonly memoryGiB: number;
	readonly gpu: number;
	readonly acceleratorType: string;
}

export interface WorkloadArtifactBinding {
	readonly artifactId: string;
	readonly mountPath: string;
	readonly accessMode: "read" | "read-write";
}

export interface WorkloadManifest {
	readonly pqcSignature: string;
	readonly algorithm: string;
	readonly issuedAt: string;
	readonly [key: string]: unknown;
}

export interface WorkloadSecurityProfile {
	readonly controlPlaneTokenSha256: string | null;
	readonly pqcSignatures: ReadonlyArray<{ provider: string; algorithm: string }>;
	readonly hardwareProvider: string | null;
	readonly attestationStatus: string | null;
	readonly attestationProof: string | null;
}

export interface SubmitWorkloadRequest {
	readonly tenantId: string;
	readonly name: string;
	readonly priority: WorkloadPriority;
	readonly schedulingPolicy: SchedulingPolicy;
	readonly containerImage: string;
	readonly command: readonly string[];
	readonly env?: Record<string, string>;
	readonly resources: WorkloadResources;
	readonly artifacts: readonly WorkloadArtifactBinding[];
	readonly manifest: WorkloadManifest;
	readonly labels?: Record<string, string>;
	readonly idempotencyKey?: string;
}

export interface SubmitWorkloadResponse {
	readonly workloadId: string;
	readonly status: WorkloadStatus;
	readonly replayed: boolean;
	readonly acceptedAt: string | null;
}

export interface WorkloadSummary {
	readonly id: string;
	readonly tenantId: string;
	readonly name: string;
	readonly status: WorkloadStatus;
	readonly priority: WorkloadPriority;
	readonly schedulingPolicy: SchedulingPolicy;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly acceptedAt: string | null;
	readonly completedAt: string | null;
	readonly labels: Record<string, string> | null;
	readonly security: WorkloadSecurityProfile;
}

export interface WorkloadDetail extends WorkloadSummary {
	readonly manifest: WorkloadManifest;
	readonly resources: WorkloadResources;
	readonly artifacts: readonly WorkloadArtifactBinding[];
	readonly schedulerMetadata: Record<string, unknown> | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface QnsiExecutorConfig {
	/**
	 * QNSP API key. Get one at https://cloud.qnsi.heossi.com/api-keys
	 * The API key carries the tenant ID - no separate tenantId needed.
	 */
	readonly apiKey: string;
	/**
	 * Tenant ID for all workload submissions.
	 * Optional - when omitted, the tenant is resolved automatically from the API key
	 * via SDK activation. Only provide this if you need to override the resolved tenant.
	 */
	readonly tenantId?: string;
	/**
	 * Base URL for the QNSP API.
	 * Defaults to https://api.qnsi.heossi.com
	 */
	readonly baseUrl?: string;
	/**
	 * Container image to use for code execution workloads.
	 * Defaults to "qnsp/enclave-python-runtime:latest"
	 */
	readonly containerImage?: string;
	/**
	 * CPU allocation for each workload (fractional cores).
	 * Defaults to 1.
	 */
	readonly cpu?: number;
	/**
	 * Memory allocation in GiB for each workload.
	 * Defaults to 2.
	 */
	readonly memoryGiB?: number;
	/**
	 * GPU allocation. Defaults to 0 (CPU-only).
	 * Set > 0 to use GPU enclaves (requires enterprise tier + enclave-gpu-capacity add-on).
	 */
	readonly gpu?: number;
	/**
	 * Accelerator type when gpu > 0.
	 * Defaults to "nvidia-a100".
	 */
	readonly acceleratorType?: string;
	/**
	 * Maximum time in milliseconds to wait for a workload to complete.
	 * Defaults to 300000 (5 minutes).
	 */
	readonly pollTimeoutMs?: number;
	/**
	 * Interval in milliseconds between workload status polls.
	 * Defaults to 2000 (2 seconds).
	 */
	readonly pollIntervalMs?: number;
	/**
	 * Per-request timeout in milliseconds. Defaults to 30000.
	 */
	readonly requestTimeoutMs?: number;
}

export interface ExecuteCodeRequest {
	/** The code to execute inside the enclave. */
	readonly code: string;
	/**
	 * Programming language / runtime. Used to select the execution command.
	 * Defaults to "python".
	 */
	readonly language?: "python" | "bash" | "javascript";
	/** Environment variables to inject into the workload. */
	readonly env?: Record<string, string>;
	/** Human-readable name for this workload (used in audit logs). */
	readonly name?: string;
	/**
	 * Idempotency key - if provided, duplicate submissions with the same key
	 * return the original workload result instead of creating a new one.
	 */
	readonly idempotencyKey?: string;
}

export interface ExecuteCodeResult {
	/** The workload ID assigned by the AI orchestrator. */
	readonly workloadId: string;
	/** Final workload status. */
	readonly status: WorkloadStatus;
	/** Whether this result was replayed from a previous idempotent submission. */
	readonly replayed: boolean;
	/** PQC attestation proof from the enclave (if available). */
	readonly attestationProof: string | null;
	/** Hardware provider for the enclave (if available). */
	readonly hardwareProvider: string | null;
	/** ISO timestamp when the workload was accepted. */
	readonly acceptedAt: string | null;
	/** ISO timestamp when the workload completed. */
	readonly completedAt: string | null;
}

// ─── Zod schema for workload security profile ─────────────────────────────────

const securityProfileSchema = z.object({
	attestationProof: z.string().nullable(),
	hardwareProvider: z.string().nullable(),
	attestationStatus: z.string().nullable(),
	controlPlaneTokenSha256: z.string().nullable(),
	pqcSignatures: z.array(z.object({ provider: z.string(), algorithm: z.string() })),
});

// ─── Terminal status set ──────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set<WorkloadStatus>(["succeeded", "failed", "canceled"]);

// ─── Language → command mapping ───────────────────────────────────────────────

const LANGUAGE_COMMANDS: Record<string, readonly string[]> = {
	python: ["python", "-c"],
	bash: ["bash", "-c"],
	javascript: ["node", "-e"],
};

// ─── QnsiExecutor ─────────────────────────────────────────────────────────────

/**
 * AutoGen-compatible code executor backed by QNSP AI orchestrator enclaves.
 *
 * @example
 * ```typescript
 * import { QnsiExecutor } from "@heossihq/qnsi/autogen";
 *
 * const executor = new QnsiExecutor({ apiKey: process.env.QNSI_API_KEY });
 * const result = await executor.execute({ code: "print('hi')", language: "python" });
 * console.log(result.status, result.attestationProof);
 * ```
 */
export class QnsiExecutor {
	readonly #apiKey: string;
	readonly #baseUrl: string;
	readonly #containerImage: string;
	readonly #cpu: number;
	readonly #memoryGiB: number;
	readonly #gpu: number;
	readonly #acceleratorType: string;
	readonly #pollTimeoutMs: number;
	readonly #pollIntervalMs: number;
	readonly #requestTimeoutMs: number;
	#resolvedTenantId: string | null;
	#activationPromise: Promise<void> | null = null;

	constructor(config: QnsiExecutorConfig) {
		this.#resolvedTenantId = config.tenantId ?? null;
		this.#containerImage = config.containerImage ?? "qnsp/enclave-python-runtime:latest";
		this.#cpu = config.cpu ?? 1;
		this.#memoryGiB = config.memoryGiB ?? 2;
		this.#gpu = config.gpu ?? 0;
		this.#acceleratorType = config.acceleratorType ?? "nvidia-a100";
		this.#pollTimeoutMs = config.pollTimeoutMs ?? 300_000;
		this.#pollIntervalMs = config.pollIntervalMs ?? 2_000;
		this.#requestTimeoutMs = config.requestTimeoutMs ?? 30_000;
		this.#apiKey = config.apiKey;
		this.#baseUrl = (config.baseUrl ?? "https://api.qnsi.heossi.com").replace(/\/$/, "");
	}

	/**
	 * Resolve the effective tenant ID - either from config or via SDK activation.
	 * Caches the result after the first call.
	 */
	async #ensureTenantId(): Promise<string> {
		if (this.#resolvedTenantId) {
			return this.#resolvedTenantId;
		}
		if (!this.#activationPromise) {
			this.#activationPromise = resolveActivationTenantId(this.#apiKey, this.#baseUrl).then(
				(tenantId) => {
					this.#resolvedTenantId = tenantId;
				},
			);
		}
		await this.#activationPromise;
		if (!this.#resolvedTenantId) {
			throw new Error(
				"QNSP AutoGen: tenantId could not be resolved. Ensure your API key is valid.",
			);
		}
		return this.#resolvedTenantId;
	}

	/**
	 * Authenticated request against the AI orchestrator via the edge gateway.
	 * Faithful to the former @heossihq/qnsi-ai-sdk request: Bearer apiKey, JSON,
	 * bounded retry (3 attempts, 1s backoff) on network / 5xx.
	 */
	async #request<T>(
		method: string,
		path: string,
		body?: unknown,
		extraHeaders?: Record<string, string>,
	): Promise<T> {
		const url = `${this.#baseUrl}${path}`;
		const headers: Record<string, string> = {
			authorization: `Bearer ${this.#apiKey}`,
			accept: "application/json",
			...extraHeaders,
		};
		const init: RequestInit = { method, headers };
		if (body !== undefined) {
			headers["content-type"] = "application/json";
			init.body = JSON.stringify(body);
		}

		const maxAttempts = 3;
		// Every exit is explicit inside the loop (return or throw), so no
		// unreachable terminator is needed after it.
		for (let attempt = 1; ; attempt++) {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), this.#requestTimeoutMs);
			try {
				const response = await fetch(url, { ...init, signal: controller.signal });
				const text = await response.text().catch(() => "");
				if (!response.ok) {
					// Retry only transient 5xx; surface 4xx (incl. tier 402/403) immediately.
					if (response.status >= 500 && attempt < maxAttempts) {
						await delay(1_000);
						continue;
					}
					let message = `AI orchestrator request failed (${response.status})`;
					try {
						const parsed = JSON.parse(text) as Record<string, unknown>;
						if (typeof parsed["message"] === "string") message = parsed["message"];
						else if (typeof parsed["error"] === "string") message = parsed["error"];
					} catch {
						if (text.length > 0) message = text;
					}
					throw new Error(message);
				}
				if (response.status === 204 || text.length === 0) {
					return {} as T;
				}
				return JSON.parse(text) as T;
			} catch (err) {
				const isAbort = err instanceof Error && err.name === "AbortError";
				if (attempt < maxAttempts && (isAbort || err instanceof TypeError)) {
					await delay(1_000);
					continue;
				}
				throw err;
			} finally {
				clearTimeout(timer);
			}
		}
	}

	/**
	 * Execute code inside a QNSP enclave and wait for the result.
	 */
	async execute(request: ExecuteCodeRequest): Promise<ExecuteCodeResult> {
		const language = request.language ?? "python";
		const command = LANGUAGE_COMMANDS[language];
		if (!command) {
			throw new Error(`Unsupported language: ${language}. Supported: python, bash, javascript`);
		}

		const workloadName = request.name ?? `autogen-${language}-${Date.now()}`;
		const issuedAt = new Date().toISOString();
		const tenantId = await this.#ensureTenantId();

		const workloadRequest: SubmitWorkloadRequest = {
			tenantId,
			name: workloadName,
			priority: "normal",
			schedulingPolicy: this.#gpu > 0 ? "on-demand" : "spot",
			containerImage: this.#containerImage,
			command: [...command, request.code],
			env: request.env ?? {},
			resources: {
				cpu: this.#cpu,
				memoryGiB: this.#memoryGiB,
				gpu: this.#gpu,
				acceleratorType: this.#acceleratorType,
			},
			artifacts: [],
			manifest: {
				pqcSignature: "",
				algorithm: "none",
				issuedAt,
				language,
				executor: "autogen-qnsp",
			},
			labels: {
				"qnsp.io/executor": "autogen-qnsp",
				"qnsp.io/language": language,
			},
			...(request.idempotencyKey !== undefined ? { idempotencyKey: request.idempotencyKey } : {}),
		};

		const submitted = await this.#submitWorkload(workloadRequest);

		// If already in a terminal state (e.g. replayed idempotent result), return immediately
		if (TERMINAL_STATUSES.has(submitted.status)) {
			return {
				workloadId: submitted.workloadId,
				status: submitted.status,
				replayed: submitted.replayed,
				attestationProof: null,
				hardwareProvider: null,
				acceptedAt: submitted.acceptedAt,
				completedAt: null,
			};
		}

		const detail = await this.#pollUntilComplete(submitted.workloadId);
		const security = securityProfileSchema.safeParse(detail.security);

		return {
			workloadId: detail.id,
			status: detail.status,
			replayed: submitted.replayed,
			attestationProof: security.success ? security.data.attestationProof : null,
			hardwareProvider: security.success ? security.data.hardwareProvider : null,
			acceptedAt: detail.acceptedAt,
			completedAt: detail.completedAt,
		};
	}

	/**
	 * Submit a workload. Faithful to @heossihq/qnsi-ai-sdk: `idempotencyKey` is
	 * stripped from the body and sent as the `idempotency-key` header; `env`
	 * defaults to `{}`.
	 */
	async #submitWorkload(input: SubmitWorkloadRequest): Promise<SubmitWorkloadResponse> {
		const { idempotencyKey, ...payload } = input;
		const extraHeaders: Record<string, string> = {};
		if (idempotencyKey) {
			extraHeaders["idempotency-key"] = idempotencyKey;
		}
		// execute() always defaults env before building the payload, so no
		// second fallback is reachable here.
		return this.#request<SubmitWorkloadResponse>("POST", "/ai/v1/workloads", payload, extraHeaders);
	}

	async #getWorkload(workloadId: string): Promise<WorkloadDetail> {
		return this.#request<WorkloadDetail>(
			"GET",
			`/ai/v1/workloads/${encodeURIComponent(workloadId)}`,
		);
	}

	/**
	 * Poll a workload until it reaches a terminal state or the timeout is exceeded.
	 */
	async #pollUntilComplete(workloadId: string): Promise<WorkloadDetail> {
		const deadline = Date.now() + this.#pollTimeoutMs;

		while (Date.now() < deadline) {
			const detail = await this.#getWorkload(workloadId);

			if (TERMINAL_STATUSES.has(detail.status)) {
				return detail;
			}

			const remaining = deadline - Date.now();
			const wait = Math.min(this.#pollIntervalMs, remaining);
			if (wait > 0) {
				await delay(wait);
			}
		}

		throw new Error(
			`Workload ${workloadId} did not complete within ${this.#pollTimeoutMs}ms poll timeout`,
		);
	}
}

function delay(ms: number): Promise<void> {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
