/**
 * QNSP AI Orchestrator — model registry, AI workloads with enclave
 * attestation, inference, bias / prompt-injection monitoring. Wraps
 * `apps/ai-orchestrator` (`/ai/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";

const PATH_PREFIX = "/proxy/ai/v1";

export interface RegisterModelRequest {
	readonly name: string;
	readonly version: string;
	readonly provider: string;
	readonly capabilities?: readonly string[];
	readonly metadata?: Record<string, unknown>;
}

export interface SubmitWorkloadRequest {
	readonly modelId: string;
	readonly type: string; // "training" | "fine-tune" | "inference-batch"
	readonly inputRefs?: readonly string[];
	readonly outputBucket?: string;
	readonly enclaveType?: string;
	readonly metadata?: Record<string, unknown>;
}

export interface InferenceRequest {
	readonly modelId: string;
	readonly input: Record<string, unknown>;
	readonly stream?: boolean;
	readonly metadata?: Record<string, unknown>;
}

export interface RegisterArtifactRequest {
	readonly name: string;
	readonly hash: string;
	readonly storageId: string;
	readonly type?: string;
	readonly metadata?: Record<string, unknown>;
}

export class AiClient {
	constructor(private readonly internal: Internal) {}

	// ── Model registry ──────────────────────────────────────────────

	registerModel(req: RegisterModelRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/models`, req, opts);
	}

	listModels(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/models`, undefined, { query });
	}

	getModel(modelId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/models/${modelId}`);
	}

	updateModel(
		modelId: string,
		body: Record<string, unknown>,
		opts?: Pick<RequestOptions, "idempotencyKey">,
	) {
		return this.internal.request("PATCH", `${PATH_PREFIX}/models/${modelId}`, body, opts);
	}

	activateModel(modelId: string, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request(
			"POST",
			`${PATH_PREFIX}/models/${modelId}/activate`,
			undefined,
			opts,
		);
	}

	deployModel(body: Record<string, unknown>, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/models/deploy`, body, opts);
	}

	// ── Workloads ───────────────────────────────────────────────────

	submitWorkload(req: SubmitWorkloadRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/workloads`, req, opts);
	}

	getWorkload(workloadId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/workloads/${workloadId}`);
	}

	listWorkloads(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/workloads`, undefined, { query });
	}

	cancelWorkload(workloadId: string, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request(
			"POST",
			`${PATH_PREFIX}/workloads/${workloadId}/cancel`,
			undefined,
			opts,
		);
	}

	// ── Inference ────────────────────────────────────────────────────

	invokeInference(req: InferenceRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/inference`, req, opts);
	}

	// ── Artifacts ────────────────────────────────────────────────────

	registerArtifact(req: RegisterArtifactRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/artifacts`, req, opts);
	}
}
