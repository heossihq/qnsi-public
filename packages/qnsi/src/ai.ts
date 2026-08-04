/**
 * QNSP AI Orchestrator - model registry, AI workloads with enclave
 * attestation, inference, bias / prompt-injection monitoring. Wraps
 * `apps/ai-orchestrator` (`/ai/v1`).
 */

import type { Internal, RequestOptions } from "./_internal.js";

const PATH_PREFIX = "/proxy/ai/v1";

export type ModelProvider =
	| "openai"
	| "anthropic"
	| "google"
	| "meta"
	| "deepseek"
	| "bedrock"
	| "huggingface"
	| "custom";

export type ModelType =
	| "llm"
	| "embedding"
	| "image"
	| "audio"
	| "multimodal"
	| "classification"
	| "regression";

export type WorkloadPriority = "low" | "normal" | "high";
export type SchedulingPolicy = "spot" | "on-demand" | "mixed";

export interface RegisterModelRequest {
	readonly name: string;
	readonly version: string;
	readonly provider: ModelProvider;
	readonly modelType: ModelType;
	readonly description?: string;
	readonly baseModelId?: string;
	readonly capabilities?: readonly string[];
	readonly inputSchema?: Record<string, unknown>;
	readonly outputSchema?: Record<string, unknown>;
	readonly trainingMetadata?: {
		readonly datasetId?: string;
		readonly epochs?: number;
		readonly learningRate?: number;
		readonly trainedAt?: string;
	};
	readonly servingConfig?: {
		readonly maxBatchSize?: number;
		readonly maxConcurrency?: number;
		readonly timeoutMs?: number;
		readonly cachingEnabled?: boolean;
		readonly streamingEnabled?: boolean;
	};
	readonly tags?: readonly string[];
}

export interface UpdateModelRequest {
	readonly description?: string;
	readonly capabilities?: readonly string[];
	readonly inputSchema?: Record<string, unknown>;
	readonly outputSchema?: Record<string, unknown>;
	readonly servingConfig?: RegisterModelRequest["servingConfig"];
	readonly performanceMetrics?: {
		readonly avgLatencyMs?: number;
		readonly p99LatencyMs?: number;
		readonly throughputRps?: number;
		readonly errorRate?: number;
	};
	readonly tags?: readonly string[];
}

export interface DeployModelRequest {
	readonly modelId: string;
	readonly environment: "development" | "staging" | "production";
	readonly replicas?: number;
	readonly minReplicas?: number;
	readonly maxReplicas?: number;
	readonly resourceAllocation?: {
		readonly cpu?: number;
		readonly memoryGiB?: number;
		readonly gpu?: number;
		readonly acceleratorType?: string;
	};
	readonly autoscalingConfig?: {
		readonly targetCpuUtilization?: number;
		readonly targetMemoryUtilization?: number;
		readonly scaleUpCooldownSeconds?: number;
		readonly scaleDownCooldownSeconds?: number;
	};
	readonly healthCheckConfig?: {
		readonly path?: string;
		readonly intervalSeconds?: number;
		readonly timeoutSeconds?: number;
		readonly unhealthyThreshold?: number;
	};
}

export interface WorkloadResources {
	readonly cpu: number;
	readonly memoryGiB: number;
	readonly gpu: number;
	readonly acceleratorType: string;
}

export interface SubmitWorkloadRequest {
	readonly name: string;
	readonly priority: WorkloadPriority;
	readonly schedulingPolicy: SchedulingPolicy;
	readonly containerImage: string;
	readonly command: readonly string[];
	readonly env: Record<string, string>;
	readonly resources: WorkloadResources;
	readonly artifacts: readonly {
		readonly artifactId: string;
		readonly mountPath: string;
		readonly accessMode: "read" | "read-write";
	}[];
	readonly manifest: {
		readonly algorithm: string;
		readonly pqcSignature: string;
		readonly issuedAt: string;
		readonly [key: string]: unknown;
	};
	readonly labels?: Record<string, string>;
}

export interface InferenceRequest {
	readonly modelDeploymentId: string;
	readonly input: Record<string, unknown>;
	readonly provider?: string;
	readonly priority?: WorkloadPriority;
	readonly schedulingPolicy?: SchedulingPolicy;
	readonly command?: readonly string[];
	readonly env?: Record<string, string>;
	readonly resources?: Partial<WorkloadResources>;
}

export interface RegisterArtifactRequest {
	readonly documentId: string;
	readonly version: number;
}

export class AiClient {
	constructor(private readonly internal: Internal) {}

	// ── Model registry ──────────────────────────────────────────────

	registerModel(req: RegisterModelRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/registry/models`, req, opts);
	}

	listModels(query?: RequestOptions["query"]) {
		return this.internal.request("GET", `${PATH_PREFIX}/registry/models`, undefined, { query });
	}

	getModel(modelId: string) {
		return this.internal.request("GET", `${PATH_PREFIX}/registry/models/${modelId}`);
	}

	updateModel(
		modelId: string,
		body: UpdateModelRequest,
		opts?: Pick<RequestOptions, "idempotencyKey">,
	) {
		return this.internal.request("PATCH", `${PATH_PREFIX}/registry/models/${modelId}`, body, opts);
	}

	activateModel(modelId: string, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request(
			"POST",
			`${PATH_PREFIX}/registry/models/${modelId}/activate`,
			{},
			opts,
		);
	}

	deployModel(body: DeployModelRequest, opts?: Pick<RequestOptions, "idempotencyKey">) {
		return this.internal.request("POST", `${PATH_PREFIX}/registry/deployments`, body, opts);
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
